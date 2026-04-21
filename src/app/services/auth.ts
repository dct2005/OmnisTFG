import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 1. CAMBIO CRÍTICO: Usamos '/api' sin el localhost para que Vercel encuentre sus funciones
  private apiUrl = '/api';

  currentUser = signal<any>(null);
  private http = inject(HttpClient);

  constructor() {
    this.initializeFromToken();
  }

  public getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  }

  private initializeFromToken() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Seteamos lo mínimo necesario para que fetchCurrentUser pueda funcionar
        this.currentUser.set({ email: payload.email, id: payload.id, role: payload.role });
        this.fetchCurrentUser(); // Sincronizamos con el servidor
      } catch (e) {
        localStorage.removeItem('token');
      }
    }
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'register', ...userData }).pipe(
      tap((res: any) => {
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  login(credentials: { username: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'login', ...credentials }).pipe(
      tap((res: any) => {
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  logout(event?: Event) {
    if (event) event.stopPropagation();

    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail) {
      this.http.post(`${this.apiUrl}/user`, {
        action: 'update-estado',
        email: userEmail,
        estado: 'desconectado'
      }).subscribe({
        next: () => console.log('Sesión cerrada en BD'),
        error: (err) => console.error('Error al cerrar sesión:', err)
      });
    }

    localStorage.removeItem('token');
    this.currentUser.set(null);
  }

  updateStatus(estado: string) {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail && user) {
      this.currentUser.set({ ...user, estado: estado });

      this.http.post(`${this.apiUrl}/user`, {
        action: 'update-estado',
        email: userEmail,
        estado: estado
      }).subscribe({
        next: (res: any) => console.log('Estado en BD:', res.user?.estado),
        error: (err) => console.error('Error al cambiar estado:', err)
      });
    }
  }

  addPeppix(amount: number, price: number = 0, method: string = 'tarjeta') {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail && user) {
      const currentPeppix = typeof user.peppix === 'string' ? parseInt(user.peppix.replace(/\./g, ''), 10) : (user.peppix || 0);
      const newPeppix = currentPeppix + amount;

      this.currentUser.set({ ...user, peppix: newPeppix });

      this.http.post(`${this.apiUrl}/user`, {
        action: 'update-peppix',
        email: userEmail,
        amount: amount,
        price: price,
        method: method
      }).subscribe({
        next: (res: any) => console.log('Peppix añadido y transacción registrada en BD'),
        error: (err) => console.error('Error al actualizar Peppix:', err)
      });
    }
  }

  updateProfileBackground(background: string): Observable<any> {
    const user = this.currentUser();
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-profile-background',
      email: user?.email,
      background
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  fetchCurrentUser() {
    const user = this.currentUser();
    const userEmail = user?.email;
    const userId = user?.id;

    if (userEmail) {
      this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get`, this.getAuthHeaders())
        .subscribe({
          next: (res: any) => {
            // VERIFICACIÓN CRÍTICA: Solo actualizar si el usuario actual sigue siendo el mismo
            // para evitar que peticiones "viejas" en vuelo sobreescriban una nueva sesión o un logout
            const currentUser = this.currentUser();
            if (res.user && currentUser && currentUser.id === res.user.id) {
              this.currentUser.set({
                ...res.user,
                unreadNotifications: res.unreadNotifications || []
              });
            }
          },
          error: (err) => console.error('Error sincronizando datos:', err)
        });
    }
  }

  getUserByUsername(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user?username=${username}&action=get`);
  }

  getUserStatus(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user?username=${username}&action=get-status`);
  }

  getUserById(id: number | string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user?id=${id}&action=get-by-id`);
  }

  purchaseGame(gameId: number | string, price: number, gameName: string): Observable<any> {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (!userEmail) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'purchase-game',
      email: userEmail,
      gameId: gameId.toString(),
      price: price,
      gameName: gameName
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  getUserGames(email?: string): Observable<any> {
    const userEmail = email || this.currentUser()?.email;
    if (!userEmail) throw new Error('Email de usuario no proporcionado');
    return this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get-user-games`);
  }

  getAnyGame(): Observable<any> {
    return this.http.get(`${this.apiUrl}/user?action=get-any-game`);
  }

  updateProfileImage(base64Image: string): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-profile-image',
      email: user.email,
      profileImage: base64Image
    }, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  updateProfileMusic(base64Music: string): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-profile-music',
      email: user.email,
      profileMusic: base64Music
    }, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  getUserComments(userId: number | string, limit: number = 5, offset: number = 0): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user`, {
      params: {
        action: 'get-user-comments',
        userId: userId.toString(),
        limit: limit.toString(),
        offset: offset.toString()
      }
    });
  }

  getTransactions(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-transactions&userId=${userId}`);
  }

  updateLocation(location: string): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-location',
      email: user.email,
      location: location
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  getWishlist(): Observable<any> {
    const user = this.currentUser();
    const userEmail = user?.email;
    if (!userEmail) throw new Error('Usuario no autenticado');

    return this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get-wishlist`);
  }

  toggleWishlist(gameId: number | string): Observable<any> {
    const user = this.currentUser();
    const userEmail = user?.email;
    if (!userEmail) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'toggle-wishlist',
      email: userEmail,
      gameId: gameId.toString()
    });
  }

  updateBillingInfo(billingData: { firstName: string, lastName: string, address: string, phone: string }): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-billing-info',
      email: user.email,
      ...billingData
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  checkDailyReward(): Observable<{ canClaim: boolean }> {
    const user = this.currentUser();
    return this.http.get<{ canClaim: boolean }>(`${this.apiUrl}/user?email=${user?.email}&action=check-daily-reward`);
  }

  claimDailyReward(): Observable<any> {
    const user = this.currentUser();
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'claim-daily-reward',
      email: user?.email
    }).pipe(
      tap((res: any) => {
        this.fetchCurrentUser();
      })
    );
  }

  updatePassword(oldPassword: string, newPassword: string): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-password',
      email: user.email,
      oldPassword,
      newPassword
    });
  }

  // --- SISTEMA DE AMISTADES ---

  getFriends(userId?: number | string): Observable<any[]> {
    const id = userId || this.currentUser()?.id;
    if (!id) throw new Error('ID de usuario no proporcionado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-friends&userId=${id}`);
  }

  sendFriendRequest(senderId: number | string, receiverId: number | string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'friend-request',
      senderId,
      receiverId
    });
  }

  acceptFriendRequest(friendshipId: number | string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'accept-friend',
      friendshipId
    });
  }

  removeFriend(friendshipId?: number | string, senderId?: number | string, receiverId?: number | string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'remove-friend',
      friendshipId,
      senderId,
      receiverId
    });
  }

  updateProfileSettings(settings: any): Observable<any> {
    const user = this.currentUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-profile-settings',
      email: user.email,
      ...settings
    }, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  addProfileComment(profileUserId: number, authorUserId: number, content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'add-profile-comment',
      profile_user_id: profileUserId,
      author_user_id: authorUserId,
      content
    });
  }

  getProfileComments(userId: number, limit: number = 5, offset: number = 0): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user`, {
      params: {
        action: 'get-profile-comments',
        userId: userId.toString(),
        limit: limit.toString(),
        offset: offset.toString()
      }
    });
  }

  deleteProfileComment(commentId: number, userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'delete-profile-comment',
      commentId,
      userId
    });
  }

  createSupportTicket(userId: number, category: string, productName: string | null, gameId: string | null, subject: string, details: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'create-ticket',
      userId,
      category,
      productName,
      gameId,
      subject,
      details
    });
  }

  getSupportTickets(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user`, {
      params: {
        action: 'get-tickets',
        userId: userId.toString()
      }
    });
  }

  // --- ACCIONES DE ADMINISTRADOR ---

  /**
   * Obtiene todos los usuarios (solo para administradores)
   */
  getAllUsers(): Observable<any[]> {
    const userEmail = this.currentUser()?.email;
    if (!userEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-all-users&requesterEmail=${userEmail}`);
  }

  /**
   * Elimina un usuario y todos sus datos asociados (solo para administradores)
   */
  deleteUser(userIdToDelete: number): Observable<any> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'delete-user',
      adminEmail: adminEmail,
      userIdToDelete: userIdToDelete
    });
  }

  /**
   * Obtiene todos los reportes (tickets de soporte) - Solo administradores
   */
  getAllReports(): Observable<any[]> {
    const userEmail = this.currentUser()?.email;
    if (!userEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-all-reports&requesterEmail=${userEmail}`);
  }

  /**
   * Actualiza el estado de un reporte - Solo administradores
   */
  updateReportStatus(reportId: number, newStatus: string, adminResponse?: string): Observable<any> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'update-report-status',
      adminEmail: adminEmail,
      reportId: reportId,
      newStatus: newStatus,
      adminResponse: adminResponse
    });
  }

  /**
   * Obtiene estadísticas globales - Solo administradores
   */
  getAdminStats(): Observable<any> {
    const userEmail = this.currentUser()?.email;
    if (!userEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any>(`${this.apiUrl}/user?action=get-admin-stats&requesterEmail=${userEmail}`);
  }
  /**
   * Procesa un reembolso de juego - Solo administradores
   */
  refundGame(reportId: number, userId: number, gameId: string, amount: number): Observable<any> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'refund-game',
      adminEmail,
      reportId,
      userId,
      gameId,
      amount
    });
  }

  /**
   * Obtiene todas las comunidades - Solo administradores
   */
  getAllCommunities(): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-all-communities&requesterEmail=${adminEmail}`);
  }

  /**
   * Elimina una comunidad - Solo administradores
   */
  deleteCommunity(communityId: number): Observable<any> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'delete-community',
      adminEmail,
      communityId
    });
  }

  /**
   * Obtiene todas las transacciones globales - Solo administradores
   */
  getAllTransactionsAdmin(): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-all-transactions-admin&requesterEmail=${adminEmail}`);
  }

  /**
   * Obtiene todos los juegos vendidos (solo para administradores)
   */
  getAllGamesAdmin(): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-all-games-admin&requesterEmail=${adminEmail}`);
  }

  /**
   * Obtiene la evolución de ventas de un juego - Solo administradores
   */
  getGameSalesHistory(gameId: string): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-game-sales-history&requesterEmail=${adminEmail}&gameId=${gameId}`);
  }

  /**
   * Obtiene la evolución de miembros de una comunidad - Solo administradores
   */
  getCommunityGrowthHistory(communityId: number): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-community-growth-history&requesterEmail=${adminEmail}&communityId=${communityId}`);
  }

  searchUsers(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user?action=search-users&query=${query}`);
  }

  /**
   * Obtiene las transacciones de un usuario específico - Solo administradores
   */
  getUserTransactionsAdmin(userId: number): Observable<any[]> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-user-transactions-admin&requesterEmail=${adminEmail}&userId=${userId}`);
  }

  /**
   * Resuelve un reporte de compra ingresando Peppix manualmente - Solo administradores
   */
  resolvePurchaseReport(reportId: number, userId: number, amount: number): Observable<any> {
    const adminEmail = this.currentUser()?.email;
    if (!adminEmail) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'resolve-purchase-report',
      adminEmail,
      reportId,
      userId,
      amount
    }, this.getAuthHeaders());
  }
  updateActivity(activity: string) {
    const user = this.currentUser();
    if (user?.email) {
      this.http.post(`${this.apiUrl}/user`, {
        action: 'update-activity',
        email: user.email,
        activity: activity
      }).subscribe();
    }
  }

  markNotificationsAsRead(): Observable<any> {
    const user = this.currentUser();
    if (!user?.id) throw new Error('Usuario no autenticado');
    return this.http.post(`${this.apiUrl}/user`, {
      action: 'mark-notifications-read',
      userId: user.id
    });
  }
}
