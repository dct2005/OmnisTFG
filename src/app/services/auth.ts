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

  private initializeFromToken() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Seteamos lo mínimo necesario para que fetchCurrentUser pueda funcionar
        this.currentUser.set({ email: payload.email, id: payload.id });
        this.fetchCurrentUser(); // Sincronizamos con el servidor
      } catch (e) {
        localStorage.removeItem('token');
      }
    }
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'register', ...userData }).pipe(
      tap((res: any) => {
        this.currentUser.set(res.user || {
          username: userData.name,
          email: userData.username,
          peppix: 0,
          estado: 'desconectado'
        });
      })
    );
  }

  login(credentials: { username: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'login', ...credentials }).pipe(
      tap((res: any) => {
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

    if (userEmail) {
      this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get`)
        .subscribe({
          next: (res: any) => {
            if (res.user) {
              this.currentUser.set(res.user);
            }
          },
          error: (err) => console.error('Error sincronizando datos:', err)
        });
    }
  }

  getUserByUsername(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user?username=${username}&action=get`);
  }

  purchaseGame(gameId: number | string, price: number): Observable<any> {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (!userEmail) throw new Error('Usuario no autenticado');

    return this.http.post(`${this.apiUrl}/user`, {
      action: 'purchase-game',
      email: userEmail,
      gameId: gameId.toString(),
      price: price
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
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }

  getUserComments(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user?action=get-user-comments&userId=${userId}`);
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
    }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUser.set(res.user);
        }
      })
    );
  }
}