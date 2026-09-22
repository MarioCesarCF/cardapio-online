import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { AdminService } from '../../services/admin.service';
import type { LanchoneteResumo } from '../../services/admin.service';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import { MarcaService } from '../../services/marca.service';
import { FONTES_PADRAO, TIPOS_LANCHONETE, logoPadrao } from '../../services/lanchonete-visual';

interface EtapaConf {
  nome: string;
  tipo: string | null;
  logoUrl: string | null;
  corPrincipal: string | null;
  fonte: string | null;
  enderecoLoja: string | null;
  whatsapp: string | null;
  emailContato: string | null;
}

const NOME_REGEX = /^[\p{L}\p{N} ]+$/u;

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule, RouterLink, HeaderLanchoneteComponent, Button, InputText, Select],
  template: `
    <main class="ob">
      <a class="ob__voltar" routerLink="/"><i class="pi pi-arrow-left"></i> Início</a>

      <div class="ob__card superficie">
        <h1>Configure sua lanchonete</h1>
        <p class="ob__subtitulo">{{ tituloEtapa }}</p>

        @if (erro()) {
          <p class="ob__erro"><i class="pi pi-exclamation-circle"></i> {{ erro() }}</p>
        }

        @if (etapa() === 1) {
          <form (ngSubmit)="criarLanchonete()" autocomplete="off">
            <label class="ob__campo">
              <span>Nome da lanchonete</span>
              <input
                pInputText
                type="text"
                [(ngModel)]="nome"
                name="nome"
                required
                maxlength="50"
                autofocus
                placeholder="Ex.: Sabor da Vila"
              />
            </label>
            <p class="ob__dica">
              @if (slugPreview()) {
                Sua lanchonete ficará em <strong>/{{ slugPreview() }}</strong> — sem acentos,
                espaços ou caracteres especiais.
              } @else {
                Use letras, números e espaços (máx. 50 caracteres).
              }
            </p>
            <div class="ob__acoes">
              <p-button
                type="submit"
                [label]="salvando() ? 'Criando…' : 'Criar e continuar'"
                icon="pi pi-arrow-right"
                iconPos="right"
                [loading]="salvando()"
                [disabled]="salvando() || !nomeValido()"
              />
            </div>
          </form>
        }

        @if (etapa() === 2) {
          <div class="ob__tipos">
            @for (tipo of tipos; track tipo.valor) {
              <button
                type="button"
                class="ob__tipo"
                [class.ob__tipo--ativo]="conf()?.tipo === tipo.valor"
                (click)="escolherTipo(tipo.valor)"
              >
                <span class="ob__tipo-emoji">{{ tipo.emoji }}</span>
                <span>{{ tipo.rotulo }}</span>
              </button>
            }
          </div>
          <p class="ob__dica">Escolha o tipo para obter uma logo padrão (dá pra trocar depois).</p>
          <div class="ob__acoes">
            <p-button
              type="button"
              label="Continuar"
              icon="pi pi-arrow-right"
              iconPos="right"
              [disabled]="!conf()?.tipo"
              (onClick)="proximaEtapa()"
            />
          </div>
        }

        @if (etapa() === 3) {
          <form class="ob__form" (ngSubmit)="salvarEtapa3()" autocomplete="off">
            <label class="ob__campo">
              <span>Endereço da loja</span>
              <input
                pInputText
                type="text"
                [(ngModel)]="conf()!.enderecoLoja"
                name="enderecoLoja"
                placeholder="Rua, número, bairro"
              />
            </label>
            <div class="ob__grid2">
              <label class="ob__campo">
                <span>WhatsApp (com DDD)</span>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="conf()!.whatsapp"
                  name="whatsapp"
                  placeholder="(11) 99999-9999"
                />
              </label>
              <label class="ob__campo">
                <span>E-mail de contato</span>
                <input
                  pInputText
                  type="email"
                  [(ngModel)]="conf()!.emailContato"
                  name="emailContato"
                  placeholder="loja@exemplo.com"
                />
              </label>
            </div>
            <div class="ob__acoes">
              <p-button
                type="submit"
                [label]="salvando() ? 'Salvando…' : 'Salvar e continuar'"
                icon="pi pi-arrow-right"
                iconPos="right"
                [loading]="salvando()"
              />
            </div>
          </form>
        }

        @if (etapa() === 4) {
          <form class="ob__form" (ngSubmit)="salvarEtapa4()">
            <div class="ob__grid2">
              <label class="ob__campo">
                <span>Cor principal</span>
                <input
                  type="color"
                  [(ngModel)]="conf()!.corPrincipal"
                  name="corPrincipal"
                  (ngModelChange)="aplicarCor($event)"
                />
              </label>
              <label class="ob__campo">
                <span>Fonte do cardápio</span>
                <p-select
                  [options]="fontes"
                  optionLabel="label"
                  optionValue="value"
                  [(ngModel)]="conf()!.fonte"
                  name="fonte"
                  (onChange)="aplicarCor(conf()!.corPrincipal)"
                />
              </label>
            </div>
            <div class="ob__previa">
              <app-header-lanchonete
                [nome]="conf()!.nome"
                [logoUrl]="conf()!.logoUrl"
                [cor]="conf()!.corPrincipal"
                [fonte]="conf()!.fonte"
              />
            </div>
            <div class="ob__acoes">
              <p-button
                type="submit"
                [label]="salvando() ? 'Salvando…' : 'Salvar e finalizar'"
                icon="pi pi-check"
                [loading]="salvando()"
              />
            </div>
          </form>
        }

        @if (etapa() === 5) {
          <div class="ob__previa">
            <app-header-lanchonete
              [nome]="conf()!.nome"
              [logoUrl]="conf()!.logoUrl"
              [cor]="conf()!.corPrincipal"
              [fonte]="conf()!.fonte"
              tamanho="lg"
            />
            <p class="ob__dica">
              Seu cardápio público estará em <strong>/{{ slug() }}</strong
              >.
            </p>
          </div>
          <div class="ob__acoes">
            <p-button
              label="Configurar o cardápio"
              icon="pi pi-arrow-right"
              iconPos="right"
              (onClick)="finalizar()"
            />
            <p-button
              label="Ir para as configurações"
              severity="secondary"
              [outlined]="true"
              (onClick)="finalizar(true)"
            />
          </div>
        }

        <div class="ob__passos">
          @for (passo of passos; track passo) {
            <span class="ob__passo" [class.ob__passo--ativo]="etapa() === passo">{{ passo }}</span>
          }
        </div>
      </div>
    </main>
  `,
  styles: `
    .ob {
      max-width: 560px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }
    .ob__voltar {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--app-texto-suave);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .ob__voltar:hover {
      color: var(--p-primary-color);
    }
    .ob__card {
      padding: 24px;
      margin-top: 12px;
    }
    .ob__card h1 {
      margin: 0 0 2px;
      font-size: 1.5rem;
    }
    .ob__subtitulo {
      margin: 0 0 16px;
      color: var(--app-texto-suave);
      font-size: 0.9rem;
    }
    .ob__erro {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: color-mix(in srgb, var(--p-red-500, #ef4444) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 40%, transparent);
      color: var(--p-red-500, #ef4444);
      padding: 8px 12px;
      border-radius: var(--app-raio-sm);
      font-size: 0.85rem;
    }
    .ob__campo {
      display: grid;
      gap: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      margin-bottom: 12px;

      > span {
        color: var(--app-texto-suave);
      }
    }
    input[type='color'] {
      width: 46px;
      height: 40px;
      padding: 2px;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: var(--app-superficie-2);
      cursor: pointer;
    }
    .ob__grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .ob__dica {
      color: var(--app-texto-suave);
      font-size: 0.82rem;
    }
    .ob__acoes {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .ob__tipos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .ob__tipo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      border: 2px solid var(--app-borda);
      border-radius: var(--app-raio);
      background: var(--app-superficie-2);
      color: var(--app-texto);
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      font-size: 0.95rem;
      transition:
        border-color 0.15s ease,
        background-color 0.15s ease;
    }
    .ob__tipo:hover {
      border-color: color-mix(in srgb, var(--p-primary-color) 55%, var(--app-borda));
    }
    .ob__tipo--ativo {
      border-color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 14%, var(--app-superficie-2));
    }
    .ob__tipo-emoji {
      font-size: 1.6rem;
    }
    .ob__previa {
      margin-top: 16px;
      border: 1px dashed var(--app-borda);
      border-radius: var(--app-raio);
      padding: 8px 16px;
    }
    .ob__passos {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
    }
    .ob__passo {
      width: 10px;
      height: 10px;
      border-radius: 99px;
      background: var(--app-borda);
      text-indent: -9999px;
      overflow: hidden;
    }
    .ob__passo--ativo {
      background: var(--p-primary-color);
    }
    @media (max-width: 560px) {
      .ob__grid2,
      .ob__tipos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OnboardingComponent {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly marca = inject(MarcaService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly tipos = TIPOS_LANCHONETE;
  readonly fontes = FONTES_PADRAO;
  readonly passos = [1, 2, 3, 4, 5];

  readonly etapa = signal(1);
  readonly nome = signal('');
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly conf = signal<EtapaConf | null>(null);
  readonly slug = signal('');

  readonly nomeValido = computed(() => {
    const nome = this.nome().trim().replace(/\s+/g, ' ');
    return nome.length >= 2 && nome.length <= 50 && NOME_REGEX.test(nome);
  });

  readonly slugPreview = computed(() => {
    if (!this.nome().trim()) return '';
    return this.normalizar(this.nome());
  });

  private normalizar(nome: string): string {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  get tituloEtapa(): string {
    switch (this.etapa()) {
      case 1:
        return 'Passo 1 de 5 — Como sua lanchonete vai se chamar?';
      case 2:
        return 'Passo 2 de 5 — Qual o tipo da sua lanchonete?';
      case 3:
        return 'Passo 3 de 5 — Onde encontrar a sua lanchonete';
      case 4:
        return 'Passo 4 de 5 — A cara da sua página';
      default:
        return 'Passo 5 de 5 — Está quase pronto!';
    }
  }

  async criarLanchonete(): Promise<void> {
    if (!this.nomeValido()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const criada: LanchoneteResumo = await this.admin.createLanchonete({
        nome: this.nome().trim().replace(/\s+/g, ' '),
      });
      this.slug.set(criada.slug);
      this.conf.set({
        nome: criada.nome,
        tipo: criada.tipo ?? null,
        logoUrl: criada.logoUrl ?? null,
        corPrincipal: null,
        fonte: null,
        enderecoLoja: null,
        whatsapp: null,
        emailContato: null,
      });
      this.etapa.set(2);
    } catch (error) {
      this.erro.set(this.mensagemDe(error));
    } finally {
      this.salvando.set(false);
    }
  }

  async escolherTipo(tipo: string): Promise<void> {
    const atual = this.conf();
    if (!atual) return;
    this.erro.set(null);
    const novo = { ...atual, tipo, logoUrl: logoPadrao(tipo) };
    this.conf.set(novo);
    try {
      await this.admin.updateConfig(this.slug(), {
        tipo,
        logoUrl: logoPadrao(tipo),
      });
    } catch (error) {
      this.erro.set(this.mensagemDe(error));
    }
  }

  async salvarEtapa3(): Promise<void> {
    const atual = this.conf();
    if (!atual) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      await this.admin.updateConfig(this.slug(), {
        enderecoLoja: atual.enderecoLoja || null,
        whatsapp: atual.whatsapp || null,
        emailContato: atual.emailContato || null,
      });
      this.proximaEtapa();
    } catch (error) {
      this.erro.set(this.mensagemDe(error));
    } finally {
      this.salvando.set(false);
    }
  }

  async salvarEtapa4(): Promise<void> {
    const atual = this.conf();
    if (!atual) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      await this.admin.updateConfig(this.slug(), {
        corPrincipal: atual.corPrincipal || null,
        fonte: atual.fonte || null,
      });
      this.proximaEtapa();
    } catch (error) {
      this.erro.set(this.mensagemDe(error));
    } finally {
      this.salvando.set(false);
    }
  }

  proximaEtapa(): void {
    this.erro.set(null);
    this.etapa.update((etapa) => Math.min(etapa + 1, 5));
  }

  aplicarCor(cor: string | null): void {
    this.marca.aplicar(cor, this.host.nativeElement);
  }

  async finalizar(paraConfig = false): Promise<void> {
    await this.router.navigate(
      paraConfig ? ['/admin', this.slug(), 'config'] : ['/admin', this.slug(), 'cardapio'],
    );
  }

  private mensagemDe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const msg = (error.error as { message?: string } | undefined)?.message;
      return msg ?? 'Não foi possível salvar. Tente novamente.';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Não foi possível salvar. Tente novamente.';
  }
}
