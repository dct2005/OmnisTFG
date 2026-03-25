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

  constructor() { }

  register(userData: any): Observable<any> {
    // IMPORTANTE: Asegúrate de que tu backend espera el objeto con { action: 'register', ... }
    return this.http.post(`${this.apiUrl}/user`, { action: 'register', ...userData }).pipe(
      tap((res: any) => {
        // Al registrar, seteamos el usuario con peppix 0 y estado desconectado
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
    // Según tu DB: el email es donde está el correo real
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

    this.currentUser.set(null);
  }

  updateStatus(estado: string) {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail && user) {
      // Actualizamos el Signal primero para que la Navbar cambie al instante
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

  addPeppix(amount: number) {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail && user) {
      const currentPeppix = typeof user.peppix === 'string' ? parseInt(user.peppix.replace(/\./g, ''), 10) : (user.peppix || 0);
      const newPeppix = currentPeppix + amount;

      this.currentUser.set({ ...user, peppix: newPeppix });

      this.http.post(`${this.apiUrl}/user`, {
        action: 'update-peppix',
        email: userEmail,
        amount: amount
      }).subscribe({
        next: (res: any) => console.log('Peppix añadido en BD:', res.user?.peppix || newPeppix),
        error: (err) => console.error('Error al actualizar Peppix:', err)
      });
    }
  }

  fetchCurrentUser() {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (userEmail) {
      // Usamos la acción 'get-user' o el método que tengas en tu backend único
      this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get`)
        .subscribe({
          next: (res: any) => {
            if (res.user) {
              // Actualizamos peppix y estado si han cambiado en la BD
              this.currentUser.set(res.user);
            }
          },
          error: (err) => console.error('Error sincronizando datos:', err)
        });
    }
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

  getUserGames(): Observable<any> {
    const user = this.currentUser();
    const userEmail = user?.email;

    if (!userEmail) throw new Error('Usuario no autenticado');

    return this.http.get(`${this.apiUrl}/user?email=${userEmail}&action=get-user-games`);
  }
}