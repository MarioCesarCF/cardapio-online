/**
 * Relatório exportável de pedidos — planilha `.xlsx` (OOXML) montada à mão, sem lib.
 *
 * Gerado no front (sem back): o painel já tem os pedidos em memória, então o arquivo
 * respeita o filtro de status e o chip "Histórico/Atuais" sem nova chamada ao back.
 *
 * Por que `.xlsx` de verdade e não mais XML SpreadsheetML: o SpreadsheetML 2003 só abre
 * no Office (o Google Sheets do Android não importa). Um `.xlsx` é um ZIP com XMLs
 * dentro, então escrevemos o pacote aqui (ver `zip.ts`) — mesmo formato que o Excel
 * salva, com data real, número somável e filtro/freeze de cabeçalho.
 *
 * Abas geradas:
 * - "Itens": UMA LINHA POR ITEM (é o que permite somar quantidade/faturamento no Excel);
 * - "Pedidos": uma linha por pedido (visão do dia a dia, com total, pagamento e endereço);
 * - "Informações": o que foi exportado + avisos (ex.: histórico apagado após 30 dias).
 *
 * segurança/LGPD: nunca inclui `chavePix` nem `brCodePix` (ver regra no AGENTS.md).
 * Telefone/endereço entram porque o arquivo é do dono da loja, para os clientes dele.
 */

import { PedidoPainel, labelStatus, rotuloPagamento, tipoEntregaLabel } from './pedido-painel';
import { formatarValor } from './moeda';
import { criarZip, type ArquivoZip } from './zip';

/** MIME do `.xlsx` (o do SpreadsheetML antigo era `application/vnd.ms-excel`). */
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type OrigemRelatorio = 'atuais' | 'historico' | 'ambos';

export interface DadosRelatorio {
  /** Nome da lanchonete (aparece na aba Informações e no nome do arquivo). */
  nomeLanchonete: string;
  slug: string;
  pedidos: PedidoPainel[];
  /** De onde vieram os pedidos: atuais (não arquivados), histórico (arquivados) ou ambos. */
  origem: OrigemRelatorio;
  /** 'todos' ou o status filtrado na tela. */
  filtroStatus: string;
}

const COLUNAS_ITENS = [
  'Pedido',
  'Data',
  'Status',
  'Tipo',
  'Cliente',
  'WhatsApp',
  'Item',
  'Opções',
  'Qtd',
  'Preço unitário',
  'Total do item',
];

const COLUNAS_PEDIDOS = [
  'Pedido',
  'Data',
  'Status',
  'Tipo',
  'Cliente',
  'WhatsApp',
  'Itens',
  'Qtd de itens',
  'Subtotal',
  'Taxa de entrega',
  'Total',
  'Pagamento',
  'PIX confirmado',
  'PIX confirmado em',
  'Endereço de entrega',
  'Observação',
  'Motivo do cancelamento',
];

const AVISO_HISTORICO =
  'O histórico cobre apenas os últimos 30 dias: pedidos com mais de 30 dias são apagados automaticamente.';

const NOTA_PRECOS =
  'Os adicionais escolhidos nas opções já estão incluídos no preço unitário. A taxa de entrega e o total do pedido estão na aba "Pedidos".';

// ---------- estilos (índices de `cellXfs` em ESTILOS_XML) ----------

const ESTILO = {
  geral: 0,
  cabecalho: 1,
  texto: 2,
  textoLongo: 3,
  inteiro: 4,
  moeda: 5,
  data: 6,
  rotulo: 7,
} as const;

// ---------- células ----------

type Celula =
  | { tipo: 'texto'; valor: unknown; estilo: number }
  | { tipo: 'numero'; valor: number | null | undefined; estilo: number }
  | { tipo: 'data'; valor: string | null | undefined }
  | { tipo: 'vazia'; estilo: number };

function colTexto(valor: unknown, estilo: number = ESTILO.texto): Celula {
  return { tipo: 'texto', valor, estilo };
}

function colNumero(valor: number | null | undefined, estilo: number = ESTILO.moeda): Celula {
  return { tipo: 'numero', valor, estilo };
}

function colInteiro(valor: number | null | undefined): Celula {
  return { tipo: 'numero', valor, estilo: ESTILO.inteiro };
}

function colData(iso: string | null | undefined): Celula {
  return { tipo: 'data', valor: iso };
}

function colVazia(estilo: number = ESTILO.texto): Celula {
  return { tipo: 'vazia', estilo };
}

/** Caracteres que o XML 1.0 proíbe (controle) — removidos antes de escapar. */
// eslint-disable-next-line no-control-regex
const CONTROLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Escapa texto para XML. */
function esc(valor: unknown): string {
  return String(valor ?? '')
    .replace(CONTROLES, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Texto de uma célula: quebras de linha viram espaço (não quebra a célula). */
function texto(valor: unknown): string {
  return String(valor ?? '')
    .replace(CONTROLES, '')
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Letra da coluna: 1 → A, 27 → AA (o XML exige o endereço "B12" em cada célula). */
function letraColuna(indice: number): string {
  let numero = indice + 1;
  let letras = '';
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    numero = Math.floor((numero - 1) / 26);
  }
  return letras;
}

/** ISO → número serial do Excel (dias desde 1899-12-30, horário como fração). */
function serialData(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const momento = new Date(iso);
  if (Number.isNaN(momento.getTime())) return null;
  // Usa os componentes locais: é o mesmo dia/hora que o dono vê na tela.
  const local = Date.UTC(
    momento.getFullYear(),
    momento.getMonth(),
    momento.getDate(),
    momento.getHours(),
    momento.getMinutes(),
    momento.getSeconds(),
  );
  const segundos = Math.round((local - Date.UTC(1899, 11, 30)) / 1000);
  return Number((segundos / 86400).toFixed(6));
}

function celulaXml(referencia: string, celula: Celula): string {
  const estilo = celula.tipo === 'data' ? ESTILO.data : celula.estilo;
  if (celula.tipo === 'vazia') return `<c r="${referencia}" s="${estilo}"/>`;
  if (celula.tipo === 'texto') {
    const conteudo = esc(texto(celula.valor));
    // Célula de verdade vazia (não um `<t></t>` sem texto).
    if (!conteudo) return `<c r="${referencia}" s="${estilo}"/>`;
    return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${conteudo}</t></is></c>`;
  }
  if (celula.tipo === 'numero') {
    const valor = celula.valor;
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return `<c r="${referencia}" s="${estilo}"/>`;
    }
    return `<c r="${referencia}" s="${estilo}"><v>${valor}</v></c>`;
  }
  const serial = serialData(celula.valor);
  if (serial === null) return `<c r="${referencia}" s="${estilo}"/>`;
  return `<c r="${referencia}" s="${estilo}"><v>${serial}</v></c>`;
}

// ---------- linhas das abas ----------

function opcoesDe(item: PedidoPainel['itens'][number]): string {
  if (!item.opcoes?.length) return '';
  return item.opcoes
    .map((op) => {
      if (op.remove) return `${op.nome} (sem)`;
      if (op.precoAdicional > 0) return `${op.nome} (+R$ ${formatarValor(op.precoAdicional)})`;
      return op.nome;
    })
    .join(', ');
}

function resumoItens(pedido: PedidoPainel): string {
  if (!pedido.itens?.length) return '';
  return pedido.itens.map((item) => `${item.qtd}x ${item.nome}`).join(' | ');
}

function enderecoDe(pedido: PedidoPainel): string {
  const end = pedido.enderecoEntrega;
  if (!end) return '';
  return [
    `${end.rua}, ${end.numero}`,
    end.complemento,
    end.bairro,
    `${end.cidade}/${end.uf}`,
    end.cep,
  ]
    .filter((parte) => !!parte)
    .join(' · ');
}

function linhasItens(pedidos: PedidoPainel[]): Celula[][] {
  const linhas: Celula[][] = [];
  for (const pedido of pedidos) {
    // Pedido sem item (não deveria existir) ainda ganha uma linha, para não sumir do relatório.
    const itens = pedido.itens?.length ? pedido.itens : [null];
    for (const item of itens) {
      linhas.push([
        colInteiro(pedido.numero),
        colData(pedido.createdAt),
        colTexto(labelStatus(pedido.status)),
        colTexto(tipoEntregaLabel(pedido.tipoEntrega)),
        colTexto(pedido.cliente?.nome ?? ''),
        colTexto(pedido.clienteTelefone ?? ''),
        item ? colTexto(item.nome) : colVazia(),
        item ? colTexto(opcoesDe(item), ESTILO.textoLongo) : colVazia(),
        item ? colInteiro(item.qtd) : colVazia(),
        item ? colNumero(item.precoUnit) : colVazia(),
        item ? colNumero(item.qtd * item.precoUnit) : colVazia(),
      ]);
    }
  }
  return linhas;
}

function linhasPedidos(pedidos: PedidoPainel[]): Celula[][] {
  return pedidos.map((pedido) => [
    colInteiro(pedido.numero),
    colData(pedido.createdAt),
    colTexto(labelStatus(pedido.status)),
    colTexto(tipoEntregaLabel(pedido.tipoEntrega)),
    colTexto(pedido.cliente?.nome ?? ''),
    colTexto(pedido.clienteTelefone ?? ''),
    colTexto(resumoItens(pedido), ESTILO.textoLongo),
    colInteiro((pedido.itens ?? []).reduce((acc, i) => acc + i.qtd, 0)),
    colNumero(pedido.subtotal),
    colNumero(pedido.taxaEntrega),
    colNumero(pedido.total),
    colTexto(rotuloPagamento(pedido.formaPagamento)),
    colTexto(pedido.formaPagamento === 'pix' ? (pedido.pixConfirmado ? 'Sim' : 'Não') : '—'),
    colData(pedido.pixConfirmadoEm),
    colTexto(enderecoDe(pedido), ESTILO.textoLongo),
    colTexto(pedido.observacao, ESTILO.textoLongo),
    colTexto(pedido.justificativaCancelamento ?? '', ESTILO.textoLongo),
  ]);
}

function linhasInformacoes(dados: DadosRelatorio, totalItens: number): Celula[][] {
  const origem =
    dados.origem === 'ambos'
      ? 'Atuais + histórico'
      : dados.origem === 'historico'
        ? 'Histórico'
        : 'Atuais';
  const pares: [string, string][] = [
    ['Lanchonete', dados.nomeLanchonete || dados.slug],
    ['Endereço da loja', `/${dados.slug}`],
    ['Origem dos pedidos', origem],
    [
      'Filtro de status',
      dados.filtroStatus === 'todos' ? 'Todos' : labelStatus(dados.filtroStatus),
    ],
    ['Pedidos no arquivo', String(dados.pedidos.length)],
    ['Linhas de itens no arquivo', String(totalItens)],
    ['Sobre os preços', NOTA_PRECOS],
    [
      'Sobre os dados',
      'Telefone e endereço são os dados dos clientes que você cadastrou nesta loja.',
    ],
  ];
  const linhas: Celula[][] = pares.map(([chave, valor]) => [
    colTexto(chave, ESTILO.rotulo),
    colTexto(valor, ESTILO.textoLongo),
  ]);
  // Datas de verdade (número com formato), não texto ISO.
  linhas.push([colTexto('Exportado em', ESTILO.rotulo), colData(new Date().toISOString())]);
  linhas.push([colTexto('Aviso', ESTILO.rotulo), colTexto(AVISO_HISTORICO, ESTILO.textoLongo)]);
  return linhas;
}

// ---------- pacote OOXML ----------

const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="&quot;R$&quot;#,##0.00"/>
<numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8800C"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

interface Aba {
  nome: string;
  colunas: string[];
  larguras: number[];
  linhas: Celula[][];
  /** Aba de informações: sem freeze nem autofilter (cabeçalho só rotula as colunas). */
  simples?: boolean;
}

function abaXml(aba: Aba, indice: number): string {
  const colunas = aba.colunas.length;
  const totalLinhas = aba.linhas.length + 1;
  const alcance = `A1:${letraColuna(colunas - 1)}${totalLinhas}`;

  const cabecalho = `<row r="1" ht="24" customHeight="1">${aba.colunas
    .map((coluna, i) => celulaXml(`${letraColuna(i)}1`, colTexto(coluna, ESTILO.cabecalho)))
    .join('')}</row>`;

  const corpo = aba.linhas
    .map((celulas, linha) => {
      const numero = linha + 2;
      const dentro = celulas
        .map((celula, coluna) => celulaXml(`${letraColuna(coluna)}${numero}`, celula))
        .join('');
      return `<row r="${numero}">${dentro}</row>`;
    })
    .join('');

  const cols = `<cols>${aba.larguras
    .map((largura, i) => `<col min="${i + 1}" max="${i + 1}" width="${largura}" customWidth="1"/>`)
    .join('')}</cols>`;

  // Aba de tabela: cabeçalho congelado + autofiltro. A de Informações não usa os dois.
  const painel = aba.simples
    ? ''
    : `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>`;
  const filtro = aba.simples ? '' : `<autoFilter ref="${alcance}"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${alcance}"/><sheetViews><sheetView workbookViewId="0"${indice === 0 ? ' tabSelected="1"' : ''}>${painel}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${cabecalho}${corpo}</sheetData>${filtro}</worksheet>`;
}

function contentTypes(abas: number): string {
  const folhas = Array.from(
    { length: abas },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${folhas}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

const RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Peditto</Application></Properties>`;

function coreXml(titulo: string, quando: Date): string {
  const iso = quando.toISOString();
  // A ordem segue o schema de coreProperties (created, creator, lastModifiedBy, modified, title).
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dc:creator>Peditto</dc:creator><cp:lastModifiedBy>Peditto</cp:lastModifiedBy><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified><dc:title>${esc(titulo)}</dc:title></cp:coreProperties>`;
}

/** O Excel recusa nome de aba com `[]:*?/\` ou com mais de 31 caracteres. */
function nomeAba(nome: string): string {
  return nome.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Aba';
}

function workbookXml(abas: Aba[]): string {
  const folhas = abas
    .map(
      (aba, i) => `<sheet name="${esc(nomeAba(aba.nome))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000" activeTab="0"/></bookViews><sheets>${folhas}</sheets></workbook>`;
}

function workbookRelsXml(abas: number): string {
  const folhas = Array.from(
    { length: abas },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${folhas}<Relationship Id="rId${abas + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

/** Gera o arquivo `.xlsx` (bytes) do relatório de pedidos. */
export async function gerarPlanilhaPedidos(
  dados: DadosRelatorio,
): Promise<Uint8Array<ArrayBuffer>> {
  const pedidos = [...dados.pedidos].sort((a, b) => b.numero - a.numero);
  const totalItens = pedidos.reduce((acc, p) => acc + (p.itens?.length ?? 0), 0);

  const abas: Aba[] = [
    {
      nome: 'Itens',
      colunas: COLUNAS_ITENS,
      larguras: [10, 18, 12, 18, 26, 16, 34, 34, 7, 14, 14],
      linhas: linhasItens(pedidos),
    },
    {
      nome: 'Pedidos',
      colunas: COLUNAS_PEDIDOS,
      larguras: [10, 18, 12, 18, 26, 16, 46, 11, 13, 15, 13, 13, 14, 18, 38, 32, 30],
      linhas: linhasPedidos(pedidos),
    },
    {
      nome: 'Informações',
      colunas: ['Campo', 'Valor'],
      larguras: [26, 60],
      linhas: linhasInformacoes(dados, totalItens),
      simples: true,
    },
  ];

  const quando = new Date();
  const arquivos: ArquivoZip[] = [
    { nome: '[Content_Types].xml', dados: contentTypes(abas.length) },
    { nome: '_rels/.rels', dados: RELS_RAIZ },
    {
      nome: 'docProps/core.xml',
      dados: coreXml(`Pedidos - ${dados.nomeLanchonete || dados.slug}`, quando),
    },
    { nome: 'docProps/app.xml', dados: APP_XML },
    { nome: 'xl/workbook.xml', dados: workbookXml(abas) },
    { nome: 'xl/_rels/workbook.xml.rels', dados: workbookRelsXml(abas.length) },
    { nome: 'xl/styles.xml', dados: ESTILOS_XML },
    ...abas.map((aba, i) => ({
      nome: `xl/worksheets/sheet${i + 1}.xml`,
      dados: abaXml(aba, i),
    })),
  ];

  return criarZip(arquivos, quando);
}

/** Nome do arquivo, ex.: `pedidos-duarte-burguers-ambos-20260926-1432.xlsx`. */
export function nomeArquivoRelatorio(
  slug: string,
  origem: OrigemRelatorio,
  data = new Date(),
): string {
  const carimbo =
    `${data.getFullYear()}${pad(data.getMonth() + 1)}${pad(data.getDate())}` +
    `-${pad(data.getHours())}${pad(data.getMinutes())}`;
  const base = slug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'lanchonete';
  return `pedidos-${base}-${origem}-${carimbo}.xlsx`;
}

function pad(valor: number): string {
  return String(valor).padStart(2, '0');
}
