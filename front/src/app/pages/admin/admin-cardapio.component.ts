import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { AdminService, CardapioAdmin } from '../../services/admin.service';
import { HeaderLanchoneteComponent } from '../../components/header-lanchonete.component';
import { GaleriaService, GaleriaImagem, GaleriaCategoria } from '../../services/galeria.service';

interface GrupoEdit {
  id: string;
  nome: string;
  tipo: 'unica' | 'multipla';
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
}

export interface OpcaoEdit {
  id: string;
  nome: string;
  precoAdicional: number;
  remove: boolean;
  ativa: boolean;
}

@Component({
  selector: 'app-admin-cardapio',
  imports: [CommonModule, FormsModule, HeaderLanchoneteComponent, Button, Dialog, InputText],
  template: `
    <div class="cardapio">
      @if (data(); as d) {
        <app-header-lanchonete
          [nome]="d.lanchonete.nome"
          [logoUrl]="d.lanchonete.logoUrl"
          [cor]="d.lanchonete.corPrincipal"
          [fonte]="d.lanchonete.fonte"
        />
      }
      <p class="aviso" *ngIf="mensagem">{{ mensagem }}</p>
      <div class="topo-acoes">
        <p-button
          label="Recarregar"
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          (onClick)="recarregar()"
        />
        <a class="ver" [href]="'/' + slug()" target="_blank">
          Ver cardápio público <i class="pi pi-external-link"></i>
        </a>
      </div>

      <!-- GRUPOS DE OPÇÕES -->
      <section class="bloco">
        <h2>Grupos de opções</h2>
        <form class="linha" (ngSubmit)="criarGrupo()" autocomplete="off">
          <input
            type="text"
            [(ngModel)]="novoGrupo.nome"
            name="gNome"
            required
            placeholder="Ex.: Adicionais"
          />
          <select [(ngModel)]="novoGrupo.tipo" name="gTipo">
            <option value="multipla">Múltipla</option>
            <option value="unica">Única</option>
          </select>
          <label class="chk"
            ><input type="checkbox" [(ngModel)]="novoGrupo.obrigatorio" name="gObrig" />
            obrigatório</label
          >
          <button type="submit">Adicionar grupo</button>
        </form>

        <article class="card" *ngFor="let grupo of data()?.grupos ?? []; trackBy: grupoTrackBy">
          <ng-container *ngIf="editGrupo?.id === grupo.id; else grupoView">
            <form class="linha" (ngSubmit)="salvarGrupo()" autocomplete="off">
              <input type="text" [(ngModel)]="editGrupo!.nome" name="egNome" required />
              <select [(ngModel)]="editGrupo!.tipo" name="egTipo">
                <option value="multipla">Múltipla</option>
                <option value="unica">Única</option>
              </select>
              <label class="chk"
                ><input type="checkbox" [(ngModel)]="editGrupo!.obrigatorio" name="egObrig" />
                obrigatório</label
              >
              <label class="num"
                >mín <input type="number" min="0" [(ngModel)]="editGrupo!.minSelecoes" name="egMin"
              /></label>
              <label class="num"
                >máx
                <input
                  type="number"
                  min="0"
                  [(ngModel)]="editGrupo!.maxSelecoes"
                  name="egMax"
                  placeholder="∞"
              /></label>
              <button type="submit">Salvar</button>
              <button type="button" class="btn-neutro" (click)="editGrupo = null">Cancelar</button>
            </form>
          </ng-container>
          <ng-template #grupoView>
            <div class="grupo-topo">
              <strong>{{ grupo.nome }}</strong>
              <span class="badge">{{ grupo.tipo === 'unica' ? 'escolha única' : 'múltipla' }}</span>
              <span class="badge" *ngIf="grupo.obrigatorio">obrigatório</span>
              <span class="regras" *ngIf="grupo.minSelecoes > 0 || grupo.maxSelecoes">
                ({{ grupo.minSelecoes
                }}{{ grupo.maxSelecoes ? '–' + grupo.maxSelecoes : '+' }} opções)
              </span>
              <div class="acoes">
                <button class="btn-neutro" (click)="iniciarEditGrupo(grupo)">Editar</button>
                <button class="btn-excluir" (click)="excluirGrupo(grupo.id)">Excluir</button>
              </div>
            </div>
          </ng-template>

          <ul class="opcoes">
            <li *ngFor="let opcao of grupo.opcoes; trackBy: opcaoTrackBy">
              <ng-container *ngIf="editOpcao?.id === opcao.id; else opcaoView">
                <form class="linha" (ngSubmit)="salvarOpcao()" autocomplete="off">
                  <input type="text" [(ngModel)]="editOpcao!.nome" name="eoNome" required />
                  <label class="num">
                    R$
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      [(ngModel)]="editOpcao!.precoAdicional"
                      name="eoPreco"
                    />
                  </label>
                  <label class="chk"
                    ><input type="checkbox" [(ngModel)]="editOpcao!.remove" name="eoRemove" />
                    remover</label
                  >
                  <button type="submit">Salvar</button>
                  <button type="button" class="btn-neutro" (click)="editOpcao = null">
                    Cancelar
                  </button>
                </form>
              </ng-container>
              <ng-template #opcaoView>
                <span [class.riscado]="opcao.remove">{{ opcao.nome }}</span>
                <span class="preco">
                  {{
                    opcao.remove
                      ? 'remover'
                      : opcao.precoAdicional > 0
                        ? '+' + opcao.precoAdicional.toFixed(2)
                        : 'grátis'
                  }}
                </span>
                <label class="chk" title="Ativa">
                  <input
                    type="checkbox"
                    [(ngModel)]="opcao.ativa"
                    name="oa{{ opcao.id }}"
                    (ngModelChange)="toggleOpcao(opcao)"
                  />
                </label>
                <button class="btn-neutro" (click)="iniciarEditOpcao(opcao)">Editar</button>
                <button class="btn-excluir" (click)="excluirOpcao(opcao.id)">×</button>
              </ng-template>
            </li>
          </ul>

          <form class="linha nova-opcao" (ngSubmit)="criarOpcao(grupo.id)" autocomplete="off">
            <input
              type="text"
              [(ngModel)]="novaOpcao.nome"
              name="noNome"
              required
              placeholder="Nova opção…"
            />
            <label class="num">
              R$
              <input
                type="number"
                step="0.01"
                min="0"
                [(ngModel)]="novaOpcao.precoAdicional"
                name="noPreco"
              />
            </label>
            <label class="chk"
              ><input type="checkbox" [(ngModel)]="novaOpcao.remove" name="noRemove" />
              remover</label
            >
            <button type="submit">Adicionar</button>
          </form>
        </article>
      </section>

      <!-- CATEGORIAS / PRODUTOS -->
      <section class="bloco">
        <h2>Categorias e produtos</h2>
        <form class="linha" (ngSubmit)="criarCategoria()" autocomplete="off">
          <input
            type="text"
            [(ngModel)]="novoCatNome"
            name="cNome"
            required
            placeholder="Nova categoria…"
          />
          <button type="submit">Adicionar categoria</button>
        </form>

        <article class="card" *ngFor="let cat of data()?.categorias ?? []; trackBy: catTrackBy">
          <ng-container *ngIf="editCat?.id === cat.id; else catView">
            <form class="linha" (ngSubmit)="salvarCategoria()" autocomplete="off">
              <input type="text" [(ngModel)]="editCat!.nome" name="ecNome" required />
              <label class="chk"
                ><input type="checkbox" [(ngModel)]="editCat!.ativa" name="ecAtiva" /> ativa</label
              >
              <img *ngIf="editCat!.imagemUrl" class="thumb" [src]="editCat!.imagemUrl" alt="" />
              <button type="button" class="btn-neutro" (click)="abrirGaleria('categoria')">
                Galeria
              </button>
              <button
                type="button"
                class="btn-excluir"
                *ngIf="editCat!.imagemUrl"
                (click)="editCat!.imagemUrl = ''"
              >
                remover
              </button>
              <button type="submit">Salvar</button>
              <button type="button" class="btn-neutro" (click)="editCat = null">Cancelar</button>
            </form>
          </ng-container>
          <ng-template #catView>
            <div class="grupo-topo">
              <strong
                >{{ cat.nome }} <span class="qtd">({{ cat.produtos.length }})</span></strong
              >
              <img *ngIf="cat.imagemUrl" class="thumb" [src]="cat.imagemUrl" alt="" />
              <div class="acoes">
                <button class="btn-neutro" (click)="iniciarEditCat(cat)">Editar</button>
                <button class="btn-excluir" (click)="excluirCategoria(cat.id)">Excluir</button>
              </div>
            </div>
          </ng-template>

          <ul class="produtos">
            <li *ngFor="let produto of cat.produtos; trackBy: produtoTrackBy">
              <ng-container *ngIf="editProd?.id === produto.id; else prodView">
                <form class="produto-edit" (ngSubmit)="salvarProduto()" autocomplete="off">
                  <div class="grid3">
                    <input
                      type="text"
                      [(ngModel)]="editProd!.nome"
                      name="epNome"
                      required
                      placeholder="Nome"
                    />
                    <label class="num">
                      R$
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        [(ngModel)]="editProd!.preco"
                        name="epPreco"
                        required
                      />
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="editProd!.descricao"
                      name="epDesc"
                      placeholder="Descrição"
                    />
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="editProd!.imagemUrl"
                    name="epImg"
                    placeholder="URL da imagem (opcional)"
                  />
                  <div class="linha">
                    <img
                      *ngIf="editProd!.imagemUrl"
                      class="thumb"
                      [src]="editProd!.imagemUrl"
                      alt=""
                    />
                    <button type="button" class="btn-neutro" (click)="abrirGaleria('produto')">
                      Galeria
                    </button>
                    <button
                      type="button"
                      class="btn-excluir"
                      *ngIf="editProd!.imagemUrl"
                      (click)="editProd!.imagemUrl = ''"
                    >
                      remover
                    </button>
                  </div>
                  <div class="checks">
                    <label class="chk"
                      ><input type="checkbox" [(ngModel)]="editProd!.destaque" name="epDestaque" />
                      destaque</label
                    >
                    <label class="chk"
                      ><input type="checkbox" [(ngModel)]="editProd!.ativo" name="epAtivo" />
                      ativo</label
                    >
                  </div>
                  <div class="grupos-seletor">
                    <span>Grupos de opções:</span>
                    <label
                      class="chk"
                      *ngFor="let g of data()?.grupos ?? []; trackBy: grupoTrackBy"
                    >
                      <input
                        type="checkbox"
                        name="epg{{ g.id }}"
                        [checked]="editProd!.grupos.includes(g.id)"
                        (change)="toggleGrupoProduto(g.id, $any($event.target).checked)"
                      />
                      {{ g.nome }}
                    </label>
                  </div>
                  <div class="acoes">
                    <button type="submit">Salvar</button>
                    <button type="button" class="btn-neutro" (click)="editProd = null">
                      Cancelar
                    </button>
                  </div>
                </form>
              </ng-container>
              <ng-template #prodView>
                <img *ngIf="produto.imagemUrl" class="thumb" [src]="produto.imagemUrl" alt="" />
                <span class="prod-nome" [class.ino]="!produto.ativo">{{ produto.nome }}</span>
                <span class="prod-badges">
                  <span class="badge" *ngIf="produto.destaque">destaque</span>
                  <span class="badge papel" *ngIf="produto.grupoIds.length"
                    >{{ produto.grupoIds.length }} grupo(s)</span
                  >
                </span>
                <span class="prod-preco">R$ {{ produto.preco.toFixed(2) }}</span>
                <div class="acoes">
                  <button class="btn-neutro" (click)="iniciarEditProd(produto)">Editar</button>
                  <button class="btn-excluir" (click)="excluirProduto(produto.id)">×</button>
                </div>
              </ng-template>
            </li>
          </ul>

          <form class="linha novo-produto" (ngSubmit)="criarProduto(cat.id)" autocomplete="off">
            <input
              type="text"
              [(ngModel)]="novoProd.nome"
              name="npNome"
              required
              placeholder="Novo produto…"
            />
            <label class="num">
              R$
              <input
                type="number"
                step="0.01"
                min="0"
                [(ngModel)]="novoProd.preco"
                name="npPreco"
                required
                placeholder="0,00"
              />
            </label>
            <button type="submit">Adicionar</button>
          </form>
        </article>
      </section>
    </div>

    <p-dialog
      [(visible)]="galeria.aberta"
      header="Escolher imagem da galeria"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(720px, 95vw)' }"
      appendTo="self"
    >
      <div class="filtros">
        <input
          pInputText
          type="text"
          [(ngModel)]="galeria.busca"
          name="gBusca"
          placeholder="Buscar… (ex.: hamburguer)"
          (keydown.enter)="buscarGaleria()"
        />
        <select [(ngModel)]="galeria.categoria" name="gCat" (change)="buscarGaleria()">
          <option value="">Todas as categorias</option>
          <option *ngFor="let c of galeria.categorias" [value]="c.slug">{{ c.label }}</option>
        </select>
        <p-button label="Buscar" icon="pi pi-search" type="button" (onClick)="buscarGaleria()" />
      </div>
      <div class="grid" *ngIf="galeria.resultados.length; else vazio">
        <button
          class="item"
          type="button"
          *ngFor="let img of galeria.resultados"
          (click)="escolherImagem(img)"
          [title]="img.autor ? 'Foto de ' + img.autor : ''"
        >
          <img [src]="img.url" alt="" loading="lazy" />
        </button>
      </div>
      <ng-template #vazio>
        <p class="vazio">
          Nenhuma imagem encontrada. A galeria é preenchida pelo seed: no back, rode
          <code>npm run seed:galeria</code>.
        </p>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .cardapio {
      display: grid;
      gap: 24px;
    }
    .aviso {
      color: var(--p-red-500, #ef4444);
      margin: 0;
    }
    .topo-acoes {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .topo-acoes .ver {
      margin-left: auto;
      font-weight: 600;
      text-decoration: none;
    }
    .bloco h2 {
      font-size: 1.1rem;
      margin: 0 0 10px;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--app-borda);
    }
    .card {
      background: var(--app-superficie);
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio);
      padding: 14px;
      margin-bottom: 10px;
    }
    .linha {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    input[type='text'],
    input[type='number'],
    select {
      padding: 7px 9px;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio-sm);
      background: var(--app-superficie-2);
      color: var(--app-texto);
      font: inherit;
      font-size: 0.85rem;
    }
    .linha input[type='text'] {
      flex: 1;
      min-width: 140px;
    }
    button {
      padding: 8px 12px;
      border: 0;
      border-radius: var(--app-raio-sm);
      cursor: pointer;
      font: inherit;
      font-size: 0.85rem;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color, #fff);
      font-weight: 600;
    }
    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .btn-neutro {
      background: var(--app-superficie-2);
      color: var(--app-texto);
      border: 1px solid var(--app-borda);
    }
    .btn-excluir {
      background: transparent;
      color: var(--p-red-500, #ef4444);
      border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 40%, transparent);
      padding: 6px 10px;
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--app-texto-suave);
    }
    .num {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--app-texto-suave);
    }
    .num input {
      width: 72px;
    }
    .grupo-topo {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .grupo-topo strong {
      font-size: 1rem;
    }
    .badge {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 99px;
      background: var(--app-superficie-2);
      color: var(--app-texto-suave);
      border: 1px solid var(--app-borda);
    }
    .badge.papel {
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      border-color: color-mix(in srgb, var(--p-primary-color) 40%, transparent);
      color: var(--p-primary-color);
    }
    .regras {
      color: var(--app-texto-suave);
      font-size: 0.8rem;
    }
    .acoes {
      margin-left: auto;
      display: flex;
      gap: 6px;
    }
    .opcoes,
    .produtos {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .opcoes li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.92rem;
    }
    .preco {
      color: var(--app-texto-suave);
      font-size: 0.8rem;
      margin-right: 4px;
      min-width: 52px;
    }
    .riscado {
      text-decoration: line-through;
      color: var(--p-red-500, #ef4444);
    }
    .nova-opcao,
    .novo-produto {
      padding-top: 10px;
      border-top: 1px dashed var(--app-borda);
    }
    .produtos li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid var(--app-borda);
    }
    .prod-nome {
      font-weight: 600;
    }
    .prod-nome.ino {
      color: var(--app-texto-suave);
      text-decoration: line-through;
    }
    .prod-badges {
      display: flex;
      gap: 5px;
    }
    .prod-preco {
      margin-left: auto;
      font-weight: 600;
    }
    .produto-edit {
      display: grid;
      gap: 8px;
      padding: 10px;
      background: var(--app-superficie-2);
      border-radius: var(--app-raio);
    }
    .grid3 {
      display: grid;
      grid-template-columns: 1.4fr 0.6fr 1fr;
      gap: 8px;
    }
    .grupos-seletor {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 0.85rem;
    }
    .grupos-seletor > span {
      font-weight: 600;
    }
    .thumb {
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: var(--app-raio-sm);
      border: 1px solid var(--app-borda);
    }
    .filtros {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .filtros input {
      flex: 1;
      min-width: 160px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
      overflow: auto;
      max-height: 55vh;
    }
    .item {
      padding: 0;
      overflow: hidden;
      border-radius: 9px;
      aspect-ratio: 1 / 1;
      background: var(--app-superficie-2);
      border: 1px solid var(--app-borda);
    }
    .item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .vazio {
      color: var(--app-texto-suave);
      text-align: center;
    }
    .vazio code {
      background: var(--app-superficie-2);
      padding: 1px 5px;
      border-radius: 5px;
    }
    .checks {
      display: flex;
      gap: 14px;
    }
    @media (max-width: 600px) {
      .grid3 {
        grid-template-columns: 1fr;
      }
      .acoes {
        margin-left: 0;
      }
    }
  `,
})
export class AdminCardapioComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  private readonly galeriaSvc = inject(GaleriaService);

  private readonly router = inject(Router);
  readonly slug = signal('');
  readonly data = signal<CardapioAdmin | null>(null);
  mensagem = '';

  galeria = {
    aberta: false,
    alvo: null as 'categoria' | 'produto' | null,
    busca: '',
    categoria: '',
    resultados: [] as GaleriaImagem[],
    categorias: [] as GaleriaCategoria[],
  };

  novoGrupo = { nome: '', tipo: 'unica' as 'unica' | 'multipla', obrigatorio: false };
  editGrupo: GrupoEdit | null = null;
  novaOpcao = { nome: '', precoAdicional: 0, remove: false };
  editOpcao: OpcaoEdit | null = null;

  novoCatNome = '';
  editCat: { id: string; nome: string; ativa: boolean; imagemUrl: string } | null = null;
  novoProd = { nome: '', preco: 0 };
  editProd: {
    id: string;
    nome: string;
    preco: number;
    descricao: string;
    imagemUrl: string;
    destaque: boolean;
    ativo: boolean;
    grupos: string[];
  } | null = null;

  constructor() {
    (this.route.parent?.paramMap ?? this.route.paramMap).subscribe((params) =>
      this.carregar(params.get('slug') ?? ''),
    );
  }

  private async carregar(slug: string) {
    this.slug.set(slug);
    try {
      this.data.set(await this.admin.getCardapio(slug));
    } catch {
      await this.router.navigate(['/admin']);
    }
  }

  recarregar() {
    void this.carregar(this.slug());
  }

  private erro(error: unknown, fallback: string) {
    this.mensagem = (error as { error?: { message?: string } }).error?.message ?? fallback;
  }

  // grupos
  async criarGrupo() {
    try {
      const grupo = await this.admin.createGrupo(this.slug(), {
        nome: this.novoGrupo.nome,
        tipo: this.novoGrupo.tipo,
        obrigatorio: this.novoGrupo.obrigatorio,
      });
      this.data.update((d) => (d ? { ...d, grupos: [...d.grupos, { ...grupo, opcoes: [] }] } : d));
      this.novoGrupo = { nome: '', tipo: 'unica', obrigatorio: false };
    } catch (error) {
      this.erro(error, 'Falha ao criar grupo');
    }
  }

  iniciarEditGrupo(grupo: GrupoEdit) {
    this.editGrupo = {
      id: grupo.id,
      nome: grupo.nome,
      tipo: grupo.tipo,
      obrigatorio: grupo.obrigatorio,
      minSelecoes: grupo.minSelecoes,
      maxSelecoes: grupo.maxSelecoes,
    };
  }

  async salvarGrupo() {
    if (!this.editGrupo) return;
    try {
      const atualizado = await this.admin.updateGrupo(this.editGrupo.id, {
        nome: this.editGrupo.nome,
        tipo: this.editGrupo.tipo,
        obrigatorio: this.editGrupo.obrigatorio,
        minSelecoes: this.editGrupo.minSelecoes,
        maxSelecoes: this.editGrupo.maxSelecoes,
      });
      this.data.update((d) =>
        d
          ? {
              ...d,
              grupos: d.grupos.map((g) =>
                g.id === atualizado.id ? { ...atualizado, opcoes: g.opcoes } : g,
              ),
            }
          : d,
      );
      this.editGrupo = null;
    } catch (error) {
      this.erro(error, 'Falha ao salvar grupo');
    }
  }

  async excluirGrupo(id: string) {
    if (!confirm('Excluir este grupo de opções?')) return;
    try {
      await this.admin.removeGrupo(id);
      this.data.update((d) => (d ? { ...d, grupos: d.grupos.filter((g) => g.id !== id) } : d));
    } catch (error) {
      this.erro(error, 'Falha ao excluir grupo');
    }
  }

  // opções
  async criarOpcao(grupoId: string) {
    try {
      const opcao = await this.admin.createOpcao(grupoId, {
        nome: this.novaOpcao.nome,
        precoAdicional: this.novaOpcao.precoAdicional,
        remove: this.novaOpcao.remove,
      });
      this.data.update((d) =>
        d
          ? {
              ...d,
              grupos: d.grupos.map((g) =>
                g.id === grupoId ? { ...g, opcoes: [...g.opcoes, opcao] } : g,
              ),
            }
          : d,
      );
      this.novaOpcao = { nome: '', precoAdicional: 0, remove: false };
    } catch (error) {
      this.erro(error, 'Falha ao criar opção');
    }
  }

  iniciarEditOpcao(opcao: OpcaoEdit) {
    this.editOpcao = { ...opcao };
  }

  async salvarOpcao() {
    if (!this.editOpcao) return;
    try {
      const atualizada = await this.admin.updateOpcao(this.editOpcao.id, {
        nome: this.editOpcao.nome,
        precoAdicional: this.editOpcao.precoAdicional,
        remove: this.editOpcao.remove,
      });
      this.patchOpcao(atualizada.id, atualizada);
      this.editOpcao = null;
    } catch (error) {
      this.erro(error, 'Falha ao salvar opção');
    }
  }

  async toggleOpcao(opcao: OpcaoEdit) {
    try {
      const atualizada = await this.admin.updateOpcao(opcao.id, { ativa: opcao.ativa });
      this.patchOpcao(atualizada.id, atualizada);
    } catch (error) {
      this.erro(error, 'Falha ao alterar opção');
    }
  }

  private patchOpcao(id: string, opcao: OpcaoEdit) {
    this.data.update((d) =>
      d
        ? {
            ...d,
            grupos: d.grupos.map((g) => ({
              ...g,
              opcoes: g.opcoes.map((o) => (o.id === id ? { ...opcao, id } : o)),
            })),
          }
        : d,
    );
  }

  async excluirOpcao(id: string) {
    if (!confirm('Excluir esta opção?')) return;
    try {
      await this.admin.removeOpcao(id);
      this.data.update((d) =>
        d
          ? {
              ...d,
              grupos: d.grupos.map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => o.id !== id) })),
            }
          : d,
      );
    } catch (error) {
      this.erro(error, 'Falha ao excluir opção');
    }
  }

  // categorias
  async criarCategoria() {
    try {
      const cat = await this.admin.createCategoria(this.slug(), { nome: this.novoCatNome });
      this.data.update((d) =>
        d ? { ...d, categorias: [...d.categorias, { ...cat, produtos: [] }] } : d,
      );
      this.novoCatNome = '';
    } catch (error) {
      this.erro(error, 'Falha ao criar categoria');
    }
  }

  iniciarEditCat(cat: { id: string; nome: string; ativa: boolean; imagemUrl: string | null }) {
    this.editCat = { ...cat, imagemUrl: cat.imagemUrl ?? '' };
  }

  async salvarCategoria() {
    if (!this.editCat) return;
    try {
      const atualizada = await this.admin.updateCategoria(this.editCat.id, {
        nome: this.editCat.nome,
        ativa: this.editCat.ativa,
        imagemUrl: this.editCat.imagemUrl || null,
      });
      this.data.update((d) =>
        d
          ? {
              ...d,
              categorias: d.categorias.map((c) =>
                c.id === atualizada.id ? { ...c, ...atualizada } : c,
              ),
            }
          : d,
      );
      this.editCat = null;
    } catch (error) {
      this.erro(error, 'Falha ao salvar categoria');
    }
  }

  async excluirCategoria(id: string) {
    if (!confirm('Excluir esta categoria e todos os produtos dela?')) return;
    try {
      await this.admin.removeCategoria(id);
      this.data.update((d) =>
        d ? { ...d, categorias: d.categorias.filter((c) => c.id !== id) } : d,
      );
    } catch (error) {
      this.erro(error, 'Falha ao excluir categoria');
    }
  }

  // produtos
  async criarProduto(catId: string) {
    try {
      const produto = await this.admin.createProduto(catId, {
        nome: this.novoProd.nome,
        preco: this.novoProd.preco,
      });
      this.data.update((d) =>
        d
          ? {
              ...d,
              categorias: d.categorias.map((c) =>
                c.id === catId
                  ? { ...c, produtos: [...c.produtos, { ...produto, grupoIds: [] }] }
                  : c,
              ),
            }
          : d,
      );
      this.novoProd = { nome: '', preco: 0 };
    } catch (error) {
      this.erro(error, 'Falha ao criar produto');
    }
  }

  iniciarEditProd(p: {
    id: string;
    nome: string;
    descricao: string | null;
    imagemUrl: string | null;
    preco: number;
    destaque: boolean;
    ativo: boolean;
    grupoIds: string[];
  }) {
    this.editProd = {
      id: p.id,
      nome: p.nome,
      preco: p.preco,
      descricao: p.descricao ?? '',
      imagemUrl: p.imagemUrl ?? '',
      destaque: p.destaque,
      ativo: p.ativo,
      grupos: [...p.grupoIds],
    };
  }

  toggleGrupoProduto(grupoId: string, marcado: boolean) {
    if (!this.editProd) return;
    this.editProd.grupos = marcado
      ? [...this.editProd.grupos, grupoId]
      : this.editProd.grupos.filter((id) => id !== grupoId);
  }

  async salvarProduto() {
    if (!this.editProd) return;
    try {
      const atualizado = await this.admin.updateProduto(this.editProd.id, {
        nome: this.editProd.nome,
        preco: this.editProd.preco,
        descricao: this.editProd.descricao || null,
        imagemUrl: this.editProd.imagemUrl || null,
        destaque: this.editProd.destaque,
        ativo: this.editProd.ativo,
      });
      await this.admin.setProdutoGrupos(this.editProd.id, this.editProd.grupos);
      this.data.update((d) =>
        d
          ? {
              ...d,
              categorias: d.categorias.map((c) => ({
                ...c,
                produtos: c.produtos.map((p) =>
                  p.id === atualizado.id
                    ? { ...p, ...atualizado, grupoIds: this.editProd!.grupos }
                    : p,
                ),
              })),
            }
          : d,
      );
      this.editProd = null;
    } catch (error) {
      this.erro(error, 'Falha ao salvar produto');
    }
  }

  async excluirProduto(id: string) {
    if (!confirm('Excluir este produto?')) return;
    try {
      await this.admin.removeProduto(id);
      this.data.update((d) =>
        d
          ? {
              ...d,
              categorias: d.categorias.map((c) => ({
                ...c,
                produtos: c.produtos.filter((p) => p.id !== id),
              })),
            }
          : d,
      );
    } catch (error) {
      this.erro(error, 'Falha ao excluir produto');
    }
  }

  // galeria de imagens
  abrirGaleria(alvo: 'categoria' | 'produto') {
    this.galeria.alvo = alvo;
    this.galeria.aberta = true;
    this.galeria.busca = '';
    this.galeria.categoria = '';
    void this.carregarGaleria();
  }

  private async carregarGaleria() {
    try {
      const [resultados, categorias] = await Promise.all([
        this.galeriaSvc.list(this.galeria.busca || undefined, this.galeria.categoria || undefined),
        this.galeria.categorias.length
          ? Promise.resolve(this.galeria.categorias)
          : this.galeriaSvc.categorias(),
      ]);
      this.galeria.resultados = resultados;
      this.galeria.categorias = categorias;
    } catch {
      this.galeria.resultados = [];
    }
  }

  buscarGaleria() {
    void this.carregarGaleria();
  }

  escolherImagem(img: GaleriaImagem) {
    if (this.galeria.alvo === 'categoria' && this.editCat) {
      this.editCat.imagemUrl = img.url;
    }
    if (this.galeria.alvo === 'produto' && this.editProd) {
      this.editProd.imagemUrl = img.url;
    }
    this.galeria.aberta = false;
  }

  // trackBy
  grupoTrackBy = (_: number, g: { id: string }) => g.id;
  opcaoTrackBy = (_: number, o: { id: string }) => o.id;
  catTrackBy = (_: number, c: { id: string }) => c.id;
  produtoTrackBy = (_: number, p: { id: string }) => p.id;
}
