import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
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
  isNotificationsOpen = signal(false);
  private statusInterval: any;
  private router = inject(Router);

  ngOnInit() {
    // Hace un "polling" (consulta periódica) cada 80 segundos a la base de datos (ligeramente aumentado para salvar cuota)
    this.statusInterval = setInterval(() => {
      if (this.isLoggedIn()) {
        this.authService.getLightweightUpdate().subscribe({
          next: (update) => {
            const user = this.authService.currentUser();
            if (user && update) {
              // Actualizamos solo lo necesario en el signal global
              this.authService.currentUser.set({
                ...user,
                estado: update.estado,
                last_activity: update.last_activity,
                xp: update.xp,
                peppix: update.peppix,
                unreadCount: update.unreadNotificationsCount, // Guardamos el conteo para la UI
                // Mockeamos la estructura de notificaciones si es necesario o manejamos el conteo directo
                unreadMessagesCount: update.unreadMessagesCount
              });
            }
          }
        });
      }
    }, 80000);
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
    this.isNotificationsOpen.set(false);
  }

  toggleNotifications() {
    this.isNotificationsOpen.update(v => !v);
    this.isDropdownOpen.set(false);
    
    // Si abrimos y hay notificaciones, marcamos como leídas después de un pequeño delay
    if (this.isNotificationsOpen() && this.unreadCount() > 0) {
      setTimeout(() => {
        this.authService.markNotificationsAsRead().subscribe();
      }, 3000);
    }
  }

  notifications = computed(() => this.authService.currentUser()?.unreadNotifications || []);
  unreadCount = computed(() => {
    const user = this.authService.currentUser();
    return user?.unreadCount ?? user?.unreadNotifications?.length ?? 0;
  });

  handleNotificationClick(note: any) {
    this.isNotificationsOpen.set(false);
    
    // Marcar como leída (ya lo hace el toggle si estaba abierta, pero aseguramos)
    this.authService.markNotificationsAsRead().subscribe();

    if (!note.link) return;

    // Navegar manualmente para manejar queryParams correctamente
    if (note.link.includes('?')) {
      const [path, query] = note.link.split('?');
      const params: any = {};
      query.split('&').forEach((part: string) => {
        const [key, val] = part.split('=');
        params[key] = val;
      });
      this.router.navigate([path], { queryParams: params });
    } else {
      this.router.navigateByUrl(note.link);
    }
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