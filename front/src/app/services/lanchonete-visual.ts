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
