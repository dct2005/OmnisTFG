import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
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
import { adminGuard } from './guards/admin.guard';

// ... (existing guards)

export const routes: Routes = [
    {
        path: 'home', title: 'Inicio', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent), canActivate: [() => {
            const authService = inject(AuthService);
            const router = inject(Router);
            if (authService.currentUser()?.role === 'administrador') {
                return router.parseUrl('/admin');
            }
            return true;
        }]
    },
    { path: 'catalogo', title: 'Catálogo', loadComponent: () => import('./catalog/catalog.component').then(m => m.CatalogComponent) },
    { path: 'game/:id', title: 'Detalles del Juego', loadComponent: () => import('./game-details/game-details.component').then(m => m.GameDetailsComponent) },
    { path: 'login', title: 'Iniciar Sesión', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent), canActivate: [guestGuard] },
    { path: 'register', title: 'Registro', loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent), canActivate: [guestGuard] },
    {
        path: '',
        canActivate: [() => {
            const authService = inject(AuthService);
            const router = inject(Router);
            const user = authService.currentUser();
            if (localStorage.getItem('token') || user) {
                if (user?.role === 'administrador') {
                    return router.parseUrl('/admin');
                }
                return router.parseUrl('/catalogo');
            }
            return router.parseUrl('/home');
        }],
        loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) // Placeholder necesario para que actue el guard
    },
    { path: 'communities', title: 'Comunidades', loadComponent: () => import('./communities/communities').then(m => m.CommunitiesComponent) },
    { path: 'informacion-communities/:id', title: 'Información de la Comunidad', loadComponent: () => import('./informacion-communities/informacion-communities').then(m => m.InformacionCommunities) },
    { path: 'crear-comunidad', title: 'Crear Comunidad', loadComponent: () => import('./create-community/create-community').then(m => m.CreateCommunity), canActivate: [authGuard] },
    { path: 'soporte', title: 'Soporte', loadComponent: () => import('./support/support.component').then(m => m.SupportComponent) },
    { path: 'admin', title: 'Administración', loadComponent: () => import('./admin/admin-dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [adminGuard] },
    { path: 'pagos', title: 'Pagos', loadComponent: () => import('./pagos/pagos').then(m => m.Pagos) },
    { path: 'compras', title: 'Compras', loadComponent: () => import('./compras/compras').then(m => m.Compras) },
    { path: 'account', title: 'Detalles de la Cuenta', loadComponent: () => import('./account-details/account-details.component').then(m => m.AccountDetailsComponent) },
    { path: 'perfil/:username', title: 'Perfil', loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent) },
    { path: 'mensajes', title: 'Mensajes', loadComponent: () => import('./direct-messages/direct-messages').then(m => m.DirectMessagesComponent), canActivate: [authGuard] },
    { path: 'social', title: 'Social', loadComponent: () => import('./social/social.component').then(m => m.SocialComponent) },
    { path: 'perfil', redirectTo: 'perfil/me', pathMatch: 'full' }
];
