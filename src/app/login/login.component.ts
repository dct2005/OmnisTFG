import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth';
import Swal from 'sweetalert2';

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
        username: '', // Recuerda: en tu API esto es el email
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

                // GUARDAR EL TOKEN: Esto es vital para saber que estás logueado
                localStorage.setItem('token', response.token);

                Swal.fire({
                    title: '¡Bienvenido de nuevo!',
                    icon: 'success',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    this.router.navigate(['/catalogo']);
                });
            },
            error: (error) => {
                console.error('Error login:', error);
                Swal.fire({
                    title: 'Error',
                    text: error.error?.error || 'Credenciales incorrectas',
                    icon: 'error',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed'
                });
            }
        });
    }
}
