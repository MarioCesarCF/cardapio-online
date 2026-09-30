import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { AuthService } from '../services/auth.service';
import { PerfilService } from '../services/perfil.service';
import { TemaService } from '../services/tema.service';

/** Tira query string/hash e barra final para comparar rotas ("/home?x=1" → "/home"). */
function rotaLimpa(url: string): string {
  const limpo = url.split('?')[0].split('#')[0];
  return limpo.length > 1 && limpo.endsWith('/') ? limpo.slice(0, -1) : limpo;
}

/**
 * Menu hambúrguer global (app bar): reúne a navegação entre telas que morava
 * espalhada no topo de cada página (Meus pedidos, Página principal, Sair…).
 * A ordem é sempre navegação → tema → Sair, e o item que leva à tela em que o
 * usuário está não aparece.
 */
@Component({
  selector: 'app-menu-nav',
  imports: [Button, Menu],
  template: `
    <p-button
      icon="pi pi-bars"
      [rounded]="true"
      [text]="true"
      ariaLabel="Abrir o menu"
      title="Menu"
      (onClick)="menu.toggle($event)"
    />
    <p-menu #menu [model]="itens()" [popup]="true" appendTo="body" styleClass="menu-nav" />
  `,
})
export class MenuNavComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly perfil = inject(PerfilService);
  private readonly tema = inject(TemaService);

  private readonly url = signal('');

  readonly itens = computed<MenuItem[]>(() => {
    const url = rotaLimpa(this.url());
    const perfil = this.perfil.perfilPrincipal();
    const logado = this.auth.isAuthenticated();
    const itens: MenuItem[] = [];

    const add = (rotulo: string, icone: string, rota: string): void => {
      if (this.naTela(url, rota)) return;
      itens.push({ label: rotulo, icon: icone, routerLink: rota });
    };

    // No onboarding o lojista ainda não tem lanchonete: os itens de perfil
    // (que o `perfilGuard` mandaria de volta para a mesma tela) só poluiriam.
    if (perfil && url !== '/onboarding') {
      if (perfil === 'admin-sistema') {
        add('Painel da plataforma', 'pi pi-shield', '/painel-admin');
      }
      if (perfil === 'dono') {
        const slug = this.perfil.dados()?.lanchonetes[0]?.slug;
        if (slug) {
          add('Dados cadastrados', 'pi pi-id-card', `/admin/${slug}/config`);
          add('Configuração de Cardápio', 'pi pi-list', `/admin/${slug}/cardapio`);
          add('Pedidos', 'pi pi-receipt', `/admin/${slug}/pedidos`);
          // Abre em outra aba: é a visão do cliente, não o painel de trabalho.
          if (!this.naTela(url, `/${slug}`)) {
            itens.push({
              label: 'Cardápio público',
              icon: 'pi pi-external-link',
              command: () => window.open(`/${slug}`, '_blank', 'noopener'),
            });
          }
        }
      }
      if (perfil === 'cliente') {
        add('Página principal', 'pi pi-home', '/home');
        add('Meus pedidos', 'pi pi-receipt', '/meus-pedidos');
      }
    }

    add('Termos de Uso', 'pi pi-file', '/termos');
    add('Política de Privacidade', 'pi pi-lock', '/privacidade');
    if (!logado) {
      add('Voltar para o login', 'pi pi-sign-in', '/auth');
    }

    itens.push({ separator: true });
    itens.push({
      label: this.tema.escuro() ? 'Tema claro' : 'Tema escuro',
      icon: this.tema.escuro() ? 'pi pi-sun' : 'pi pi-moon',
      command: () => this.tema.alternar(),
    });

    if (logado) {
      itens.push({ separator: true });
      itens.push({
        label: 'Sair',
        icon: 'pi pi-sign-out',
        styleClass: 'menu-nav__sair',
        command: () => {
          void this.sair();
        },
      });
    }

    return itens;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => this.url.set(evento.urlAfterRedirects));
    this.url.set(this.router.url);
  }

  /** O item que aponta para a tela atual é dispensável. */
  private naTela(url: string, rota: string): boolean {
    const alvo = rotaLimpa(rota);
    if (alvo === '/' || alvo === '/auth') {
      return url === '/' || url === '/auth' || url.startsWith('/auth/');
    }
    // `/admin` é prefixo de `/admin/:slug/...`: match exato aqui, senão um item
    // apontando para `/admin` sumiria dentro das telas do painel.
    if (alvo === '/admin') return url === '/admin';
    return url === alvo || url.startsWith(`${alvo}/`);
  }

  private async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
}
