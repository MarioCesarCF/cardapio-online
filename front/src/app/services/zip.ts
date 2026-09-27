/**
 * Escritor de ZIP mínimo (sem lib) — o `.xlsx` é um ZIP com XMLs dentro.
 *
 * Por que não usar uma lib (`xlsx`/SheetJS ou `jszip`): o bundle inicial do front já
 * está em cima do budget e nenhuma delas é pequena. Como o ZIP é um formato simples
 * (cabeçalho local + diretório central + fim), dá para escrever em ~120 linhas.
 *
 * Compressão: usa `CompressionStream('deflate-raw')` quando o navegador tem
 * (Chrome/Edge 103+, Safari 16.4+, Firefox 113+). Sem ele, grava sem comprimir
 * (método "store") — o Excel, o WPS, o LibreOffice e o Google Sheets abrem igual,
 * só o arquivo fica maior.
 */

export interface ArquivoZip {
  /** Caminho dentro do zip, ex.: `xl/worksheets/sheet1.xml`. */
  nome: string;
  dados: string | Uint8Array<ArrayBuffer>;
}

const CODIGO_LOCAL = 0x04034b50;
const CODIGO_CENTRAL = 0x02014b50;
const CODIGO_FIM = 0x06054b50;
const METODO_STORE = 0;
const METODO_DEFLATE = 8;
const FLAG_UTF8 = 0x0800;

const codificador = new TextEncoder();

let tabelaCrc: Uint32Array | null = null;

/** CRC-32 (polinômio 0xEDB88320), o mesmo das entradas de ZIP. */
export function crc32(dados: Uint8Array): number {
  if (!tabelaCrc) {
    const tabela = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[i] = c >>> 0;
    }
    tabelaCrc = tabela;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < dados.length; i++) {
    crc = (tabelaCrc[(crc ^ dados[i]) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deflate "cru" (o mesmo do ZIP); `null` se o navegador não tiver a API. */
async function deflateBruto(
  dados: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const Construtor = (
    globalThis as { CompressionStream?: new (formato: string) => TransformStream }
  ).CompressionStream;
  if (!Construtor) return null;
  try {
    const fluxo = new Response(dados).body?.pipeThrough(new Construtor('deflate-raw'));
    if (!fluxo) return null;
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  } catch {
    return null;
  }
}

/** Data/hora no formato MS-DOS que o cabeçalho do ZIP usa (mínimo: 1980). */
function dosDataHora(quando: Date): { hora: number; dia: number } {
  const ano = Math.max(quando.getFullYear(), 1980);
  return {
    hora: (quando.getHours() << 11) | (quando.getMinutes() << 5) | (quando.getSeconds() >> 1),
    dia: ((ano - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate(),
  };
}

function juntar(partes: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const saida = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }
  return saida;
}

/** Texto → bytes (a cópia garante buffer COMMON, que é o que Blob/Response aceitam). */
function paraBytes(valor: string | Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(typeof valor === 'string' ? codificador.encode(valor) : valor);
}

/** Monta o arquivo .zip/.xlsx final (bytes prontos para virar Blob). */
export async function criarZip(
  arquivos: ArquivoZip[],
  quando = new Date(),
): Promise<Uint8Array<ArrayBuffer>> {
  const { hora, dia } = dosDataHora(quando);
  const locais: Uint8Array<ArrayBuffer>[] = [];
  const centrais: Uint8Array<ArrayBuffer>[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = paraBytes(arquivo.nome);
    const dados = paraBytes(arquivo.dados);
    const crc = crc32(dados);
    const comprimido = await deflateBruto(dados);
    const comprime = comprimido !== null && comprimido.length < dados.length;
    const conteudo = comprime ? comprimido : dados;
    const metodo = comprime ? METODO_DEFLATE : METODO_STORE;

    const local = new Uint8Array(30 + nome.length);
    const vLocal = new DataView(local.buffer);
    vLocal.setUint32(0, CODIGO_LOCAL, true);
    vLocal.setUint16(4, 20, true); // versão necessária
    vLocal.setUint16(6, FLAG_UTF8, true); // nomes em UTF-8
    vLocal.setUint16(8, metodo, true);
    vLocal.setUint16(10, hora, true);
    vLocal.setUint16(12, dia, true);
    vLocal.setUint32(14, crc, true);
    vLocal.setUint32(18, conteudo.length, true);
    vLocal.setUint32(22, dados.length, true);
    vLocal.setUint16(26, nome.length, true);
    vLocal.setUint16(28, 0, true); // sem campos extras
    local.set(nome, 30);
    locais.push(local, conteudo);

    const central = new Uint8Array(46 + nome.length);
    const vCentral = new DataView(central.buffer);
    vCentral.setUint32(0, CODIGO_CENTRAL, true);
    vCentral.setUint16(4, 20, true); // versão do criador
    vCentral.setUint16(6, 20, true); // versão necessária
    vCentral.setUint16(8, FLAG_UTF8, true);
    vCentral.setUint16(10, metodo, true);
    vCentral.setUint16(12, hora, true);
    vCentral.setUint16(14, dia, true);
    vCentral.setUint32(16, crc, true);
    vCentral.setUint32(20, conteudo.length, true);
    vCentral.setUint32(24, dados.length, true);
    vCentral.setUint16(28, nome.length, true);
    vCentral.setUint32(42, deslocamento, true);
    central.set(nome, 46);
    centrais.push(central);

    deslocamento += local.length + conteudo.length;
  }

  const central = juntar(centrais);
  const fim = new Uint8Array(22);
  const vFim = new DataView(fim.buffer);
  vFim.setUint32(0, CODIGO_FIM, true);
  vFim.setUint16(8, arquivos.length, true);
  vFim.setUint16(10, arquivos.length, true);
  vFim.setUint32(12, central.length, true);
  vFim.setUint32(16, deslocamento, true);

  return juntar([...locais, central, fim]);
}
