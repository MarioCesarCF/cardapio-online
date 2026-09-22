import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { TERMO_VERSAO_ATUAL, TERMO_ATUALIZADO_EM } from '../../services/termos';

interface PlataformaResposta {
  email: string | null;
}

@Component({
  selector: 'app-termos',
  templateUrl: './termos.component.html',
  styleUrl: './termos.component.scss',
})
export class TermosComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly emailContato = signal<string | null>(null);
  readonly VERSAO = TERMO_VERSAO_ATUAL;
  readonly ATUALIZADO_EM = TERMO_ATUALIZADO_EM;

  ngOnInit(): void {
    void this.carregarContato();
  }

  private async carregarContato(): Promise<void> {
    try {
      const plataforma = await firstValueFrom(
        this.api.get<PlataformaResposta>('/plataforma/email-lojista'),
      );
      this.emailContato.set(plataforma.email);
    } catch {
      // Sem e-mail configurado a página segue sem bloco de contato.
    }
  }
}
