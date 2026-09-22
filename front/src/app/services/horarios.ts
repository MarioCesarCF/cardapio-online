// Horários de funcionamento (front). Dia 0 = domingo (Date.getDay()).
// Formato: [{ dia: 0-6, aberto: boolean, inicio: "HH:MM", fim: "HH:MM" }] — dias
// fechados guardam inicio/fim null; fim "00:00" = meia-noite (vira o dia).

export interface HorarioDia {
  dia: number;
  aberto: boolean;
  inicio: string | null;
  fim: string | null;
}

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const DIAS_SEMANA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horaValida(horario: string | null | undefined): boolean {
  return typeof horario === 'string' && HORA_REGEX.test(horario.trim());
}

export function dentroDoHorario(horarios: HorarioDia[] | null | undefined, now: Date): boolean {
  if (!Array.isArray(horarios) || horarios.length === 0) return true;
  const dia = now.getDay();
  const item = horarios.find((h) => h.dia === dia);
  if (!item || !item.aberto || !item.inicio || !item.fim) return false;
  const agora = now.getHours() * 60 + now.getMinutes();
  const inicio = toMinutos(item.inicio);
  const fim = toMinutos(item.fim);
  if (fim > inicio) return agora >= inicio && agora < fim;
  if (fim === 0) return agora >= inicio;
  return agora >= inicio || agora < fim;
}

function toMinutos(horario: string): number {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

function formatarHora(horario: string): string {
  const [h, m] = horario.split(':').map(Number);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function horarioResumo(horarios: HorarioDia[] | null | undefined): string | null {
  if (!Array.isArray(horarios) || horarios.length === 0) return null;
  const periodoPorDia = Array.from({ length: 7 }, (_, dia) => {
    const item = horarios.find((h) => h.dia === dia);
    if (!item || !item.aberto || !item.inicio || !item.fim) return null;
    return { inicio: item.inicio, fim: item.fim };
  });

  const partes: string[] = [];
  let i = 0;
  while (i < 7) {
    const atual = periodoPorDia[i];
    if (atual) {
      let j = i;
      while (
        j < 6 &&
        periodoPorDia[j + 1] &&
        periodoPorDia[j + 1]!.inicio === atual.inicio &&
        periodoPorDia[j + 1]!.fim === atual.fim
      ) {
        j++;
      }
      const rotulo =
        j === i ? DIAS_SEMANA_CURTO[i] : `${DIAS_SEMANA_CURTO[i]} a ${DIAS_SEMANA_CURTO[j]}`;
      partes.push(`${rotulo} ${formatarHora(atual.inicio)}–${formatarHora(atual.fim)}`);
      i = j + 1;
    } else {
      let j = i;
      while (j < 6 && !periodoPorDia[j + 1]) j++;
      const rotulo =
        j === i ? DIAS_SEMANA_CURTO[i] : `${DIAS_SEMANA_CURTO[i]} a ${DIAS_SEMANA_CURTO[j]}`;
      partes.push(`${rotulo} fechado`);
      i = j + 1;
    }
  }
  return partes.join(' · ');
}
