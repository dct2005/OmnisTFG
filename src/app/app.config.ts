import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { routes } from './app.routes';

// 1. IMPORTANTE: Importar esto
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // 2. IMPORTANTE: Añadir esto. Sin esto, AuthService no funciona.
    provideHttpClient(withFetch()),
    
    provideFirebaseApp(() => initializeApp({
      // Reemplaza esto con tu configuración de Firebase real
      projectId: "TU_PROJECT_ID",
      appId: "TU_APP_ID",
      storageBucket: "TU_STORAGE_BUCKET",
      apiKey: "TU_API_KEY",
      authDomain: "TU_AUTH_DOMAIN",
      messagingSenderId: "TU_MESSAGING_SENDER_ID"
    })),
    provideAuth(() => getAuth())
  ]
};