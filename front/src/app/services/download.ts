/**
 * Baixa um arquivo gerado no navegador (planilha, CSV, JSON…).
 * Aceita texto ou bytes (o `.xlsx` é binário) e usa Blob + `<a download>` — funciona
 * no Chrome do celular (iOS abre o visualizador de arquivos em vez de salvar direto;
 * o dono pode "compartilhar" dali).
 */
export function baixarArquivo(nomeArquivo: string, conteudo: BlobPart, mime: string): void {
  const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Espera o navegador iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
