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
      apiKey: "AIzaSyCm_eSF_6WNT8QDvQ5PjnAr-XeCKxLHuNo",
      authDomain: "omnistfg.firebaseapp.com",
      projectId: "omnistfg",
      storageBucket: "omnistfg.firebasestorage.app",
      messagingSenderId: "670880231687",
      appId: "1:670880231687:web:083457a63eaa54527d55a2",
      measurementId: "G-MJWWNEXKF2"
    })),
    provideAuth(() => getAuth())
  ]
};