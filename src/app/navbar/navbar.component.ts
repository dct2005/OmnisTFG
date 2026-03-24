import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth';
import { CommonModule } from '@angular/common'; // IMPORTANTE para el ngClass

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  isDropdownOpen = signal(false);
  private statusInterval: any;

  ngOnInit() {
    // Hace un "polling" (consulta periódica) cada 5 segundos a la base de datos
    // Esto conectará los cambios manuales hechos en BBDD con la interfaz
    this.statusInterval = setInterval(() => {
      if (this.isLoggedIn()) {
        this.authService.fetchCurrentUser();
      }
    }, 5000);
  }

  ngOnDestroy() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  get userEstado() {
    const user = this.authService.currentUser();
    return user?.estado || 'desconectado';
  }

  constructor(public authService: AuthService) { }

  isLoggedIn = computed(() => !!this.authService.currentUser());

  usernameValue = computed(() => {
    const user = this.authService.currentUser();
    return user?.name || user?.username || 'Usuario';
  });

  toggleDropdown() {
    this.isDropdownOpen.update(v => !v);
  }

  changeStatus(status: string, event: Event) {
    event.stopPropagation();
    this.authService.updateStatus(status);
    this.isDropdownOpen.set(false);
  }

  logout(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.authService.logout();
    this.isDropdownOpen.set(false);
  }
}