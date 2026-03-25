import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-details.component.html',
  styleUrls: ['./account-details.component.css']
})
export class AccountDetailsComponent {
  authService = inject(AuthService);

  get user() {
    return this.authService.currentUser();
  }

  get maskedEmail() {
    const email = this.user?.email || '';
    if (!email) return '*****@gmail.com';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}*****@${domain}`;
  }

  get maskedPhone() {
    const phone = this.user?.phone || '6996';
    return `Termina en ${phone.slice(-4)}`;
  }
}
