import { Injectable, inject, effect, NgZone } from '@angular/core';
import { ChatService } from './chat.service';
import { AuthService } from './auth';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private pollingSubscription?: Subscription;
  private notifiedMessageIds = new Set<number>();
  private isInitialized = false;

  constructor() {
    // Escuchar cambios en el usuario para iniciar/detener el polling
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.startPolling(user.id);
      } else {
        this.stopPolling();
      }
    });
  }

  startPolling(userId: number) {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Polling cada 8 segundos
    this.pollingSubscription = interval(8000).pipe(
      filter(() => !this.router.url.includes('/mensajes')), // No notificar si ya estamos en la pantalla de chat
      switchMap(() => this.chatService.getUnreadMessages(userId))
    ).subscribe({
      next: (messages) => {
        this.handleNewMessages(messages);
      },
      error: (err) => console.error('Error en polling de notificaciones:', err)
    });
  }

  stopPolling() {
    this.pollingSubscription?.unsubscribe();
    this.isInitialized = false;
    this.notifiedMessageIds.clear();
  }

  private handleNewMessages(messages: any[]) {
    messages.forEach(msg => {
      if (!this.notifiedMessageIds.has(msg.id)) {
        this.notifiedMessageIds.add(msg.id);
        this.showNotification(msg);
      }
    });
  }

  private showNotification(msg: any) {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: true,
      confirmButtonText: 'Ver chat',
      timer: 6000,
      timerProgressBar: true,
      background: '#1a103c',
      color: '#fff',
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });

    Toast.fire({
      html: `
        <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
          <img src="${msg.sender_image || 'images/default-avatar.png'}" 
               style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid #7c3aed; object-fit: cover;">
          <div>
            <div style="font-weight: bold; color: #7c3aed; font-size: 0.9rem;">Nuevo mensaje</div>
            <div style="color: #fff; font-size: 0.85rem;"><b>${msg.sender_name}</b> te ha enviado un mensaje</div>
          </div>
        </div>
      `,
      background: 'rgba(26, 16, 60, 0.95)',
      backdrop: 'blur(10px)',
      customClass: {
        popup: 'stylized-toast'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.ngZone.run(() => {
          this.router.navigate(['/mensajes'], { queryParams: { userId: msg.sender_id } });
        });
      }
    });
  }
}
