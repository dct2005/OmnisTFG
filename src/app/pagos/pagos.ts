import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-pagos',
  imports: [],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
})
export class Pagos implements OnInit {
  peppix: string = '25.000';
  precio: string = '500,00';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['peppix']) {
        this.peppix = params['peppix'];
      }
      if (params['precio']) {
        this.precio = params['precio'];
      }
    });
  }

  pagar() {
    const user = this.authService.currentUser();
    if (!user) {
      alert('Debes iniciar sesión para realizar la compra.');
      this.router.navigate(['/login']);
      return;
    }

    const amount = parseInt(this.peppix.replace(/\./g, ''), 10);
    this.authService.addPeppix(amount);

    alert(`¡Pago completado! Se han añadido ${this.peppix} Peppix a tu cuenta.`);
    this.router.navigate(['/']);
  }
}
