import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  constructor() {
    inject(MarcaService);
  }

  ngOnInit(): void {
    this.auth.init();
  }
}
