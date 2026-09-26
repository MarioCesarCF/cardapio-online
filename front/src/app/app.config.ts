import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';

// Locale pt-BR: pipes com locale explícito (ex.: currency) e o LOCALE_ID padrão usam
// vírgula como separador decimal e data no formato brasileiro.
registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    MessageService,
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    providePrimeNG({
      ripple: true,
      translation: {
        aria: {
          close: 'Fechar',
          previous: 'Anterior',
          next: 'Próximo',
          trueLabel: 'Sim',
          falseLabel: 'Não',
          nullLabel: 'Nenhum',
          selectAll: 'Selecionar todos',
          unselectAll: 'Desmarcar todos',
        },
      },
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: false,
        },
      },
    }),
  ],
};
