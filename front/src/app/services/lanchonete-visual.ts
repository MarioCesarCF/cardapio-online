import { environment } from '../../environments/environment';

export interface TipoLanchonete {
  valor: string;
  rotulo: string;
  emoji: string;
}

export interface FonteOpcao {
  label: string;
  value: string;
}

export const TIPOS_LANCHONETE: TipoLanchonete[] = [
  { valor: 'lanches', rotulo: 'Lanches', emoji: '🍔' },
  { valor: 'pizzaria', rotulo: 'Pizzaria', emoji: '🍕' },
  { valor: 'sorvetes', rotulo: 'Sorveteria', emoji: '🍨' },
  { valor: 'acai', rotulo: 'Açaí', emoji: '🍧' },
];

export const FONTES_PADRAO: FonteOpcao[] = [
  { label: 'Padrão do sistema', value: '' },
  { label: 'Clássica (Georgia)', value: 'Georgia, serif' },
  { label: 'Serifada (Times)', value: "'Times New Roman', serif" },
  { label: 'Limpa (Arial)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Forte (Trebuchet)', value: "'Trebuchet MS', sans-serif" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Impacto (Impact)', value: 'Impact, sans-serif' },
  { label: 'Máquina (mono)', value: "'Courier New', monospace" },
];

export function logoPadrao(tipo: string): string {
  return `${environment.apiUrl}/assets/logo-${tipo}.svg`;
}

/**
 * O logo realmente exibido de uma lanchonete.
 *
 * Uma versao anterior do front salvava a URL do logo padrao (com o host da API
 * da epoca, em dev `http://localhost:3000/...`) no campo `logoUrl`. Isso quebrava
 * em qualquer outro ambiente -- no celular do dono, no deploy da Vercel, em
 * outra maquina -- porque `localhost` aponta para o proprio aparelho. Aqui
 * qualquer URL que aponte para o asset padrao (`/assets/logo-*.svg`, venha de
 * onde vier) e tratada como "a lanchonete nao tem logo propria" e remontada com
 * o `apiUrl` atual. Logo de verdade (R2, galeria, URL propria) passa direto.
 */
export function resolveLogo(
  logoUrl: string | null | undefined,
  tipo: string | null | undefined,
): string | null {
  const custom = (logoUrl ?? '').trim();
  if (custom && !ehLogoPadrao(custom)) return custom;
  return tipoValido(tipo) ? logoPadrao(tipo as string) : null;
}

/** True quando a URL aponta para o asset de logo padrao da API (qualquer host). */
export function ehLogoPadrao(url: string): boolean {
  return /\/assets\/logo-[a-z]+\.svg(\?.*)?$/i.test(url.trim());
}

function tipoValido(tipo: string | null | undefined): boolean {
  return !!tipo && TIPOS_LANCHONETE.some((t) => t.valor === tipo);
}
