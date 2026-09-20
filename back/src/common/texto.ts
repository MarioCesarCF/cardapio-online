export const NOME_REGEX = /^[\p{L}\p{N} ]+$/u;

export const TIPOS_LANCHONETE = [
  'lanches',
  'pizzaria',
  'sorvetes',
  'acai',
] as const;

export function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
