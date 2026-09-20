import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verificar-email')
  verificarEmail(
    @Body() body: { email?: string },
  ): Promise<{ registrado: boolean }> {
    return this.authService.verificarEmailExistente(body.email ?? '');
  }

  @Post('exchange')
  exchange(@Body() body: { token?: string }): Promise<{ token: string }> {
    return this.authService.exchangeSessionToken(body.token ?? '');
  }
}
