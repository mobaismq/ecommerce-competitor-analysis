import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from './jwt-auth.guard'
import { AuthService } from './auth.service'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ChangePhoneDto } from './dto/change-phone.dto'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  private readonly authService: AuthService

  constructor(authService?: AuthService) {
    this.authService = authService ?? new AuthService()
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password)
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePassword(@Req() request: { user: { sub: string } }, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(request.user.sub, body.oldPassword, body.newPassword)
  }

  @Post('change-phone')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePhone(@Req() request: { user: { sub: string } }, @Body() body: ChangePhoneDto) {
    return this.authService.changePhone(request.user.sub, body.newPhone)
  }
}
