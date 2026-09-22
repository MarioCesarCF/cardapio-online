import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
import { ConfigService } from '@nestjs/config';
import { decodeProtectedHeader, importJWK, jwtVerify, SignJWT } from 'jose';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';

const APP_ISSUER = 'cardapio-online';

interface NeonJwtClaims {
  sub?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  role?: string | null;
  banned?: boolean | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly issuer: string;
  private readonly keys = new Map<string, CryptoKey>();
  private readonly appSecret: string;
  private readonly appKey: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.issuer = config.get<string>('NEON_AUTH_ISSUER', '');
    this.appSecret = config.get<string>('APP_JWT_SECRET', '');
    this.appKey = new TextEncoder().encode(this.appSecret);
  }

  // No navegador, o SDK da Neon não enxerga o header `set-auth-jwt` (CORS) e a
  // session.token retornada é o token OPACO do cookie (HttpOnly). Este endpoint
  // resolve esse token no neon_auth.session e emite um JWT HS256 próprio da API,
  // que o front usa como Bearer dali em diante.
  async verificarEmailExistente(
    emailInput: string,
  ): Promise<{ registrado: boolean }> {
    const email = typeof emailInput === 'string' ? emailInput.trim() : '';
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('E-mail inválido.');
    }
    const rows = await this.prisma.$queryRaw<{ existe: number }[]>`
      SELECT 1 AS existe
      FROM neon_auth."user"
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;
    return { registrado: rows.length > 0 };
  }

  async exchangeSessionToken(token: string): Promise<{ token: string }> {
    const opaco = typeof token === 'string' ? token.trim() : '';
    if (!opaco || !this.appKey.length) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    try {
      const rows = await this.prisma.$queryRaw<
        { userId: string; banned: boolean | null }[]
      >`
        SELECT s."userId", u.banned
        FROM neon_auth.session s
        LEFT JOIN neon_auth."user" u ON u.id = s."userId"
        WHERE (s.token = ${opaco} OR s.token LIKE ${`${opaco}.%`})
          AND s."expiresAt" > NOW()
        LIMIT 1
      `;
      const row = rows[0];
      if (!row || row.banned === true) {
        throw new UnauthorizedException('Sessão inválida ou expirada');
      }

      const jwt = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(row.userId)
        .setIssuedAt()
        .setIssuer(APP_ISSUER)
        .setAudience(APP_ISSUER)
        .setExpirationTime('7d')
        .sign(this.appKey);

      return { token: jwt };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.debug(
        `Exchange falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      throw new UnauthorizedException('Não foi possível validar a sessão');
    }
  }

  async validateSession(token: string): Promise<AuthenticatedUser | null> {
    if (this.appKey.length) {
      try {
        const { payload } = await jwtVerify(token, this.appKey, {
          algorithms: ['HS256'],
          issuer: APP_ISSUER,
          audience: APP_ISSUER,
        });
        return await this.buildUser(payload as NeonJwtClaims);
      } catch {
        // cai no caminho legado (JWT EdDSA da Neon)
      }
    }
    return this.validateNeonSession(token);
  }

  private async validateNeonSession(
    token: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      if (!this.issuer) {
        return null;
      }

      const { kid } = decodeProtectedHeader(token);
      if (!kid) {
        return null;
      }

      const key = await this.getKey(kid);
      if (!key) {
        return null;
      }

      const { payload } = await jwtVerify(token, key, {
        algorithms: ['EdDSA'],
        issuer: this.issuer,
        audience: this.issuer,
      });

      return await this.buildUser(payload as NeonJwtClaims);
    } catch (error) {
      this.logger.debug(
        `Sessão inválida: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      return null;
    }
  }

  private async buildUser(
    claims: NeonJwtClaims,
  ): Promise<AuthenticatedUser | null> {
    const id = claims.sub;
    if (typeof id !== 'string') {
      return null;
    }
    if (claims.banned === true) {
      return null;
    }

    const alive = await this.prisma.$queryRaw<{ alive: number }[]>`
      SELECT 1 AS alive
      FROM neon_auth.session
      WHERE "userId" = ${id}::uuid AND "expiresAt" > NOW()
      LIMIT 1
    `;
    if (alive.length === 0) {
      return null;
    }

    return {
      id,
      email: claims.email ?? null,
      name: claims.name ?? null,
      image: claims.image ?? null,
      emailVerified: claims.emailVerified ?? null,
      role: claims.role ?? null,
    };
  }

  private async getKey(kid: string): Promise<CryptoKey | null> {
    const cached = this.keys.get(kid);
    if (cached) {
      return cached;
    }

    const rows = await this.prisma.$queryRaw<{ publicKey: string }[]>`
      SELECT "publicKey" FROM neon_auth.jwks WHERE id = ${kid}::uuid
    `;
    const row = rows[0];
    if (!row) {
      return null;
    }

    try {
      const jwk = JSON.parse(row.publicKey) as {
        kty: string;
        crv: string;
        x: string;
      };
      const key = await importJWK(
        { kty: jwk.kty, crv: jwk.crv, x: jwk.x },
        'EdDSA',
      );
      this.keys.set(kid, key as CryptoKey);
      return key as CryptoKey;
    } catch (error) {
      this.logger.warn(
        `Não foi possível importar a JWK ${kid}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      return null;
    }
  }
}
