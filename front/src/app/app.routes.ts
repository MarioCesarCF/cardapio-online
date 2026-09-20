import { Routes } from '@angular/router';
import { AuthComponent } from './pages/auth/auth.component';
import { CardapioComponent } from './pages/cardapio/cardapio.component';
import { AdminHomeComponent } from './pages/admin/admin-home.component';
import { AdminShellComponent } from './pages/admin/admin-shell.component';
import { AdminConfigComponent } from './pages/admin/admin-config.component';
import { AdminCardapioComponent } from './pages/admin/admin-cardapio.component';
import { AdminPedidosComponent } from './pages/admin/admin-pedidos.component';
import { MeusPedidosComponent } from './pages/meus-pedidos/meus-pedidos.component';
import { OnboardingComponent } from './pages/onboarding/onboarding.component';
import { PainelAdminComponent } from './pages/admin/painel-admin.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: AuthComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'minhas-pedidos', component: MeusPedidosComponent, canActivate: [authGuard] },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [authGuard] },
  { path: 'painel-admin', component: PainelAdminComponent, canActivate: [authGuard] },
  {
    path: 'admin',
    component: AdminHomeComponent,
    canActivate: [authGuard],
  },
  {
    path: 'admin/:slug',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'config', pathMatch: 'full' },
      { path: 'config', component: AdminConfigComponent },
      { path: 'cardapio', component: AdminCardapioComponent },
      { path: 'pedidos', component: AdminPedidosComponent },
    ],
  },
  { path: ':slug', component: CardapioComponent },
  { path: '**', redirectTo: '' },
];
