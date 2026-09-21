import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AdminService, LanchoneteConfig } from '../../services/admin.service';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import {
  FONTES_PADRAO,
  TIPOS_LANCHONETE,
  logoPadrao,
  type FonteOpcao,
} from '../../services/lanchonete-visual';

@Component({
  selector: 'app-admin-config',
  imports: [FormsModule, HeaderLanchoneteComponent, Button, InputText, Select, Tag, ToggleSwitch],
  template: `
    @if (conf(); as c) {
      <form class="config superficie" (ngSubmit)="salvar()" autocomplete="off">
        <app-header-lanchonete
          [nome]="c.nome"
          [logoUrl]="c.logoUrl"
          [cor]="c.corPrincipal"
          [fonte]="c.fonte"
        />

        @if (c.situacao === 'pendente') {
          <div class="banner">
            <p-tag value="pendente" severity="warn" />
            <span>
              Sua lanchonete está em análise pela plataforma. Continue editando o que quiser — ela
              só entra no ar depois da aprovação.
            </span>
          </div>
        } @else if (c.situacao === 'pausada') {
          <div class="banner">
            <p-tag value="pausada" severity="danger" />
            <span>Lanchonete pausada pela plataforma — a página está fora do ar.</span>
          </div>
        }

        <h2>Identidade</h2>
        <div class="grid2">
          <label class="campo">
            <span>Nome</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="c.nome"
              name="nome"
              required
              minlength="2"
              maxlength="50"
            />
          </label>
          <label class="campo">
            <span>Tipo</span>
            <p-select
              [options]="tipos"
              optionLabel="rotulo"
              optionValue="valor"
              [(ngModel)]="c.tipo"
              name="tipo"
              placeholder="—"
              [showClear]="true"
              (onChange)="usarLogoPadraoSeSemLogo()"
            />
          </label>
        </div>

        <div class="grid2">
          <label class="campo">
            <span
              class="rotulo-com-dica"
              [attr.title]="tooltipSlug(c.slug)"
            >
              Rota de acesso (slug) <i class="pi pi-info-circle"></i>
            </span>
            <span class="slug-linha">
              <input
                pInputText
                type="text"
                [(ngModel)]="c.slug"
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="ex.: minha-lanchonete"
              />
              <p-button
                label="Copiar link"
                icon="pi pi-link"
                severity="secondary"
                [outlined]="true"
                (onClick)="copiarLink()"
              />
            </span>
          </label>
          <label class="campo">
            <span>Logo</span>
            <span class="logo-linha">
              <input
                pInputText
                type="text"
                [(ngModel)]="c.logoUrl"
                name="logoUrl"
                placeholder="https://…"
              />
              <p-button
                label="Padrão"
                icon="pi pi-image"
                severity="secondary"
                [outlined]="true"
                (onClick)="usarLogoPadrao()"
              />
            </span>
          </label>
        </div>

        <div class="grid2">
          <label class="campo">
            <span>Fonte do cardápio</span>
            <p-select
              [options]="fontes()"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="c.fonte"
              name="fonte"
            />
          </label>
          <label class="campo">
            <span>Cor principal</span>
            <span class="cor">
              <input type="color" [(ngModel)]="c.corPrincipal" name="corPrincipal" />
              <input pInputText type="text" [(ngModel)]="c.corPrincipal" name="corPrincipalText" />
            </span>
          </label>
        </div>

        <h2>Contato e entrega</h2>
        <div class="grid2">
          <label class="campo">
            <span>WhatsApp (com DDD)</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="c.whatsapp"
              name="whatsapp"
              placeholder="(11) 99999-9999"
            />
          </label>
          <label class="campo">
            <span>E-mail de contato</span>
            <input
              pInputText
              type="email"
              [(ngModel)]="c.emailContato"
              name="emailContato"
              placeholder="loja@exemplo.com"
            />
          </label>
        </div>
        <label class="campo">
          <span>Endereço da loja</span>
          <input pInputText type="text" [(ngModel)]="c.enderecoLoja" name="enderecoLoja" />
        </label>

        <h2>PIX</h2>
        <div class="grid2">
          <label class="campo">
            <span>Chave PIX</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="c.chavePix"
              name="chavePix"
              placeholder="CPF, e-mail, celular ou aleatória"
            />
          </label>
          <label class="campo">
            <span>Nome do titular</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="c.nomePix"
              name="nomePix"
              placeholder="Como aparece no PIX"
            />
          </label>
        </div>

        <h2>Notificações de pedidos</h2>
        <div class="notifs">
          <label class="check">
            <p-toggleswitch [(ngModel)]="c.notifPainel" name="notifPainel" />
            <span>Painel (tempo real)</span>
          </label>
          <label class="check">
            <p-toggleswitch [(ngModel)]="c.notifWhatsapp" name="notifWhatsapp" />
            <span>WhatsApp</span>
          </label>
          <label class="check">
            <p-toggleswitch [(ngModel)]="c.notifEmail" name="notifEmail" />
            <span>E-mail</span>
          </label>
        </div>

        <div class="acoes">
          <p-button
            type="submit"
            [label]="salvando ? 'Salvando…' : 'Salvar'"
            icon="pi pi-check"
            [loading]="salvando"
          />
          <p-button
            type="button"
            label="Excluir lanchonete"
            icon="pi pi-trash"
            severity="danger"
            [outlined]="true"
            (onClick)="excluir()"
            [disabled]="salvando"
          />
        </div>
        @if (mensagem) {
          <p class="aviso" [class.aviso--ok]="isSucesso">{{ mensagem }}</p>
        }
      </form>
    }
  `,
  styles: `
    .config {
      display: grid;
      gap: 14px;
      padding: 20px;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.65rem 0.9rem;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: color-mix(in srgb, var(--p-primary-color) 8%, var(--app-superficie));

      span {
        font-size: 0.9rem;
        color: var(--app-texto-suave);
      }
    }
    .slug-linha {
      display: flex;
      gap: 8px;
      align-items: center;

      input {
        flex: 1;
        min-width: 0;
      }
    }
    .rotulo-com-dica {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;

      i {
        font-size: 0.85rem;
        color: var(--app-texto-suave);
      }
    }
    .slug-linha p-button button,
    .logo-linha p-button button {
      white-space: nowrap;
    }
    .config h2 {
      font-size: 1.05rem;
      margin: 14px 0 0;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--app-borda);
    }
    .campo {
      display: grid;
      gap: 5px;

      > span {
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--app-texto-suave);
      }
    }
    .logo-linha {
      display: flex;
      gap: 8px;
      align-items: center;

      input {
        flex: 1;
        min-width: 0;
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
    .cor {
      display: flex;
      gap: 8px;

      input[type='text'] {
        flex: 1;
        min-width: 0;
      }
    }
    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .notifs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      font-size: 0.9rem;
      min-width: 0;
    }
    .acoes {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .aviso {
      margin: 0;
      color: var(--p-red-500, #ef4444);
      font-size: 0.85rem;
    }
    .aviso--ok {
      color: var(--p-green-500, #22c55e);
    }
    @media (max-width: 600px) {
      .grid2 {
        grid-template-columns: 1fr;
      }
      .notifs {
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .check {
        font-size: 0.78rem;
        gap: 4px;
      }
    }
  `,
})
export class AdminConfigComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);

  readonly conf = signal<LanchoneteConfig | null>(null);
  salvando = false;
  mensagem = '';
  private slug = '';

  readonly tipos = TIPOS_LANCHONETE;

  tooltipSlug(slug: string): string {
    return (
      `Endereço da sua página na plataforma: /${slug}. ` +
      'Use apenas letras minúsculas e hífens, por exemplo: minha-lanchonete. ' +
      'Você pode alterá-lo aqui a qualquer momento.'
    );
  }

  get isSucesso(): boolean {
    return this.mensagem === 'Salvo!' || this.mensagem === 'Link copiado!';
  }

  readonly fontes = computed<FonteOpcao[]>(() => {
    const atual = this.conf()?.fonte;
    if (atual && !FONTES_PADRAO.some((fonte) => fonte.value === atual)) {
      return [...FONTES_PADRAO, { label: `Personalizada: ${atual}`, value: atual }];
    }
    return FONTES_PADRAO;
  });

  async copiarLink(): Promise<void> {
    const slug = this.conf()?.slug;
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/${slug}`);
      this.mensagem = 'Link copiado!';
      setTimeout(() => {
        if (this.mensagem === 'Link copiado!') this.mensagem = '';
      }, 2500);
    } catch {
      this.mensagem = 'Não foi possível copiar o link.';
    }
  }

  usarLogoPadrao(): void {
    const conf = this.conf();
    if (!conf?.tipo) return;
    conf.logoUrl = logoPadrao(conf.tipo);
  }

  usarLogoPadraoSeSemLogo(): void {
    const conf = this.conf();
    if (conf?.tipo && !conf.logoUrl) {
      conf.logoUrl = logoPadrao(conf.tipo);
    }
  }

  constructor() {
    (this.route.parent?.paramMap ?? this.route.paramMap).subscribe((params) =>
      this.carregar(params.get('slug') ?? ''),
    );
  }

  private async carregar(slug: string) {
    this.slug = slug;
    try {
      this.conf.set(await this.admin.getConfig(slug));
    } catch {
      await this.router.navigate(['/admin']);
    }
  }

  async salvar() {
    if (!this.conf()) return;
    this.salvando = true;
    this.mensagem = '';
    try {
      const atualizada = await this.admin.updateConfig(
        this.slug,
        this.conf() as unknown as Record<string, unknown>,
      );
      this.mensagem = 'Salvo!';
      if (atualizada.slug !== this.slug) {
        await this.router.navigate(['/admin', atualizada.slug, 'config'], { replaceUrl: true });
        this.slug = atualizada.slug;
      }
    } catch (error) {
      this.mensagem =
        (error as { error?: { message?: string } }).error?.message ?? 'Falha ao salvar';
    } finally {
      this.salvando = false;
    }
  }

  async excluir() {
    if (
      !this.conf() ||
      !confirm('Excluir esta lanchonete e todo o cardápio? Essa ação não pode ser desfeita.')
    )
      return;
    this.salvando = true;
    try {
      await this.admin.removeLanchonete(this.slug);
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.mensagem =
        (error as { error?: { message?: string } }).error?.message ?? 'Falha ao excluir';
      this.salvando = false;
    }
  }
}
