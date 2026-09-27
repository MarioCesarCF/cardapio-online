import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface PlataformaResposta {
  email: string | null;
}

/**
 * Bloco de contato (LGPD) compartilhado por `/termos` e `/privacidade`.
 * O e-mail vem de `GET /plataforma/email-lojista` (configurado pelo admin raiz);
 * sem ele, mostra o texto de fallback.
 */
@Component({
  selector: 'app-contato-lgpd',
  template: `
    @if (email(); as contato) {
      <p>
        Escreva para
        <a [href]="'mailto:' + contato">{{ contato }}</a
        >. Guarde a data do seu contato e descreva o assunto (dados da conta, pedido, lanchonete
        etc.) para que possamos responder.
      </p>
    } @else {
      <p>
        Utilize o e-mail de contato da plataforma indicado na página principal (<code>/home</code>).
        Se preferir, também pode escrever pelo perfil da sua conta.
      </p>
    }
  `,
})
export class ContatoLgpdComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly email = signal<string | null>(null);

  ngOnInit(): void {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const plataforma = await firstValueFrom(
        this.api.get<PlataformaResposta>('/plataforma/email-lojista'),
      );
      this.email.set(plataforma.email);
    } catch {
      // Sem e-mail configurado: o template mostra o texto de fallback.
    }
  }
}
