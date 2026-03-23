import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.css']
})
export class SupportComponent {
  private router = inject(Router);

  checkLoginAndRedirect() {
    // Verificamos si existe el token en localStorage (el usuario está logueado)
    const token = localStorage.getItem('token');

    if (!token) {
      // Si no hay token, redirigimos a login
      this.router.navigate(['/login']);
    } else {
      // Aquí puedes poner la lógica de lo que pasará si YA está logueado
      console.log('el usuario esta logueado.');
    }
  }
}
