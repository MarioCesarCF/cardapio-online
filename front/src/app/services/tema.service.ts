import { Injectable, signal } from '@angular/core';

const CHAVE = 'cardapio:tema';

@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly escuro = signal(false);

  constructor() {
    this.escuro.set(this.preferenciaInicial());
    this.aplicarClasse();
  }

  alternar(): void {
    this.definir(!this.escuro());
  }

  definir(escuro: boolean): void {
    this.escuro.set(escuro);
    try {
      localStorage.setItem(CHAVE, escuro ? 'escuro' : 'claro');
    } catch {
      /* localStorage indisponível */
    }
    this.aplicarClasse();
  }

  private preferenciaInicial(): boolean {
    let salvo: string | null = null;
    try {
      salvo = localStorage.getItem(CHAVE);
    } catch {
      salvo = null;
    }
    if (salvo === 'escuro') return true;
    if (salvo === 'claro') return false;
    const sistema = window.matchMedia?.('(prefers-color-scheme: dark)');
    return sistema?.matches ?? false;
  }

  private aplicarClasse(): void {
    document.documentElement.classList.toggle('app-dark', this.escuro());
  }
}
