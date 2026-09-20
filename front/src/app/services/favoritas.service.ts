import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface LanchoneteFavoritaResumo {
  id: string;
  slug: string;
  nome: string;
  logoUrl: string | null;
  tipo: string | null;
  enderecoLoja: string | null;
  whatsapp: string | null;
  corPrincipal: string | null;
  fonte: string | null;
}

export interface Favorita {
  id: string;
  favoritadaEm: string;
  lanchonete: LanchoneteFavoritaResumo;
}

@Injectable({ providedIn: 'root' })
export class FavoritasService {
  private readonly api = inject(ApiService);

  list(): Promise<Favorita[]> {
    return firstValueFrom(this.api.get<Favorita[]>('/favoritas'));
  }

  favoritar(lanchoneteId: string): Promise<{ ok: boolean; favoritadaEm: string }> {
    return firstValueFrom(
      this.api.put<{ ok: boolean; favoritadaEm: string }>(`/favoritas/${lanchoneteId}`),
    );
  }

  desfavoritar(lanchoneteId: string): Promise<{ ok: boolean; removidas: number }> {
    return firstValueFrom(
      this.api.delete<{ ok: boolean; removidas: number }>(`/favoritas/${lanchoneteId}`),
    );
  }
}
