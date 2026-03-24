import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 1. La URL: Si usas 'http://localhost:3000/api', asegúrate de que el server esté corriendo
  private apiUrl = 'http://localhost:3000/api';

  // 2. EL ESTADO GLOBAL: El Signal que la Navbar va a observar
  // Empezamos en 'null' porque nadie está logueado al arrancar
  currentUser = signal<any>(null);

  constructor(private http: HttpClient) { }

  // Registro corregido para usar 'tap'
  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData).pipe(
      tap((res: any) => {
        // Si el registro es exitoso, guardamos al usuario en el signal
        // Esto es lo que hace que la Navbar cambie mágicamente
        this.currentUser.set(res.user || { name: userData.name, username: userData.username });
      })
    );
  }

  login(credentials: { username: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        // Al hacer login, también actualizamos el signal
        this.currentUser.set(res.user);
      })
    );
  }

  // Función para cerrar sesión
  logout() {
    this.currentUser.set(null);
  }
}