import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { AdminService } from '../../services/admin.service';
import { MarcaService } from '../../services/marca.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button],
  template: `
    <main class="shell">
      <header class="shell__topo">
        <h1>{{ nome() }}</h1>
        <div class="shell__acoes">
          <a class="shell__ver" [href]="'/' + slug()" target="_blank">
            Ver página <i class="pi pi-external-link"></i>
          </a>
          <p-button
            label="Sair"
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            (onClick)="sair()"
          />
        </div>
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

      <nav class="shell__abas">
        <a routerLink="config" routerLinkActive="shell__aba--ativa">
          <i class="pi pi-id-card"></i> Dados cadastrados
        </a>
        <a routerLink="cardapio" routerLinkActive="shell__aba--ativa">
          <i class="pi pi-list"></i> Cardápio
        </a>
        <a routerLink="pedidos" routerLinkActive="shell__aba--ativa">
          <i class="pi pi-receipt"></i> Pedidos
        </a>
      </nav>

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
      gap: 16px;
      flex-wrap: wrap;
      padding-right: 7.5rem;
    }
    .shell__topo h1 {
      font-size: 1.3rem;
      margin: 0;
      flex: 1;
    }
    a {
      text-decoration: none;
    }
    .shell__ver {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--p-primary-color);
      font-weight: 600;
      font-size: 0.9rem;
    }
    .shell__abas {
      display: flex;
      gap: 6px;
      margin: 18px 0 22px;
      padding: 5px;
      border: 1px solid var(--app-borda);
      border-radius: 999px;
      background: var(--app-superficie);
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
    }
    .shell__abas a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 8px 16px;
      border-radius: 999px;
      color: var(--app-texto-suave);
      font-weight: 600;
      white-space: nowrap;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;
    }
    .shell__abas a:hover {
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .shell__aba--ativa {
      color: var(--p-primary-contrast-color, #fff) !important;
      background: var(--p-primary-color);
    }
    .shell__ver:hover {
      text-decoration: none;
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
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);
  private readonly marca = inject(MarcaService);
  private readonly auth = inject(AuthService);

  readonly slug = signal('');
  readonly nome = signal('');
  readonly situacao = signal<'' | 'pendente' | 'ativa' | 'pausada'>('');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.slug.set(slug);
      void this.admin.getConfig(slug).then((config) => {
        this.nome.set(config.nome);
        this.situacao.set(config.situacao ?? '');
        this.marca.aplicar(config.corPrincipal);
      });
    });
  }

  async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
}
