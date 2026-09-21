import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { AdminService } from '../../services/admin.service';
import { PedidosRealtimeService } from '../../services/pedidos-realtime.service';
import {
  labelStatus as rotularStatus,
  PEDIDO_STATUSES,
  PEDIDO_STATUS_SEVERIDADE,
  PedidoPainel,
  podeCancelar as podeCancelarStatus,
  proximoStatus as proximo,
} from '../../services/pedido-painel';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-admin-pedidos',
  imports: [CurrencyPipe, DatePipe, FormsModule, Button, Tag, Textarea],
  template: `
    <div class="pedidos">
      @if (indisponivel(); as msg) {
        <div class="indisponivel superficie">
          <i class="pi pi-clock"></i>
          <p><strong>Loja indisponível.</strong> {{ msg }}</p>
        </div>
      } @else {
        <div class="topo">
          <h2>Pedidos</h2>
          <span class="realtime" [class.on]="realtime.conectado()">
            <i
              class="pi"
              [class.pi-circle-fill]="realtime.conectado()"
              [class.pi-circle-off]="!realtime.conectado()"
            ></i>
            {{ realtime.conectado() ? 'ao vivo' : 'reconectando…' }}
          </span>
          <p-button
            label="Atualizar"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            (onClick)="recarregar()"
          />
        </div>

        @if (erro(); as msg) {
          <p class="aviso">{{ msg }}</p>
        }

        @if (novoPedido(); as novo) {
          <div class="banner">
            <span
              >Novo pedido #{{ novo.numero }} —
              <strong>{{ novo.total | currency: 'BRL' }}</strong></span
            >
            <p-button label="Ver" size="small" (onClick)="verNovo()" />
          </div>
        }

        <div class="filtros">
          <button
            type="button"
            class="chip"
            [class.ativa]="filtro() === 'todos'"
            (click)="filtro.set('todos')"
          >
            Todos ({{ pedidos().length }})
          </button>
          @for (status of statuses; track status) {
            <button
              type="button"
              class="chip"
              [class.ativa]="filtro() === status"
              (click)="filtro.set(status)"
            >
              {{ labelStatus(status) }} ({{ contar(status) }})
            </button>
          }
        </div>

        @if (loading()) {
          <p class="status">Carregando…</p>
        } @else if (filtrados().length === 0) {
          <p class="status">Nenhum pedido aqui.</p>
        } @else {
          @for (pedido of filtrados(); track pedido.id) {
            <article class="pedido superficie status-{{ pedido.status }}">
              <header>
                <h3>#{{ pedido.numero }}</h3>
                <p-tag
                  [value]="labelStatus(pedido.status)"
                  [severity]="severidade(pedido.status)"
                />
                <span class="data">{{ pedido.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                <div class="acoes">
                  @if (proximoStatus(pedido.status); as prox) {
                    <p-button
                      [label]="labelStatus(prox)"
                      icon="pi pi-arrow-right"
                      iconPos="right"
                      size="small"
                      [outlined]="true"
                      (onClick)="avancarStatus(pedido)"
                    />
                  }
                  @if (podeCancelar(pedido.status) && cancelandoId() !== pedido.id) {
                    <p-button
                      label="Cancelar pedido"
                      icon="pi pi-times"
                      severity="danger"
                      size="small"
                      [outlined]="true"
                      [text]="true"
                      (onClick)="iniciarCancelamento(pedido)"
                    />
                  }
                </div>
              </header>
              <p class="cliente">
                <strong>{{ pedido.cliente?.nome ?? 'Cliente' }}</strong>
              </p>
              <ul class="itens">
                @for (item of pedido.itens; track item.id) {
                  <li>
                    <div>
                      <strong>{{ item.qtd }}× {{ item.nome }}</strong>
                      @for (opcao of item.opcoes; track opcao.id) {
                        <small class="op">
                          {{ opcao.nome }}
                          @if (opcao.remove) {
                            (remover)
                          } @else if (opcao.precoAdicional > 0) {
                            +{{ opcao.precoAdicional | currency: 'BRL' }}
                          }
                        </small>
                      }
                    </div>
                    <span>{{ item.qtd * item.precoUnit | currency: 'BRL' }}</span>
                  </li>
                }
              </ul>
              @if (pedido.enderecoEntrega; as end) {
                <p class="end">
                  <i class="pi pi-map-marker"></i> {{ end.rua }}, {{ end.numero }}
                  @if (end.complemento) {
                    - {{ end.complemento }}
                  }
                  · {{ end.bairro }} — {{ end.cidade }}/{{ end.uf }}
                </p>
              }
              @if (pedido.observacao) {
                <p class="obs">Obs.: {{ pedido.observacao }}</p>
              }
              @if (pedido.justificativaCancelamento) {
                <p class="obs obs--cancel">
                  <i class="pi pi-times-circle"></i> Motivo do cancelamento:
                  {{ pedido.justificativaCancelamento }}
                </p>
              }
              @if (cancelandoId() === pedido.id) {
                <div class="cancel">
                  <p class="cancel__titulo">
                    <i class="pi pi-times-circle"></i> Cancelar pedido #{{ pedido.numero }}
                  </p>
                  <textarea
                    pTextarea
                    rows="2"
                    placeholder="Motivo do cancelamento (obrigatório)"
                    [(ngModel)]="justificativa"
                    [maxlength]="300"
                  ></textarea>
                  @if (erroCancelamento(); as msg) {
                    <p class="aviso">{{ msg }}</p>
                  }
                  <div class="cancel__acoes">
                    <p-button
                      label="Confirmar cancelamento"
                      severity="danger"
                      size="small"
                      [loading]="salvandoCancelamento()"
                      (onClick)="confirmarCancelamento()"
                    />
                    <p-button
                      label="Voltar"
                      severity="secondary"
                      size="small"
                      [outlined]="true"
                      (onClick)="fecharCancelamento()"
                    />
                  </div>
                </div>
              }
              <footer>
                <span>Total</span>
                <strong>{{ pedido.total | currency: 'BRL' }}</strong>
              </footer>
            </article>
          }
        }
      }
    </div>
  `,
  styles: `
    .pedidos {
      display: grid;
      gap: 14px;
    }
    .topo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .topo h2 {
      font-size: 1.15rem;
      margin: 0;
    }
    .realtime {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      color: var(--app-texto-suave);
    }
    .realtime .pi {
      font-size: 0.6rem;
    }
    .realtime.on {
      color: var(--p-green-500, #22c55e);
    }
    .topo p-button {
      margin-left: auto;
    }
    .aviso {
      color: var(--p-red-500, #ef4444);
      margin: 0;
    }
    .indisponivel {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      padding: 2.25rem 1.25rem;
      text-align: center;

      i {
        font-size: 1.3rem;
        color: var(--p-primary-color);
      }
      p {
        margin: 0;
        color: var(--app-texto-suave);
      }
    }
    .status {
      color: var(--app-texto-suave);
    }
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--app-raio);
      background: color-mix(in srgb, var(--p-primary-color) 16%, var(--app-superficie));
      border: 1px solid color-mix(in srgb, var(--p-primary-color) 40%, transparent);
      color: var(--app-texto);
    }
    .filtros {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chip {
      padding: 6px 12px;
      border: 1px solid var(--app-borda);
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
      font-size: 0.82rem;
      background: var(--app-superficie-2);
      color: var(--app-texto-suave);
      font-weight: 600;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;
    }
    .chip:hover {
      color: var(--p-primary-color);
    }
    .chip.ativa {
      background: var(--p-primary-color);
      border-color: var(--p-primary-color);
      color: var(--p-primary-contrast-color, #fff);
    }
    .pedido {
      padding: 14px;
      border-left: 4px solid var(--app-borda);
    }
    .pedido.status-recebido {
      border-left-color: #1976d2;
    }
    .pedido.status-em_preparo {
      border-left-color: #ed6c02;
    }
    .pedido.status-enviado {
      border-left-color: #9c27b0;
    }
    .pedido.status-entregue {
      border-left-color: var(--p-green-500, #22c55e);
    }
    .pedido.status-finalizado {
      border-left-color: #455a64;
      opacity: 0.85;
    }
    .pedido.status-cancelado {
      border-left-color: var(--p-red-500, #ef4444);
      opacity: 0.7;
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .obs.obs--cancel {
      color: var(--p-red-500, #ef4444);
      font-weight: 600;
    }
    .cancel {
      display: grid;
      gap: 8px;
      margin-top: 10px;
      padding: 10px;
      border: 1px solid var(--p-red-300, #fca5a5);
      border-radius: var(--app-raio);
      background: color-mix(in srgb, var(--p-red-500) 8%, var(--app-superficie));
    }
    .cancel__titulo {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--p-red-600, #dc2626);
    }
    .cancel textarea {
      width: 100%;
    }
    .cancel__acoes {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    header h3 {
      margin: 0;
      font-size: 1.05rem;
    }
    .data {
      color: var(--app-texto-suave);
      font-size: 0.8rem;
      margin-left: auto;
    }
    .cliente {
      margin: 8px 0 0;
      font-size: 0.9rem;
    }
    .itens {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .itens li {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.92rem;
    }
    .op {
      display: block;
      color: var(--app-texto-suave);
      font-size: 0.78rem;
    }
    .end,
    .obs {
      color: var(--app-texto-suave);
      font-size: 0.82rem;
      margin: 8px 0 0;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--app-borda);
    }
    footer span {
      color: var(--app-texto-suave);
      font-size: 0.82rem;
    }
  `,
})
export class AdminPedidosComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);
  readonly realtime = inject(PedidosRealtimeService);

  readonly slug = signal('');
  readonly pedidos = signal<PedidoPainel[]>([]);
  readonly filtro = signal<string>('todos');
  readonly loading = signal(true);
  readonly erro = signal<string | null>(null);
  readonly novoPedido = signal<PedidoPainel | null>(null);
  readonly indisponivel = signal<string | null>(null);
  readonly cancelandoId = signal<string | null>(null);
  readonly justificativa = signal('');
  readonly salvandoCancelamento = signal(false);
  readonly erroCancelamento = signal<string | null>(null);

  readonly statuses = PEDIDO_STATUSES;
  readonly filtrados = computed(() => {
    const f = this.filtro();
    return f === 'todos' ? this.pedidos() : this.pedidos().filter((p) => p.status === f);
  });

  private readonly subs: Subscription[] = [];

  constructor() {
    this.subs.push(
      this.realtime.novosPedidos.subscribe((pedido) => {
        this.pedidos.update((lista) => [pedido, ...lista.filter((p) => p.id !== pedido.id)]);
        this.novoPedido.set(pedido);
      }),
      this.realtime.statusDePedidos.subscribe(({ id }) => {
        if (this.novoPedido()?.id === id) {
          this.novoPedido.set(null);
        }
      }),
    );
    (this.route.parent?.paramMap ?? this.route.paramMap).subscribe((params) =>
      this.iniciar(params.get('slug') ?? ''),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.realtime.desconectar();
  }

  severidade(status: string): TagSeverity {
    return (PEDIDO_STATUS_SEVERIDADE[status as keyof typeof PEDIDO_STATUS_SEVERIDADE] ??
      'secondary') as TagSeverity;
  }

  private async iniciar(slug: string) {
    this.slug.set(slug);
    this.novoPedido.set(null);
    this.loading.set(false);
    try {
      const config = await this.admin.getConfig(slug);
      if (config.situacao !== 'ativa') {
        this.indisponivel.set(
          config.situacao === 'pendente'
            ? 'Sua lanchonete ainda está em análise e não recebe pedidos.'
            : 'Esta lanchonete está pausada e não recebe pedidos no momento.',
        );
        return;
      }
    } catch {
      await this.router.navigate(['/admin']);
      return;
    }
    this.indisponivel.set(null);
    await this.realtime.conectar(slug);
    await this.carregar();
  }

  private async carregar() {
    this.loading.set(true);
    this.erro.set(null);
    try {
      this.pedidos.set(await this.admin.listPedidos(this.slug()));
    } catch {
      await this.router.navigate(['/admin']);
    } finally {
      this.loading.set(false);
    }
  }

  recarregar() {
    this.novoPedido.set(null);
    void this.carregar();
  }

  labelStatus(status: string): string {
    return rotularStatus(status);
  }

  proximoStatus(status: string): string | null {
    return proximo(status);
  }

  contar(status: string): number {
    return this.pedidos().filter((p) => p.status === status).length;
  }

  verNovo() {
    const novo = this.novoPedido();
    if (novo) {
      this.filtro.set(novo.status);
    }
    this.novoPedido.set(null);
  }

  async avancarStatus(pedido: PedidoPainel) {
    const prox = proximo(pedido.status);
    if (!prox) return;
    try {
      const atualizado = await this.admin.updatePedidoStatus(pedido.id, prox);
      this.pedidos.update((lista) => lista.map((p) => (p.id === atualizado.id ? atualizado : p)));
    } catch (error) {
      this.erro.set(
        (error as { error?: { message?: string } }).error?.message ?? 'Falha ao atualizar status.',
      );
    }
  }

  podeCancelar(status: string): boolean {
    return podeCancelarStatus(status);
  }

  iniciarCancelamento(pedido: PedidoPainel) {
    this.cancelandoId.set(pedido.id);
    this.justificativa.set('');
    this.erroCancelamento.set(null);
  }

  fecharCancelamento() {
    this.cancelandoId.set(null);
    this.justificativa.set('');
    this.erroCancelamento.set(null);
  }

  async confirmarCancelamento() {
    const id = this.cancelandoId();
    if (!id) return;
    const motivo = this.justificativa().trim();
    if (motivo.length < 2) {
      this.erroCancelamento.set('Informe o motivo do cancelamento.');
      return;
    }
    this.salvandoCancelamento.set(true);
    this.erroCancelamento.set(null);
    try {
      const atualizado = await this.admin.updatePedidoStatus(id, 'cancelado', motivo);
      this.pedidos.update((lista) => lista.map((p) => (p.id === atualizado.id ? atualizado : p)));
      this.fecharCancelamento();
    } catch (error) {
      this.erroCancelamento.set(
        (error as { error?: { message?: string } }).error?.message ?? 'Falha ao cancelar o pedido.',
      );
    } finally {
      this.salvandoCancelamento.set(false);
    }
  }
}
