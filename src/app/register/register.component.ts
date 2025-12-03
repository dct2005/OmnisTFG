import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth';
@Component({
    selector: 'app-register',
    standalone: true,
    imports: [RouterLink, FormsModule],
    templateUrl: './register.component.html',
    styleUrl: './register.component.css'
})
export class RegisterComponent {
    user = {
        username: "",
        password: ""
    }
    passwordVisible = signal(false);
    constructor(private authService: AuthService, private router: Router) { }
    togglePasswordVisibility() {
        this.passwordVisible.update(value => !value);
    }
    onSubmit() {
        console.log('Enviando...', this.user);

        this.authService.register(this.user).subscribe({
            next: (res) => {
                alert('¡Registro exitoso!');
                this.router.navigate(['/login']);
            },
            error: (err) => {
                // Esto lo verás en la consola (F12) en rojo
                console.error('ERROR DEL SERVIDOR:', err);

                // 1. Intentamos sacar el mensaje si viene en formato JSON
                let mensaje = err.error?.details || err.error?.error || err.error?.message;

                // 2. Si sigue sin haber mensaje, convertimos TODO el objeto a texto
                if (!mensaje) {
                    mensaje = JSON.stringify(err.error || err.message);
                }

                alert('Fallo: ' + mensaje);
            }
        });
    }
}
