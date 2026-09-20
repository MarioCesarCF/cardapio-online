import { Injectable, signal } from '@angular/core';
import { aplicarCorMarca, COR_MARCA_PADRAO } from './cor-marca';

@Injectable({ providedIn: 'root' })
export class MarcaService {
  readonly cor = signal<string>(COR_MARCA_PADRAO);

  constructor() {
    aplicarCorMarca(null);
  }

  aplicar(cor?: string | null): void {
    this.cor.set(cor || COR_MARCA_PADRAO);
    aplicarCorMarca(cor);
  }
}
