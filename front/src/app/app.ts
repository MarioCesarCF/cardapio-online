import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { MarcaService } from './services/marca.service';
import { TemaSwitchComponent } from './components/tema-switch.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TemaSwitchComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly appBar = signal(true);

  constructor() {
    inject(MarcaService);
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        const url = evento.urlAfterRedirects;
        this.appBar.set(!(url === '' || url === '/' || url.startsWith('/auth')));
      }
    });
  }

  ngOnInit(): void {
    this.auth.init();
  }
}
