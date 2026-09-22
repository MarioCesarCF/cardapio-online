const CRC_TABLE = (() => {
  const table = Array.from({ length: 256 }, () => 0);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc =
      ((crc << 8) ^ CRC_TABLE[((crc >> 8) ^ payload.charCodeAt(i)) & 0xff]) &
      0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function calcularCrc16(payload: string): string {
  return crc16(payload);
}

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function normalize(value: string, max: number): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ascii.slice(0, max);
}

// CPF válido (módulo 11) — desambigua 11 dígitos entre CPF e telefone móvel.
function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos)) {
    return false;
  }
  if (/^(\d)\1+$/.test(digitos)) {
    return false;
  }
  const somaInicial = (ate: number, base: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(digitos[i]) * (base - i);
    }
    return soma;
  };
  const digito = (soma: number) => ((soma * 10) % 11) % 10;
  const d1 = digito(somaInicial(9, 10));
  const d2 = digito(somaInicial(10, 11));
  return digitos[9] === String(d1) && digitos[10] === String(d2);
}

// Chave PIX para o formato exigido pelos bancos dentro do BR Code (idempotente):
//   - telefone  -> dígitos + DDI 55 (ex.: (11) 99999-9999 -> +5511999999999)
//   - e-mail    -> trim + minúsculas
//   - CPF/CNPJ  -> somente dígitos (CPF é desambiguado de telefone por dígito verificador)
//   - aleatória -> trim
// Nunca logar a chave (dado sensível — ver regras em AGENTS.md).
export function normalizarChavePix(chave: string): string {
  const bruta = chave.trim();
  if (!bruta) {
    return bruta;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruta)) {
    return bruta.toLowerCase();
  }
  const digitos = bruta.replace(/\D/g, '');
  if (digitos.length >= 10 && digitos.length <= 13) {
    if (digitos.length === 11 && cpfValido(digitos)) {
      return digitos;
    }
    const jaTemDdi = digitos.startsWith('55') && digitos.length >= 12;
    return (jaTemDdi ? '+' : '+55') + digitos;
  }
  if (digitos.length === 14) {
    return digitos;
  }
  return bruta;
}

export function gerarBrCode(params: {
  chavePix: string;
  nomeTitular: string;
  cidade?: string;
  valorTotal: number;
  txid?: string;
}): string {
  const chave = normalizarChavePix(params.chavePix);
  const merchantAccount = emv('00', 'br.gov.bcb.pix') + emv('01', chave);
  const txid = params.txid ?? '***';
  const payloadSemCrc =
    emv('00', '01') +
    emv('26', merchantAccount) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', params.valorTotal.toFixed(2)) +
    emv('58', 'BR') +
    emv('59', normalize(params.nomeTitular, 25)) +
    emv('60', normalize(params.cidade ?? 'SAO PAULO', 15)) +
    emv('62', emv('05', txid));
  return payloadSemCrc + emv('63', crc16(payloadSemCrc + '6304'));
}
