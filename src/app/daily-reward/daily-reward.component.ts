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
        
        // Calculamos la rotación final. 
        // 360 / 8 premios = 45 grados por premio.
        const prizeIndex = this.getPrizeIndex(this.prize);
        const extraDegrees = 3600; // 10 vueltas
        const prizeDegree = (prizeIndex * 45); 
        
        const randomOffset = 10 + Math.random() * 25; // 10-35 grados de margen (el segmento es de 45)
        this.rotation = extraDegrees + (360 - prizeDegree) + randomOffset;
        
        setTimeout(() => {
          this.isSpinning = false;
          this.hasSpun = true;
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
    if (prize.label.includes('1500') || prize.label.includes('Súper')) return 6;
    if (prize.value === 1000) return 5;
    if (prize.value === 500) return 4;
    if (prize.value === 250) return 3;
    if (prize.type === 'nada') return 2;
    if (prize.value === 100) return 1;
    return 0; // 50 Peppix
  }

  close() {
    this.onClose.emit();
  }
}
