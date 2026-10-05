// Catálogos e validadores do questionário de encerramento (exit survey).
// São os mesmos slugs/rótulos espelhados em
// front/src/app/services/encerramento.ts — ao mudar, mantenha os dois em
// sincronia (o back valida o slug, o front mostra o rótulo).
//
// Regra de ouro do questionário: ele NUNCA pode virar barreira para encerrar a
// conta. As validações abaixo existem só para o dado entrar limpo no banco;
// responder ou não é decisão de quem está saindo (o front sempre oferece pular).

export const PERFIS_ENCERRAMENTO = ['cliente', 'lanchonete'] as const;
export type PerfilEncerramento = (typeof PERFIS_ENCERRAMENTO)[number];

// Motivo principal do cliente.
export const MOTIVOS_CLIENTE = [
  'nao_uso_mais',
  'nao_pedo_online',
  'problema_pedido',
  'problema_lanchonete',
  'dificuldade_uso',
  'notificacoes',
  'nao_quero_conta',
  'outra_forma',
  'outro',
] as const;

// Motivo principal da lanchonete.
export const MOTIVOS_LANCHONETE = [
  'sem_pedidos',
  'preco',
  'outra_plataforma',
  'dificuldade_uso',
  'falta_recurso',
  'problemas_tecnicos',
  'problemas_pagamento',
  'atendimento',
  'fechei_lanchonete',
  'nao_preciso',
  'temporario',
  'outro',
] as const;

// "O que mais influenciou sua decisão?" — até 3 (perfil lanchonete).
export const FATORES_LANCHONETE = [
  'preco',
  'quantidade_pedidos',
  'facilidade_uso',
  'config_cardapio',
  'recebimento_pedidos',
  'pagamentos',
  'entregas',
  'divulgacao',
  'relatorios',
  'personalizacao',
  'atendimento',
  'recursos_faltantes',
  'problemas_tecnicos',
  'outro',
] as const;

// "O Peditto ajudou sua lanchonete a receber pedidos?" (perfil lanchonete).
export const AJUDOU_PEDIDOS = [
  'ajudou_bastante',
  'ajudou_um_pouco',
  'sem_diferenca',
  'nao_consegui',
  'nao_usei_bem',
] as const;

// "Qual valor mensal você consideraria adequado?" — só quando o motivo
// principal é "preco".
export const PRECO_ADEQUADO = [
  'ate_29',
  'faixa_30_49',
  'faixa_50_69',
  'faixa_70_99',
  'cem_ou_mais',
  'nao_sei',
] as const;

export const VOLTARIA = ['sim', 'talvez', 'nao'] as const;

export const MAX_SECUNDARIOS = 3;
export const MAX_TEXTO = 1000;
export const MAX_CONTATO = 120;

export interface RespostaEncerramentoInput {
  motivoPrincipal?: unknown;
  motivosSecundarios?: unknown;
  ajudouPedidos?: unknown;
  precoAdequado?: unknown;
  funcionalidadeFaltante?: unknown;
  satisfacao?: unknown;
  voltaria?: unknown;
  contatoLiberado?: unknown;
  contato?: unknown;
  melhorar?: unknown;
  paraContinuar?: unknown;
  experiencia?: unknown;
}

export interface RespostaValidada {
  motivoPrincipal: string;
  motivosSecundarios: string[];
  ajudouPedidos: string | null;
  precoAdequado: string | null;
  funcionalidadeFaltante: string | null;
  satisfacao: number | null;
  voltaria: string | null;
  contatoLiberado: boolean;
  contato: string | null;
  melhorar: string | null;
  paraContinuar: string | null;
  experiencia: string | null;
}

function catalogo<T extends readonly string[]>(
  valores: T,
): ReadonlySet<string> {
  return new Set<string>(valores);
}

// Remove dado pessoal que a pessoa digita no campo aberto ("meu telefone é...").
// Não é para ser esperto: é para o texto livre não virar uma segunda lista de
// contatos que ninguém pediu para guardar. E-mail, telefone, documento e
// qualquer sequência longa de dígitos saem; o resto do texto fica.
//
// A ordem importa: `RE_DIGITOS` roda ANTES do telefone/documento porque eles
// casam por prefixes e deixavam a cauda de um número/protocolo sobreviver
// ("protocolo 99887[dado removido]"). Quem tem 8+ dígitos seguido vira a marca
// inteira; telefone e documento só pegam o que estiver mascarado (`(11) 9xxxx-xxxx`,
// `123.456.789-00`), e com os guards `(?<!\d)`/`(?!\d)` não arrancam o meio de
// uma sequência maior.
const MARCA = '[dado removido]';
const RE_EMAIL = /[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[^\s@<>()[\],;:]{2,}/g;
const RE_DIGITOS = /\d{8,}/g;
const RE_DOCUMENTO =
  /(?<!\d)\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}(?!\d)/g;
const RE_TELEFONE =
  /(?<!\d)(?:\+?55\s*)?(?:\(\d{2}\)|\d{2})[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g;

function redigeDadoPessoal(texto: string): string {
  return (
    texto
      // E-mail primeiro: tem letra e ponto, e os números de dentro dele (um
      // número de telefone no domínio) já saem com ele.
      .replace(RE_EMAIL, MARCA)
      .replace(RE_DIGITOS, MARCA)
      .replace(RE_DOCUMENTO, MARCA)
      .replace(RE_TELEFONE, MARCA)
  );
}

const CATALOGOS = {
  cliente: catalogo(MOTIVOS_CLIENTE),
  lanchonete: catalogo(MOTIVOS_LANCHONETE),
  fatores: catalogo(FATORES_LANCHONETE),
  ajudou: catalogo(AJUDOU_PEDIDOS),
  preco: catalogo(PRECO_ADEQUADO),
  voltaria: catalogo(VOLTARIA),
};

// WhatsApp brasileiro: reaproveita a mesma normalização do envio de pedidos
// (back/src/whatsapp/whatsapp.utils.ts) para o contato sair gravado em E.164.
const SO_DIGITOS_E_SIMBOLOS = /^[\d\s()+.-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizaContato(valor: string): string | null {
  const texto = valor.trim();
  if (texto.length === 0) return null;
  if (texto.length > MAX_CONTATO) {
    throw new Error('Contato muito longo (máximo 120 caracteres).');
  }
  if (EMAIL.test(texto)) return texto.toLowerCase();
  if (!SO_DIGITOS_E_SIMBOLOS.test(texto)) {
    throw new Error('Contato inválido. Informe um e-mail ou WhatsApp com DDD.');
  }
  const digitos = texto.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digitos) && !digitos.startsWith('55'))
    return `+55${digitos}`;
  if (/^55\d{10,11}$/.test(digitos)) return `+${digitos}`;
  throw new Error('Contato inválido. Informe um e-mail ou WhatsApp com DDD.');
}

/**
 * `mensagem` é a mensagem **completa** de erro (o 400 vai direto para a tela).
 * Os campos são validados em vários pontos com nomes diferentes, então a
 * concordância fica a cargo de quem chama em vez de um "inválido." genérico.
 */
function enumObrigatorio(
  valor: unknown,
  valores: ReadonlySet<string>,
  mensagem: string,
): string {
  if (typeof valor !== 'string' || !valores.has(valor)) {
    throw new Error(mensagem);
  }
  return valor;
}

function enumOpcional(
  valor: unknown,
  valores: ReadonlySet<string>,
  mensagem: string,
): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return enumObrigatorio(valor, valores, mensagem);
}

function textoOpcional(valor: unknown, rotuloCampo: string): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new Error(`${rotuloCampo} inválido.`);
  const texto = redigeDadoPessoal(valor.trim());
  if (texto.length === 0) return null;
  if (texto.length > MAX_TEXTO) {
    throw new Error(
      `${rotuloCampo} muito longo (máximo ${MAX_TEXTO} caracteres).`,
    );
  }
  return texto;
}

/**
 * Valida o corpo do questionário de um perfil e devolve os campos prontos para
 * o Prisma. Lança Error com mensagem pt-BR (o service transforma em 400).
 */
export function validaRespostaEncerramento(
  perfil: PerfilEncerramento,
  body: RespostaEncerramentoInput | null | undefined,
): RespostaValidada {
  const dados = body ?? {};

  const ehLanchonete = perfil === 'lanchonete';
  const motivoPrincipal = enumObrigatorio(
    dados.motivoPrincipal,
    CATALOGOS[perfil],
    'Motivo do encerramento inválido.',
  );

  // Fatores secundários: só a lanchonete tem a pergunta, e no máx. 3.
  let motivosSecundarios: string[] = [];
  if (ehLanchonete) {
    if (
      !Array.isArray(dados.motivosSecundarios) ||
      dados.motivosSecundarios.length === 0
    ) {
      throw new Error('Escolha ao menos um item.');
    }
    if (dados.motivosSecundarios.length > MAX_SECUNDARIOS) {
      throw new Error(`Escolha no máximo ${MAX_SECUNDARIOS} itens.`);
    }
    motivosSecundarios = [
      ...new Set(
        dados.motivosSecundarios.map((item) =>
          enumObrigatorio(item, CATALOGOS.fatores, 'Item selecionado inválido.'),
        ),
      ),
    ];
  }

  const ajudouPedidos = ehLanchonete
    ? enumObrigatorio(
        dados.ajudouPedidos,
        CATALOGOS.ajudou,
        'Escolha uma das opções de "o Peditto ajudou".',
      )
    : null;

  // Preço e "funcionalidade que falta" só fazem sentido no motivo correspondente.
  const precoAdequado =
    ehLanchonete && motivoPrincipal === 'preco'
      ? enumObrigatorio(dados.precoAdequado, CATALOGOS.preco, 'Escolha uma faixa de preço.')
      : null;
  const funcionalidadeFaltante =
    ehLanchonete && motivoPrincipal === 'falta_recurso'
      ? textoOpcional(dados.funcionalidadeFaltante, 'Funcionalidade que falta')
      : null;

  // Satisfação: 1..5. No cliente é **obrigatória** (o front marca como tal);
  // na lanchonete é opcional.
  let satisfacao: number | null = null;
  if (dados.satisfacao !== undefined && dados.satisfacao !== null) {
    const nota = Number(dados.satisfacao);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      throw new Error('Avaliação inválida.');
    }
    satisfacao = nota;
  } else if (!ehLanchonete) {
    throw new Error('Escolha uma nota para continuar.');
  }

  const voltaria = enumOpcional(
    dados.voltaria,
    CATALOGOS.voltaria,
    'Resposta inválida.',
  );

  const contatoLiberado = dados.contatoLiberado === true;
  let contato: string | null = null;
  if (contatoLiberado) {
    if (
      dados.contato !== undefined &&
      dados.contato !== null &&
      String(dados.contato).trim() !== ''
    ) {
      contato = normalizaContato(String(dados.contato));
    }
  }

  return {
    motivoPrincipal,
    motivosSecundarios,
    ajudouPedidos,
    precoAdequado,
    funcionalidadeFaltante,
    satisfacao,
    voltaria,
    contatoLiberado,
    contato,
    melhorar: textoOpcional(dados.melhorar, 'Campo "melhorar"'),
    paraContinuar: textoOpcional(dados.paraContinuar, 'Campo "continuar"'),
    experiencia: textoOpcional(dados.experiencia, 'Campo "experiência"'),
  };
}
