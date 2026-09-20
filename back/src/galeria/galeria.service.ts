import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export const GALERIA_CATEGORIAS = [
  { slug: 'hamburguer', label: 'Hambúrgueres' },
  { slug: 'batata', label: 'Porções / batata frita' },
  { slug: 'sucos', label: 'Sucos' },
  { slug: 'sorvetes', label: 'Sorvetes e sobremesas' },
  { slug: 'acai', label: 'Açaí' },
  { slug: 'pizza', label: 'Pizzas' },
  { slug: 'refrigerantes', label: 'Refrigerantes' },
  { slug: 'cerveja', label: 'Cervejas' },
] as const;

const CATEGORIA_SLUGS = GALERIA_CATEGORIAS.map((c) => c.slug);

@Injectable()
export class GaleriaService {
  constructor(private readonly prisma: PrismaService) {}

  categorias() {
    return GALERIA_CATEGORIAS;
  }

  async list(q?: string, categoria?: string) {
    const where: Prisma.GaleriaImagemWhereInput = {};
    if (categoria) {
      if (
        !CATEGORIA_SLUGS.includes(categoria as (typeof CATEGORIA_SLUGS)[number])
      ) {
        throw new BadRequestException('Categoria de galeria inválida');
      }
      where.categoria = categoria;
    }
    if (q && q.trim()) {
      where.keywords = { has: q.trim().toLowerCase() };
    }

    return this.prisma.galeriaImagem.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    });
  }
}
