import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { CommunitiesComponent } from './communities/communities';
import { InformacionCommunities } from './informacion-communities/informacion-communities';
import { CreateCommunity } from './create-community/create-community';


export const routes: Routes = [
    { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    { path: 'catalogo', loadComponent: () => import('./catalog/catalog.component').then(m => m.CatalogComponent) },
    { path: 'game/:id', loadComponent: () => import('./game-details/game-details.component').then(m => m.GameDetailsComponent) },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'communities', component: CommunitiesComponent },
    { path: 'informacion-communities/:id', component: InformacionCommunities },
    { path: 'crear-comunidad', component: CreateCommunity },
    { path: 'soporte', loadComponent: () => import('./support/support.component').then(m => m.SupportComponent) }
];
