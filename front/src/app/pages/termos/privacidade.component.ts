import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TERMO_VERSAO_ATUAL, TERMO_ATUALIZADO_EM } from '../../services/termos';
import { ContatoLgpdComponent } from './contato-lgpd.component';

@Component({
  selector: 'app-privacidade',
  imports: [RouterLink, ContatoLgpdComponent],
  templateUrl: './privacidade.component.html',
  styleUrl: './legal.scss',
})
export class PrivacidadeComponent implements AfterViewInit, OnDestroy {
  readonly VERSAO = TERMO_VERSAO_ATUAL;
  readonly ATUALIZADO_EM = TERMO_ATUALIZADO_EM;

  /** A dica de arrastar só aparece quando a matriz realmente não cabe na tela. */
  readonly matrizEstoura = signal(false);

  private readonly matriz = viewChild<ElementRef<HTMLElement>>('matriz');
  private readonly aoRedimensionar = () => this.medirMatriz();

  ngAfterViewInit(): void {
    this.medirMatriz();
    window.addEventListener('resize', this.aoRedimensionar);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.aoRedimensionar);
  }

  @HostListener('window:orientationchange')
  aoGirar(): void {
    this.medirMatriz();
  }

  private medirMatriz(): void {
    const el = this.matriz()?.nativeElement;
    if (!el) return;
    this.matrizEstoura.set(el.scrollWidth > el.clientWidth + 1);
  }
}
