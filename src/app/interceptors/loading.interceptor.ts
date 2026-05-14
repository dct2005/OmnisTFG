import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { finalize } from 'rxjs/operators';
import { timer, Subscription } from 'rxjs';

let activeRequests = 0;
let loadingTimer: Subscription | null = null;

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  
  if (activeRequests === 0) {
    // Mostrar el cargador solo si la solicitud demora más de 3 segundos
    loadingTimer = timer(3000).subscribe(() => {
      loadingService.setLoading(true);
    });
  }
  
  activeRequests++;

  return next(req).pipe(
    finalize(() => {
      activeRequests--;
      if (activeRequests === 0) {
        if (loadingTimer) {
          loadingTimer.unsubscribe();
          loadingTimer = null;
        }
        loadingService.setLoading(false);
      }
    })
  );
};
