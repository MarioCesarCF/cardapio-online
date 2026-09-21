import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { TemaService } from '../services/tema.service';

@Component({
  selector: 'app-tema-switch',
  imports: [Button],
  template: `
    <p-button
      [icon]="tema.escuro() ? 'pi pi-sun' : 'pi pi-moon'"
      [rounded]="true"
      [text]="true"
      [ariaLabel]="tema.escuro() ? 'Ativar tema claro' : 'Ativar tema escuro'"
      [title]="tema.escuro() ? 'Ativar tema claro' : 'Ativar tema escuro'"
      (onClick)="tema.definir(!tema.escuro())"
    />
  `,
})
export class TemaSwitchComponent {
  readonly tema = inject(TemaService);
}
