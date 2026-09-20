import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

@Injectable()
export class FavoritasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(user: AuthenticatedUser) {
    await this.ensureCliente(user);
    const favoritas = await this.prisma.lanchoneteFavorita.findMany({
      where: { clienteId: user.id, lanchonete: { situacao: 'ativa' } },
      orderBy: { createdAt: 'desc' },
      include: {
        lanchonete: {
          select: {
            id: true,
            slug: true,
            nome: true,
            logoUrl: true,
            tipo: true,
            enderecoLoja: true,
            whatsapp: true,
            corPrincipal: true,
            fonte: true,
          },
        },
      },
    });

    return favoritas.map((f) => ({
      id: f.lanchoneteId,
      favoritadaEm: f.createdAt,
      lanchonete: f.lanchonete,
    }));
  }

  async favoritar(user: AuthenticatedUser, lanchoneteId: string) {
    const id = this.obrigatoria(lanchoneteId, 'lanchoneteId', 30);
    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { id, situacao: 'ativa' },
      select: { id: true },
    });
    if (!lanchonete) {
      throw new NotFoundException('Lanchonete não encontrada.');
    }
    await this.ensureCliente(user);
    const favorita = await this.prisma.lanchoneteFavorita.upsert({
      where: {
        clienteId_lanchoneteId: { clienteId: user.id, lanchoneteId: id },
      },
      create: { clienteId: user.id, lanchoneteId: id },
      update: {},
    });
    return { ok: true, favoritadaEm: favorita.createdAt };
  }

  async desfavoritar(user: AuthenticatedUser, lanchoneteId: string) {
    const id = this.obrigatoria(lanchoneteId, 'lanchoneteId', 30);
    const removidas = await this.prisma.lanchoneteFavorita.deleteMany({
      where: { clienteId: user.id, lanchoneteId: id },
    });
    return { ok: true, removidas: removidas.count };
  }

  private async ensureCliente(user: AuthenticatedUser): Promise<void> {
    await this.prisma.cliente.upsert({
      where: { id: user.id },
      create: { id: user.id, nome: user.name, email: user.email },
      update: { nome: user.name ?? undefined, email: user.email ?? undefined },
    });
  }

  private obrigatoria(value: unknown, campo: string, max: number): string {
    if (
      typeof value !== 'string' ||
      value.trim().length === 0 ||
      value.trim().length > max
    ) {
      throw new BadRequestException(`Campo "${campo}" inválido.`);
    }
    return value.trim();
  }
}
