import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { resolveLogo } from '../../services/lanchonete-visual';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet],
  template: `
    <main class="shell">
      <header class="shell__topo">
        @if (logo(); as logo) {
          <img class="shell__logo" [src]="logo" alt="" />
        }
        <h1>{{ nome() }}</h1>
      </header>

      @if (situacao() === 'pendente') {
        <div class="shell__aviso">
          <i class="pi pi-hourglass"></i>
          <p>
            <strong>Aguardando aprovação.</strong> Continue preparando a configuração e o cardápio —
            sua página só fica no ar quando a plataforma aprovar.
          </p>
        </div>
      } @else if (situacao() === 'pausada') {
        <div class="shell__aviso">
          <i class="pi pi-pause-circle"></i>
          <p>
            <strong>Lanchonete pausada.</strong> A página está fora do ar e não recebe pedidos no
            momento.
          </p>
        </div>
      }

      <router-outlet />
    </main>
  `,
  styles: `
    .shell {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 20px 64px;
    }
    .shell__topo {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .shell__topo h1 {
      font-size: 1.35rem;
      margin: 0;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .shell__logo {
      max-height: 2.75rem;
      max-width: 7rem;
      object-fit: contain;
      border-radius: var(--app-raio-sm);
    }
    .shell__aviso {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      margin-top: 16px;
      padding: 0.7rem 1rem;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: color-mix(in srgb, var(--p-primary-color) 8%, var(--app-superficie));

      p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--app-texto-suave);
      }
      i {
        color: var(--p-primary-color);
        margin-top: 2px;
      }
    }
  `,
})
export class AdminShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);

  readonly slug = signal('');
  readonly nome = signal('');
  readonly logo = signal('');
  readonly situacao = signal<'' | 'pendente' | 'ativa' | 'pausada'>('');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.slug.set(slug);
      void this.admin.getConfig(slug).then((config) => {
        this.nome.set(config.nome);
        this.logo.set(resolveLogo(config.logoUrl, config.tipo) ?? '');
        this.situacao.set(config.situacao ?? '');
      });
    });
  }
}
