// Utilitários do WhatsApp (Meta Cloud API). Números de destino são brasileiros
// (assumimos DDD): normaliza para E.164 com o DDI do Brasil (+55).

export function normalizarNumeroWhatsApp(numero: unknown): string {
  if (typeof numero !== 'string') {
    throw new Error('Número de WhatsApp inválido.');
  }
  const digitos = numero.replace(/\D/g, '');
  let e164 = digitos;
  if (/^\d{10,11}$/.test(digitos) && !digitos.startsWith('55')) {
    e164 = `55${digitos}`;
  }
  if (!/^55\d{10,11}$/.test(e164)) {
    throw new Error(
      'Número de WhatsApp inválido (informe o DDD + número, ex.: 27999999999).',
    );
  }
  return e164;
}