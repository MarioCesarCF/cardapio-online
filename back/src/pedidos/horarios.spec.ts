import { describe, expect, it } from 'vitest';
import { estaDentroDoHorario, type HorarioDia } from './horarios.js';

// 2026-01-04 era domingo (dia 0). Base fixa evita DST/idioma local.
function emDia(dia: number, h: number, m = 0): Date {
  return new Date(2026, 0, 4 + dia, h, m);
}

const SEMANA_BASE = (
  aberto: Partial<Record<number, { inicio: string; fim: string }>> = {},
): HorarioDia[] =>
  Array.from({ length: 7 }, (_, dia) => {
    const periodo = aberto[dia];
    return {
      dia,
      aberto: Boolean(periodo),
      inicio: periodo?.inicio ?? null,
      fim: periodo?.fim ?? null,
    };
  });

describe('estaDentroDoHorario', () => {
  it('sem horarios configurados não bloqueia', () => {
    expect(estaDentroDoHorario(null, emDia(3, 12))).toBe(true);
    expect(estaDentroDoHorario(undefined, emDia(3, 12))).toBe(true);
    expect(estaDentroDoHorario([], emDia(3, 12))).toBe(true);
  });

  it('dia fechado bloqueia', () => {
    const horarios = SEMANA_BASE({ 1: { inicio: '09:00', fim: '18:00' } });
    expect(estaDentroDoHorario(horarios, emDia(3, 12))).toBe(false);
  });

  it('respeita a fronteira de abertura (minuto antes = fechado, no início = aberto)', () => {
    const horarios = SEMANA_BASE({ 2: { inicio: '16:00', fim: '22:00' } });
    expect(estaDentroDoHorario(horarios, emDia(2, 15, 59))).toBe(false);
    expect(estaDentroDoHorario(horarios, emDia(2, 16, 0))).toBe(true);
  });

  it('respeita a fronteira de fechamento (minuto antes = aberto, na hora = fechado)', () => {
    const horarios = SEMANA_BASE({ 2: { inicio: '16:00', fim: '22:00' } });
    expect(estaDentroDoHorario(horarios, emDia(2, 21, 59))).toBe(true);
    expect(estaDentroDoHorario(horarios, emDia(2, 22, 0))).toBe(false);
  });

  it('dia do meio funciona normalmente', () => {
    const horarios = SEMANA_BASE({ 5: { inicio: '10:00', fim: '14:30' } });
    expect(estaDentroDoHorario(horarios, emDia(5, 12, 15))).toBe(true);
    expect(estaDentroDoHorario(horarios, emDia(5, 8, 0))).toBe(false);
  });

  it('vira de dia 22h–00h (fim = meia-noite)', () => {
    const horarios = SEMANA_BASE({ 5: { inicio: '22:00', fim: '00:00' } });
    expect(estaDentroDoHorario(horarios, emDia(5, 21, 59))).toBe(false);
    expect(estaDentroDoHorario(horarios, emDia(5, 23, 30))).toBe(true);
    // Meia-noite pertence ao dia seguinte (fecha às 00:00 em ponto).
    expect(estaDentroDoHorario(horarios, emDia(6, 0, 0))).toBe(false);
  });

  it('intervalo que atravessa a meia-noite (18h–02h) vale em ambos os dias?', () => {
    const horarios = SEMANA_BASE({ 3: { inicio: '18:00', fim: '02:00' } });
    expect(estaDentroDoHorario(horarios, emDia(3, 20, 0))).toBe(true);
    // Depois da meia-noite o dia virou quarta (4) — o mapeamento do helper
    // avalia pelo dia do Date, então madrugada de 00h–02h só entra se o dia
    // seguinte estiver configurado com o mesmo período.
    expect(estaDentroDoHorario(horarios, emDia(4, 1, 0))).toBe(false);
  });

  it('dia sem entrada no array conta como fechado', () => {
    const injetado = [{ dia: 1, aberto: true, inicio: '09:00', fim: '18:00' }];
    expect(estaDentroDoHorario(injetado, emDia(2, 12))).toBe(false);
  });
});
