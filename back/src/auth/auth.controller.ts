import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';

@Controller('auth')
@Throttle({ default: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Enumeração de e-mails é o vetor mais barato de abusar — mais restrito que
  // o restante do /auth.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
