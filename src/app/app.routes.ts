import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { CommunitiesComponent } from './communities/communities';
import { InformacionCommunities } from './informacion-communities/informacion-communities';
import { CreateCommunity } from './create-community/create-community';
import { Pagos } from './pagos/pagos';
import { Compras } from './compras/compras';

export const routes: Routes = [
    { path: 'home', title: 'Inicio', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    { path: 'catalogo', title: 'Catálogo', loadComponent: () => import('./catalog/catalog.component').then(m => m.CatalogComponent) },
    { path: 'game/:id', title: 'Detalles del Juego', loadComponent: () => import('./game-details/game-details.component').then(m => m.GameDetailsComponent) },
    { path: 'login', title: 'Iniciar Sesión', component: LoginComponent },
    { path: 'register', title: 'Registro', component: RegisterComponent },
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'communities', title: 'Comunidades', component: CommunitiesComponent },
    { path: 'informacion-communities/:id', title: 'Información de la Comunidad', component: InformacionCommunities },
    { path: 'crear-comunidad', title: 'Crear Comunidad', component: CreateCommunity },
    { path: 'soporte', title: 'Soporte', loadComponent: () => import('./support/support.component').then(m => m.SupportComponent) },
    { path: 'pagos', title: 'Pagos', component: Pagos },
    { path: 'compras', title: 'Compras', component: Compras },
    { path: 'account', title: 'Detalles de la Cuenta', loadComponent: () => import('./account-details/account-details.component').then(m => m.AccountDetailsComponent) }
];
