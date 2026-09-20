import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

export interface CriaEnderecoInput {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep?: string;
  apelido?: string;
  padrao?: boolean;
}

export interface AtualizaPerfilInput {
  nome?: string;
  telefone?: string;
}

type EnderecoDados = CriaEnderecoInput & {
  complemento: string | null;
  cep: string | null;
  apelido: string | null;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: AuthenticatedUser) {
    await this.ensureCliente(user);
    const [lanchonetes, cliente, enderecos, adminSistema] = await Promise.all([
      this.prisma.lanchonete.findMany({
        where: { donoId: user.id },
        select: { id: true, nome: true, slug: true, logoUrl: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cliente.findUnique({ where: { id: user.id } }),
      this.prisma.endereco.findMany({
        where: { clienteId: user.id },
        orderBy: [{ padrao: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.adminSistema.findUnique({ where: { id: user.id } }),
    ]);

    return {
      user,
      lanchonetes,
      cliente,
      enderecos,
      adminSistema: Boolean(adminSistema),
      adminSistemaFuncao: adminSistema?.funcao ?? null,
    };
  }

  async atualizarPerfil(user: AuthenticatedUser, body: AtualizaPerfilInput) {
    await this.ensureCliente(user);
    const dados: { nome?: string; telefone?: string | null } = {};

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome || nome.length > 80) {
        throw new BadRequestException('Campo "nome" inválido.');
      }
      dados.nome = nome;
    }

    if (body.telefone !== undefined) {
      const bruto = body.telefone == null ? '' : String(body.telefone);
      const digitos = bruto.replace(/\D/g, '');
      if (bruto.trim() === '') {
        dados.telefone = null;
      } else if (!digitos || !/^\d{10,13}$/.test(digitos)) {
        throw new BadRequestException(
          'Telefone inválido. Informe o WhatsApp com DDD.',
        );
      } else {
        dados.telefone = digitos;
      }
    }

    if (Object.keys(dados).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar.');
    }

    return this.prisma.cliente.update({ where: { id: user.id }, data: dados });
  }

  async listarEnderecos(user: AuthenticatedUser) {
    return this.prisma.endereco.findMany({
      where: { clienteId: user.id },
      orderBy: [{ padrao: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async criarEndereco(user: AuthenticatedUser, body: CriaEnderecoInput) {
    const dados = this.validaEndereco(body);
    await this.ensureCliente(user);

    return this.prisma.$transaction(async (tx) => {
      if (dados.padrao) {
        await tx.endereco.updateMany({
          where: { clienteId: user.id },
          data: { padrao: false },
        });
      }
      return tx.endereco.create({
        data: {
          clienteId: user.id,
          rua: dados.rua!,
          numero: dados.numero!,
          bairro: dados.bairro!,
          cidade: dados.cidade!,
          uf: dados.uf!,
          complemento: dados.complemento ?? null,
          cep: dados.cep ?? null,
          apelido: dados.apelido ?? null,
          padrao: dados.padrao ?? false,
        },
      });
    });
  }

  async atualizarEndereco(
    user: AuthenticatedUser,
    enderecoId: string,
    body: Partial<CriaEnderecoInput>,
  ) {
    const endereco = await this.prisma.endereco.findFirst({
      where: {
        id: this.obrigatoria(enderecoId, 'enderecoId', 30),
        clienteId: user.id,
      },
    });
    if (!endereco) throw new NotFoundException('Endereço não encontrado.');

    const dados = this.validaEndereco(body, true);
    return this.prisma.$transaction(async (tx) => {
      if (dados.padrao) {
        await tx.endereco.updateMany({
          where: { clienteId: user.id, id: { not: endereco.id } },
          data: { padrao: false },
        });
      }
      return tx.endereco.update({
        where: { id: endereco.id },
        data: dados as Partial<EnderecoDados>,
      });
    });
  }

  async removerEndereco(user: AuthenticatedUser, enderecoId: string) {
    const endereco = await this.prisma.endereco.findFirst({
      where: {
        id: this.obrigatoria(enderecoId, 'enderecoId', 30),
        clienteId: user.id,
      },
    });
    if (!endereco) throw new NotFoundException('Endereço não encontrado.');
    await this.prisma.endereco.delete({ where: { id: endereco.id } });
    return { ok: true };
  }

  async listarPedidos(user: AuthenticatedUser) {
    await this.ensureCliente(user);
    const pedidos = await this.prisma.pedido.findMany({
      where: { clienteId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        lanchonete: { select: { nome: true, slug: true, logoUrl: true } },
        itens: { include: { opcoes: true }, orderBy: { nomeSnapshot: 'asc' } },
      },
    });

    return pedidos.map((p) => ({
      id: p.id,
      numero: p.numero,
      status: p.status,
      subtotal: Number(p.subtotal),
      total: Number(p.total),
      formaPagamento: p.formaPagamento,
      brCodePix: p.brCodePix,
      enderecoEntrega: p.enderecoEntrega,
      observacao: p.observacao,
      lanchonete: p.lanchonete,
      createdAt: p.createdAt,
      itens: p.itens.map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        nome: item.nomeSnapshot,
        precoUnit: Number(item.precoUnit),
        qtd: item.qtd,
        opcoes: item.opcoes.map((op) => ({
          id: op.id,
          opcaoId: op.opcaoId,
          nome: op.nomeSnapshot,
          precoAdicional: Number(op.precoAdicional),
          remove: op.remove,
        })),
      })),
    }));
  }

  private validaEndereco(
    body: Partial<CriaEnderecoInput>,
    parcial = false,
  ): Partial<EnderecoDados> {
    const res: Record<string, unknown> = {};
    const campo = (
      nome: keyof CriaEnderecoInput,
      max: number,
      obrigatorio: boolean,
    ) => {
      const v = body[nome];
      if (v === undefined) {
        if (!parcial && obrigatorio)
          throw new BadRequestException(`Campo "${nome}" é obrigatório.`);
        return;
      }
      if (typeof v !== 'string' || v.trim().length > max) {
        throw new BadRequestException(`Campo "${nome}" inválido.`);
      }
      if (!obrigatorio && v.trim().length === 0) return;
      res[nome] = v.trim();
    };

    campo('rua', 120, true);
    campo('numero', 20, true);
    campo('bairro', 80, true);
    campo('cidade', 80, true);
    campo('uf', 2, true);
    campo('complemento', 80, false);
    campo('cep', 9, false);
    campo('apelido', 40, false);

    if (res.uf != null) {
      const uf = String(res.uf).toUpperCase();
      if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestException('UF inválida.');
      res.uf = uf;
    }
    if (body.padrao !== undefined) res.padrao = Boolean(body.padrao);
    return res;
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

  private obrigatoriaOu(
    value: unknown,
    campo: string,
    max: number,
    parcial: boolean,
  ): string | undefined {
    if (value == null) return undefined;
    if (
      typeof value !== 'string' ||
      value.trim().length === 0 ||
      value.trim().length > max
    ) {
      if (parcial) return undefined;
      throw new BadRequestException(`Campo "${campo}" inválido.`);
    }
    return value.trim();
  }

  private opcional(value: unknown, max: number): string | null {
    if (value == null) return null;
    const texto = String(value).trim();
    return texto.length === 0 || texto.length > max ? null : texto;
  }
}
