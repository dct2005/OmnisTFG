import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth'; // Ajusta la ruta si es necesario
declare var Swal: any;

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './register.component.html',
    styleUrl: './register.component.css'
})
export class RegisterComponent {
    user = {
        name: "",
        username: "",
        password: "",
        confirmPassword: "",
        acceptedTerms: false
    }

    passwordVisible = signal(false);

    constructor(private authService: AuthService, private router: Router) { }

    togglePasswordVisibility() {
        this.passwordVisible.update(value => !value);
    }

    onSubmit() {
        console.log('Iniciando registro...', this.user);

        this.authService.register(this.user).subscribe({
            next: (res: any) => {
                Swal.fire({
                    title: '¡Registro exitoso!',
                    text: 'Bienvenido a Omnis.',
                    icon: 'success',
                    background: '#1a103c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed'
                });

                this.router.navigate(['/']);
            },
            error: (err) => {
                console.error('ERROR DEL SERVIDOR:', err);

                let mensaje = err.error?.details || err.error?.error || err.error?.message;
                if (!mensaje) {
                    mensaje = typeof err.error === 'string' ? err.error : 'Error desconocido de conexión';
                }

                Swal.fire({
                    title: 'Fallo en el registro',
                    text: mensaje,
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
                console.log('Registro/Login con Google exitoso:', response);

                Swal.fire({
                    title: '¡Registro/Login exitoso!',
                    text: 'Bienvenido a Omnis.',
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