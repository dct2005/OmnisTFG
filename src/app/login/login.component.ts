import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth';
declare var Swal: any;

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
    passwordVisible = signal(false);
    credentials = {
        username: '',
        password: ''
    };
    constructor(private authService: AuthService, private router: Router) { }
    togglePasswordVisibility() {
        this.passwordVisible.update(value => !value);
    }
    onLogin() {
        console.log('Intentando iniciar sesión...', this.credentials);

        if (!this.credentials.username || !this.credentials.password) {
            Swal.fire({
                title: 'Atención',
                text: 'Por favor, introduce email y contraseña',
                icon: 'warning',
                background: '#1a103c',
                color: '#ffffff',
                confirmButtonColor: '#7c3aed'
            });
            return;
        }

        this.authService.login(this.credentials).subscribe({
            next: (response: any) => {
                console.log('Login exitoso:', response);

                Swal.fire({
                    title: '¡Bienvenido de nuevo!',
                    icon: 'success',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    this.router.navigate(['/']);
                });
            },
            error: (error) => {
                console.error('Error completo del login:', error);

                let mensaje = error.error?.error || error.error?.message || error.message;

                if (typeof mensaje === 'object') {
                    mensaje = JSON.stringify(mensaje);
                }

                Swal.fire({
                    title: 'Error de acceso',
                    text: mensaje || 'No se pudo conectar con el servidor',
                    icon: 'error',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed'
                });
            }
        });
    }

    loginWithGoogle() {
        console.log('Intentando iniciar sesión con Google...');
        this.authService.loginWithGoogle().subscribe({
            next: (response: any) => {
                console.log('Login con Google exitoso:', response);

                Swal.fire({
                    title: '¡Bienvenido de nuevo!',
                    icon: 'success',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    this.router.navigate(['/']);
                });
            },
            error: (error) => {
                console.error('Error del login con Google:', error);

                let mensaje = error.error?.error || error.error?.message || error.message || 'Error al iniciar sesión con Google';
                if (typeof mensaje === 'object') {
                    mensaje = JSON.stringify(mensaje);
                }

                Swal.fire({
                    title: 'Error de acceso',
                    text: mensaje,
                    icon: 'error',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed'
                });
            }
        });
    }
}
