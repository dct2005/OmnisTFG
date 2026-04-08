import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { filter } from 'rxjs/operators';
import { NotificationService } from './services/notification.service';

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

  constructor() {
    // Escuchamos cada vez que la navegación termina
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {

      const currentUrl = event.urlAfterRedirects || event.url;
      this.showNavbar.set(true);
    });
  }
}