import { Component, computed, inject } from '@angular/core'; // Añadimos inject para modernidad
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  // Usamos inject o mantenemos el constructor, pero el servicio debe ser accesible
  constructor(public authService: AuthService) { }

  // Estas son las señales que usaremos en el HTML
  isLoggedIn = computed(() => !!this.authService.currentUser());

  usernameValue = computed(() => {
    const user = this.authService.currentUser();
    return user?.name || user?.username || 'Usuario';
  });

  logout() {
    this.authService.logout();
  }
}