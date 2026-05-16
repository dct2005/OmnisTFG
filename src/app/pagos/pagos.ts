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

  // Estado para forma y selección.
  metodoSeleccionado: string = 'tarjeta';
  numTarjeta: string = '';
  caducidad: string = '';
  nombreTarjeta: string = '';
  cvv: string = '';
  emailContacto: string = '';

  // Estado de facturación
  billingInfo = {
    firstName: '',
    lastName: '',
    address: '',
    phone: ''
  };

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

    const user = this.authService.currentUser();
    if (user) {
      this.billingInfo = {
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        address: user.address || '',
        phone: user.phone || ''
      };
    }
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

    if (this.metodoSeleccionado === 'tarjeta') {
      if (!this.numTarjeta || !this.caducidad || !this.nombreTarjeta || !this.cvv ||
          !this.billingInfo.firstName || !this.billingInfo.lastName || !this.billingInfo.address || !this.billingInfo.phone) {
        Swal.fire({
          title: 'Faltan datos',
          text: 'Por favor, rellena todos los campos (facturación y tarjeta).',
          icon: 'warning',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      this.authService.updateBillingInfo(this.billingInfo).subscribe({
        next: () => this.ejecutarPago(),
        error: (err: any) => {
          console.error('Error guardando info de facturación:', err);
          Swal.fire('Error', 'No se pudo procesar la información de facturación', 'error');
        }
      });
    } else {
      if (!this.emailContacto || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.emailContacto)) {
        Swal.fire({
          title: 'Email inválido',
          text: 'Por favor, introduce un correo electrónico válido.',
          icon: 'warning',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }
      this.ejecutarPago();
    }
  }

  private luhnCheck(num: string): boolean {
    let sum = 0;
    let isEven = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num.charAt(i), 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }
    return (sum % 10) === 0;
  }

  private ejecutarPago() {
    if (this.metodoSeleccionado === 'tarjeta') {
      if (!/^\d{3,4}$/.test(this.cvv)) {
        Swal.fire('CVV Inválido', 'El CVV debe tener 3 o 4 dígitos.', 'error');
        return;
      }

      const sanitizedNum = this.numTarjeta.replace(/\D/g, '');
      if (sanitizedNum.length < 13 || sanitizedNum.length > 19 || !this.luhnCheck(sanitizedNum)) {
        Swal.fire('Tarjeta Inválida', 'El número de tarjeta no es válido.', 'error');
        return;
      }

      const parts = this.caducidad.split('/');
      if (parts.length !== 2) {
        Swal.fire('Error', 'Formato de fecha inválido (MM/YY)', 'error');
        return;
      }
      const month = parseInt(parts[0], 10);
      const yearRaw = parseInt(parts[1], 10);
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear2Digit = parseInt(now.getFullYear().toString().slice(-2), 10);
      const year = yearRaw > 100 ? parseInt(yearRaw.toString().slice(-2), 10) : yearRaw;

      if (!month || isNaN(year) || month < 1 || month > 12) {
        Swal.fire('Fecha inválida', 'Por favor, introduce una fecha válida.', 'error');
        return;
      }

      if (year < currentYear2Digit || (year === currentYear2Digit && month < currentMonth)) {
        Swal.fire('Tarjeta caducada', 'La fecha no puede ser inferior al día de hoy.', 'error');
        return;
      }
    }

    const amount = parseInt(this.peppix.replace(/\./g, ''), 10);
    const price = parseFloat(this.precio.replace(/\./g, '').replace(',', '.'));
    this.authService.addPeppix(amount, price, this.metodoSeleccionado);

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
