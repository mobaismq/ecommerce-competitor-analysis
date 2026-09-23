import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { SseStream, type SseReplyLike } from '../common/sse'
import { GenerateDetailWorkflowDto, GenerateImageDto, GeneratePromptsDto, GenerateRetouchPromptDto, ExtractImageTextDto } from './dto/product-sets.dto'
import { ProductSetsService } from './product-sets.service'

@Controller('product-sets')
@UseGuards(JwtAuthGuard)
export class ProductSetsController {
  constructor(private readonly service: ProductSetsService) {}

  @Post('generate-prompts')
  generatePrompts(@Req() request: { user: { tenantId: string } }, @Body() body: GeneratePromptsDto) {
    return this.service.generatePrompts({
      settings: body.settings as never,
      baseText: body.baseText,
      reportText: body.reportText,
      information: body.information,
      promptSlots: body.promptSlots,
      selectedSlots: body.selectedSlots,
    })
  }

  @Post('generate-image')
  generateImage(@Req() request: { user: { tenantId: string; username?: string } }, @Body() body: GenerateImageDto) {
    return this.service.generateImage({
      prompt: body.prompt,
      size: body.size,
      count: body.count,
      jobId: body.jobId,
      image: body.image,
      images: body.images,
      ratio: body.ratio,
      watermark: body.watermark,
      name: body.name,
      slotType: body.slotType,
      productName: body.productName,
      productId: body.productId,
      createdBy: request.user.username,
      tenantId: request.user.tenantId,
    })
  }

  @Post('generate-detail-workflow')
  generateDetailWorkflow(@Req() _request: { user: { tenantId: string } }, @Body() body: GenerateDetailWorkflowDto) {
    return this.service.generateDetailWorkflow({
      settings: body.settings as never,
      baseText: body.baseText,
      reportText: body.reportText,
      promptSlots: body.promptSlots,
    })
  }

  @Post('generate-retouch-prompt')
  generateRetouchPrompt(@Req() _request: { user: { tenantId: string } }, @Body() body: GenerateRetouchPromptDto) {
    return this.service.generateRetouchPrompt({
      settings: body.settings as never,
      slot: body.slot,
      originalPrompt: body.originalPrompt,
      userDirection: body.userDirection,
    })
  }

  @Post('extract-image-text')
  extractImageText(@Req() request: { user: { tenantId: string } }, @Body() body: ExtractImageTextDto) {
    return this.service.extractImageText({ imageUrl: body.imageUrl || body.image || '', tenantId: request.user.tenantId })
  }

  @Post('expand-prompts-stream')
  @UseGuards(JwtAuthGuard)
  async expandPromptsStream(@Req() _request: { user: { tenantId: string } }, @Body() body: GeneratePromptsDto, @Res() reply: any) {
    const stream = new SseStream(reply)
    try {
      const { text, model } = await this.service.expandPrompts({
        settings: body.settings as never,
        baseText: body.baseText,
        reportText: body.reportText,
        information: body.information,
        promptSlots: body.promptSlots,
        selectedSlots: body.selectedSlots,
      })
      stream.send('content', { content: text ?? '', model })
      stream.send('done', { ok: true })
    } catch (error: unknown) {
      stream.error((error as Error)?.message ?? '生成失败')
    } finally {
      stream.end()
    }
  }

  @Get('generated-images')
  list(@Req() request: { user: { tenantId: string } }, @Query('jobId') jobId?: string, @Query('productName') productName?: string) {
    return this.service.listGenerated(request.user.tenantId, jobId, productName)
  }

  @Post('generated-images/delete')
  removeBatch(@Req() request: { user: { tenantId: string } }, @Body() body: { ids?: string[] }) {
    return this.service.removeGeneratedBatch(request.user.tenantId, body?.ids ?? [])
  }

  @Post('generated-images')
  save(@Req() request: { user: { tenantId: string; username?: string } }, @Body() body: { images?: Array<{ name?: string; url?: string; type?: string }>; productName?: string; productId?: string; sizeRatio?: string; platform?: string; runId?: string }) {
    return this.service.saveGenerated(request.user.tenantId, { ...body, createdBy: request.user.username })
  }

  @Delete('generated-images/:id')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.service.removeGenerated(request.user.tenantId, id)
  }

  @Get('main-image-descriptions')
  mainImageDescriptions(@Req() request: { user: { tenantId: string } }, @Query('runId') runId: string) {
    return this.service.mainImageDescriptions(runId, request.user.tenantId)
  }
}