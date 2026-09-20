import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  FavoritasService,
  type Favorita,
  type LanchoneteFavoritaResumo,
} from '../../services/favoritas.service';
import { TIPOS_LANCHONETE, logoPadrao } from '../../services/lanchonete-visual';

interface DiretorioLanchonete {
  id: string;
  slug: string;
  nome: string;
  logoUrl: string | null;
  tipo: string | null;
  enderecoLoja: string | null;
}

interface Endereco {
  id: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string | null;
  apelido: string | null;
  padrao: boolean;
}

interface MeResponse {
  user: { id: string; name?: string | null; email?: string | null };
  cliente: { id: string; nome?: string | null; telefone?: string | null } | null;
  enderecos: Endereco[];
  lanchonetes: unknown[];
  adminSistema: boolean;
}

interface LinhaLanchonete {
  id: string;
  slug: string;
  nome: string;
  logoUrl: string | null;
  tipo: string | null;
  enderecoLoja: string | null;
  corPrincipal: string | null;
  favorita: boolean;
  favoritadaEm: string;
  itensSacola: number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Button, InputText],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly favoritasSvc = inject(FavoritasService);

  readonly favoritas = signal<Favorita[]>([]);
  readonly diretorio = signal<DiretorioLanchonete[]>([]);
  readonly loading = signal(true);
  readonly erro = signal<string | null>(null);
  readonly filtro = signal('');
  readonly ocupada = signal<Record<string, boolean>>({});
  readonly emailLojista = signal<string | null>(null);

  readonly meNome = signal('');
  readonly meTelefone = signal('');
  readonly salvandoPerfil = signal(false);
  readonly perfilErro = signal<string | null>(null);
  readonly perfilOk = signal<'idle' | 'ok' | 'erro'>('idle');

  readonly enderecos = signal<Endereco[]>([]);
  readonly novoEnderecoAberto = signal(false);
  readonly novoEndereco = signal<Record<string, string>>({});
  readonly salvandoEndereco = signal(false);
  readonly enderecoErro = signal<string | null>(null);

  readonly visiveis = computed<LinhaLanchonete[]>(() => {
    const favoritaIds = new Set(this.favoritas().map((f) => f.lanchonete.id));
    const porId = new Map<string, LanchoneteFavoritaResumo>();
    for (const f of this.favoritas()) porId.set(f.lanchonete.id, f.lanchonete);
    const texto = this.filtro().trim().toLowerCase();

    const linhas = this.diretorio().map<LinhaLanchonete>((d) => {
      const fav = porId.get(d.id);
      return {
        ...d,
        corPrincipal: fav?.corPrincipal ?? null,
        favorita: favoritaIds.has(d.id),
        favoritadaEm: fav
          ? (this.favoritas().find((f) => f.lanchonete.id === d.id)?.favoritadaEm ?? '')
          : '',
        itensSacola: this.cart.totalItensNoSlug(d.slug),
      };
    });

    const filtradas =
      texto.length === 0
        ? linhas.filter((l) => l.favorita)
        : linhas.filter((l) => {
            const rotulo = this.rotuloTipo(l.tipo).toLowerCase();
            return (
              l.nome.toLowerCase().includes(texto) ||
              (l.enderecoLoja ?? '').toLowerCase().includes(texto) ||
              rotulo.includes(texto)
            );
          });

    return [...filtradas].sort((a, b) => {
      if (texto.length === 0) return b.favoritadaEm.localeCompare(a.favoritadaEm);
      if (a.favorita !== b.favorita) return a.favorita ? -1 : 1;
      if (a.favorita) return b.favoritadaEm.localeCompare(a.favoritadaEm);
      return a.nome.localeCompare(b.nome);
    });
  });

  readonly temFavoritas = computed(() => this.favoritas().length > 0);
  readonly filtroVazio = computed(() => this.filtro().trim().length === 0);

  ngOnInit(): void {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    this.loading.set(true);
    this.erro.set(null);
    try {
      await this.auth.init();
      const [favoritas, diretorio, me, plataforma] = await Promise.all([
        this.favoritasSvc.list(),
        firstValueFrom(this.api.get<DiretorioLanchonete[]>('/l')),
        firstValueFrom(this.api.get<MeResponse>('/me')),
        firstValueFrom(this.api.get<{ email: string | null }>('/plataforma/email-lojista')),
      ]);
      this.favoritas.set(favoritas);
      this.diretorio.set(diretorio);
      this.meNome.set(me.cliente?.nome ?? me.user.name ?? '');
      this.meTelefone.set(me.cliente?.telefone ?? '');
      this.enderecos.set(me.enderecos);
      this.emailLojista.set(plataforma.email);
    } catch {
      this.erro.set('Não foi possível carregar suas lanchonetes. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }

  rotuloTipo(tipo: string | null): string {
    return TIPOS_LANCHONETE.find((t) => t.valor === tipo)?.rotulo ?? '';
  }

  mailtoLojista(): string {
    return `mailto:${this.emailLojista() ?? ''}`;
  }

  logoDa(linha: LinhaLanchonete | LanchoneteFavoritaResumo): string | null {
    return linha.logoUrl ?? (linha.tipo ? logoPadrao(linha.tipo) : null);
  }

  async alternarFavorita(linha: LinhaLanchonete): Promise<void> {
    if (this.ocupada()[linha.id]) return;
    this.erro.set(null);
    this.ocupada.update((m) => ({ ...m, [linha.id]: true }));
    try {
      if (linha.favorita) {
        await this.favoritasSvc.desfavoritar(linha.id);
        this.favoritas.update((lista) => lista.filter((f) => f.lanchonete.id !== linha.id));
      } else {
        const res = await this.favoritasSvc.favoritar(linha.id);
        const lan = this.diretorio().find((d) => d.id === linha.id);
        if (lan) {
          const favorita: Favorita = {
            id: lan.id,
            favoritadaEm: res.favoritadaEm,
            lanchonete: { ...lan, whatsapp: null, corPrincipal: null, fonte: null },
          };
          this.favoritas.update((lista) => [favorita, ...lista]);
        }
      }
    } catch (error) {
      this.erro.set(
        (error as { error?: { message?: string } }).error?.message ??
          'Não foi possível atualizar a favorita.',
      );
    } finally {
      this.ocupada.update((m) => {
        const copia = { ...m };
        delete copia[linha.id];
        return copia;
      });
    }
  }

  async salvarPerfil(): Promise<void> {
    if (this.salvandoPerfil()) return;
    const nome = this.meNome().trim().replace(/\s+/g, ' ');
    const bruto = this.meTelefone().trim();
    const telefone = bruto.replace(/\D/g, '');

    this.perfilErro.set(null);
    this.perfilOk.set('idle');
    if (nome.length < 2 || nome.length > 80) {
      this.perfilErro.set('O nome deve ter entre 2 e 80 caracteres.');
      this.perfilOk.set('erro');
      return;
    }
    if (bruto !== '' && !/^\d{10,13}$/.test(telefone)) {
      this.perfilErro.set('WhatsApp inválido. Informe o número com DDD.');
      this.perfilOk.set('erro');
      return;
    }

    this.salvandoPerfil.set(true);
    try {
      await firstValueFrom(this.api.patch('/me', { nome, telefone: bruto === '' ? '' : telefone }));
      this.meNome.set(nome);
      this.meTelefone.set(bruto === '' ? '' : telefone);
      this.perfilOk.set('ok');
    } catch {
      this.perfilErro.set('Não foi possível salvar. Tente novamente.');
      this.perfilOk.set('erro');
    } finally {
      this.salvandoPerfil.set(false);
    }
  }

  abrirNovoEndereco(): void {
    this.novoEndereco.set({});
    this.enderecoErro.set(null);
    this.novoEnderecoAberto.set(true);
  }

  valorEndereco(campo: string): string {
    return this.novoEndereco()[campo] ?? '';
  }

  padraoNovo(): boolean {
    return Boolean(this.novoEndereco()['padrao']);
  }

  alternarPadraoNovo(): void {
    this.novoEndereco.update((form) => ({ ...form, padrao: form['padrao'] ? '' : '1' }));
  }

  setCampoEndereco(nome: string, valor: string): void {
    this.novoEndereco.update((form) => ({ ...form, [nome]: valor }));
  }

  async salvarEndereco(): Promise<void> {
    if (this.salvandoEndereco()) return;
    this.enderecoErro.set(null);
    const form = this.novoEndereco();
    const obrigatorios = ['rua', 'numero', 'bairro', 'cidade', 'uf'];
    for (const campo of obrigatorios) {
      if (!form[campo]?.trim()) {
        this.enderecoErro.set('Preencha os campos obrigatórios do endereço.');
        return;
      }
    }
    this.salvandoEndereco.set(true);
    try {
      const criado = await firstValueFrom(
        this.api.post<Endereco>('/me/enderecos', {
          rua: form['rua'].trim(),
          numero: form['numero'].trim(),
          complemento: form['complemento']?.trim() || undefined,
          bairro: form['bairro'].trim(),
          cidade: form['cidade'].trim(),
          uf: form['uf'].trim().toUpperCase(),
          cep: form['cep']?.trim() || undefined,
          apelido: form['apelido']?.trim() || undefined,
          padrao: Boolean(form['padrao']),
        }),
      );
      if (criado.padrao) {
        this.enderecos.update((lista) => lista.map((e) => ({ ...e, padrao: false })));
      }
      this.enderecos.update((lista) => [...lista, criado]);
      this.novoEnderecoAberto.set(false);
    } catch (error) {
      this.enderecoErro.set(
        (error as { error?: { message?: string } }).error?.message ??
          'Não foi possível salvar o endereço.',
      );
    } finally {
      this.salvandoEndereco.set(false);
    }
  }

  async removerEndereco(id: string): Promise<void> {
    if (!confirm('Remover este endereço?')) return;
    try {
      await firstValueFrom(this.api.delete<{ ok: boolean }>(`/me/enderecos/${id}`));
      this.enderecos.update((lista) => lista.filter((e) => e.id !== id));
    } catch {
      this.enderecoErro.set('Não foi possível remover o endereço.');
    }
  }

  async definirPadrao(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.patch(`/me/enderecos/${id}`, { padrao: true }));
      this.enderecos.update((lista) => lista.map((e) => ({ ...e, padrao: e.id === id })));
    } catch {
      this.enderecoErro.set('Não foi possível definir o endereço padrão.');
    }
  }

  async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
}
