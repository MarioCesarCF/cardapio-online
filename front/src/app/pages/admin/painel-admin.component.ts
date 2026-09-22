import { Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Dialog } from 'primeng/dialog';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  AdminPainel,
  CardapioConsulta,
  LanchoneteConsulta,
  LanchonetePainel,
  LogSistema,
  PainelAdminService,
  PedidoConsulta,
} from '../../services/painel-admin.service';
import { TIPOS_LANCHONETE } from '../../services/lanchonete-visual';
import { labelStatus as labelStatusPedido } from '../../services/pedido-painel';

const SITUACAO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  ativa: 'Ativa',
  pausada: 'Pausada',
};

const SITUACAO_FILTROS = [
  { rotulo: 'Pendente', valor: 'pendente' },
  { rotulo: 'Ativa', valor: 'ativa' },
  { rotulo: 'Pausada', valor: 'pausada' },
];

const TIPOS_FILTROS = TIPOS_LANCHONETE.map((t) => ({
  rotulo: t.rotulo,
  valor: t.valor,
}));

@Component({
  selector: 'app-painel-admin',
  imports: [FormsModule, RouterLink, Button, InputText, Select, Tag, JsonPipe, Dialog],
  template: `
    <main class="pa">
      @if (semAcesso()) {
        <header class="pa__topo">
          <a class="pa__voltar" routerLink="/"><i class="pi pi-arrow-left"></i> Voltar ao site</a>
        </header>
        <p class="pa__erro">Você não tem acesso ao painel administrativo desta plataforma.</p>
      } @else {
        <header class="pa__topo">
          <h1>Painel administrativo da plataforma</h1>
          <p-tag
            [value]="eSuper() ? 'Raiz' : 'Admin'"
            [severity]="eSuper() ? 'warn' : 'secondary'"
          />
          <p-button
            class="pa__sair"
            label="Sair"
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            (onClick)="sair()"
          />
        </header>

        <nav class="pa__abas">
          <button
            type="button"
            class="pa__aba"
            [class.pa__aba--ativa]="aba() === 'lanchonetes'"
            (click)="trocarAba('lanchonetes')"
          >
            Lanchonetes ({{ lanchonetes().length }})
          </button>
          <button
            type="button"
            class="pa__aba"
            [class.pa__aba--ativa]="aba() === 'admins'"
            (click)="trocarAba('admins')"
          >
            Administradores ({{ admins().length }})
          </button>
          <button
            type="button"
            class="pa__aba"
            [class.pa__aba--ativa]="aba() === 'logs'"
            (click)="trocarAba('logs')"
          >
            Logs
          </button>
          <button
            type="button"
            class="pa__aba"
            [class.pa__aba--ativa]="aba() === 'config'"
            (click)="trocarAba('config')"
          >
            Configurações
          </button>
        </nav>

        @if (mensagem()) {
          <p class="pa__erro">{{ mensagem() }}</p>
        }

        @if (consultando(); as l) {
          <section class="pa__consulta superficie">
            <div class="pa__consulta-topo">
              <div>
                <h2>
                  <span class="pa__emoji">{{ tipoDe(l.tipo)?.emoji ?? '🏪' }}</span>
                  {{ l.nome }}
                </h2>
                <p>/{{ l.slug }} · {{ rotuloSituacao(l.situacao) }}</p>
              </div>
              <div class="pa__consulta-acoes">
                @if (l.situacao === 'pendente') {
                  <p-button
                    label="Aprovar"
                    icon="pi pi-check"
                    size="small"
                    severity="success"
                    (onClick)="aprovar(l)"
                  />
                }
                @if (l.situacao === 'ativa') {
                  <p-button
                    label="Pausar"
                    icon="pi pi-pause"
                    size="small"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="pausar(l)"
                  />
                }
                @if (l.situacao === 'pausada') {
                  <p-button
                    label="Reativar"
                    icon="pi pi-play"
                    size="small"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="reativar(l)"
                  />
                }
                @if (l.plano === 'pago') {
                  <p-button
                    label="Marcar como teste"
                    icon="pi pi-refresh"
                    size="small"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="trocarPlanoParaTrial(l)"
                  />
                } @else {
                  <p-button
                    label="Marcar como pago"
                    icon="pi pi-dollar"
                    size="small"
                    severity="success"
                    [outlined]="true"
                    (onClick)="trocarPlanoParaPago(l)"
                  />
                }
                <p-button
                  label="Fechar"
                  icon="pi pi-times"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  (onClick)="fecharConsulta()"
                />
              </div>
            </div>

            @if (consultaCarregando()) {
              <p>Carregando dados da lanchonete…</p>
            } @else {
              @if (consultaDados(); as dados) {
                <div class="pa__consulta-dados">
                  <span><strong>Situação:</strong> {{ rotuloSituacao(dados.situacao) }}</span>
                  <span><strong>Plano:</strong> {{ rotuloPlano(dados) }}</span>
                  <span><strong>Tipo:</strong> {{ rotuloTipo(dados.tipo) }}</span>
                  <span
                    ><strong>Dono:</strong> {{ dados.donoNome || '—' }} ({{
                      dados.donoEmail || '—'
                    }})</span
                  >
                  <span><strong>WhatsApp:</strong> {{ dados.whatsapp || '—' }}</span>
                  <span><strong>E-mail de contato:</strong> {{ dados.emailContato || '—' }}</span>
                  <span><strong>Endereço da loja:</strong> {{ dados.enderecoLoja || '—' }}</span>
                  <span
                    ><strong>PIX:</strong> {{ dados.chavePix || '—' }} ({{
                      dados.nomePix || '—'
                    }})</span
                  >
                  <span
                    ><strong>Cor/fonte:</strong> {{ dados.corPrincipal || 'padrão' }} ·
                    {{ dados.fonte || 'padrão' }}</span
                  >
                  <span>
                    <strong>Notificações:</strong> painel {{ dados.notifPainel ? 'sim' : 'não' }} ·
                    WhatsApp {{ dados.notifWhatsapp ? 'sim' : 'não' }}
                  </span>
                </div>
              }

              <h3 class="pa__consulta-titulo">Cardápio ({{ itensCardapio() }} produtos)</h3>
              @if (consultaCardapio(); as cardapio) {
                @if (cardapio.categorias.length === 0) {
                  <p class="pa__vazio">Nenhuma categoria cadastrada.</p>
                }
                @for (categoria of cardapio.categorias; track categoria.id) {
                  <div class="pa__cat">
                    <h4>
                      {{ categoria.nome }}
                      @if (!categoria.ativa) {
                        <p-tag value="inativa" severity="secondary" size="small" />
                      }
                    </h4>
                    @for (produto of categoria.produtos; track produto.id) {
                      <div class="pa__produto" [class.pa__produto--inativo]="!produto.ativo">
                        <span class="pa__produto-nome">
                          {{ produto.nome }}
                          @if (produto.destaque) {
                            <i class="pi pi-star-fill pa__star"></i>
                          }
                          @if (!produto.ativo) {
                            <p-tag value="inativo" severity="secondary" size="small" />
                          }
                        </span>
                        <small>{{ produto.descricao || '' }}</small>
                        <strong>{{ precoDe(produto.preco) }}</strong>
                        @if (produto.grupos.length > 0) {
                          <ul class="pa__grupos">
                            @for (grupo of produto.grupos; track grupo.id) {
                              <li>
                                <strong>{{ grupo.nome }}</strong>
                                <small>
                                  {{ grupo.obrigatorio ? 'obrigatório' : 'opcional' }}
                                  @if (grupo.minSelecoes > 0 || grupo.maxSelecoes !== null) {
                                    ({{ grupo.minSelecoes }}-{{ grupo.maxSelecoes ?? '∞' }})
                                  }
                                </small>
                                <span class="pa__opcoes">
                                  @for (opcao of grupo.opcoes; track opcao.id) {
                                    <span>
                                      {{ opcao.nome }}
                                      @if (opcao.precoAdicional > 0) {
                                        (+{{ precoDe(opcao.precoAdicional) }})
                                      }
                                    </span>
                                  }
                                </span>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    }
                  </div>
                }
              }

              <h3 class="pa__consulta-titulo">Pedidos ({{ consultaPedidos().length }})</h3>
              @if (consultaPedidos().length === 0) {
                <p class="pa__vazio">Nenhum pedido ainda.</p>
              }
              @for (pedido of consultaPedidos(); track pedido.id) {
                <div class="pa__pedido">
                  <div class="pa__pedido-topo">
                    <strong>#{{ pedido.numero }}</strong>
                    <p-tag
                      [value]="labelStatus(pedido.status)"
                      [severity]="severidadePedido(pedido.status)"
                    />
                    <small>{{ dataHoraDe(pedido.createdAt) }}</small>
                  </div>
                  @for (item of pedido.itens; track item.id) {
                    <div class="pa__pedido-item">
                      <span>{{ item.qtd }}× {{ item.nome }}</span>
                      <strong>{{ precoDe(item.precoUnit * item.qtd) }}</strong>
                      @if (item.opcoes.length > 0) {
                        <small>
                          @for (op of item.opcoes; track op.id) {
                            <span>{{ op.remove ? 'sem ' : '' }}{{ op.nome }}</span>
                          }
                        </small>
                      }
                    </div>
                  }
                  @if (pedido.cliente) {
                    <small class="pa__pedido-cliente">
                      Cliente: {{ pedido.cliente.nome || '—' }}
                      @if (pedido.cliente.telefone) {
                        · {{ pedido.cliente.telefone }}
                      }
                    </small>
                  }
                  @if (pedido.observacao) {
                    <small class="pa__pedido-cliente">Obs.: {{ pedido.observacao }}</small>
                  }
                  <strong class="pa__pedido-total">Total: {{ precoDe(pedido.total) }}</strong>
                </div>
              }
            }
          </section>
        }

        @if (!consultando()) {
          @if (aba() === 'lanchonetes') {
            @if (carregando()) {
              <p>Carregando…</p>
            } @else if (lanchonetes().length === 0) {
              <p class="pa__vazio">Nenhuma lanchonete cadastrada ainda.</p>
            } @else {
              <div class="pa__filtros">
                <label class="pa__campo pa__filtro-busca">
                  <span>Buscar</span>
                  <input
                    pInputText
                    type="text"
                    [value]="filtroBusca()"
                    (input)="filtroBusca.set($any($event.target).value)"
                    placeholder="Nome, /slug ou dono"
                  />
                </label>
                <label class="pa__campo">
                  <span>Situação</span>
                  <p-select
                    [options]="situacaoFiltros"
                    optionLabel="rotulo"
                    optionValue="valor"
                    [(ngModel)]="filtroSituacao"
                    name="filtroSituacao"
                    placeholder="Todas"
                    [showClear]="true"
                  />
                </label>
                <label class="pa__campo">
                  <span>Tipo</span>
                  <p-select
                    [options]="tiposFiltros"
                    optionLabel="rotulo"
                    optionValue="valor"
                    [(ngModel)]="filtroTipo"
                    name="filtroTipo"
                    placeholder="Todos"
                    [showClear]="true"
                  />
                </label>
              </div>

              @if (lanchonetesFiltradas().length === 0) {
                <p class="pa__vazio">Nenhuma lanchonete encontrada.</p>
              } @else {
                <div class="pa__tabela">
                  <div class="pa__linha pa__linha--cabecalho">
                    <span>Lanchonete</span>
                    <span>Dono</span>
                    <span>Conteúdo</span>
                    <span>Criada em</span>
                    <span>Plano</span>
                    <span>Status</span>
                    <span>Ações</span>
                  </div>
                  @for (l of lanchonetesFiltradas(); track l.id) {
                    <div class="pa__linha" [class.pa__linha--pausada]="l.situacao === 'pausada'">
                      <span class="pa__nome">
                        @let tipo = tipoDe(l.tipo);
                        <span class="pa__emoji">{{ tipo?.emoji ?? '🏪' }}</span>
                        <span>
                          <strong>{{ l.nome }}</strong>
                          <small>/{{ l.slug }}</small>
                        </span>
                      </span>
                      <span class="pa__dono">
                        {{ l.donoNome || '—' }}
                        <small>{{ l.donoEmail || '' }}</small>
                      </span>
                      <span class="pa__conteudo">
                        {{ l.totalCategorias }} cat. · {{ l.totalProdutos }} prod. ·
                        {{ l.totalPedidos }} ped.
                      </span>
                      <span>{{ dataDe(l.createdAt) }}</span>
                      <span>
                        <p-tag
                          [value]="rotuloPlano(l)"
                          [severity]="planoSeverity(l)"
                        />
                      </span>
                      <span>
                        <p-tag
                          [value]="rotuloSituacao(l.situacao)"
                          [severity]="situacaoSeverity(l.situacao)"
                        />
                      </span>
                      <span class="pa__acoes">
                        <p-button
                          label="Consultar"
                          icon="pi pi-search"
                          size="small"
                          severity="secondary"
                          [outlined]="true"
                          (onClick)="abrirConsulta(l)"
                        />
                        @if (l.situacao === 'pendente') {
                          <p-button
                            label="Aprovar"
                            icon="pi pi-check"
                            size="small"
                            severity="success"
                            (onClick)="aprovar(l)"
                          />
                        }
                        @if (l.situacao === 'ativa') {
                          <p-button
                            label="Pausar"
                            icon="pi pi-pause"
                            size="small"
                            severity="secondary"
                            [outlined]="true"
                            (onClick)="pausar(l)"
                          />
                        }
                        @if (l.situacao === 'pausada') {
                          <p-button
                            label="Reativar"
                            icon="pi pi-play"
                            size="small"
                            severity="secondary"
                            [outlined]="true"
                            (onClick)="reativar(l)"
                          />
                        }
                        @if (eSuper()) {
                          <p-button
                            label="Excluir"
                            icon="pi pi-trash"
                            size="small"
                            severity="danger"
                            [outlined]="true"
                            (onClick)="excluir(l)"
                          />
                        }
                      </span>
                    </div>
                  }
                </div>
              }
            }
          }

          @if (aba() === 'logs') {
            <div class="pa__filtros">
              <label class="pa__campo">
                <span>Nível</span>
                <p-select
                  [options]="filtrosNivel"
                  optionLabel="rotulo"
                  optionValue="valor"
                  [(ngModel)]="filtroNivel"
                  name="nivel"
                  placeholder="Todos"
                  [showClear]="true"
                  (onChange)="carregarLogs()"
                />
              </label>
              <label class="pa__campo">
                <span>Categoria</span>
                <p-select
                  [options]="filtrosCategoria"
                  optionLabel="rotulo"
                  optionValue="valor"
                  [(ngModel)]="filtroCategoria"
                  name="categoria"
                  placeholder="Todas"
                  [showClear]="true"
                  (onChange)="carregarLogs()"
                />
              </label>
            </div>

            @if (carregandoLogs()) {
              <p>Carregando logs…</p>
            } @else if (logs().length === 0) {
              <p class="pa__vazio">Nenhum registro no log.</p>
            } @else {
              @for (log of logs(); track log.id) {
                <div class="pa__log superficie">
                  <span class="pa__log-badges">
                    <p-tag
                      [value]="capitalizar(log.nivel)"
                      [severity]="log.nivel === 'erro' ? 'danger' : 'secondary'"
                    />
                    <p-tag
                      [value]="capitalizar(log.categoria)"
                      [severity]="log.categoria === 'erro' ? 'danger' : 'info'"
                    />
                  </span>
                  <div class="pa__log-corpo">
                    <strong>{{ log.mensagem }}</strong>
                    <small>
                      {{ dataHoraDe(log.createdAt) }}
                      @if (log.usuarioNome || log.usuarioEmail) {
                        · {{ log.usuarioNome || '—' }} ({{ log.usuarioEmail || '—' }})
                      } @else {
                        · sistema
                      }
                    </small>
                    @if (log.detalhes) {
                      <details class="pa__log-detalhes">
                        <summary>Ver detalhes</summary>
                        <pre>{{ log.detalhes | json }}</pre>
                      </details>
                    }
                  </div>
                </div>
              }
            }
          }

          @if (aba() === 'config') {
            <section class="pa__bloco">
              <h2>E-mail de contato para lojistas</h2>
              <div class="pa__config">
                <p class="pa__config-dica">
                  Esse e-mail aparece na página principal dos clientes para quem quiser anunciar
                  como lojista.
                </p>
                <label class="pa__campo pa__campo--contato">
                  <span>E-mail</span>
                  <input
                    pInputText
                    type="email"
                    [value]="novoEmailLojista()"
                    (input)="novoEmailLojista.set($any($event.target).value)"
                    placeholder="contato@cardapio.com.br"
                  />
                </label>
                <div class="pa__config-acoes">
                  <p-button
                    label="Salvar"
                    icon="pi pi-check"
                    [loading]="salvandoEmail()"
                    [disabled]="salvandoEmail() || !emailValido()"
                    (onClick)="salvarEmailLojista()"
                  />
                  @if (emailOk() === 'ok') {
                    <span class="pa__ok"><i class="pi pi-check-circle"></i> Salvo!</span>
                  }
                </div>
                @if (erroEmail()) {
                  <p class="pa__erro">{{ erroEmail() }}</p>
                }
              </div>
            </section>
          }

          @if (aba() === 'admins') {
            <section class="pa__bloco">
              <div class="pa__bloco-topo">
                <h2>Administradores</h2>
                <p-button
                  label="Criar administrador"
                  icon="pi pi-plus"
                  size="small"
                  [disabled]="!eSuper()"
                  (onClick)="abrirCriarAdmin()"
                />
              </div>
              @if (admins().length === 0) {
                <p class="pa__vazio">Nenhum administrador cadastrado.</p>
              }
              @for (admin of admins(); track admin.id) {
                <div class="pa__admin superficie">
                  <div>
                    <strong>{{ admin.nome || '—' }}</strong>
                    <small>{{ admin.email }}</small>
                  </div>
                  <p-tag
                    [value]="admin.funcao === 'super' ? 'Raiz' : 'Admin'"
                    [severity]="admin.funcao === 'super' ? 'warn' : 'secondary'"
                  />
                  <small class="pa__desde">desde {{ dataDe(admin.createdAt) }}</small>
                  @if (eSuper()) {
                    <p-button
                      label="Editar"
                      icon="pi pi-pencil"
                      size="small"
                      severity="secondary"
                      [outlined]="true"
                      (onClick)="abrirEditarAdmin(admin)"
                    />
                    <p-button
                      label="Remover"
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      [outlined]="true"
                      [disabled]="admin.funcao === 'super'"
                      (onClick)="removerAdmin(admin)"
                    />
                  }
                </div>
              }
            </section>
          }
        }
      }

      <p-dialog
        [(visible)]="adminCriarAberto"
        header="Criar administrador"
        [modal]="true"
        [dismissableMask]="true"
        appendTo="body"
        [style]="{ width: 'min(90vw, 30rem)' }"
      >
        <div class="pa__modal-corpo">
          <label class="pa__campo">
            <span>Nome</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="novoAdminNome"
              name="adminNome"
              (input)="erroAdmin.set(null)"
            />
          </label>
          <label class="pa__campo">
            <span>E-mail</span>
            <input
              pInputText
              type="email"
              [(ngModel)]="novoAdminEmail"
              name="adminEmail"
              (input)="erroAdmin.set(null)"
            />
          </label>
          <label class="pa__campo">
            <span>Senha</span>
            <input
              pInputText
              type="password"
              [(ngModel)]="novoAdminSenha"
              name="adminSenha"
              placeholder="mínimo 8 caracteres"
              (input)="erroAdmin.set(null)"
            />
          </label>
          @if (erroAdmin()) {
            <p class="pa__erro">{{ erroAdmin() }}</p>
          }
        </div>
        <div class="pa__modal-acoes">
          <p-button
            label="Cancelar"
            severity="secondary"
            [outlined]="true"
            [disabled]="salvandoAdmin()"
            (onClick)="adminCriarAberto.set(false)"
          />
          <p-button
            label="Criar"
            icon="pi pi-plus"
            [loading]="salvandoAdmin()"
            [disabled]="salvandoAdmin() || !adminFormValido()"
            (onClick)="criarAdmin()"
          />
        </div>
      </p-dialog>

      <p-dialog
        [(visible)]="adminEditarAberto"
        [header]="'Editar ' + (editandoAdmin()?.nome || 'administrador')"
        [modal]="true"
        [dismissableMask]="true"
        appendTo="body"
        [style]="{ width: 'min(90vw, 28rem)' }"
      >
        <div class="pa__modal-corpo">
          <p class="pa__modal-info">{{ editandoAdmin()?.email }}</p>
          <label class="pa__campo">
            <span>Nome</span>
            <input
              pInputText
              type="text"
              [(ngModel)]="editarAdminNome"
              name="editarAdminNome"
              (input)="erroEditarAdmin.set(null)"
            />
          </label>
          @if (erroEditarAdmin()) {
            <p class="pa__erro">{{ erroEditarAdmin() }}</p>
          }
        </div>
        <div class="pa__modal-acoes">
          <p-button
            label="Cancelar"
            severity="secondary"
            [outlined]="true"
            [disabled]="salvandoAdminEdicao()"
            (onClick)="adminEditarAberto.set(false)"
          />
          <p-button
            label="Salvar"
            icon="pi pi-check"
            [loading]="salvandoAdminEdicao()"
            [disabled]="salvandoAdminEdicao() || !editarAdminNomeValido()"
            (onClick)="salvarEditarAdmin()"
          />
        </div>
      </p-dialog>
    </main>
  `,
  styles: `
    .pa {
      max-width: 1080px;
      margin: 0 auto;
      padding: 20px 20px 64px;
    }
    .pa__topo {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .pa__topo h1 {
      font-size: 1.5rem;
      margin: 0;
    }
    .pa__sair {
      margin-left: auto;
    }
    .pa__voltar {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--app-texto-suave);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .pa__voltar:hover {
      color: var(--p-primary-color);
    }
    .pa__abas {
      display: flex;
      gap: 6px;
      margin: 0 0 16px;
      padding: 5px;
      border: 1px solid var(--app-borda);
      border-radius: 999px;
      background: var(--app-superficie);
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
    }
    .pa__aba {
      padding: 8px 16px;
      border: 0;
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      color: var(--app-texto-suave);
      border-radius: 999px;
      white-space: nowrap;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;
    }
    .pa__aba:hover {
      color: var(--p-primary-color);
    }
    .pa__aba--ativa {
      color: var(--p-primary-contrast-color, #fff) !important;
      background: var(--p-primary-color);
    }
    .pa__erro {
      background: color-mix(in srgb, var(--p-red-500, #ef4444) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 40%, transparent);
      color: var(--p-red-500, #ef4444);
      padding: 10px 14px;
      border-radius: var(--app-raio-sm);
      font-size: 0.9rem;
    }
    .pa__vazio {
      color: var(--app-texto-suave);
    }
    .pa__tabela {
      display: grid;
      gap: 4px;
    }
    .pa__linha {
      display: grid;
      grid-template-columns: 2fr 1.3fr 1fr 1fr 1fr 0.7fr 1.6fr;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      background: var(--app-superficie);
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio);
      font-size: 0.9rem;
    }
    .pa__linha--cabecalho {
      background: transparent;
      border: 0;
      color: var(--app-texto-suave);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pa__linha--cabecalho span {
      font-weight: 700;
    }
    .pa__linha--pausada {
      opacity: 0.65;
    }
    .pa__nome {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pa__nome small,
    .pa__dono small {
      display: block;
      color: var(--app-texto-suave);
      font-size: 0.75rem;
    }
    .pa__emoji {
      font-size: 1.4rem;
    }
    .pa__acoes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pa__bloco {
      margin-bottom: 24px;
    }
    .pa__bloco h2 {
      margin: 0 0 6px;
      font-size: 1.05rem;
    }
    .pa__bloco-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .pa__bloco-topo h2 {
      margin: 0;
    }
    .pa__modal-corpo {
      display: grid;
      gap: 14px;
    }
    .pa__modal-acoes {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 16px;
    }
    .pa__modal-info {
      margin: 0;
      color: var(--app-texto-suave);
      font-size: 0.9rem;
    }
    .pa__campo {
      display: grid;
      gap: 4px;
      font-weight: 600;
      font-size: 0.85rem;

      > span {
        color: var(--app-texto-suave);
      }
    }
    .pa__filtro-busca {
      min-width: 16rem;
      flex: 1;
    }
    .pa__config {
      display: grid;
      gap: 12px;
      max-width: 34rem;
    }
    .pa__config-dica {
      margin: 0;
      font-size: 0.9rem;
      color: var(--app-texto-suave);
    }
    .pa__config-acoes {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pa__campo--contato {
      max-width: 22rem;
    }
    .pa__ok {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--p-green-500, #22c55e);
    }
    .pa__admin {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border-radius: var(--app-raio);
      margin-bottom: 6px;
      font-size: 0.9rem;
    }
    .pa__admin small {
      color: var(--app-texto-suave);
    }
    .pa__admin div {
      flex: 1;
      display: grid;
    }
    .pa__desde {
      white-space: nowrap;
    }
    .pa__filtros {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .pa__log {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      border-radius: var(--app-raio);
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .pa__log-badges {
      display: flex;
      gap: 6px;
      padding-top: 2px;
    }
    .pa__log-corpo {
      flex: 1;
      display: grid;
      gap: 4px;
    }
    .pa__log-corpo small {
      color: var(--app-texto-suave);
    }
    .pa__log-detalhes summary {
      cursor: pointer;
      color: var(--p-primary-color);
      font-size: 0.8rem;
    }
    .pa__log-detalhes pre {
      background: var(--app-fundo);
      border-radius: var(--app-raio-sm);
      border: 1px solid var(--app-borda);
      padding: 10px;
      overflow-x: auto;
      font-size: 0.75rem;
    }
    .pa__consulta {
      padding: 18px;
      margin-bottom: 20px;
      display: grid;
      gap: 14px;
    }
    .pa__consulta-topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .pa__consulta-topo h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    .pa__consulta-topo p {
      margin: 4px 0 0;
      color: var(--app-texto-suave);
      font-size: 0.85rem;
    }
    .pa__consulta-acoes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pa__consulta-dados {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 18px;
      font-size: 0.85rem;
      padding: 12px;
      background: var(--app-fundo);
      border-radius: var(--app-raio-sm);
    }
    .pa__consulta-dados strong {
      color: var(--app-texto);
    }
    .pa__consulta-titulo {
      margin: 8px 0 0;
      font-size: 1rem;
      border-top: 1px solid var(--app-borda);
      padding-top: 14px;
    }
    .pa__cat {
      display: grid;
      gap: 6px;
    }
    .pa__cat h4 {
      margin: 12px 0 2px;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pa__produto {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px 12px;
      align-items: center;
      padding: 8px 10px;
      background: var(--app-fundo);
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      font-size: 0.85rem;
    }
    .pa__produto--inativo {
      opacity: 0.6;
    }
    .pa__produto-nome {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .pa__produto small {
      color: var(--app-texto-suave);
    }
    .pa__produto > strong {
      grid-row: span 2;
    }
    .pa__star {
      color: var(--p-warn-color, #f59e0b);
      font-size: 0.8rem;
    }
    .pa__grupos {
      grid-column: 1 / -1;
      margin: 4px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 4px;
      font-size: 0.8rem;
    }
    .pa__grupos li {
      display: grid;
      gap: 2px;
    }
    .pa__grupos small {
      color: var(--app-texto-suave);
    }
    .pa__opcoes {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .pa__opcoes span {
      background: var(--app-superficie);
      border: 1px solid var(--app-borda);
      padding: 1px 8px;
      border-radius: 999px;
    }
    .pa__pedido {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      background: var(--app-fundo);
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      font-size: 0.85rem;
      margin-bottom: 8px;
    }
    .pa__pedido-topo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pa__pedido-topo small {
      color: var(--app-texto-suave);
      margin-left: auto;
    }
    .pa__pedido-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .pa__pedido-item small {
      color: var(--app-texto-suave);
    }
    .pa__pedido-cliente,
    .pa__pedido-total {
      color: var(--app-texto-suave);
    }
    .pa__pedido-total {
      border-top: 1px dashed var(--app-borda);
      padding-top: 6px;
    }
    @media (max-width: 900px) {
      .pa__linha {
        grid-template-columns: 1fr 1fr;
      }
      .pa__linha--cabecalho {
        display: none;
      }
      .pa__filtro-busca {
        min-width: 100%;
      }
      .pa__consulta-dados {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PainelAdminComponent {
  private readonly api = inject(ApiService);
  private readonly painel = inject(PainelAdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly aba = signal<'lanchonetes' | 'admins' | 'logs' | 'config'>('lanchonetes');
  readonly lanchonetes = signal<LanchonetePainel[]>([]);
  readonly admins = signal<AdminPainel[]>([]);
  readonly carregando = signal(true);
  readonly semAcesso = signal(false);
  readonly mensagem = signal<string | null>(null);
  readonly funcao = signal<string | null>(null);
  readonly eSuper = computed(() => this.funcao() === 'super');

  readonly filtroBusca = signal('');
  readonly filtroSituacao = signal<string | null>(null);
  readonly filtroTipo = signal<string | null>(null);

  readonly situacaoFiltros = SITUACAO_FILTROS;
  readonly tiposFiltros = TIPOS_FILTROS;

  readonly lanchonetesFiltradas = computed(() => {
    const busca = this.filtroBusca().trim().toLowerCase();
    const situacao = this.filtroSituacao();
    const tipo = this.filtroTipo();
    return this.lanchonetes().filter((l) => {
      if (situacao && l.situacao !== situacao) return false;
      if (tipo && l.tipo !== tipo) return false;
      if (!busca) return true;
      const alvo = `${l.nome} /${l.slug} ${l.donoNome ?? ''} ${l.donoEmail ?? ''}`.toLowerCase();
      return alvo.includes(busca);
    });
  });

  readonly adminCriarAberto = signal(false);
  readonly adminEditarAberto = signal(false);
  readonly editandoAdmin = signal<AdminPainel | null>(null);
  readonly editarAdminNome = signal('');
  readonly salvandoAdminEdicao = signal(false);
  readonly erroEditarAdmin = signal<string | null>(null);
  readonly editarAdminNomeValido = computed(() => this.editarAdminNome().trim().length >= 2);

  readonly consultando = signal<LanchonetePainel | null>(null);
  readonly consultaDados = signal<LanchoneteConsulta | null>(null);
  readonly consultaCardapio = signal<CardapioConsulta | null>(null);
  readonly consultaPedidos = signal<PedidoConsulta[]>([]);
  readonly consultaCarregando = signal(false);

  readonly logs = signal<LogSistema[]>([]);
  readonly carregandoLogs = signal(false);
  readonly filtroNivel = signal<string | null>(null);
  readonly filtroCategoria = signal<string | null>(null);
  readonly filtrosNivel = [
    { rotulo: 'erro', valor: 'erro' },
    { rotulo: 'info', valor: 'info' },
  ];
  readonly filtrosCategoria = [
    { rotulo: 'ação', valor: 'acao' },
    { rotulo: 'erro', valor: 'erro' },
  ];

  readonly novoAdminNome = signal('');
  readonly novoAdminEmail = signal('');
  readonly novoAdminSenha = signal('');
  readonly salvandoAdmin = signal(false);
  readonly erroAdmin = signal<string | null>(null);

  readonly novoEmailLojista = signal('');
  readonly salvandoEmail = signal(false);
  readonly erroEmail = signal<string | null>(null);
  readonly emailOk = signal<'idle' | 'ok'>('idle');

  readonly emailValido = computed(
    () =>
      this.novoEmailLojista().trim() === '' ||
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.novoEmailLojista().trim()),
  );

  readonly adminFormValido = computed(
    () =>
      this.novoAdminNome().trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.novoAdminEmail().trim()) &&
      this.novoAdminSenha().length >= 8,
  );

  readonly itensCardapio = computed(
    () =>
      this.consultaCardapio()?.categorias.reduce((total, c) => total + c.produtos.length, 0) ?? 0,
  );

  constructor() {
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    try {
      const me = await firstValueFrom(
        this.api.get<{ adminSistema: boolean; adminSistemaFuncao: string | null }>('/me'),
      );
      this.semAcesso.set(!me.adminSistema);
      if (me.adminSistema) {
        this.funcao.set(me.adminSistemaFuncao ?? 'admin');
        await Promise.all([
          this.carregarLanchonetes(),
          this.carregarAdmins(),
          this.carregarPlataforma(),
        ]);
      }
    } catch {
      this.semAcesso.set(true);
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarLanchonetes(): Promise<void> {
    this.lanchonetes.set(await this.painel.listarLanchonetes());
  }

  private async carregarAdmins(): Promise<void> {
    this.admins.set(await this.painel.listarAdmins());
  }

  private async carregarPlataforma(): Promise<void> {
    const config = await this.painel.getPlataforma();
    this.novoEmailLojista.set(config.emailLojista ?? '');
  }

  async salvarEmailLojista(): Promise<void> {
    if (this.salvandoEmail() || !this.emailValido()) return;
    this.salvandoEmail.set(true);
    this.erroEmail.set(null);
    this.emailOk.set('idle');
    try {
      const valor = this.novoEmailLojista().trim() || null;
      const resultado = await this.painel.atualizarPlataforma(valor);
      this.novoEmailLojista.set(resultado.emailLojista ?? '');
      this.emailOk.set('ok');
    } catch (error) {
      this.erroEmail.set(this.mensagemDe(error));
    } finally {
      this.salvandoEmail.set(false);
    }
  }

  trocarAba(aba: 'lanchonetes' | 'admins' | 'logs' | 'config') {
    this.fecharConsulta();
    this.aba.set(aba);
    if (aba === 'logs') {
      void this.carregarLogs();
    }
  }

  async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }

  async carregarLogs(): Promise<void> {
    this.carregandoLogs.set(true);
    try {
      this.logs.set(
        await this.painel.listarLogs({
          nivel: this.filtroNivel() ?? undefined,
          categoria: this.filtroCategoria() ?? undefined,
        }),
      );
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    } finally {
      this.carregandoLogs.set(false);
    }
  }

  tipoDe(tipo: string | null) {
    return TIPOS_LANCHONETE.find((t) => t.valor === tipo) ?? null;
  }

  rotuloTipo(tipo: string | null): string {
    const info = this.tipoDe(tipo);
    if (info) return info.rotulo;
    return tipo ? this.capitalizar(tipo) : '—';
  }

  capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  dataDe(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  dataHoraDe(data: string): string {
    return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  precoDe(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  rotuloSituacao(situacao: string): string {
    return SITUACAO_LABELS[situacao] ?? situacao;
  }

  situacaoSeverity(situacao: string): 'warn' | 'success' | 'danger' {
    if (situacao === 'ativa') return 'success';
    if (situacao === 'pendente') return 'warn';
    return 'danger';
  }

  rotuloPlano(l: {
    plano: string | null;
    planoExpira: string | null;
    planoExpirado: boolean;
  }): string {
    if (l.plano === 'pago') return 'Pago';
    if (l.plano === 'trial') {
      if (l.planoExpirado) return 'Trial expirado';
      return l.planoExpira ? `Trial · até ${this.dataDe(l.planoExpira)}` : 'Trial';
    }
    return '—';
  }

  planoSeverity(l: {
    plano: string | null;
    planoExpirado: boolean;
  }): 'success' | 'info' | 'danger' | 'secondary' {
    if (l.plano === 'pago') return 'success';
    if (l.planoExpirado) return 'danger';
    if (l.plano === 'trial') return 'info';
    return 'secondary';
  }

  labelStatus(status: string): string {
    return labelStatusPedido(status);
  }

  severidadePedido(status: string): 'success' | 'info' | 'warn' | 'danger' {
    if (status === 'cancelado') return 'danger';
    if (status === 'entregue') return 'success';
    if (status === 'recebido') return 'warn';
    return 'info';
  }

  async abrirConsulta(l: LanchonetePainel): Promise<void> {
    this.consultando.set(l);
    this.consultaDados.set(null);
    this.consultaCardapio.set(null);
    this.consultaPedidos.set([]);
    this.consultaCarregando.set(true);
    this.mensagem.set(null);
    try {
      this.consultaDados.set(await this.painel.consultarLanchonete(l.id));
      this.consultaCardapio.set(await this.painel.consultarCardapio(l.id));
      this.consultaPedidos.set(await this.painel.consultarPedidos(l.id));
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    } finally {
      this.consultaCarregando.set(false);
    }
  }

  fecharConsulta(): void {
    this.consultando.set(null);
    this.consultaDados.set(null);
    this.consultaCardapio.set(null);
    this.consultaPedidos.set([]);
  }

  async aprovar(l: LanchonetePainel): Promise<void> {
    await this.mudarSituacao(l, 'ativa');
  }

  async pausar(l: LanchonetePainel): Promise<void> {
    await this.mudarSituacao(l, 'pausada');
  }

  async reativar(l: LanchonetePainel): Promise<void> {
    await this.mudarSituacao(l, 'ativa');
  }

  private async mudarSituacao(l: LanchonetePainel, situacao: string): Promise<void> {
    this.mensagem.set(null);
    try {
      await this.painel.alterarSituacao(l.id, situacao);
      await this.carregarLanchonetes();
      const consultando = this.consultando();
      if (consultando && consultando.id === l.id) {
        this.consultando.set({ ...consultando, situacao });
      }
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    }
  }

  async trocarPlanoParaPago(l: LanchonetePainel): Promise<void> {
    await this.trocarPlano(l, 'pago');
  }

  async trocarPlanoParaTrial(l: LanchonetePainel): Promise<void> {
    await this.trocarPlano(l, 'trial');
  }

  private async trocarPlano(l: LanchonetePainel, plano: 'trial' | 'pago'): Promise<void> {
    this.mensagem.set(null);
    try {
      const atualizado = await this.painel.alterarPlano(l.id, plano);
      await this.carregarLanchonetes();
      const consultando = this.consultando();
      if (consultando && consultando.id === l.id) {
        this.consultando.set({
          ...consultando,
          plano: atualizado.plano,
          planoExpira: atualizado.planoExpira,
          planoExpirado:
            atualizado.plano === 'trial' &&
            atualizado.planoExpira !== null &&
            new Date(atualizado.planoExpira) < new Date(),
        });
      }
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    }
  }

  async excluir(l: LanchonetePainel): Promise<void> {
    if (!confirm(`Excluir a lanchonete "${l.nome}"? Essa ação não pode ser desfeita.`)) return;
    this.mensagem.set(null);
    try {
      await this.painel.excluirLanchonete(l.id);
      await this.carregarLanchonetes();
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    }
  }

  abrirCriarAdmin(): void {
    if (!this.eSuper()) return;
    this.novoAdminNome.set('');
    this.novoAdminEmail.set('');
    this.novoAdminSenha.set('');
    this.erroAdmin.set(null);
    this.adminCriarAberto.set(true);
  }

  async criarAdmin(): Promise<void> {
    if (!this.adminFormValido()) return;
    this.salvandoAdmin.set(true);
    this.erroAdmin.set(null);
    try {
      await this.painel.criarAdmin({
        nome: this.novoAdminNome().trim().replace(/\s+/g, ' '),
        email: this.novoAdminEmail().trim(),
        senha: this.novoAdminSenha(),
      });
      this.novoAdminNome.set('');
      this.novoAdminEmail.set('');
      this.novoAdminSenha.set('');
      this.adminCriarAberto.set(false);
      await this.carregarAdmins();
    } catch (error) {
      this.erroAdmin.set(this.mensagemDe(error));
    } finally {
      this.salvandoAdmin.set(false);
    }
  }

  abrirEditarAdmin(admin: AdminPainel): void {
    if (!this.eSuper()) return;
    this.editandoAdmin.set(admin);
    this.editarAdminNome.set(admin.nome ?? '');
    this.erroEditarAdmin.set(null);
    this.adminEditarAberto.set(true);
  }

  async salvarEditarAdmin(): Promise<void> {
    const admin = this.editandoAdmin();
    if (!admin || !this.editarAdminNomeValido() || this.salvandoAdminEdicao()) return;
    this.salvandoAdminEdicao.set(true);
    this.erroEditarAdmin.set(null);
    try {
      await this.painel.atualizarAdmin(admin.id, {
        nome: this.editarAdminNome().trim().replace(/\s+/g, ' '),
      });
      this.adminEditarAberto.set(false);
      await this.carregarAdmins();
    } catch (error) {
      this.erroEditarAdmin.set(this.mensagemDe(error));
    } finally {
      this.salvandoAdminEdicao.set(false);
    }
  }

  async removerAdmin(admin: AdminPainel): Promise<void> {
    if (!confirm(`Remover o acesso de ${admin.email}?`)) return;
    this.mensagem.set(null);
    try {
      await this.painel.removerAdmin(admin.id);
      await this.carregarAdmins();
    } catch (error) {
      this.mensagem.set(this.mensagemDe(error));
    }
  }

  private mensagemDe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const msg = (error.error as { message?: string } | undefined)?.message;
      return msg ?? 'Não foi possível concluir. Tente novamente.';
    }
    return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
  }
}
