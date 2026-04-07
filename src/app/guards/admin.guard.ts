import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.currentUser();

    if (user && user.role === 'administrador') {
        return true;
    }

    // Si no es admin, redirigir al home o mostrar error
    return router.parseUrl('/home');
};
