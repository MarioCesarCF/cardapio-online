import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TERMO_VERSAO_ATUAL, TERMO_ATUALIZADO_EM } from '../../services/termos';
import { ContatoLgpdComponent } from './contato-lgpd.component';

@Component({
  selector: 'app-privacidade',
  imports: [RouterLink, ContatoLgpdComponent],
  templateUrl: './privacidade.component.html',
  styleUrl: './legal.scss',
})
export class PrivacidadeComponent {
  readonly VERSAO = TERMO_VERSAO_ATUAL;
  readonly ATUALIZADO_EM = TERMO_ATUALIZADO_EM;
}
