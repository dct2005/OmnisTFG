import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { CommunityService } from '../services/community.service';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
declare var Swal: any;
declare var Chart: any;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private communityService = inject(CommunityService);
  private http = inject(HttpClient);
  private router = inject(Router);
  
  users = signal<any[]>([]);
  reports = signal<any[]>([]);
  stats = signal<any>(null);
  communities = signal<any[]>([]);
  transactions = signal<any[]>([]);
  games = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  activeTab = signal('users');
  searchQuery = signal('');

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.users();
    if (!q) return all;
    
    return all.filter(u => 
      u.username?.toLowerCase().includes(q) || 
      u.email?.toLowerCase().includes(q) ||
      u.id?.toString().includes(q)
    );
  });

  filteredGames = computed(() => {
    return this.games();
  });

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
    } else if (this.activeTab() === 'communities') {
      this.loadCommunities();
    } else if (this.activeTab() === 'transactions') {
      this.loadAllTransactions();
    } else if (this.activeTab() === 'games') {
      this.searchGames(); // Usar búsqueda en lugar de carga estática
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

  loadCommunities() {
    this.loading.set(true);
    this.authService.getAllCommunities().subscribe({
      next: (data) => {
        this.communities.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar comunidades');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadAllTransactions() {
    this.loading.set(true);
    this.authService.getAllTransactionsAdmin().subscribe({
      next: (data) => {
        this.transactions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar historial de transacciones');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadGames() {
    this.loading.set(true);
    this.authService.getAllGamesAdmin().subscribe({
      next: (data) => {
        this.games.set(data.map(g => ({ ...g, sales_count: parseInt(g.sales_count, 10) })));
        this.loading.set(false);
        this.resolveMultipleGames(data.map(g => g.game_api_id));
      },
      error: (err) => {
        this.error.set('Error al cargar juegos');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  // Nueva función para buscar en el catálogo completo
  searchGames() {
    const query = this.searchQuery().trim();
    if (!query) {
      this.loadGames();
      return;
    }

    this.loading.set(true);
    // 1. Buscar en IGDB
    this.http.get<any[]>(`/api/games?search=${query}`).subscribe({
      next: (igdbGames) => {
        // 2. Obtener ventas de todos los juegos para cruzar datos
        this.authService.getAllGamesAdmin().subscribe({
          next: (salesData) => {
            const results = igdbGames.map(ig => {
              const sales = salesData.find(s => s.game_api_id.toString() === ig.id.toString());
              return {
                game_api_id: ig.id.toString(),
                name: ig.name,
                image: ig.cover?.url?.replace('t_thumb', 't_cover_big'),
                sales_count: sales ? parseInt(sales.sales_count, 10) : 0
              };
            });
            this.games.set(results);
            this.loading.set(false);
          },
          error: () => {
             // Fallback: mostrar solo resultados de IGDB sin ventas
             this.games.set(igdbGames.map(ig => ({
               game_api_id: ig.id.toString(),
               name: ig.name,
               image: ig.cover?.url?.replace('t_thumb', 't_cover_big'),
               sales_count: 0
             })));
             this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set('Error en la búsqueda del catálogo');
        this.loading.set(false);
      }
    });
  }

  resolveMultipleGames(ids: string[]) {
    if (ids.length === 0) return;
    
    // Agrupar IDs para evitar peticiones demasiado largas
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }

    chunks.forEach(chunk => {
      this.http.get<any[]>(`/api/games?id=${chunk.join(',')}`).subscribe({
        next: (games) => {
          this.games.update(current => 
            current.map(g => {
              const info = games.find(info => info.id.toString() === g.game_api_id.toString());
              return info ? { ...g, name: info.name, image: info.cover?.url?.replace('t_thumb', 't_cover_big') } : g;
            })
          );
        }
      });
    });
  }

  deleteCommunity(id: number, name: string) {
    Swal.fire({
      title: '¿Confirmar eliminación?',
      text: `Se borrará la comunidad "${name}" y todos sus mensajes de forma permanente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ff4444',
      background: '#1a103c',
      color: '#fff'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.authService.deleteCommunity(id).subscribe({
          next: () => {
            Swal.fire('Borrada', 'La comunidad ha sido eliminada.', 'success');
            this.loadCommunities();
          },
          error: (err) => {
            Swal.fire('Error', 'No se pudo eliminar la comunidad.', 'error');
            console.error(err);
          }
        });
      }
    });
  }

  showCommunityDetail(community: any) {
    Swal.fire({
      title: `<span style="color: #7c3aed">${community.name}</span>`,
      html: `
        <div style="text-align: left; color: #fff; font-family: 'Inter', sans-serif;">
          <div style="display: flex; justify-content: center; margin-bottom: 20px;">
            <img src="${community.image_url}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 2px solid #7c3aed; box-shadow: 0 0 15px rgba(124, 58, 237, 0.4);">
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
            <p style="margin: 0 0 5px 0; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">Descripción</p>
            <p style="margin: 0; line-height: 1.5; color: #ddd;">${community.description || 'Sin descripción disponible.'}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
               <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Categoría</p>
               <p style="margin: 0; font-weight: 600;">${community.categoria}</p>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px;">
               <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Miembros</p>
               <p style="margin: 0; font-weight: 600;">${community.num_members} usuarios</p>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; margin-bottom: 20px;">
             <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Fecha de Creación</p>
             <p style="margin: 0; font-weight: 500;">${new Date(community.created_at).toLocaleDateString()}</p>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="view-members-btn" class="swal-custom-btn" style="flex: 1; background: rgba(124, 58, 237, 0.1); border: 1px solid #7c3aed; color: #fff; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              <i class="fas fa-users"></i> Ver Miembros
            </button>
            <button id="delete-comm-detail-btn" class="swal-custom-btn" style="flex: 1; background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; color: #ff4444; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </div>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      showConfirmButton: false,
      background: '#1a103c',
      color: '#fff',
      didOpen: () => {
        const viewMembersBtn = document.getElementById('view-members-btn');
        if (viewMembersBtn) {
          viewMembersBtn.onclick = () => {
            this.showMembersList(community.id, community.name);
          };
        }

        const deleteBtn = document.getElementById('delete-comm-detail-btn');
        if (deleteBtn) {
          deleteBtn.onclick = () => {
            this.deleteCommunity(community.id, community.name);
            Swal.close();
          };
        }
      }
    });
  }

  showMembersList(communityId: number, communityName: string) {
    this.loading.set(true);
    this.communityService.getCommunityMembers(communityId.toString()).subscribe({
      next: (members) => {
        this.loading.set(false);
        const membersHtml = members.map((m, index) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${m.profile_image || 'assets/default-avatar.png'}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; color: #fff;">${m.username}</span>
                <span style="font-size: 0.7rem; color: #888;">Unido: ${new Date(m.joined_at).toLocaleDateString()}</span>
              </div>
            </div>
            ${index === 0 ? '<span style="background: #a855f7; color: #fff; font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Creador</span>' : 
              `<span style="color: #aaa; font-size: 0.7rem;">${m.role}</span>`}
          </div>
        `).join('');

        Swal.fire({
          title: `<span style="color: #7c3aed">Miembros de ${communityName}</span>`,
          html: `
            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
              ${membersHtml || '<p style="color: #888; text-align: center;">No hay miembros registrados.</p>'}
            </div>
          `,
          background: '#1a103c',
          color: '#fff',
          confirmButtonColor: '#7c3aed',
          confirmButtonText: 'Regresar'
        });
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire('Error', 'No se pudieron cargar los miembros.', 'error');
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

  fillMissingDates(history: any[], valueKey: string): any[] {
    if (history.length === 0) return [];
    
    // Normalizar fechas a medianoche local para comparar sin problemas de hora
    const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const sorted = [...history].map(h => ({
      ...h,
      dateObj: normalize(new Date(h.date))
    })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const result = [];
    const firstDate = sorted[0].dateObj;
    const lastDate = normalize(new Date()); // Hasta hoy
    
    let current = new Date(firstDate);
    while (current <= lastDate) {
      const time = current.getTime();
      const existing = sorted.find(h => h.dateObj.getTime() === time);
      
      result.push({
        date: new Date(current),
        [valueKey]: existing ? parseInt(existing[valueKey], 10) : 0
      });
      
      current.setDate(current.getDate() + 1);
      current = normalize(current);
    }
    
    return result;
  }

  showGameDetail(game: any) {
    this.http.get<any[]>(`/api/games?id=${game.game_api_id}`).subscribe({
      next: (games) => {
        if (games && games.length > 0) {
          const info = games[0];
          
          this.authService.getGameSalesHistory(game.game_api_id).subscribe({
            next: (rawHistory) => {
              const history = this.fillMissingDates(rawHistory, 'sales');
              Swal.fire({
                title: `<span style="color: #7c3aed">${info.name}</span>`,
                html: `
                  <div style="text-align: left; color: #fff; font-family: 'Inter', sans-serif;">
                    <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                      <img src="${info.cover?.url?.replace('t_thumb', 't_cover_big') || 'images/game_placeholder.png'}" 
                           style="width: 120px; border-radius: 12px; border: 2px solid #7c3aed; box-shadow: 0 0 15px rgba(124, 58, 237, 0.3);">
                      <div style="flex: 1;">
                        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                          <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Total Ventas</p>
                          <p style="margin: 0; font-size: 1.1rem; font-weight: bold; color: #00f2ff;">${game.sales_count} copias</p>
                        </div>
                        <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                            <p style="margin: 0; font-size: 0.6rem; color: #888;">PUNTUACIÓN</p>
                            <p style="margin: 0; font-weight: 600; font-size: 0.9rem;">${info.rating ? Math.round(info.rating) + '%' : 'N/A'}</p>
                          </div>
                          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                            <p style="margin: 0; font-size: 0.6rem; color: #888;">CATEGORÍA</p>
                            <p style="margin: 0; font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${info.genres?.[0]?.name || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(124, 58, 237, 0.2);">
                      <p style="margin: 0 0 15px 0; font-size: 0.75rem; color: #a855f7; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Evolución Temporal de Ventas</p>
                      <div style="height: 200px; position: relative;">
                        <canvas id="salesEvolutionChart"></canvas>
                      </div>
                    </div>

                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; max-height: 100px; overflow-y: auto; font-size: 0.85rem;">
                      <p style="margin: 0; line-height: 1.4; color: #bbb;">${info.summary || 'Sin descripción disponible.'}</p>
                    </div>
                  </div>
                `,
                background: '#1a103c',
                color: '#fff',
                width: '600px',
                confirmButtonColor: '#7c3aed',
                confirmButtonText: 'Cerrar',
                didOpen: () => {
                  const ctx = (document.getElementById('salesEvolutionChart') as HTMLCanvasElement).getContext('2d');
                  if (!ctx) return;

                  const labels = history.map(h => new Date(h.date).toLocaleDateString());
                  const data = history.map(h => h.sales);

                  new Chart(ctx, {
                    type: 'line',
                    data: {
                      labels: labels,
                      datasets: [{
                        label: 'Ventas Diarias',
                        data: data,
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#00f2ff',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6
                      }]
                    },
                    options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(26, 16, 60, 0.9)',
                          titleColor: '#a855f7',
                          bodyColor: '#fff',
                          borderColor: '#7c3aed',
                          borderWidth: 1,
                          padding: 10,
                          displayColors: false
                        }
                      },
                      scales: {
                        x: {
                          grid: { display: false },
                          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(255,255,255,0.05)' },
                          ticks: { 
                            color: 'rgba(255,255,255,0.5)', 
                            font: { size: 10 },
                            stepSize: 1
                          }
                        }
                      }
                    }
                  });
                }
              });
            },
            error: () => {
              Swal.fire('Error', 'No se pudo cargar el historial de ventas.', 'error');
            }
          });
        }
      }
    });
  }

  showCommunityGrowthDetail(community: any) {
    const communityId = community.id || community.community_id;
    if (!communityId) {
      console.error('Community ID not found', community);
      Swal.fire('Error', 'No se pudo identificar la comunidad.', 'error');
      return;
    }
    this.authService.getCommunityGrowthHistory(communityId).subscribe({
      next: (rawHistory) => {
        const history = this.fillMissingDates(rawHistory, 'daily_joins');
        Swal.fire({
          title: `<span style="color: #00f2ff">${community.name}</span>`,
          html: `
            <div style="text-align: left; color: #fff; font-family: 'Inter', sans-serif;">
              <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                <img src="${community.image_url || 'images/comunidad_default.png'}" 
                     style="width: 100px; height: 100px; border-radius: 50%; border: 2px solid #00f2ff; box-shadow: 0 0 15px rgba(0, 242, 255, 0.3); object-fit: cover;">
                <div style="flex: 1;">
                  <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="margin: 0 0 5px 0; font-size: 0.7rem; color: #888; text-transform: uppercase;">Miembros Totales</p>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: bold; color: #7c3aed;">${community.member_count} usuarios</p>
                  </div>
                  <div style="margin-top: 10px; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="margin: 0; font-size: 0.6rem; color: #888; text-transform: uppercase;">Líder de la Comunidad</p>
                    <p style="margin: 0; font-weight: 600; font-size: 0.9rem;">${community.creator_name || 'Admin'}</p>
                  </div>
                </div>
              </div>

              <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(0, 242, 255, 0.2);">
                <p style="margin: 0 0 15px 0; font-size: 0.75rem; color: #00f2ff; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Crecimiento de Miembros (Uniones Diarias)</p>
                <div style="height: 200px; position: relative;">
                  <canvas id="communityGrowthChart"></canvas>
                </div>
              </div>

              <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; font-size: 0.85rem; text-align: center;">
                <p style="margin: 0; color: #aaa;">Esta comunidad representa una parte significativa de nuestra base social.</p>
              </div>
            </div>
          `,
          background: '#1a103c',
          color: '#fff',
          width: '600px',
          confirmButtonColor: '#00f2ff',
          confirmButtonText: 'Cerrar',
          didOpen: () => {
            const ctx = (document.getElementById('communityGrowthChart') as HTMLCanvasElement).getContext('2d');
            if (!ctx) return;

            const labels = history.map(h => new Date(h.date).toLocaleDateString());
            const data = history.map(h => h.daily_joins);

            new Chart(ctx, {
              type: 'line',
              data: {
                labels: labels,
                datasets: [{
                  label: 'Nuevos Miembros',
                  data: data,
                  borderColor: '#00f2ff',
                  backgroundColor: 'rgba(0, 242, 255, 0.1)',
                  fill: true,
                  tension: 0.4,
                  borderWidth: 3,
                  pointBackgroundColor: '#7c3aed',
                  pointBorderColor: '#fff',
                  pointRadius: 4,
                  pointHoverRadius: 6
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(26, 16, 60, 0.9)',
                    titleColor: '#00f2ff',
                    bodyColor: '#fff',
                    borderColor: '#00f2ff',
                    borderWidth: 1,
                    displayColors: false
                  }
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { 
                      color: 'rgba(255,255,255,0.5)', 
                      font: { size: 10 },
                      stepSize: 1
                    }
                  }
                }
              }
            });
          }
        });
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar el historial de la comunidad.', 'error');
      }
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
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="margin: 0; font-weight: bold; font-size: 1.1rem;">${report.user_name} <span style="font-weight: normal; font-size: 0.9rem; color: #aaa;">(${report.user_email})</span></p>
              </div>
              <button id="view-profile-btn" class="swal-custom-btn" style="background: rgba(124, 58, 237, 0.2); border: 1px solid #7c3aed; color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-user"></i> Ver Perfil
              </button>
            </div>
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
            <textarea id="admin-reply-text" placeholder="Escribe aquí tu respuesta para el usuario..." style="width: 100%; min-height: 100px; background: rgba(0,0,0,0.2); border: 1px solid #7c3aed; border-radius: 8px; color: #fff; padding: 12px; margin-bottom: 20px; outline: none; transition: border-color 0.2s;"></textarea>
          </div>
          
          
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="reject-report-btn" class="swal-custom-btn" style="flex: 1; background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; color: #ff4444; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              <i class="fas fa-times-circle"></i> Rechazar Reporte
            </button>
            ${report.category === 'community_report' ? `
              <button id="ban-user-btn" class="swal-custom-btn" style="flex: 1; background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; color: #ff4444; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-user-slash"></i> Banear Usuario
              </button>
            ` : ''}
            ${report.category === 'games' && report.game_api_id ? `
              <button id="refund-btn" class="swal-custom-btn" style="flex: 1; background: rgba(255, 170, 0, 0.1); border: 1px solid #ffaa00; color: #ffaa00; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-undo"></i> Realizar Reembolso
              </button>
            ` : ''}
            ${['purchases', 'store'].includes(report.category) ? `
              <button id="view-transactions-btn" class="swal-custom-btn" style="flex: 1; background: rgba(34, 211, 238, 0.1); border: 1px solid #22d3ee; color: #22d3ee; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-receipt"></i> Ver Transacciones
              </button>
              <button id="resolve-purchase-btn" class="swal-custom-btn" style="flex: 1; background: rgba(30, 215, 96, 0.1); border: 1px solid #1ed760; color: #1ed760; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-check-double"></i> Ingresar Peppix
              </button>
            ` : ''}
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
      didOpen: () => {
        // Listeners para botones personalizados
        const viewProfileBtn = document.getElementById('view-profile-btn');
        if (viewProfileBtn) {
          viewProfileBtn.onclick = () => {
            Swal.close();
            this.router.navigate(['/perfil', report.user_name]);
          };
        }

        const rejectBtn = document.getElementById('reject-report-btn');
        if (rejectBtn) {
          rejectBtn.onclick = () => {
            Swal.fire({
              title: '¿Rechazar reporte?',
              text: 'Se marcará como rechazado y se notificará al usuario si incluyes una razón.',
              input: 'textarea',
              inputPlaceholder: 'Razón del rechazo...',
              showCancelButton: true,
              confirmButtonText: 'Rechazar definitivamente',
              confirmButtonColor: '#ff4444',
              background: '#1a103c',
              color: '#fff'
            }).then((rejResult: any) => {
              if (rejResult.isConfirmed) {
                this.updateReportStatus(report.id, 'rejected', rejResult.value || 'Reporte rechazado por administración');
                Swal.close();
              }
            });
          };
        }

        const banBtn = document.getElementById('ban-user-btn');
        if (banBtn) {
          banBtn.onclick = () => {
            Swal.fire({
              title: 'Banear Jugador',
              text: 'Introduce el nombre de usuario exacto del jugador a eliminar.',
              input: 'text',
              inputPlaceholder: 'Username...',
              showCancelButton: true,
              confirmButtonText: 'Buscar y Revisar',
              confirmButtonColor: '#7c3aed',
              background: '#1a103c',
              color: '#fff',
              inputValidator: (value: string) => {
                if (!value) return 'Debes introducir un nombre';
                return null;
              }
            }).then((searchRes: any) => {
              if (searchRes.isConfirmed) {
                const searchUsername = searchRes.value;
                Swal.showLoading();
                this.authService.getUserByUsername(searchUsername).subscribe({
                  next: (userRes: any) => {
                    const targetUser = userRes.user;
                    if (!targetUser) {
                      Swal.fire('No encontrado', 'No existe ningún usuario con ese nombre.', 'error');
                      return;
                    }

                    // Confirmación final con detalles del usuario
                    Swal.fire({
                      title: '¿Confirmar Baneo Permanente?',
                      html: `
                        <div style="text-align: left; color: #fff;">
                          <p><b>Usuario:</b> ${targetUser.username}</p>
                          <p><b>Email:</b> ${targetUser.email}</p>
                          <p><b>ID:</b> ${targetUser.id}</p>
                          <hr style="border-top: 1px solid rgba(255,255,255,0.1);">
                          <p style="color: #ff4444; font-weight: bold;">Esta acción eliminará TODOS los datos de este usuario de forma irreversible.</p>
                        </div>
                      `,
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'Sí, banear (Eliminar)',
                      confirmButtonColor: '#ff4444',
                      background: '#1a103c',
                      color: '#fff'
                    }).then((finalRes: any) => {
                      if (finalRes.isConfirmed) {
                        this.authService.deleteUser(targetUser.id).subscribe({
                          next: () => {
                            Swal.fire('Usuario Baneado', 'El usuario ha sido eliminado del sistema.', 'success');
                            this.loadReports();
                            this.loadUsers();
                          },
                          error: (err) => {
                            Swal.fire('Error', 'No se pudo eliminar al usuario.', 'error');
                            console.error(err);
                          }
                        });
                      }
                    });
                  },
                  error: (err) => {
                    Swal.fire('Error', 'Hubo un problema al buscar al usuario.', 'error');
                    console.error(err);
                  }
                });
              }
            });
          };
        }

        const refundBtn = document.getElementById('refund-btn');
        if (refundBtn) {
          refundBtn.onclick = () => {
             this.handleRefund(report);
          };
        }

        const viewTransactionsBtn = document.getElementById('view-transactions-btn');
        if (viewTransactionsBtn) {
          viewTransactionsBtn.onclick = () => {
            this.showUserTransactionsAdmin(report.user_id, report.user_name);
          };
        }

        const resolvePurchaseBtn = document.getElementById('resolve-purchase-btn');
        if (resolvePurchaseBtn) {
          resolvePurchaseBtn.onclick = () => {
            this.handleResolvePurchase(report);
          };
        }
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

  handleRefund(report: any) {
    Swal.fire({
      title: 'Procesar Reembolso',
      text: 'Se devolverán Peppix al usuario y se eliminará el juego de su biblioteca.',
      input: 'number',
      inputLabel: 'Cantidad de Peppix a devolver',
      inputPlaceholder: 'Ej: 500',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Reembolso',
      confirmButtonColor: '#ffaa00',
      background: '#1a103c',
      color: '#fff',
      inputValidator: (value: string | null) => {
        if (!value || parseInt(value) <= 0) {
          return 'Debes ingresar una cantidad válida';
        }
        return null;
      }
    }).then((result: any) => {
      if (result.isConfirmed) {
        const amount = parseInt(result.value);
        this.authService.refundGame(report.id, report.user_id, report.game_api_id, amount).subscribe({
          next: () => {
            Swal.fire('Reembolsado', 'El dinero ha sido devuelto y el ticket cerrado.', 'success');
            this.loadReports();
          },
          error: (err) => {
            Swal.fire('Error', 'No se pudo procesar el reembolso.', 'error');
            console.error(err);
          }
        });
      }
    });
  }

  showUserTransactionsAdmin(userId: number, username: string) {
    this.loading.set(true);
    this.authService.getUserTransactionsAdmin(userId).subscribe({
      next: (transactions) => {
        this.loading.set(false);
        const transHtml = transactions.map(t => `
          <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
            <div style="text-align: left;">
              <p style="margin: 0; font-weight: 600; color: #fff;">${t.peppix_amount} Peppix</p>
              <p style="margin: 0; font-size: 0.75rem; color: #888;">${t.payment_method} | ${new Date(t.created_at).toLocaleString()}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 700; color: #1ed760;">${t.real_money_euro}€</p>
            </div>
          </div>
        `).join('');

        Swal.fire({
          title: `<span style="color: #22d3ee">Transacciones de ${username}</span>`,
          html: `
            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
              ${transHtml || '<p style="color: #fff; opacity: 0.5; text-align: center; padding: 20px;">No se han encontrado transacciones para este usuario.</p>'}
            </div>
          `,
          background: '#1a103c',
          color: '#fff',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#22d3ee'
        });
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire('Error', 'No se pudo cargar el historial de transacciones.', 'error');
        console.error(err);
      }
    });
  }

  handleResolvePurchase(report: any) {
    Swal.fire({
      title: 'Validar y Resolver Compra',
      text: 'Introduce el importe de Peppix que el usuario reclama haber comprado y que no se le ha ingresado.',
      input: 'number',
      inputLabel: 'Peppix a ingresar',
      inputPlaceholder: 'Ej: 500',
      showCancelButton: true,
      confirmButtonText: 'Ingresar Peppix y Cerrar Ticket',
      confirmButtonColor: '#1ed760',
      background: '#1a103c',
      color: '#fff',
      inputValidator: (value: string | null) => {
        if (!value || parseInt(value) <= 0) {
          return 'Debes ingresar una cantidad válida';
        }
        return null;
      }
    }).then((result: any) => {
      if (result.isConfirmed) {
        const amount = parseInt(result.value);
        this.authService.resolvePurchaseReport(report.id, report.user_id, amount).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Reclamación Resuelta',
              text: `Se han ingresado ${amount} Peppix al usuario y el reporte se ha cerrado con éxito.`,
              background: '#1a103c',
              color: '#fff'
            });
            this.loadReports();
          },
          error: (err) => {
            Swal.fire('Error', 'No se pudo procesar el ingreso de Peppix.', 'error');
            console.error(err);
          }
        });
      }
    });
  }

  setTab(tab: string) {
    this.activeTab.set(tab);
    this.error.set(null);
    this.loadData();
  }
}
