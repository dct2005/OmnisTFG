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
        console.log('Enviando...', this.user);

        this.authService.register(this.user).subscribe({
            next: (res) => {
                alert('¡Registro exitoso!');
                this.router.navigate(['/login']);
            },
            error: (err) => {
                console.error('ERROR DEL SERVIDOR:', err);

                let mensaje = err.error?.details || err.error?.error || err.error?.message;

                if (!mensaje) {
                    mensaje = JSON.stringify(err.error || err.message);
                }

                alert('Fallo: ' + mensaje);
            }
        });
    }
}
