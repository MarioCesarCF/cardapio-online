export const COR_MARCA_PADRAO = '#e8800c';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const PASSOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function hexParaRgb(hex: string): [number, number, number] | null {
  const limpo = hex.trim().replace(/^#/, '');
  const completo =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;
  return [
    parseInt(completo.slice(0, 2), 16),
    parseInt(completo.slice(2, 4), 16),
    parseInt(completo.slice(4, 6), 16),
  ];
}

function rgbParaHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function luminancia(r: number, g: number, b: number): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function hsl(h: number, s: number, l: number): string {
  const sl = Math.max(0, Math.min(100, Math.round(s)));
  const ll = Math.max(0, Math.min(100, Math.round(l)));
  return `hsl(${h} ${sl}% ${ll}%)`;
}

/**
 * Aplica a cor da lanchonete como paleta primária do PrimeNG.
 * Escreve as variáveis inline em <html>, que têm precedência sobre o tema
 * injetado, garantindo que os acentos sigam a marca em claro e escuro.
 */
export function aplicarCorMarca(cor?: string | null): void {
  const rgb = cor ? hexParaRgb(cor) : null;
  const base = rgb ?? (hexParaRgb(COR_MARCA_PADRAO) as [number, number, number]);
  const tom = rgbParaHsl(base[0], base[1], base[2]);
  const raiz = document.documentElement;

  const meio = Math.max(42, Math.min(58, tom.l));
  const niveis: Record<number, { l: number; s: number }> = {
    50: { l: 96, s: tom.s * 0.45 },
    100: { l: 92, s: tom.s * 0.6 },
    200: { l: 83, s: tom.s * 0.75 },
    300: { l: 71, s: tom.s * 0.88 },
    400: { l: 58, s: tom.s * 0.96 },
    500: { l: meio, s: tom.s },
    600: { l: meio - 8, s: tom.s },
    700: { l: meio - 16, s: tom.s },
    800: { l: meio - 24, s: Math.max(0, tom.s - 6) },
    900: { l: meio - 31, s: Math.max(0, tom.s - 12) },
    950: { l: meio - 37, s: Math.max(0, tom.s - 18) },
  };

  for (const passo of PASSOS) {
    const { l, s } = niveis[passo];
    raiz.style.setProperty(`--p-primary-${passo}`, hsl(tom.h, s, l));
  }

  const claro = luminancia(base[0], base[1], base[2]) > 0.55;
  raiz.style.setProperty('--p-primary-contrast-color', claro ? '#101014' : '#ffffff');
  raiz.style.setProperty('--cor-primaria', cor && rgb ? cor : COR_MARCA_PADRAO);
}
