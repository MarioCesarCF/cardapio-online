import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AdminService, LanchoneteResumo } from '../../services/admin.service';

@Component({
  selector: 'app-admin-home',
  imports: [FormsModule, RouterLink, Button, InputText, Tag],
  template: `
    <main class="admin-home">
      <header class="admin-home__topo">
        <h1>Minhas lanchonetes</h1>
        <a routerLink="/" class="admin-home__link"
          ><i class="pi pi-arrow-left"></i> Voltar ao site</a
        >
      </header>

@if (!carregando && lanchonetes().length === 0) {
      <form class="card criar superficie" (ngSubmit)="criar()" autocomplete="off">
        <h2>Criar lanchonete</h2>
        <label class="campo">
          <span>Nome</span>
          <input
            pInputText
            type="text"
            [(ngModel)]="novoNome"
            name="nome"
            required
            minlength="2"
            maxlength="50"
            placeholder="Ex.: Sabor da Vila"
          />
        </label>
        <p class="dica">
          O endereço da página é gerado automaticamente a partir do nome (sem acentos). Ele precisa
          ser único: se já existir uma lanchonete com esse nome, você verá a mensagem e poderá
          escolher outro.
        </p>
        <p-button
          type="submit"
          [label]="salvando ? 'Criando…' : 'Criar'"
          icon="pi pi-plus"
          [loading]="salvando"
        />
        @if (mensagem) {
          <p class="aviso"><i class="pi pi-exclamation-circle"></i> {{ mensagem }}</p>
        }
      </form>
    }

      <section class="lista">
        @if (carregando) {
          <p class="suave">Carregando…</p>
        } @else if (lanchonetes().length === 0) {
          <p class="vazio">Você ainda não tem lanchonetes. Crie a sua acima.</p>
        }
        @for (lanchonete of lanchonetes(); track lanchonete.id) {
          <article class="card item superficie">
            <div class="item__info">
              <span class="item__nome">{{ lanchonete.nome }}</span>
              <span class="item__slug">
                /{{ lanchonete.slug }}
                @if (lanchonete.situacao === 'pendente') {
                  <span class="item__pendente">· aguardando aprovação</span>
                }
              </span>
            </div>
            <p-tag [value]="lanchonete.situacao" [severity]="severidade(lanchonete.situacao)" />
            <a class="item__abrir" [routerLink]="['/admin', lanchonete.slug, 'config']">
              Gerenciar <i class="pi pi-arrow-right"></i>
            </a>
          </article>
        }
      </section>
    </main>
  `,
  styles: `
    .admin-home {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px;
    }
    .admin-home__topo {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      flex-wrap: wrap;
      padding-right: 7.5rem;
    }
    .admin-home__link {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--app-texto-suave);

      &:hover {
        color: var(--p-primary-color);
        text-decoration: none;
      }
    }
    .card {
      padding: 16px;
    }
    .criar {
      display: grid;
      gap: 12px;
      margin-top: 8px;
    }
    .criar h2 {
      margin: 0 0 4px;
      font-size: 1.05rem;
    }
    .campo {
      display: grid;
      gap: 4px;

      span {
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--app-texto-suave);
      }
    }
    .aviso {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--p-red-500, #ef4444);
      font-size: 0.85rem;
      margin: 0;
    }
    .dica {
      color: var(--app-texto-suave);
      font-size: 0.82rem;
      margin: 0;
    }
    .lista {
      display: grid;
      gap: 10px;
      margin-top: 24px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .item__info {
      display: grid;
      flex: 1;
    }
    .item__nome {
      font-weight: 700;
    }
    .item__slug {
      color: var(--app-texto-suave);
      font-size: 0.85rem;
    }
    .item__pendente {
      color: var(--p-primary-color);
    }
    .item__abrir {
      font-weight: 600;
      white-space: nowrap;
    }
    .vazio,
    .suave {
      color: var(--app-texto-suave);
    }
  `,
})
export class AdminHomeComponent {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  readonly lanchonetes = signal<LanchoneteResumo[]>([]);
  carregando = true;
  salvando = false;
  mensagem = '';
  novoNome = '';

  severidade(situacao: string): 'success' | 'warn' | 'danger' {
    if (situacao === 'ativa') return 'success';
    if (situacao === 'pendente') return 'warn';
    return 'danger';
  }

  constructor() {
    void this.admin.listMine().then((lista) => {
      this.lanchonetes.set(lista);
      this.carregando = false;
      if (lista.length === 1) {
        void this.router.navigate(['/admin', lista[0].slug, 'config'], { replaceUrl: true });
      }
    });
  }

  async criar() {
    this.salvando = true;
    this.mensagem = '';
    try {
      const criada = await this.admin.createLanchonete({
        nome: this.novoNome.trim().replace(/\s+/g, ' '),
      });
      await this.router.navigate(['/admin', criada.slug, 'config']);
    } catch (error) {
      this.mensagem =
        (error as { error?: { message?: string } }).error?.message ?? 'Não foi possível criar';
      this.salvando = false;
    }
  }
}
