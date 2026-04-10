import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { filter } from 'rxjs/operators';
import { NotificationService } from './services/notification.service';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Login');

  // Señal que controla si la navbar se ve o no (por defecto true)
  showNavbar = signal(true);

  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  constructor() {
    // Escuchamos cada vez que la navegación termina
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {

      const currentUrl = event.urlAfterRedirects || event.url;
      this.showNavbar.set(true);

      // Mapeo automático de actividad según la ruta
      let activity = 'Explorando Omnis';
      if (currentUrl.includes('/home')) activity = 'En el inicio';
      else if (currentUrl.includes('/catalogo')) activity = 'Mirando el catálogo';
      else if (currentUrl.includes('/game/')) activity = 'Viendo detalles de un juego';
      else if (currentUrl.includes('/communities')) activity = 'Mirando comunidades';
      else if (currentUrl.includes('/informacion-communities/')) activity = 'En una comunidad';
      else if (currentUrl.includes('/perfil/')) activity = 'Viendo un perfil';
      else if (currentUrl.includes('/social')) activity = 'En la sección social';
      else if (currentUrl.includes('/mensajes')) activity = 'Chateando';
      else if (currentUrl.includes('/compras')) activity = 'Gestionando Peppix';
      else if (currentUrl.includes('/account')) activity = 'Ajustando su cuenta';
      else if (currentUrl.includes('/soporte')) activity = 'Contactando con soporte';

      this.authService.updateActivity(activity);
    });
  }
}