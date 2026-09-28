import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { MarcaService } from './services/marca.service';
import { PerfilService } from './services/perfil.service';
import { TemaSwitchComponent } from './components/tema-switch.component';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TemaSwitchComponent, Toast],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly perfil = inject(PerfilService);
  readonly appBar = signal(true);

  /**
   * Clicar na logo leva para a "home" de quem está logado: cliente → /home,
   * lanchonete (dono) → /admin, admin da plataforma → /painel-admin e,
   * sem sessão, para a tela de login.
   */
  readonly rotaHome = signal('/');

  constructor() {
    inject(MarcaService);
    this.definirRotaHome();
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        const url = evento.urlAfterRedirects;
        this.appBar.set(!(url === '' || url === '/' || url.startsWith('/auth')));
        void this.definirRotaHome();
      }
    });
  }

  ngOnInit(): void {
    this.auth.init();
  }

  private async definirRotaHome(): Promise<void> {
    const principal = this.perfil.perfilPrincipal();
    if (principal) {
      this.rotaHome.set(
        principal === 'admin-sistema' ? '/painel-admin' : principal === 'dono' ? '/admin' : '/home',
      );
      return;
    }
    try {
      // A sessão (e a troca do token opaco pelo JWT) precisa estar pronta ANTES do
      // `GET /me`: o construtor roda antes do `ngOnInit`, então sem esta espera a
      // chamada saía sem `Authorization` e o back respondia 401 "Sessão ausente"
      // no console a cada reload. `init()` é cacheado, não custa nada depois.
      await this.auth.init();
      // Sem sessão nem vale a pena pedir o perfil: só geraria 401 no console de
      // quem ainda não entrou (o destino abaixo já cai em '/').
      if (this.auth.isAuthenticated()) {
        await this.perfil.carregar();
      }
    } catch {
      // sem sessão ou rede — cai no login
    }
    const atual = this.perfil.perfilPrincipal();
    this.rotaHome.set(
      atual === 'admin-sistema'
        ? '/painel-admin'
        : atual === 'dono'
          ? '/admin'
          : atual === 'cliente'
            ? '/home'
            : '/',
    );
  }
}
