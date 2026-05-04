import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-daily-reward',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-reward.component.html',
  styleUrl: './daily-reward.css'
})
export class DailyRewardComponent implements OnInit {
  @Output() onClose = new EventEmitter<void>();
  private authService = inject(AuthService);

  isSpinning = false;
  hasSpun = false;
  prize: any = null;
  rotation = 0;

  // Los premios deben coincidir visualmente con los del backend (aprox)
  prizes = [
    { label: '50 Peppix', color: '#1a1a2e' },
    { label: '100 Peppix', color: '#16213e' },
    { label: 'Nada', color: '#334155' }, // Color gris para 'Nada'
    { label: '250 Peppix', color: '#0f3460' },
    { label: '500 Peppix', color: '#1a1a2e' },
    { label: '1000 Peppix', color: '#16213e' },
    { label: 'Súper Premio', color: '#e94560' },
    { label: '50 Peppix', color: '#0f3460' }
  ];

  ngOnInit() {}

  spin() {
    if (this.isSpinning || this.hasSpun) return;

    this.isSpinning = true;
    
    this.authService.claimDailyReward().subscribe({
      next: (res: any) => {
        this.prize = res.prize;
        
        // Recalibración: 
        // 1. Cada segmento tiene 45 grados.
        // 2. El punto medio del segmento 'i' es i * 45 + 22.5.
        // 3. Para que ese punto medio quede a las 12 (0 grados), rotamos 360 - (i * 45 + 22.5).
        const prizeIndex = this.getPrizeIndex(this.prize);
        const extraDegrees = 3600; // 10 vueltas completas
        const midpoint = (prizeIndex * 45) + 22.5;
        const jitter = (Math.random() * 30) - 15; // +/- 15 grados de margen desde el centro
        
        this.rotation = extraDegrees + (360 - midpoint) + jitter;
        
        setTimeout(() => {
          this.isSpinning = false;
          this.hasSpun = true;

          // Update user balance locally after the spin finishes for suspense
          if (this.prize && this.prize.type === 'peppix') {
            const user = this.authService.currentUser();
            if (user) {
              const currentPeppix = typeof user.peppix === 'string' ? parseInt(user.peppix.replace(/\./g, ''), 10) : (user.peppix || 0);
              this.authService.currentUser.set({
                ...user,
                peppix: currentPeppix + this.prize.value
              });
            }
          }
        }, 4000); 
      },
      error: (err: any) => {
        console.error('Error claiming reward:', err);
        this.isSpinning = false;
        this.close();
      }
    });
  }

  getPrizeIndex(prize: any): number {
    if (!prize) return 0;
    const label = (prize.label || '').toLowerCase();
    const value = prize.value;

    if (label.includes('1500') || label.includes('súper')) return 6;
    if (value === 1000) return 5;
    if (value === 500) return 4;
    if (value === 250) return 3;
    if (prize.type === 'nada' || label.includes('nada')) return 2;
    if (value === 100) return 1;
    return 0; // 50 Peppix
  }

  close() {
    this.onClose.emit();
  }
}
