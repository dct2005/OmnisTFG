import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './register.component.html',
    styleUrl: './register.component.css'
})
export class RegisterComponent {
    passwordVisible = signal(false);

    togglePasswordVisibility() {
        this.passwordVisible.update(value => !value);
    }
}
