import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SocialService, SocialRankings, RankedUser } from '../services/social.service';

declare var Swal: any;

@Component({
  selector: 'app-social',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.css']
})
export class SocialComponent implements OnInit {
  private socialService = inject(SocialService);
  
  rankings = signal<SocialRankings | null>(null);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);

  ngOnInit(): void {
    this.socialService.getRankings().subscribe({
      next: (data) => {
        this.rankings.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching rankings:', err);
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  showFullRanking(type: 'buyers' | 'communities' | 'friends'): void {
    const data = this.rankings();
    if (!data) return;

    let title = '';
    let icon = '';
    let color = '';
    let suffix = '';
    let users: RankedUser[] = [];

    if (type === 'buyers') {
      title = 'Top Coleccionistas';
      icon = 'shopping_bag';
      color = '#facc15';
      suffix = 'juegos';
      users = data.top_buyers;
    } else if (type === 'communities') {
      title = 'Top Líderes Sociales';
      icon = 'groups';
      color = '#22d3ee';
      suffix = 'grupos';
      users = data.top_communities;
    } else if (type === 'friends') {
      title = 'Top Más Influyentes';
      icon = 'person_add';
      color = '#f472b6';
      suffix = 'amigos';
      users = data.top_friends;
    }

    let html = `<div style="max-height: 500px; overflow-y: auto; padding-right: 10px; display: flex; flex-direction: column; gap: 10px;">`;
    
    users.forEach((u, i) => {
      const avatar = u.profile_image || `https://ui-avatars.com/api/?name=${u.username}&background=0d1b2a&color=fff`;
      const isTop3 = i < 3;
      const medalIcon = i === 0 ? 'gold_medal' : (i === 1 ? 'silver_medal' : (i === 2 ? 'bronze_medal' : ''));
      
      html += `
        <div class="swal-rank-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" onclick="window.location.href='/perfil/${u.username}'">
          <div style="width: 30px; font-family: 'Audiowide', cursive; color: ${isTop3 ? color : 'rgba(255,255,255,0.5)'}; font-size: 1.2rem;">${i + 1}</div>
          <div style="position: relative;">
            <img src="${avatar}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid ${isTop3 ? color : 'rgba(255,255,255,0.2)'};">
            <div style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; background: ${this.getStatusColor(u.estado)}; border: 2px solid #0d1b2a;"></div>
          </div>
          <div style="flex-grow: 1; text-align: left;">
            <div style="color: #fff; font-weight: 600;">${u.username}</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${u.count} ${suffix}</div>
          </div>
          ${isTop3 ? `<span class="material-icons-round" style="color: ${color};">workspace_premium</span>` : ''}
        </div>
      `;
    });

    html += `</div>`;

    Swal.fire({
      title: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-family: 'Audiowide', cursive; color: ${color}; letter-spacing: 2px;">
                <span class="material-icons-round" style="font-size: 2rem;">${icon}</span>
                ${title}
              </div>`,
      html: html,
      width: '500px',
      background: '#0a0f18',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'glass-modal'
      }
    });
  }

  getStatusColor(estado: string): string {
    if (estado === 'en-linea') return '#1ed760';
    if (estado === 'ausente') return '#ffb432';
    if (estado === 'ocupado') return '#ff3232';
    return '#747d8c';
  }

  getRankIcon(index: number): string {
    if (index === 0) return 'assets/icons/gold-medal.png';
    if (index === 1) return 'assets/icons/silver-medal.png';
    if (index === 2) return 'assets/icons/bronze-medal.png';
    return '';
  }

  // Fallback for missing profile images
  getProfileImage(imageUrl: string | null): string {
    return imageUrl || 'assets/default-avatar.png';
  }
}
