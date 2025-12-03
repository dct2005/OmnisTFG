import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth';

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
            alert('Por favor, introduce email y contraseña');
            return;
        }

        this.authService.login(this.credentials).subscribe({
            next: (response: any) => {
                console.log('Login exitoso:', response);

                // GUARDAR EL TOKEN: Esto es vital para saber que estás logueado
                localStorage.setItem('token', response.token);

                alert('¡Bienvenido de nuevo!');

                // Aquí redirigirías a la página principal. 
                // Como no sé cuál es tu página de inicio, por ahora redirijo al mismo sitio o a donde quieras.
                // this.router.navigate(['/dashboard']); 
            },
            error: (error) => {
                console.error('Error login:', error);
                alert('Error: ' + (error.error?.error || 'Credenciales incorrectas'));
            }
        });
    }
}
