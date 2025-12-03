import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
// 1. IMPORTAMOS EL NUEVO SERVICIO
import { UserService } from '../services/user.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [RouterLink, FormsModule, CommonModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
    passwordVisible = signal(false);
    credentials = {
        username: '',
        password: ''
    };

    // 2. INYECTAMOS EL NUEVO SERVICIO
    private userService = inject(UserService);
    private router = inject(Router);

    constructor() { }

    togglePasswordVisibility() {
        this.passwordVisible.update(value => !value);
    }

    onLogin() {
        if (!this.credentials.username || !this.credentials.password) {
            alert('Por favor, introduce email y contraseña');
            return;
        }

        console.log('Enviando con UserService...', this.credentials);

        // 3. USAMOS EL NUEVO SERVICIO
        this.userService.login(this.credentials).subscribe({
            next: (response: any) => {
                console.log('Login OK', response);
                localStorage.setItem('token', response.token);
                alert('¡Login correcto!');
            },
            error: (error) => {
                console.error(error);
                alert('Error: ' + (error.error?.error || 'Fallo al entrar'));
            }
        });
    }
}