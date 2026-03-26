import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { GameService } from '../services/game.service';
import { RouterLink } from '@angular/router';
import { switchMap, map, of } from 'rxjs';

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
  gameService = inject(GameService);

  // States
  selectedCountry = signal('Andorra');
  userEmail = signal('');
  userPhone = signal('');
  
  // viewMode: 'main' | 'peppix' | 'games'
  viewMode = signal<string>('main');
  
  transactions = signal<any[]>([]);
  gamePurchases = signal<any[]>([]);

  countryData: any = {
    'Andorra': { prefix: '+376', length: 6 },
    'España': { prefix: '+34', length: 9 },
    'Francia': { prefix: '+33', length: 9 },
    'Portugal': { prefix: '+351', length: 9 },
    'Reino Unido': { prefix: '+44', length: 10 },
    'Alemania': { prefix: '+49', length: 11 },
    'Italia': { prefix: '+39', length: 10 },
    'Estados Unidos': { prefix: '+1', length: 10 },
    'México': { prefix: '+52', length: 10 },
    'Argentina': { prefix: '+54', length: 10 }
  };

  maskedEmail = 'd*******n@u**.e*';
  maskedPhone = '*******46';
  currentPrefix = '+34';

  constructor() {
    // Sincronizar país inicialmente con el de la base de datos
    const user = this.authService.currentUser();
    if (user?.location) {
      this.selectedCountry.set(user.location);
    }
  }

  loadTransactions() {
    const user = this.authService.currentUser();
    if (user?.id) {
      this.authService.getTransactions(user.id).subscribe({
        next: (data) => this.transactions.set(data),
        error: (err) => console.error('Error cargando transacciones:', err)
      });
    }
  }

  loadGameHistory() {
    const user = this.authService.currentUser();
    if (user?.id) {
      this.authService.getUserGames().pipe(
        switchMap((res: any) => {
          const purchases = res.games || [];
          if (purchases.length === 0) return of([]);
          
          const ids = purchases.map((p: any) => p.game_api_id);
          return this.gameService.getGames('', 0, [], [], ids).pipe(
            map(gamesData => {
              // Combinar los datos de IGDB con las fechas de compra de nuestra BD
              return purchases.map((p: any) => {
                const gameInfo = gamesData.find(g => g.id.toString() === p.game_api_id.toString());
                return {
                  ...gameInfo,
                  purchase_date: p.purchase_date
                };
              });
            })
          );
        })
      ).subscribe({
        next: (combinedData) => this.gamePurchases.set(combinedData),
        error: (err) => console.error('Error cargando historial de juegos:', err)
      });
    }
  }

  togglePeppixHistory() {
    if (this.viewMode() === 'peppix') {
      this.viewMode.set('main');
    } else {
      this.viewMode.set('peppix');
      this.loadTransactions();
    }
  }

  toggleGameHistory() {
    if (this.viewMode() === 'games') {
      this.viewMode.set('main');
    } else {
      this.viewMode.set('games');
      this.loadGameHistory();
    }
  }

  async changeCountry() {
    const { value: country } = await Swal.fire({
      title: 'Seleccionar país de la tienda',
      input: 'select',
      inputOptions: Object.keys(this.countryData).reduce((acc: any, key) => {
        acc[key] = key;
        return acc;
      }, {}),
      inputPlaceholder: 'Selecciona tu país',
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#ff00ff'
    });

    if (country) {
      this.selectedCountry.set(country);
      this.currentPrefix = this.countryData[country].prefix;
      
      // PERSISTENCIA EN BD
      this.authService.updateLocation(country).subscribe({
        next: () => {
          Swal.fire({
            title: '¡País actualizado!',
            text: `Tu país ahora es ${country}`,
            icon: 'success',
            background: '#1a103c',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
          });
        },
        error: (err) => console.error('Error al actualizar localización:', err)
      });
    }
  }

  async changeEmail() {
    const { value: email } = await Swal.fire({
      title: 'Cambiar dirección de email',
      input: 'email',
      inputLabel: 'Nueva dirección de email',
      inputPlaceholder: 'ejemplo@correo.com',
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#ff00ff'
    });

    if (email) {
      Swal.fire({
        title: 'Email actualizado',
        text: 'Se ha enviado un correo de verificación a la nueva dirección.',
        icon: 'info',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
    }
  }

  async changePhone() {
    const { value: phone } = await Swal.fire({
      title: 'Gestionar número de teléfono',
      input: 'tel',
      inputLabel: 'Tu nuevo número',
      inputValue: this.maskedPhone,
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#ff00ff'
    });

    if (phone) {
      Swal.fire({
        title: 'Teléfono vinculado',
        text: 'Tu número ha sido actualizado correctamente.',
        icon: 'success',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
    }
  }

  async changePassword() {
    const { value: formValues } = await Swal.fire({
      title: 'Cambiar contraseña',
      html:
        '<input id="swal-input1" class="swal2-input" type="password" placeholder="Contraseña actual">' +
        '<input id="swal-input2" class="swal2-input" type="password" placeholder="Nueva contraseña">' +
        '<input id="swal-input3" class="swal2-input" type="password" placeholder="Confirmar nueva contraseña">',
      focusConfirm: false,
      showCancelButton: true,
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#ff00ff',
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value,
          (document.getElementById('swal-input3') as HTMLInputElement).value
        ];
      }
    });

    if (formValues) {
      const [oldPassword, newPassword, confirmPassword] = formValues;

      if (!oldPassword || !newPassword || !confirmPassword) {
        Swal.fire({
          title: 'Error',
          text: 'Todos los campos son obligatorios',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      if (newPassword.length < 6) {
        Swal.fire({
          title: 'Contraseña débil',
          text: 'La nueva contraseña debe tener al menos 6 caracteres',
          icon: 'warning',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        Swal.fire({
          title: 'Error de coincidencia',
          text: 'Las nuevas contraseñas no coinciden',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      this.authService.updatePassword(oldPassword, newPassword).subscribe({
        next: () => {
          Swal.fire({
            title: '¡Éxito!',
            text: 'Tu contraseña ha sido actualizada',
            icon: 'success',
            background: '#1a103c',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
          });
        },
        error: (err: any) => {
          Swal.fire({
            title: 'Error',
            text: err.error?.error || 'No se pudo actualizar la contraseña',
            icon: 'error',
            background: '#1a103c',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
          });
        }
      });
    }
  }
}
