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
import { HomeComponent } from './pages/home/home.component';
import { onboardingGuard, perfilGuard } from './guards/perfil.guard';

export const routes: Routes = [
  { path: '', component: AuthComponent },
  { path: 'auth', component: AuthComponent },
  // Páginas públicas de texto: lazy para não pesar no bundle inicial.
  {
    path: 'termos',
    loadComponent: () => import('./pages/termos/termos.component').then((m) => m.TermosComponent),
  },
  {
    path: 'privacidade',
    loadComponent: () =>
      import('./pages/termos/privacidade.component').then((m) => m.PrivacidadeComponent),
  },
  {
    path: 'meus-pedidos',
    component: MeusPedidosComponent,
    canActivate: [perfilGuard(['cliente'])],
  },
  // Encerramento de conta: o questionário é opcional e a página sempre
  // confirma antes. Lazy para não pesar no bundle inicial.
  {
    path: 'encerrar',
    loadComponent: () =>
      import('./pages/encerramento/encerramento.component').then((m) => m.EncerramentoComponent),
    canActivate: [perfilGuard(['cliente', 'dono'])],
  },
  { path: 'home', component: HomeComponent, canActivate: [perfilGuard(['cliente'])] },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [onboardingGuard] },
  {
    path: 'painel-admin',
    component: PainelAdminComponent,
    canActivate: [perfilGuard(['admin-sistema'])],
  },
  {
    path: 'admin',
    component: AdminHomeComponent,
    canActivate: [perfilGuard(['dono'])],
  },
  {
    path: 'admin/:slug',
    component: AdminShellComponent,
    canActivate: [perfilGuard(['dono'])],
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
