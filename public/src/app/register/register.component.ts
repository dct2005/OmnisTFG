import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
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
        console.log('Enviando formulario...', this.user); // Para ver si llegan los datos

        this.authService.register(this.user).subscribe({
            next: (res) => {
                alert('Registro exitoso');
                this.router.navigate(['/login']);
            },
            error: (err) => {
                alert('Error: ' + err.error.message); // O err.error.error dependiendo de la API
            }
        });
    }
}
