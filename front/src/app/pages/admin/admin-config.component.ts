import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AdminService, LanchoneteConfig } from '../../services/admin.service';
import { ApiService } from '../../services/api.service';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import {
  FONTES_PADRAO,
  TIPOS_LANCHONETE,
  logoPadrao,
  type FonteOpcao,
} from '../../services/lanchonete-visual';
import { DIAS_SEMANA, horaValida, type HorarioDia } from '../../services/horarios';

@Component({
  selector: 'app-admin-config',
  imports: [FormsModule, HeaderLanchoneteComponent, Button, Dialog, InputText, Select, Tag, ToggleSwitch],
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

        @if (c.plano === 'pago') {
          <div class="banner">
            <p-tag value="pago" severity="success" />
            <span>Plano ativo — sem data de vencimento.</span>
          </div>
        } @else {
          <div class="banner">
            @if (c.planoExpirado) {
              <p-tag value="expirado" severity="danger" />
              <span>
                O período de teste da sua lanchonete expirou — você não pode mais receber pedidos.
                Entre em contato com a plataforma para assinar um plano.
              </span>
            } @else {
              <p-tag value="trial" severity="warn" />
              <span>
                Período de teste válido até {{ dataPlano(c.planoExpira) }}. Depois dessa data, para
                continuar recebendo pedidos será preciso assinar um plano.
              </span>
            }
          </div>
        }

        <h2>Dados do proprietário</h2>
        <div class="grid2">
          <label class="campo">
            <span>Nome do proprietário</span>
            <input pInputText type="text" [value]="proprietario()?.nome ?? '—'" disabled />
          </label>
          <label class="campo">
            <span>E-mail do proprietário</span>
            <input pInputText type="text" [value]="proprietario()?.email ?? '—'" disabled />
          </label>
          <label class="campo">
            <span>WhatsApp do proprietário</span>
            <input
              pInputText
              type="text"
              [value]="proprietario()?.telefone ?? '—'"
              placeholder="(00) 00000-0000"
              disabled
            />
          </label>
          <div class="campo">
            <span>&nbsp;</span>
            <p-button
              label="Editar dados"
              icon="pi pi-user-edit"
              severity="secondary"
              [outlined]="true"
              (onClick)="editandoProprietario.set(true)"
            />
          </div>
        </div>

        <p-dialog
          header="Dados do proprietário"
          [(visible)]="editandoProprietario"
          [modal]="true"
          [style]="{ width: 'min(480px, 95vw)' }"
          appendTo="body"
        >
          <form class="proprietario-form" (ngSubmit)="salvarProprietario()" autocomplete="off">
            <div class="grid2">
              <label class="campo">
                <span>Nome do proprietário</span>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="propNome"
                  name="propNome"
                  [disabled]="salvandoProprietario()"
                />
              </label>
              <label class="campo">
                <span>E-mail do proprietário</span>
                <input pInputText type="text" [value]="proprietario()?.email ?? '—'" disabled />
                <small class="dica">
                  Conta usada para criar esta lanchonete. Para alterar o e-mail solicite suporte da
                  plataforma.
                </small>
              </label>
              <label class="campo">
                <span>WhatsApp do proprietário</span>
                <input
                  pInputText
                  type="tel"
                  inputmode="numeric"
                  [(ngModel)]="propTelefone"
                  name="propTelefone"
                  placeholder="(00) 00000-0000"
                  [disabled]="salvandoProprietario()"
                />
              </label>
            </div>
            <div class="produtorio-salvar">
              <p-button
                type="submit"
                [label]="salvandoProprietario() ? 'Salvando…' : 'Salvar'"
                icon="pi pi-check"
                [disabled]="salvandoProprietario()"
              />
              @if (propErro(); as e) {
                <span class="erro-txt">{{ e }}</span>
              }
              @if (propSucesso()) {
                <span class="obs-ok">Dados do proprietário salvos.</span>
              }
            </div>
          </form>
        </p-dialog>

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
            <span class="rotulo-com-dica" [attr.title]="tooltipSlug(c.slug)">
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
        </div>

        <h2>Horário de funcionamento</h2>
        <div class="horarios">
          @for (dia of horarios(); track dia.dia) {
            <div class="linha-horario" [class.linha-horario--fechada]="!dia.aberto">
              <span class="linha-dia">{{ diasSemana[dia.dia] }}</span>
              <div class="linha-controles">
                <p-toggleswitch
                  [ngModel]="dia.aberto"
                  name="horario-{{ dia.dia }}"
                  (ngModelChange)="setHorario(dia.dia, 'aberto', $event)"
                />
                <label class="mini-campo">
                  <span>Início</span>
                  <input
                    type="time"
                    [value]="dia.inicio ?? ''"
                    [disabled]="!dia.aberto"
                    (change)="setHorario(dia.dia, 'inicio', $any($event.target).value)"
                  />
                </label>
                <label class="mini-campo">
                  <span>Fim</span>
                  <input
                    type="time"
                    [value]="dia.fim ?? ''"
                    [disabled]="!dia.aberto"
                    (change)="setHorario(dia.dia, 'fim', $any($event.target).value)"
                  />
                </label>
              </div>
            </div>
          }
        </div>
        <p class="dica">
          Marque os dias de funcionamento e preencha o início e o fim (ex.: 16:00 e 22:00). Use
          00:00 como fim para funcionar até a meia-noite. Fora do horário, os pedidos ficam
          bloqueados na plataforma. Deixe tudo desligado para não bloquear pedidos.
        </p>

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
    .dica {
      margin: -4px 0 0;
      font-size: 0.8rem;
      color: var(--app-texto-suave);
    }
    .produtorio-salvar {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      flex-wrap: wrap;
      margin-top: 2px;

      .erro-txt {
        font-size: 0.85rem;
        color: var(--p-red-500, #ef4444);
        font-weight: 600;
      }
      .obs-ok {
        font-size: 0.85rem;
        color: var(--p-green-500, #22c55e);
        font-weight: 600;
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
    .horarios {
      display: grid;
      gap: 6px;
    }
    .linha-horario {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 12px;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: var(--app-superficie-2);
    }
    .linha-dia {
      flex: 1;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .linha-horario--fechada .linha-dia {
      color: var(--app-texto-suave);
      font-weight: 500;
    }
    .linha-controles {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mini-campo {
      display: grid;
      gap: 3px;

      span {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--app-texto-suave);
      }

      input {
        width: 7.5rem;
        padding: 5px 8px;
        border: 1px solid var(--app-borda);
        border-radius: var(--app-raio-sm);
        background: var(--app-superficie);
        color: var(--app-texto);
        font: inherit;
        font-size: 0.9rem;

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }
    }
    @media (max-width: 600px) {
      .linha-horario {
        flex-wrap: wrap;
        gap: 8px;
      }
      .linha-dia {
        flex: 1 1 100%;
      }
      .linha-controles {
        width: 100%;
        justify-content: space-between;
      }
      .mini-campo input {
        width: 8.5rem;
      }
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
        grid-template-columns: repeat(2, 1fr);
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
  private readonly api = inject(ApiService);

  readonly conf = signal<LanchoneteConfig | null>(null);
  readonly proprietario = signal<{
    nome: string;
    email: string;
    telefone: string | null;
  } | null>(null);
  readonly propNome = signal('');
  readonly propTelefone = signal('');
  readonly salvandoProprietario = signal(false);
  readonly propErro = signal<string | null>(null);
  readonly propSucesso = signal(false);
  readonly editandoProprietario = signal(false);
  salvando = false;
  mensagem = '';
  private slug = '';

  readonly tipos = TIPOS_LANCHONETE;
  readonly diasSemana = DIAS_SEMANA;
  readonly horarios = signal<HorarioDia[]>([]);

  private diasPadrao(): HorarioDia[] {
    return Array.from({ length: 7 }, (_, dia) => ({
      dia,
      aberto: false,
      inicio: null,
      fim: null,
    }));
  }

  dataPlano(data: string | null): string {
    if (!data) return 'sem data';
    return new Date(data).toLocaleDateString('pt-BR');
  }

  setHorario(dia: number, campo: 'aberto' | 'inicio' | 'fim', valor: unknown): void {
    this.horarios.update((dias) =>
      dias.map((d) => {
        if (d.dia !== dia) return d;
        if (campo === 'aberto') return { ...d, aberto: Boolean(valor) };
        const texto = typeof valor === 'string' ? valor : '';
        return campo === 'inicio' ? { ...d, inicio: texto || null } : { ...d, fim: texto || null };
      }),
    );
  }

  private validaHorarios(dias: HorarioDia[]): string | null {
    for (const d of dias) {
      if (!d.aberto) continue;
      if (!horaValida(d.inicio) || !horaValida(d.fim)) {
        return `Preencha o início e o fim (formato HH:MM) de ${DIAS_SEMANA[d.dia]}.`;
      }
      const [hIni, mIni] = d.inicio!.split(':').map(Number);
      const [hFim, mFim] = d.fim!.split(':').map(Number);
      const ini = hIni * 60 + mIni;
      const fim = hFim * 60 + mFim;
      if (!(fim > ini || (fim === 0 && ini > 0))) {
        return `O horário de fim deve ser depois do início em ${DIAS_SEMANA[d.dia]}.`;
      }
    }
    return null;
  }

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
      const conf = await this.admin.getConfig(slug);
      this.conf.set(conf);
      this.horarios.set(
        conf.horarios && conf.horarios.length === 7 ? conf.horarios : this.diasPadrao(),
      );
      void this.carregarProprietario();
    } catch {
      await this.router.navigate(['/admin']);
    }
  }

  private async carregarProprietario(): Promise<void> {
    try {
      const me = await firstValueFrom(
        this.api.get<{
          user: { name?: string | null; email?: string | null };
          cliente?: { telefone?: string | null };
        }>('/me'),
      );
      this.proprietario.set({
        nome: me.user?.name ?? '',
        email: me.user?.email ?? '',
        telefone: me.cliente?.telefone ?? null,
      });
      this.propNome.set(me.user?.name ?? '');
      this.propTelefone.set(me.cliente?.telefone ?? '');
    } catch {
      this.proprietario.set(null);
    }
  }

  async salvarProprietario(): Promise<void> {
    this.salvandoProprietario.set(true);
    this.propErro.set(null);
    this.propSucesso.set(false);
    try {
      const telefone = this.propTelefone().trim();
      await firstValueFrom(
        this.api.patch('/me', {
          nome: this.propNome().trim(),
          ...(telefone ? { telefone } : { telefone: null }),
        }),
      );
      this.proprietario.update((p) =>
        p
          ? {
              ...p,
              nome: this.propNome().trim(),
              telefone: telefone || null,
            }
          : p,
      );
      this.propSucesso.set(true);
      setTimeout(() => this.propSucesso.set(false), 2500);
    } catch (error) {
      this.propErro.set(
        (error as { error?: { message?: string } }).error?.message ?? 'Falha ao salvar',
      );
    } finally {
      this.salvandoProprietario.set(false);
    }
  }

  async salvar() {
    if (!this.conf()) return;
    this.salvando = true;
    this.mensagem = '';
    const erroHorarios = this.validaHorarios(this.horarios());
    if (erroHorarios) {
      this.mensagem = erroHorarios;
      this.salvando = false;
      return;
    }
    try {
      const atualizada = await this.admin.updateConfig(this.slug, {
        ...(this.conf() as unknown as Record<string, unknown>),
        horarios: this.horarios(),
      } as unknown as Record<string, unknown>);
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
