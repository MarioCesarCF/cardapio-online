import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export type PerfilTipo = 'cliente' | 'dono' | 'admin-sistema';

export interface PerfilDados {
  lanchonetes: { id: string; nome: string; slug: string }[];
  adminSistema: boolean;
  adminSistemaFuncao: string | null;
}

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly api = inject(ApiService);

  readonly dados = signal<PerfilDados | null>(null);
  readonly carregado = signal(false);
  readonly carregando = signal(false);

  readonly ehAdminSistema = computed(() => this.dados()?.adminSistema === true);
  readonly ehDono = computed(() => (this.dados()?.lanchonetes.length ?? 0) > 0);

  readonly perfilPrincipal = computed<PerfilTipo | null>(() => {
    const d = this.dados();
    if (!d) return null;
    if (d.adminSistema) return 'admin-sistema';
    if (d.lanchonetes.length > 0) return 'dono';
    return 'cliente';
  });

  private promessa: Promise<void> | null = null;

  async carregar(forcar = false): Promise<void> {
    if (!forcar && this.carregado()) return;
    if (this.promessa) return this.promessa;
    this.promessa = (async () => {
      this.carregando.set(true);
      try {
        const body = await firstValueFrom(this.api.get<PerfilDados>('/me'));
        this.dados.set(body);
        this.carregado.set(true);
      } finally {
        this.carregando.set(false);
      }
    })();
    try {
      await this.promessa;
    } finally {
      this.promessa = null;
    }
  }

  limpar(): void {
    this.promessa = null;
    this.dados.set(null);
    this.carregado.set(false);
  }
}
