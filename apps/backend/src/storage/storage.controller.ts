import { Body, Controller, Headers, Param, Post, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma.service'
import { StorageDriverService } from './storage.service'
import { verifyUploadTicket, type UploadTicketClaims } from './upload-ticket'

class CreateUploadDto {
  @IsString()
  @IsNotEmpty()
  bizType!: string

  @IsOptional()
  @IsString()
  runId?: string

  @IsOptional()
  @IsString()
  originalName?: string

  @IsOptional()
  @IsString()
  contentType?: string
}

class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  storageKey!: string

  @IsInt()
  size!: number

  @IsString()
  @IsNotEmpty()
  sign!: string

  @IsString()
  @IsNotEmpty()
  expiresAt!: string

  @IsString()
  @IsNotEmpty()
  bizType!: string

  @IsOptional()
  @IsString()
  runId?: string

  @IsOptional()
  @IsString()
  originalName?: string

  @IsOptional()
  @IsString()
  contentType?: string
}

type SignedHeaders = Record<string, string | undefined>

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageDriverService,
  ) {}

  private claims(headers: SignedHeaders, uploadId: string): UploadTicketClaims {
    const storageKey = headers['x-storage-key'] ?? ''
    const bizType = headers['x-biz-type'] ?? ''
    const expiresAt = new Date(Number(headers['x-upload-expires'] ?? '0'))
    return { uploadId, storageKey, bizType, expiresAt }
  }

  @Post('uploads')
  createUpload(@Req() request: { user: { tenantId: string } }, @Body() body: CreateUploadDto) {
    return this.storageService.getDriver().signUploadUrl({
      tenantId: request.user.tenantId,
      bizType: body.bizType,
      runId: body.runId,
      originalName: body.originalName,
      contentType: body.contentType,
    })
  }

  @Put('dev-upload')
  async devUpload(@Req() request: { body?: unknown }, @Headers() headers: SignedHeaders) {
    const uploadId = headers['x-upload-id'] ?? ''
    const claims = this.claims(headers, uploadId)
    if (!verifyUploadTicket(claims, headers['x-upload-sign'])) {
      throw new UnauthorizedException('上传票据无效或已过期')
    }
    const buffer = request.body as Buffer
    if (!Buffer.isBuffer(buffer)) throw new UnauthorizedException('请求体必须是二进制流')
    return this.storageService.getDriver().putObject({
      storageKey: claims.storageKey,
      buffer,
      contentType: headers['x-content-type'] || 'application/octet-stream',
    })
  }

  @Post('uploads/:uploadId/confirm')
  async confirmUpload(
    @Req() request: { user: { tenantId: string } },
    @Param('uploadId') uploadId: string,
    @Body() body: ConfirmUploadDto,
  ) {
    const claims: UploadTicketClaims = { uploadId, storageKey: body.storageKey, bizType: body.bizType, expiresAt: new Date(Number(body.expiresAt)) }
    if (!verifyUploadTicket(claims, body.sign)) {
      throw new UnauthorizedException('确认票据无效或已过期')
    }
    const meta = await this.storageService
      .getDriver()
      .confirmUpload({ uploadId, storageKey: body.storageKey, expectedSize: body.size })
    if (claims.bizType === 'collection' || claims.bizType === 'media') {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          tenantId: request.user.tenantId,
          sourceType: 'upload',
          storageKey: meta.storageKey,
          mimeType: meta.mimeType,
          size: meta.size,
          originalName: body.originalName,
          sourceUrl: null,
        },
      })
      return { assetId: asset.id, kind: 'media', storageKey: meta.storageKey, mimeType: meta.mimeType, size: meta.size }
    }
    const asset = await this.prisma.generatedAsset.create({
      data: {
        tenantId: request.user.tenantId,
        runId: body.runId,
        storageKey: meta.storageKey,
        mimeType: meta.mimeType,
        size: meta.size,
        originalName: body.originalName,
      },
    })
    return { assetId: asset.id, kind: 'generated', storageKey: meta.storageKey, mimeType: meta.mimeType, size: meta.size }
  }
}
