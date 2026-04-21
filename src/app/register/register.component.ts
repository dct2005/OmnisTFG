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

                // Redirigimos al inicio; la Navbar ya mostrará el avatar
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
}