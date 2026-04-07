import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
declare var Swal: any;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  
  users = signal<any[]>([]);
  reports = signal<any[]>([]);
  stats = signal<any>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  activeTab = signal('users');

  constructor() {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    if (this.activeTab() === 'users') {
      this.loadUsers();
    } else if (this.activeTab() === 'reports') {
      this.loadReports();
    } else if (this.activeTab() === 'stats') {
      this.loadStats();
    }
  }

  loadUsers() {
    this.loading.set(true);
    this.authService.getAllUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar usuarios');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadReports() {
    this.loading.set(true);
    this.authService.getAllReports().subscribe({
      next: (reports) => {
        this.reports.set(reports);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar reportes');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadStats() {
    this.loading.set(true);
    this.authService.getAdminStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        if (data.topGame && data.topGame.game_api_id) {
          this.resolveGameDetails(data.topGame.game_api_id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar estadísticas');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  resolveGameDetails(gameId: string) {
    this.http.get<any[]>(`/api/games?id=${gameId}`).subscribe({
      next: (games) => {
        if (games && games.length > 0) {
          const gameInfo = games[0];
          const currentStats = this.stats();
          if (currentStats && currentStats.topGame) {
            this.stats.set({
              ...currentStats,
              topGame: {
                ...currentStats.topGame,
                name: gameInfo.name,
                image: gameInfo.cover?.url?.replace('t_thumb', 't_cover_big') || 'images/game_placeholder.png',
                genres: gameInfo.genres?.map((g: any) => g.name).join(', ') || 'Varios',
                rating: gameInfo.rating ? Math.round(gameInfo.rating) : 'N/A'
              }
            });
          }
        }
      }
    });
  }

  showDetail(type: string) {
    const s = this.stats();
    if (!s) return;

    let title = '';
    let html = '';
    let icon: 'info' | 'success' = 'info';

    switch (type) {
      case 'users':
        title = 'Detalle de Usuarios';
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Total Registrados:</b> ${s.totalUsers}</p>
            <p><b>Administradores:</b> ${s.adminCount}</p>
            <p><b>Usuarios Normales:</b> ${s.userCount}</p>
            <p><b>Activos hoy:</b> ${s.activeToday}</p>
          </div>
        `;
        break;
      case 'revenue':
        title = 'Análisis de Ingresos';
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Ingresos Totales:</b> ${s.totalRevenue}€</p>
            <p><b>Media por Usuario:</b> ${(s.totalRevenue / (s.totalUsers || 1)).toFixed(2)}€</p>
            <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">
              Nota: Estos ingresos provienen exclusivamente de transacciones de recarga de Peppix.
            </p>
          </div>
        `;
        icon = 'success';
        break;
      case 'economy':
        title = 'Economía de Peppix';
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Peppix en Circulación:</b> ${s.totalPeppix}</p>
            <p><b>Media por Usuario:</b> ${(s.totalPeppix / (s.totalUsers || 1)).toFixed(0)} Peppix</p>
            <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">
              Representa el balance acumulado en todas las billeteras.
            </p>
          </div>
        `;
        break;
      case 'games':
        title = 'Estadísticas de Juegos';
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Juegos en Bibliotecas:</b> ${s.totalGamesSold}</p>
            <p><b>Promedio por Usuario:</b> ${(s.totalGamesSold / (s.totalUsers || 1)).toFixed(1)} juegos</p>
          </div>
        `;
        break;
      case 'support':
        title = 'Gestión de Soporte';
        const ratio = ((s.closedTickets / (s.openTickets + s.closedTickets || 1)) * 100).toFixed(1);
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Tickets Abiertos:</b> ${s.openTickets}</p>
            <p><b>Tickets Cerrados:</b> ${s.closedTickets}</p>
            <p><b>Ratio de Resolución:</b> ${ratio}%</p>
          </div>
        `;
        break;
      case 'communities':
        title = 'Estado de Comunidad';
        html = `
          <div style="text-align: left; color: #fff;">
            <p><b>Comunidades Creadas:</b> ${s.totalCommunities}</p>
            <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">
              Próximamente: Top comunidades con más miembros.
            </p>
          </div>
        `;
        break;
    }

    Swal.fire({
      title: title,
      html: html,
      icon: icon,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      confirmButtonText: 'Entendido'
    });
  }

  updateReportStatus(reportId: number, newStatus: string, adminResponse?: string) {
    this.authService.updateReportStatus(reportId, newStatus, adminResponse).subscribe({
      next: (res: any) => {
        this.reports.update(reports => 
          reports.map(r => r.id === reportId ? { ...r, status: newStatus, admin_response: adminResponse || r.admin_response } : r)
        );
        if (adminResponse) {
          Swal.fire('Enviado', 'Tu respuesta ha sido registrada y el estado actualizado.', 'success');
        }
      },
      error: (err) => {
        alert('Error al actualizar el estado del reporte');
        console.error(err);
      }
    });
  }

  showReportDetail(report: any) {
    Swal.fire({
      title: `<span style="color: #7c3aed">Reporte #${report.id}</span>`,
      html: `
        <div style="text-align: left; color: #fff; font-family: 'Inter', sans-serif;">
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);">
            <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">Usuario</p>
            <p style="margin: 0; font-weight: bold; font-size: 1.1rem;">${report.user_name} <span style="font-weight: normal; font-size: 0.9rem; color: #aaa;">(${report.user_email})</span></p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
               <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Categoría</p>
               <p style="margin: 0; font-weight: 600;">${report.category}</p>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
               <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Estado</p>
               <p style="margin: 0; font-weight: 600; color: ${report.status === 'open' ? '#00f2ff' : '#00ff00'}">${report.status.toUpperCase()}</p>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #888; text-transform: uppercase;">Asunto</p>
            <p style="margin: 0; font-weight: bold;">${report.subject}</p>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">
            <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #888; text-transform: uppercase;">Detalles</p>
            <p style="margin: 0; line-height: 1.5; color: #ddd;">${report.details}</p>
          </div>

          ${report.admin_response ? `
            <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(124, 58, 237, 0.3);">
              <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #a855f7; text-transform: uppercase;">Tu Respuesta Anterior</p>
              <p style="margin: 0; color: #fff;">${report.admin_response}</p>
            </div>
          ` : ''}

          <div id="reply-container" style="display: none;">
            <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #888; text-transform: uppercase;">Redactar Respuesta</p>
            <textarea id="admin-reply-text" style="width: 100%; min-height: 100px; background: rgba(0,0,0,0.2); border: 1px solid #7c3aed; border-radius: 8px; color: #fff; padding: 10px; margin-bottom: 20px; outline: none;"></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      showDenyButton: true,
      denyButtonText: 'Contestar',
      confirmButtonText: report.status === 'open' ? 'Dar por terminado' : 'Reabrir',
      confirmButtonColor: report.status === 'open' ? '#00ff00' : '#ffaa00',
      denyButtonColor: '#7c3aed',
      background: '#1a103c',
      color: '#fff',
      customClass: {
        popup: 'swal-premium-popup'
      },
      preDeny: () => {
        const container = document.getElementById('reply-container');
        const textarea = document.getElementById('admin-reply-text') as HTMLTextAreaElement;
        
        if (container?.style.display === 'none') {
          container.style.display = 'block';
          textarea?.focus();
          return false; // Evita que se cierre el modal
        }
        
        const reply = textarea?.value;
        if (!reply || reply.trim().length < 5) {
          Swal.showValidationMessage('La respuesta es demasiado corta');
          return false;
        }
        return { reply: reply };
      }
    }).then((result: any) => {
      if (result.isConfirmed) {
        const nextStatus = report.status === 'open' ? 'closed' : 'open';
        this.updateReportStatus(report.id, nextStatus);
      } else if (result.isDenied && result.value?.reply) {
        this.updateReportStatus(report.id, 'closed', result.value.reply);
      }
    });
  }

  deleteUser(userId: number, username: string) {
    if (confirm(`¿Estás seguro de que deseas eliminar al usuario ${username}? Esta acción es irreversible y borrará todos sus datos.`)) {
      this.authService.deleteUser(userId).subscribe({
        next: () => {
          this.users.update(users => users.filter(u => u.id !== userId));
          // Si el usuario borrado tenía reportes, podríamos refrescarlos
          if (this.activeTab() === 'reports') this.loadReports();
          alert('Usuario eliminado correctamente');
        },
        error: (err) => {
          alert('Error al eliminar usuario');
          console.error(err);
        }
      });
    }
  }

  setTab(tab: string) {
    this.activeTab.set(tab);
    this.error.set(null);
    this.loadData();
  }
}
