import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { RouterLink } from '@angular/router';

declare var Swal: any;

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-details.component.html',
  styleUrls: ['./account-details.component.css']
})
export class AccountDetailsComponent {
  authService = inject(AuthService);

  // States
  selectedCountry = signal('Andorra');
  userEmail = signal('');
  userPhone = signal('');

  countryData: any = {
    'Andorra': { prefix: '+376', length: 6 },
    'España': { prefix: '+34', length: 9 },
    'Francia': { prefix: '+33', length: 10 },
    'Portugal': { prefix: '+351', length: 9 }
  };

  get user() {
    return this.authService.currentUser();
  }

  get maskedEmail() {
    const email = this.userEmail() || this.user?.email || '';
    if (!email) return '*****@gmail.com';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}*****@${domain}`;
    return `${name.substring(0, 2)}*****@${domain}`;
  }

  get maskedPhone() {
    const phone = this.userPhone() || this.user?.phone || '6996';
    const last4 = phone.slice(-4);
    return `Termina en ${last4}`;
  }

  get currentPrefix() {
    return this.countryData[this.selectedCountry()].prefix;
  }

  async changeCountry() {
    const { value: country } = await Swal.fire({
      title: 'Seleccionar país de la tienda',
      input: 'select',
      inputOptions: {
        'Andorra': 'Andorra',
        'España': 'España',
        'Francia': 'Francia',
        'Portugal': 'Portugal'
      },
      inputValue: this.selectedCountry(),
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      inputValidator: (value: string) => {
        return new Promise((resolve) => {
          if (value) {
            resolve(null);
          } else {
            resolve('Debes seleccionar un país');
          }
        });
      }
    });

    if (country) {
      this.selectedCountry.set(country);
      Swal.fire({
        icon: 'success',
        title: 'País actualizado',
        text: `Tu tienda ahora está configurada para ${country}`,
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
    }
  }

  async changeEmail() {
    const { value: email } = await Swal.fire({
      title: 'Cambiar dirección de email',
      input: 'email',
      inputLabel: 'Nueva dirección de correo',
      inputPlaceholder: 'user@example.com',
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      inputValidator: (value: string) => {
        if (!value) {
          return '¡Debes introducir un email!';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Formato de email inválido';
        }
        return null;
      }
    });

    if (email) {
      this.userEmail.set(email);
      Swal.fire({
        icon: 'success',
        title: 'Email actualizado',
        text: `Tu nuevo email es ${email}`,
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
    }
  }

  async changePhone() {
    const prefix = this.currentPrefix;
    const { value: phone } = await Swal.fire({
      title: 'Cambiar número de teléfono',
      text: `Prefijo para ${this.selectedCountry()}: ${prefix}`,
      input: 'tel',
      inputLabel: 'Introduce los dígitos restantes',
      inputPlaceholder: '123456',
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      inputValidator: (value: string) => {
        if (!value) {
          return 'Debes introducir un número';
        }
        const expectedLength = this.countryData[this.selectedCountry()].length;
        if (value.length !== expectedLength) {
          return `El número para ${this.selectedCountry()} debe tener ${expectedLength} dígitos`;
        }
        if (!/^\d+$/.test(value)) {
          return 'Solo se permiten números';
        }
        return null;
      }
    });

    if (phone) {
      this.userPhone.set(phone);
      Swal.fire({
        icon: 'success',
        title: 'Teléfono actualizado',
        text: `Tu nuevo número es ${prefix} ${phone}`,
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
    }
  }
}
