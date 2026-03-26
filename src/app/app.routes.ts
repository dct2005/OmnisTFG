import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { CommunitiesComponent } from './communities/communities';
import { InformacionCommunities } from './informacion-communities/informacion-communities';
import { CreateCommunity } from './create-community/create-community';
import { Pagos } from './pagos/pagos';
import { Compras } from './compras/compras';
import { AuthService } from './services/auth';

const guestGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (localStorage.getItem('token') || authService.currentUser()) {
        return router.parseUrl('/home');
    }
    return true;
};
const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (localStorage.getItem('token') || authService.currentUser()) {
        return true;
    }
    return router.parseUrl('/login');
};
export const routes: Routes = [
    { path: 'home', title: 'Inicio', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    { path: 'catalogo', title: 'Catálogo', loadComponent: () => import('./catalog/catalog.component').then(m => m.CatalogComponent) },
    { path: 'game/:id', title: 'Detalles del Juego', loadComponent: () => import('./game-details/game-details.component').then(m => m.GameDetailsComponent) },
    { path: 'login', title: 'Iniciar Sesión', component: LoginComponent, canActivate: [guestGuard] },
    { path: 'register', title: 'Registro', component: RegisterComponent, canActivate: [guestGuard] },
    {
        path: '',
        canActivate: [() => {
            const authService = inject(AuthService);
            const router = inject(Router);
            if (localStorage.getItem('token') || authService.currentUser()) {
                return router.parseUrl('/catalogo');
            }
            return router.parseUrl('/home');
        }],
        component: LoginComponent // Placeholder necesario para que actue el guard
    },
    { path: 'communities', title: 'Comunidades', component: CommunitiesComponent },
    { path: 'informacion-communities/:id', title: 'Información de la Comunidad', component: InformacionCommunities },
    { path: 'crear-comunidad', title: 'Crear Comunidad', component: CreateCommunity, canActivate: [authGuard] },
    { path: 'soporte', title: 'Soporte', loadComponent: () => import('./support/support.component').then(m => m.SupportComponent) },
    { path: 'pagos', title: 'Pagos', component: Pagos },
    { path: 'compras', title: 'Compras', component: Compras },
    { path: 'account', title: 'Detalles de la Cuenta', loadComponent: () => import('./account-details/account-details.component').then(m => m.AccountDetailsComponent) },
    { path: 'perfil/:username', title: 'Perfil', loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent) },
    { path: 'perfil', redirectTo: 'perfil/me', pathMatch: 'full' }
];
