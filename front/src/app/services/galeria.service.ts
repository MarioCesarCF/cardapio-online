import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface GaleriaImagem {
  id: string;
  categoria: string;
  keywords: string[];
  url: string;
  autor: string | null;
  fonte: string | null;
}

export interface GaleriaCategoria {
  slug: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class GaleriaService {
  private readonly api = inject(ApiService);

  categorias(): Promise<GaleriaCategoria[]> {
    return firstValueFrom(this.api.get<GaleriaCategoria[]>('/galeria/categorias'));
  }

  list(q?: string, categoria?: string): Promise<GaleriaImagem[]> {
    const params = new URLSearchParams();
    if (q?.trim()) params.set('q', q.trim().toLowerCase());
    if (categoria) params.set('categoria', categoria);
    const query = params.toString() ? `?${params}` : '';
    return firstValueFrom(this.api.get<GaleriaImagem[]>(`/galeria${query}`));
  }
}
