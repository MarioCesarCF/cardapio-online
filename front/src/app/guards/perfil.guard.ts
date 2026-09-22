import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PerfilService, PerfilTipo } from '../services/perfil.service';

const DESTINOS: Record<PerfilTipo, string> = {
  'admin-sistema': '/painel-admin',
  dono: '/admin',
  cliente: '/home',
};

export function perfilGuard(perfis: PerfilTipo[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const perfil = inject(PerfilService);
    const router = inject(Router);

    await auth.init();
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth'], { queryParams: { redirect: state.url } });
    }
    try {
      await perfil.carregar(true);
    } catch {
      // segue; se não houver dados o redirect abaixo cai no login
    }
    const principal = perfil.perfilPrincipal();
    if (!principal) {
      return router.createUrlTree(['/auth'], { queryParams: { redirect: state.url } });
    }
    if (perfis.includes(principal)) {
      return true;
    }
    return router.createUrlTree([DESTINOS[principal]]);
  };
}

export const onboardingGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const perfil = inject(PerfilService);
  const router = inject(Router);

  await auth.init();
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth'], { queryParams: { redirect: state.url } });
  }
  await perfil.carregar(true);
  const principal = perfil.perfilPrincipal();
  if (principal === 'dono') {
    return router.createUrlTree(['/admin']);
  }
  if (principal === 'admin-sistema') {
    return router.createUrlTree(['/painel-admin']);
  }
  return true;
};
