import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 1. La URL base
  private apiUrl = 'http://localhost:3000/api';

  currentUser = signal<any>(null);

  constructor(private http: HttpClient) { }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'register', ...userData }).pipe(
      tap((res: any) => {
        this.currentUser.set(res.user || { name: userData.name, username: userData.username });
      })
    );
  }

  login(credentials: { username: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/user`, { action: 'login', ...credentials }).pipe(
      tap((res: any) => {
        this.currentUser.set(res.user);
      })
    );
  }

  logout(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const user = this.currentUser();
    const userEmail = user?.email || (user?.username && user?.username.includes('@') ? user.username : null);
    
    if (userEmail) {
      this.http.post(`${this.apiUrl}/user`, { action: 'update-estado', email: userEmail, estado: 'desconectado' })
        .subscribe({
          next: () => console.log('Estado actualizado a desconectado'),
          error: (err) => console.error('Error actualizando estado:', err)
        });
    }

    this.currentUser.set(null);
  }

  updateStatus(estado: string) {
    const user = this.currentUser();
    const userEmail = user?.email || (user?.username && user?.username.includes('@') ? user.username : null);
    
    if (userEmail) {
      this.currentUser.set({ ...user, estado: estado });
      
      this.http.post(`${this.apiUrl}/user`, { action: 'update-estado', email: userEmail, estado: estado })
        .subscribe({
          next: (res: any) => console.log('Estado actualizado:', res.user.estado),
          error: (err) => console.error('Error actualizando estado:', err)
        });
    }
  }

  fetchCurrentUser() {
    const user = this.currentUser();
    const userEmail = user?.email || (user?.username && user?.username.includes('@') ? user.username : null);

    if (userEmail) {
      this.http.get(`${this.apiUrl}/user?email=${userEmail}`)
        .subscribe({
          next: (res: any) => {
            if (res.user) {
              if (res.user.estado !== user.estado || res.user.peppix !== user.peppix) {
                 this.currentUser.set({ ...user, estado: res.user.estado, peppix: res.user.peppix });
              }
            }
          },
          error: (err) => console.error('Error obteniendo usuario:', err)
        });
    }
  }
}