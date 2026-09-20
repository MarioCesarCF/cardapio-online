import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LojasService {
  constructor(private readonly prisma: PrismaService) {}

  async getDiretorio() {
    const lanchonetes = await this.prisma.lanchonete.findMany({
      where: { situacao: 'ativa' },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        slug: true,
        nome: true,
        logoUrl: true,
        tipo: true,
        enderecoLoja: true,
      },
    });

    return lanchonetes;
  }

  async getConfig(slug: string) {
    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { slug, situacao: 'ativa' },
      select: {
        id: true,
        nome: true,
        logoUrl: true,
        fonte: true,
        corPrincipal: true,
        whatsapp: true,
        emailContato: true,
        enderecoLoja: true,
      },
    });

    if (!lanchonete) {
      throw new NotFoundException('Lanchonete não encontrada');
    }

    return lanchonete;
  }

  async getCardapio(slug: string) {
    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { slug, situacao: 'ativa' },
      include: {
        categorias: {
          where: { ativa: true },
          orderBy: [{ posicao: 'asc' }, { nome: 'asc' }],
          include: {
            produtos: {
              where: { ativo: true },
              orderBy: [{ destaque: 'desc' }, { nome: 'asc' }],
              include: {
                grupos: {
                  orderBy: { ordem: 'asc' },
                  include: {
                    grupo: {
                      include: {
                        opcoes: {
                          where: { ativa: true },
                          orderBy: { nome: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lanchonete) {
      throw new NotFoundException('Lanchonete não encontrada');
    }

    return {
      lanchonete: {
        id: lanchonete.id,
        nome: lanchonete.nome,
        logoUrl: lanchonete.logoUrl,
        fonte: lanchonete.fonte,
        corPrincipal: lanchonete.corPrincipal,
        tipo: lanchonete.tipo,
        whatsapp: lanchonete.whatsapp,
        emailContato: lanchonete.emailContato,
        enderecoLoja: lanchonete.enderecoLoja,
      },
      categorias: lanchonete.categorias.map((categoria) => ({
        id: categoria.id,
        nome: categoria.nome,
        imagemUrl: categoria.imagemUrl,
        produtos: categoria.produtos.map((produto) => ({
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          preco: produto.preco.toNumber(),
          imagemUrl: produto.imagemUrl,
          destaque: produto.destaque,
          grupos: produto.grupos.map((pg) => ({
            id: pg.grupo.id,
            nome: pg.grupo.nome,
            tipo: pg.grupo.tipo,
            obrigatorio: pg.grupo.obrigatorio,
            minSelecoes: pg.grupo.minSelecoes,
            maxSelecoes: pg.grupo.maxSelecoes,
            opcoes: pg.grupo.opcoes.map((opcao) => ({
              id: opcao.id,
              nome: opcao.nome,
              precoAdicional: opcao.precoAdicional.toNumber(),
              remove: opcao.remove,
            })),
          })),
        })),
      })),
    };
  }
}
