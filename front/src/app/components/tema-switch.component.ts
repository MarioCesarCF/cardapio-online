import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TemaService } from '../services/tema.service';

@Component({
  selector: 'app-tema-switch',
  imports: [FormsModule, ToggleSwitch],
  template: `
    <div class="tema" role="group" aria-label="Alternar entre tema claro e escuro">
      <i class="pi pi-moon" [class.tema__ativo]="tema.escuro()"></i>
      <p-toggleswitch
        [ngModel]="tema.escuro()"
        (ngModelChange)="tema.definir($event)"
        ariaLabel="Tema escuro"
      />
      <i class="pi pi-sun" [class.tema__ativo]="!tema.escuro()"></i>
    </div>
  `,
  styles: `
    .tema {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--p-content-border-color);
      background: color-mix(in srgb, var(--p-content-background) 82%, transparent);
      backdrop-filter: blur(10px);
      box-shadow: 0 6px 18px -12px rgba(0, 0, 0, 0.5);
    }
    .tema i {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      transition: color 0.2s ease;
    }
    .tema__ativo {
      color: var(--p-primary-color) !important;
    }
  `,
})
export class TemaSwitchComponent {
  readonly tema = inject(TemaService);
}
