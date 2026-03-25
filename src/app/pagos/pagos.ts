import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
declare var Swal: any;

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
})
export class Pagos implements OnInit {
  peppix: string = '25.000';
  precio: string = '500,00';

  // State for form and selection
  metodoSeleccionado: string = 'tarjeta';
  numTarjeta: string = '';
  caducidad: string = '';
  nombreTarjeta: string = '';
  cvv: string = '';

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

  seleccionarMetodo(metodo: string) {
    this.metodoSeleccionado = metodo;
  }

  pagar() {
    const user = this.authService.currentUser();
    if (!user) {
      Swal.fire({
        title: 'Error',
        text: 'Debes iniciar sesión para realizar la compra.',
        icon: 'error',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      this.router.navigate(['/login']);
      return;
    }

    // 1. Validation only for Card method
    if (this.metodoSeleccionado === 'tarjeta') {
      if (!this.numTarjeta || !this.caducidad || !this.nombreTarjeta || !this.cvv) {
        Swal.fire({
          title: 'Error',
          text: 'Por favor, rellena todos los campos del formulario.',
          icon: 'warning',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      const [month, yearRaw] = this.caducidad.split('/').map(n => parseInt(n, 10));
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearFull = now.getFullYear();
      const currentYear2Digit = parseInt(currentYearFull.toString().slice(-2), 10);
      const year = yearRaw > 100 ? parseInt(yearRaw.toString().slice(-2), 10) : yearRaw;

      if (!month || !yearRaw || month < 1 || month > 12) {
        Swal.fire({
          title: 'Fecha inválida',
          text: 'Por favor, introduce una fecha válida (MM/YY).',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      if (year < currentYear2Digit || (year === currentYear2Digit && month < currentMonth)) {
        Swal.fire({
          title: 'Tarjeta caducada',
          text: 'La fecha de caducidad no puede ser inferior al día de hoy.',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }
    }

    const amount = parseInt(this.peppix.replace(/\./g, ''), 10);
    this.authService.addPeppix(amount);

    Swal.fire({
      title: '¡Pago completado!',
      text: `Se han añadido ${this.peppix} Peppix a tu cuenta vía ${this.getMetodoNombre()}.`,
      icon: 'success',
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed'
    }).then(() => {
      this.router.navigate(['/']);
    });
  }

  private getMetodoNombre(): string {
    switch (this.metodoSeleccionado) {
      case 'tarjeta': return 'Tarjeta';
      case 'paypal': return 'PayPal';
      case 'crypto': return 'Criptomonedas';
      default: return 'Desconocido';
    }
  }
}
