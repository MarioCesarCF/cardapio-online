// Horários de funcionamento da lanchonete. Dia 0 = domingo (Date.getDay()).
// Formato: [{ dia: 0-6, aberto: boolean, inicio: "HH:MM", fim: "HH:MM" }].
// Dias fechados guardam inicio/fim null; fim "00:00" representa meia-noite
// (vira o dia, ex.: 22h–00h).

export interface HorarioDia {
  dia: number;
  aberto: boolean;
  inicio: string | null;
  fim: string | null;
}

export function estaDentroDoHorario(
  horarios: HorarioDia[] | null | undefined,
  now: Date,
): boolean {
  if (!Array.isArray(horarios) || horarios.length === 0) {
    return true;
  }
  const dia = now.getDay();
  const item = horarios.find((h) => h.dia === dia);
  // Dia sem horário configurado conta como fechado (evita pedido fora do ar).
  if (!item || !item.aberto || !item.inicio || !item.fim) {
    return false;
  }
  const agoraMin = now.getHours() * 60 + now.getMinutes();
  const inicio = toMinutos(item.inicio);
  const fim = toMinutos(item.fim);
  if (fim > inicio) {
    return agoraMin >= inicio && agoraMin < fim;
  }
  if (fim === 0) {
    // Aberto de inicio até a meia-noite (ex.: 22h–00h).
    return agoraMin >= inicio;
  }
  // Intervalo que atravessa a meia-noite (ex.: 18h–02h).
  return agoraMin >= inicio || agoraMin < fim;
}

export function toMinutos(horario: string): number {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}
