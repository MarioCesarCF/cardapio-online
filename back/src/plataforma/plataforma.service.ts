import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  async emailLojista(): Promise<{ email: string | null }> {
    const config = await this.prisma.configPlataforma.findUnique({
      where: { id: 'global' },
    });
    return { email: config?.emailLojista ?? null };
  }
}
