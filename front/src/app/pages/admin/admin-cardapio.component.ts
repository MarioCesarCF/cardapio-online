import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { AdminService, CardapioAdmin } from '../../services/admin.service';
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

interface ModalCategoria {
  aberto: boolean;
  id: string | null;
  nome: string;
  ativa: boolean;
  imagemUrl: string;
}

interface ModalGrupo {
  aberto: boolean;
  id: string | null;
  nome: string;
  tipo: 'unica' | 'multipla';
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
}

interface ModalProduto {
  aberto: boolean;
  categoriaId: string | null;
  id: string | null;
  nome: string;
  preco: number;
  descricao: string;
  imagemUrl: string;
  destaque: boolean;
  ativo: boolean;
  grupos: string[];
}

interface ModalOpcao {
  aberto: boolean;
  grupoId: string | null;
  id: string | null;
  nome: string;
  precoAdicional: number;
  remove: boolean;
  ativa: boolean;
}

@Component({
  selector: 'app-admin-cardapio',
  imports: [CommonModule, FormsModule, Button, Dialog, InputText],
  template: `
    <div class="cardapio">
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

      <!-- CATEGORIAS / PRODUTOS -->
      <section class="bloco">
        <h2>Categorias e produtos</h2>
        <div class="topo-criar">
          <button type="button" class="btn-novo" (click)="abrirCatCriar()">
            <i class="pi pi-plus"></i> Adicionar categoria
          </button>
        </div>

        <article class="card" *ngFor="let cat of data()?.categorias ?? []; trackBy: catTrackBy">
          <div class="grupo-topo">
            <strong>{{ cat.nome }} <span class="qtd">({{ cat.produtos.length }})</span></strong>
            <img *ngIf="cat.imagemUrl" class="thumb" [src]="cat.imagemUrl" alt="" />
            <span class="badge" *ngIf="!cat.ativa">inativa</span>
            <div class="acoes">
              <button class="btn-neutro" (click)="abrirCatEditar(cat)">Editar</button>
              <button class="btn-excluir" (click)="excluirCategoria(cat.id)">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>

          <ul class="produtos">
            <li *ngFor="let produto of cat.produtos; trackBy: produtoTrackBy">
              <img *ngIf="produto.imagemUrl" class="thumb" [src]="produto.imagemUrl" alt="" />
              <span class="prod-nome" [class.ino]="!produto.ativo">{{ produto.nome }}</span>
              <span class="prod-badges">
                <span class="badge" *ngIf="produto.destaque">destaque</span>
                <span class="badge papel" *ngIf="produto.grupoIds.length"
                  >{{ produto.grupoIds.length }} grupo(s)</span
                >
              </span>
              <div class="acoes">
                <span class="prod-preco">R$ {{ produto.preco.toFixed(2) }}</span>
                <button class="btn-neutro" (click)="abrirProdEditar(cat.id, produto)">Editar</button>
                <button class="btn-excluir" (click)="excluirProduto(produto.id)">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </li>
          </ul>

          <div class="novo-produto">
            <button type="button" class="btn-novo" (click)="abrirProdCriar(cat.id)">
              <i class="pi pi-plus"></i> Novo produto
            </button>
          </div>
        </article>
      </section>

      <!-- GRUPOS DE OPÇÕES -->
      <section class="bloco">
        <h2>Grupos de opções</h2>
        <div class="topo-criar">
          <button type="button" class="btn-novo" (click)="abrirGrupoCriar()">
            <i class="pi pi-plus"></i> Adicionar grupo
          </button>
        </div>

        <article class="card" *ngFor="let grupo of data()?.grupos ?? []; trackBy: grupoTrackBy">
          <div class="grupo-topo">
            <strong>{{ grupo.nome }}</strong>
            <span class="badge">{{ grupo.tipo === 'unica' ? 'escolha única' : 'múltipla' }}</span>
            <span class="badge" *ngIf="grupo.obrigatorio">obrigatório</span>
            <span class="regras" *ngIf="grupo.minSelecoes > 0 || grupo.maxSelecoes">
              ({{ grupo.minSelecoes
              }}{{ grupo.maxSelecoes ? '–' + grupo.maxSelecoes : '+' }} opções)
            </span>
            <div class="acoes">
              <button class="btn-neutro" (click)="abrirGrupoEditar(grupo)">Editar</button>
              <button class="btn-excluir" (click)="excluirGrupo(grupo.id)">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>

          <ul class="opcoes">
            <li *ngFor="let opcao of grupo.opcoes; trackBy: opcaoTrackBy">
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
              <span class="badge" *ngIf="!opcao.ativa">inativa</span>
              <div class="acoes">
                <button class="btn-neutro" (click)="abrirOpcaoEditar(opcao)">Editar</button>
                <button class="btn-excluir" (click)="excluirOpcao(opcao.id)">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </li>
          </ul>

          <div class="nova-opcao">
            <button type="button" class="btn-novo" (click)="abrirOpcaoCriar(grupo.id)">
              <i class="pi pi-plus"></i> Adicionar opção
            </button>
          </div>
        </article>
      </section>
    </div>

    <!-- MODAL CATEGORIA -->
    <p-dialog
      [(visible)]="catModal.aberto"
      [header]="catModal.id ? 'Editar categoria' : 'Nova categoria'"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(440px, 95vw)' }"
    >
      <form class="modal-form" (ngSubmit)="salvarCat()" autocomplete="off">
        <label class="f">
          <span>Nome da categoria *</span>
          <input
            type="text"
            [(ngModel)]="catModal.nome"
            name="cmNome"
            [class.erro]="!!catErros['nome']"
            placeholder="Ex.: Lanches"
          />
          <small class="erro-txt" *ngIf="catErros['nome']">{{ catErros['nome'] }}</small>
        </label>

        <label class="f">
          <span>Imagem</span>
          <div class="img-linha">
            <img *ngIf="catModal.imagemUrl" class="thumb-lg" [src]="catModal.imagemUrl" alt="" />
            <button type="button" class="btn-neutro" (click)="abrirGaleria('categoria')">
              Galeria
            </button>
            <button
              type="button"
              class="btn-excluir"
              *ngIf="catModal.imagemUrl"
              (click)="catModal.imagemUrl = ''"
            >
              Remover
            </button>
          </div>
        </label>

        <label class="chk"
          ><input type="checkbox" [(ngModel)]="catModal.ativa" name="cmAtiva" /> Categoria
          ativa</label
        >

        <p class="erro-txt erro-txt--bloco" *ngIf="catErros['geral']">
          <i class="pi pi-exclamation-circle"></i> {{ catErros['geral'] }}
        </p>

        <div class="modal-acoes">
          <button type="submit" [disabled]="salvando">Salvar</button>
          <button type="button" class="btn-neutro" (click)="catModal.aberto = false">
            Cancelar
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- MODAL GRUPO -->
    <p-dialog
      [(visible)]="grupoModal.aberto"
      [header]="grupoModal.id ? 'Editar grupo de opções' : 'Novo grupo de opções'"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(480px, 95vw)' }"
    >
      <form class="modal-form" (ngSubmit)="salvarGrupo()" autocomplete="off">
        <label class="f">
          <span>Nome do grupo *</span>
          <input
            type="text"
            [(ngModel)]="grupoModal.nome"
            name="gmNome"
            [class.erro]="!!grupoErros['nome']"
            placeholder="Ex.: Adicionais"
          />
          <small class="erro-txt" *ngIf="grupoErros['nome']">{{ grupoErros['nome'] }}</small>
        </label>

        <div class="f-cols">
          <label class="f">
            <span>Tipo de escolha</span>
            <select [(ngModel)]="grupoModal.tipo" name="gmTipo">
              <option value="multipla">Múltipla</option>
              <option value="unica">Única</option>
            </select>
          </label>
          <label class="f f--fim">
            <span>Obrigatório</span>
            <input
              type="checkbox"
              class="chk-input"
              [(ngModel)]="grupoModal.obrigatorio"
              name="gmObrig"
            />
          </label>
        </div>

        <div class="f-cols">
          <label class="f">
            <span>Mínimo de opções</span>
            <input
              type="number"
              min="0"
              [(ngModel)]="grupoModal.minSelecoes"
              name="gmMin"
              [class.erro]="!!grupoErros['min']"
            />
            <small class="erro-txt" *ngIf="grupoErros['min']">{{ grupoErros['min'] }}</small>
          </label>
          <label class="f">
            <span>Máximo (vazio = ilimitado)</span>
            <input
              type="number"
              min="0"
              [(ngModel)]="grupoModal.maxSelecoes"
              name="gmMax"
              placeholder="∞"
              [class.erro]="!!grupoErros['max']"
            />
            <small class="erro-txt" *ngIf="grupoErros['max']">{{ grupoErros['max'] }}</small>
          </label>
        </div>

        <p class="erro-txt erro-txt--bloco" *ngIf="grupoErros['geral']">
          <i class="pi pi-exclamation-circle"></i> {{ grupoErros['geral'] }}
        </p>

        <div class="modal-acoes">
          <button type="submit" [disabled]="salvando">Salvar</button>
          <button type="button" class="btn-neutro" (click)="grupoModal.aberto = false">
            Cancelar
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- MODAL PRODUTO -->
    <p-dialog
      [(visible)]="prodModal.aberto"
      [header]="prodModal.id ? 'Editar produto' : 'Novo produto'"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(520px, 95vw)' }"
    >
      <form class="modal-form" (ngSubmit)="salvarProduto()" autocomplete="off">
        <label class="f">
          <span>Nome do produto *</span>
          <input
            type="text"
            [(ngModel)]="prodModal.nome"
            name="pmNome"
            [class.erro]="!!prodErros['nome']"
            placeholder="Ex.: X-Burger"
          />
          <small class="erro-txt" *ngIf="prodErros['nome']">{{ prodErros['nome'] }}</small>
        </label>

        <label class="f">
          <span>Preço (R$) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            [(ngModel)]="prodModal.preco"
            name="pmPreco"
            [class.erro]="!!prodErros['preco']"
            placeholder="0,00"
          />
          <small class="erro-txt" *ngIf="prodErros['preco']">{{ prodErros['preco'] }}</small>
        </label>

        <label class="f">
          <span>Descrição</span>
          <input
            type="text"
            [(ngModel)]="prodModal.descricao"
            name="pmDesc"
            placeholder="Ingredientes, tamanho…"
          />
        </label>

        <label class="f">
          <span>Imagem</span>
          <div class="img-linha">
            <img *ngIf="prodModal.imagemUrl" class="thumb-lg" [src]="prodModal.imagemUrl" alt="" />
            <button type="button" class="btn-neutro" (click)="abrirGaleria('produto')">
              Galeria
            </button>
            <button
              type="button"
              class="btn-excluir"
              *ngIf="prodModal.imagemUrl"
              (click)="prodModal.imagemUrl = ''"
            >
              Remover
            </button>
          </div>
        </label>

        <div class="f-cols checks">
          <label class="chk"
            ><input type="checkbox" [(ngModel)]="prodModal.destaque" name="pmDestaque" />
            Destaque</label
          >
          <label class="chk"
            ><input type="checkbox" [(ngModel)]="prodModal.ativo" name="pmAtivo" /> Produto
            ativo</label
          >
        </div>

        <fieldset class="grupos-sel">
          <legend>Grupos de opções</legend>
          <label
            class="chk"
            *ngFor="let g of data()?.grupos ?? []; trackBy: grupoTrackBy"
          >
            <input
              type="checkbox"
              name="pg{{ g.id }}"
              [checked]="prodModal.grupos.includes(g.id)"
              (change)="toggleGrupoProduto(g.id, $any($event.target).checked)"
            />
            {{ g.nome }}
          </label>
          <span class="sem-grupos" *ngIf="(data()?.grupos ?? []).length === 0"
            >Você ainda não criou grupos de opções.</span
          >
        </fieldset>

        <p class="erro-txt erro-txt--bloco" *ngIf="prodErros['geral']">
          <i class="pi pi-exclamation-circle"></i> {{ prodErros['geral'] }}
        </p>

        <div class="modal-acoes">
          <button type="submit" [disabled]="salvando">Salvar</button>
          <button type="button" class="btn-neutro" (click)="prodModal.aberto = false">
            Cancelar
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- MODAL OPÇÃO -->
    <p-dialog
      [(visible)]="opcaoModal.aberto"
      [header]="opcaoModal.id ? 'Editar opção' : 'Nova opção'"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(440px, 95vw)' }"
    >
      <form class="modal-form" (ngSubmit)="salvarOpcao()" autocomplete="off">
        <label class="f">
          <span>Nome da opção *</span>
          <input
            type="text"
            [(ngModel)]="opcaoModal.nome"
            name="omNome"
            [class.erro]="!!opcaoErros['nome']"
            placeholder="Ex.: Bacon, Cheddar, Refrigerante…"
          />
          <small class="erro-txt" *ngIf="opcaoErros['nome']">{{ opcaoErros['nome'] }}</small>
        </label>

        <label class="f">
          <span>Preço adicional (R$)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            [(ngModel)]="opcaoModal.precoAdicional"
            name="omPreco"
            [class.erro]="!!opcaoErros['preco']"
            placeholder="0,00"
          />
          <small class="erro-txt" *ngIf="opcaoErros['preco']">{{ opcaoErros['preco'] }}</small>
        </label>

        <div class="f-cols checks">
          <label class="chk"
            ><input type="checkbox" [(ngModel)]="opcaoModal.remove" name="omRemove" /> É opção
            "remover"</label
          >
          <label class="chk"
            ><input type="checkbox" [(ngModel)]="opcaoModal.ativa" name="omAtiva" /> Opção
            ativa</label
          >
        </div>

        <p class="erro-txt erro-txt--bloco" *ngIf="opcaoErros['geral']">
          <i class="pi pi-exclamation-circle"></i> {{ opcaoErros['geral'] }}
        </p>

        <div class="modal-acoes">
          <button type="submit" [disabled]="salvando">Salvar</button>
          <button type="button" class="btn-neutro" (click)="opcaoModal.aberto = false">
            Cancelar
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- GALERIA -->
    <p-dialog
      [(visible)]="galeria.aberta"
      header="Escolher imagem da galeria"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: 'min(720px, 95vw)' }"
      appendTo="body"
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
    .topo-criar {
      margin-bottom: 10px;
    }
    .btn-novo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
    .qtd {
      color: var(--app-texto-suave);
      font-weight: 500;
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
      align-items: center;
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
    .opcoes li > label.chk {
      margin-left: auto;
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
    .nova-opcao {
      padding-top: 10px;
      border-top: 1px dashed var(--app-borda);
    }
    .novo-produto {
      padding-top: 10px;
      margin-top: 10px;
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

    /* ---------- Modais ---------- */
    .modal-form {
      display: grid;
      gap: 14px;
    }
    .f {
      display: grid;
      gap: 5px;
    }
    .f > span {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--app-texto-suave);
    }
    .f input:not([type='checkbox']),
    .f select {
      width: 100%;
    }
    .f-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      align-items: start;
    }
    .f--fim {
      align-content: end;
    }
    .f .chk-input {
      justify-self: start;
      width: auto;
      transform: scale(1.15);
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .erro {
      border-color: var(--p-red-500, #ef4444) !important;
      box-shadow: 0 0 0 1px var(--p-red-500, #ef4444) inset;
    }
    .erro-txt {
      color: var(--p-red-500, #ef4444);
      font-size: 0.8rem;
      font-weight: 500;
    }
    .erro-txt--bloco {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 8px 10px;
      border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 45%, transparent);
      border-radius: var(--app-raio-sm);
      background: color-mix(in srgb, var(--p-red-500, #ef4444) 9%, transparent);
    }
    .modal-acoes {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 4px;
    }
    .img-linha {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .thumb-lg {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: var(--app-raio-sm);
      border: 1px solid var(--app-borda);
      background: var(--app-superficie-2);
    }
    .grupos-sel {
      display: grid;
      gap: 8px;
      border: 1px solid var(--app-borda);
      border-radius: var(--app-raio);
      padding: 10px 12px;
      margin: 0;
    }
    .grupos-sel legend {
      padding: 0 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--app-texto-suave);
    }
    .sem-grupos {
      color: var(--app-texto-suave);
      font-size: 0.82rem;
      font-weight: 400;
    }
    .checks {
      align-items: center;
    }
    @media (max-width: 600px) {
      .f-cols {
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

  salvando = false;

  catModal: ModalCategoria = {
    aberto: false,
    id: null,
    nome: '',
    ativa: true,
    imagemUrl: '',
  };
  catErros: Record<string, string> = {};

  grupoModal: ModalGrupo = {
    aberto: false,
    id: null,
    nome: '',
    tipo: 'multipla',
    obrigatorio: false,
    minSelecoes: 0,
    maxSelecoes: null,
  };
  grupoErros: Record<string, string> = {};

  prodModal: ModalProduto = {
    aberto: false,
    categoriaId: null,
    id: null,
    nome: '',
    preco: 0,
    descricao: '',
    imagemUrl: '',
    destaque: false,
    ativo: true,
    grupos: [],
  };
  prodErros: Record<string, string> = {};

  opcaoModal: ModalOpcao = {
    aberto: false,
    grupoId: null,
    id: null,
    nome: '',
    precoAdicional: 0,
    remove: false,
    ativa: true,
  };
  opcaoErros: Record<string, string> = {};

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

  private erroMsg(error: unknown, fallback: string): string {
    return (error as { error?: { message?: string } }).error?.message ?? fallback;
  }

  private erro(error: unknown, fallback: string) {
    this.mensagem = this.erroMsg(error, fallback);
  }

  private validaNome(nome: string): string | null {
    if (nome.length === 0) return 'Informe o nome.';
    if (nome.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
    return null;
  }

  // ---------- Categoria (modal) ----------
  abrirCatCriar() {
    this.catModal = { aberto: true, id: null, nome: '', ativa: true, imagemUrl: '' };
    this.catErros = {};
  }

  abrirCatEditar(cat: { id: string; nome: string; ativa: boolean; imagemUrl: string | null }) {
    this.catModal = {
      aberto: true,
      id: cat.id,
      nome: cat.nome,
      ativa: cat.ativa,
      imagemUrl: cat.imagemUrl ?? '',
    };
    this.catErros = {};
  }

  async salvarCat() {
    if (this.salvando) return;
    this.catErros = {};
    const nome = this.catModal.nome.trim().replace(/\s+/g, ' ');
    const errNome = this.validaNome(nome);
    if (errNome) {
      this.catErros['nome'] = errNome;
      return;
    }
    this.salvando = true;
    try {
      const payload = {
        nome,
        ativa: this.catModal.ativa,
        imagemUrl: this.catModal.imagemUrl || null,
      };
      if (this.catModal.id) {
        const atualizada = await this.admin.updateCategoria(this.catModal.id, payload);
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
      } else {
        const cat = await this.admin.createCategoria(this.slug(), payload);
        this.data.update((d) =>
          d ? { ...d, categorias: [...d.categorias, { ...cat, produtos: [] }] } : d,
        );
      }
      this.catModal.aberto = false;
    } catch (error) {
      this.catErros['geral'] = this.erroMsg(error, 'Falha ao salvar categoria.');
    } finally {
      this.salvando = false;
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

  // ---------- Grupo (modal) ----------
  abrirGrupoCriar() {
    this.grupoModal = {
      aberto: true,
      id: null,
      nome: '',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
    };
    this.grupoErros = {};
  }

  abrirGrupoEditar(grupo: GrupoEdit) {
    this.grupoModal = {
      aberto: true,
      id: grupo.id,
      nome: grupo.nome,
      tipo: grupo.tipo,
      obrigatorio: grupo.obrigatorio,
      minSelecoes: grupo.minSelecoes,
      maxSelecoes: grupo.maxSelecoes,
    };
    this.grupoErros = {};
  }

  async salvarGrupo() {
    if (this.salvando) return;
    this.grupoErros = {};
    const nome = this.grupoModal.nome.trim().replace(/\s+/g, ' ');
    const errNome = this.validaNome(nome);
    if (errNome) {
      this.grupoErros['nome'] = errNome;
      return;
    }
    const min = Number(this.grupoModal.minSelecoes);
    if (!Number.isInteger(min) || min < 0) {
      this.grupoErros['min'] = 'Informe um número inteiro maior ou igual a zero.';
      return;
    }
    const maxRaw = this.grupoModal.maxSelecoes;
    const max = maxRaw === null ? null : Number(maxRaw);
    if (max !== null && (!Number.isInteger(max) || max < 0)) {
      this.grupoErros['max'] = 'Informe um número inteiro maior ou igual a zero (ou deixe vazio).';
      return;
    }
    if (max !== null && max < min) {
      this.grupoErros['max'] = 'O máximo não pode ser menor que o mínimo.';
      return;
    }
    this.salvando = true;
    try {
      const payload = {
        nome,
        tipo: this.grupoModal.tipo,
        obrigatorio: this.grupoModal.obrigatorio,
        minSelecoes: min,
        maxSelecoes: max,
      };
      if (this.grupoModal.id) {
        const atualizado = await this.admin.updateGrupo(this.grupoModal.id, payload);
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
      } else {
        const grupo = await this.admin.createGrupo(this.slug(), payload);
        this.data.update((d) =>
          d ? { ...d, grupos: [...d.grupos, { ...grupo, opcoes: [] }] } : d,
        );
      }
      this.grupoModal.aberto = false;
    } catch (error) {
      this.grupoErros['geral'] = this.erroMsg(error, 'Falha ao salvar grupo.');
    } finally {
      this.salvando = false;
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

  // ---------- Produto (modal) ----------
  abrirProdCriar(catId: string) {
    this.prodModal = {
      aberto: true,
      categoriaId: catId,
      id: null,
      nome: '',
      preco: 0,
      descricao: '',
      imagemUrl: '',
      destaque: false,
      ativo: true,
      grupos: [],
    };
    this.prodErros = {};
  }

  abrirProdEditar(
    catId: string,
    p: {
      id: string;
      nome: string;
      descricao: string | null;
      imagemUrl: string | null;
      preco: number;
      destaque: boolean;
      ativo: boolean;
      grupoIds: string[];
    },
  ) {
    this.prodModal = {
      aberto: true,
      categoriaId: catId,
      id: p.id,
      nome: p.nome,
      preco: p.preco,
      descricao: p.descricao ?? '',
      imagemUrl: p.imagemUrl ?? '',
      destaque: p.destaque,
      ativo: p.ativo,
      grupos: [...p.grupoIds],
    };
    this.prodErros = {};
  }

  toggleGrupoProduto(grupoId: string, marcado: boolean) {
    this.prodModal.grupos = marcado
      ? [...this.prodModal.grupos, grupoId]
      : this.prodModal.grupos.filter((id) => id !== grupoId);
  }

  async salvarProduto() {
    if (this.salvando) return;
    this.prodErros = {};
    const nome = this.prodModal.nome.trim().replace(/\s+/g, ' ');
    const errNome = this.validaNome(nome);
    if (errNome) {
      this.prodErros['nome'] = errNome;
      return;
    }
    const preco = Number(this.prodModal.preco);
    if (!Number.isFinite(preco) || preco < 0) {
      this.prodErros['preco'] = 'O preço deve ser maior ou igual a zero.';
      return;
    }
    if (!this.prodModal.categoriaId) return;
    this.salvando = true;
    try {
      const payload = {
        nome,
        preco,
        descricao: this.prodModal.descricao.trim() || null,
        imagemUrl: this.prodModal.imagemUrl || null,
        destaque: this.prodModal.destaque,
        ativo: this.prodModal.ativo,
      };
      let produto;
      if (this.prodModal.id) {
        produto = await this.admin.updateProduto(this.prodModal.id, payload);
      } else {
        produto = await this.admin.createProduto(this.prodModal.categoriaId, payload);
      }
      await this.admin.setProdutoGrupos(produto.id, this.prodModal.grupos);
      this.prodModal.aberto = false;
      this.recarregar();
    } catch (error) {
      this.prodErros['geral'] = this.erroMsg(error, 'Falha ao salvar produto.');
    } finally {
      this.salvando = false;
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

  // ---------- Opções (modal) ----------
  abrirOpcaoCriar(grupoId: string) {
    this.opcaoModal = {
      aberto: true,
      grupoId,
      id: null,
      nome: '',
      precoAdicional: 0,
      remove: false,
      ativa: true,
    };
    this.opcaoErros = {};
  }

  abrirOpcaoEditar(opcao: OpcaoEdit) {
    this.opcaoModal = {
      aberto: true,
      grupoId: null,
      id: opcao.id,
      nome: opcao.nome,
      precoAdicional: opcao.precoAdicional,
      remove: opcao.remove,
      ativa: opcao.ativa,
    };
    this.opcaoErros = {};
  }

  async salvarOpcao() {
    if (this.salvando) return;
    this.opcaoErros = {};
    const nome = this.opcaoModal.nome.trim().replace(/\s+/g, ' ');
    const errNome = this.validaNome(nome);
    if (errNome) {
      this.opcaoErros['nome'] = errNome;
      return;
    }
    const precoAdicional = Number(this.opcaoModal.precoAdicional);
    if (!Number.isFinite(precoAdicional) || precoAdicional < 0) {
      this.opcaoErros['preco'] = 'O preço deve ser maior ou igual a zero.';
      return;
    }
    const payload = {
      nome,
      precoAdicional,
      remove: this.opcaoModal.remove,
    };
    this.salvando = true;
    try {
      if (this.opcaoModal.id) {
        const atualizada = await this.admin.updateOpcao(this.opcaoModal.id, {
          ...payload,
          ativa: this.opcaoModal.ativa,
        });
        this.patchOpcao(atualizada.id, atualizada);
      } else {
        if (!this.opcaoModal.grupoId) return;
        const grupoId = this.opcaoModal.grupoId;
        const opcao = await this.admin.createOpcao(grupoId, payload);
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
      }
      this.opcaoModal.aberto = false;
    } catch (error) {
      this.opcaoErros['geral'] = this.erroMsg(error, 'Falha ao salvar opção.');
    } finally {
      this.salvando = false;
    }
  }

  async excluirOpcao(id: string) {
    if (!confirm('Excluir esta opção?')) return;
    try {
      await this.admin.removeOpcao(id);
      this.data.update((d) =>
        d
          ? {
              ...d,
              grupos: d.grupos.map((g) => ({
                ...g,
                opcoes: g.opcoes.filter((o) => o.id !== id),
              })),
            }
          : d,
      );
    } catch (error) {
      this.erro(error, 'Falha ao excluir opção');
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

  // ---------- Galeria de imagens ----------
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
    if (this.galeria.alvo === 'categoria') {
      this.catModal.imagemUrl = img.url;
    }
    if (this.galeria.alvo === 'produto') {
      this.prodModal.imagemUrl = img.url;
    }
    this.galeria.aberta = false;
  }

  // ---------- TrackBy ----------
  grupoTrackBy = (_: number, g: { id: string }) => g.id;
  opcaoTrackBy = (_: number, o: { id: string }) => o.id;
  catTrackBy = (_: number, c: { id: string }) => c.id;
  produtoTrackBy = (_: number, p: { id: string }) => p.id;
}