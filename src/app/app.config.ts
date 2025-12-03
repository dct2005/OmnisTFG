import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// 1. IMPORTANTE: Importar esto
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),

    // 2. IMPORTANTE: Añadir esto. Sin esto, AuthService no funciona.
    provideHttpClient(withFetch())
  ]
};