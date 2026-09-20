import { Component, input } from '@angular/core';

@Component({
  selector: 'app-header-lanchonete',
  imports: [],
  template: `
    <header
      class="hl"
      [class.hl--lg]="tamanho() === 'lg'"
      [style.--hl-fonte]="fonte() || 'inherit'"
      [style.--hl-cor]="cor() || '#111111'"
    >
      @if (logoUrl(); as logo) {
        <img class="hl__logo" [src]="logo" alt="" />
      }
      <span class="hl__nome">{{ nome() }}</span>
      @if (resumo()) {
        <span class="hl__resumo">{{ resumo() }}</span>
      }
    </header>
  `,
  styles: `
    .hl {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      text-align: center;
      padding: 0.5rem 0 1rem;
    }
    .hl__logo {
      max-height: 4.25rem;
      max-width: 11rem;
      object-fit: contain;
      border-radius: 0.75rem;
    }
    .hl__nome {
      font-family: var(--hl-fonte);
      color: color-mix(in srgb, var(--hl-cor) 82%, var(--app-texto));
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.15;
    }
    .hl__resumo {
      font-family: var(--hl-fonte);
      color: var(--app-texto-suave);
      font-size: 0.9rem;
    }
    .hl--lg .hl__logo {
      max-height: 5.5rem;
      max-width: 14rem;
    }
    .hl--lg .hl__nome {
      font-size: 2rem;
    }
  `,
})
export class HeaderLanchoneteComponent {
  readonly nome = input<string>('');
  readonly logoUrl = input<string | null>(null);
  readonly cor = input<string | null>(null);
  readonly fonte = input<string | null>(null);
  readonly resumo = input<string | null>(null);
  readonly tamanho = input<'md' | 'lg'>('md');
}
