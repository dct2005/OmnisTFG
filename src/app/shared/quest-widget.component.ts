import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { HttpClient } from '@angular/common/http';
declare var Swal: any;

@Component({
  selector: 'app-quest-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="quest-widget glass-panel">
      <div class="widget-header">
        <span class="material-icons-round">assignment</span>
        <h3>Misiones Diarias</h3>
      </div>
      
      <div class="quest-list">
        @for (quest of quests(); track quest.id) {
          <div class="quest-card" [class.completed]="quest.is_completed" (click)="showQuestDetail(quest)">
            <div class="quest-info">
              <span class="quest-title">{{ quest.title }}</span>
              <span class="quest-progress">{{ quest.current_value }} / {{ quest.requirement_value }}</span>
            </div>
            
            <div class="progress-track">
              <div class="progress-fill" [style.width.%]="calculatePercent(quest)"></div>
            </div>
            
            <div class="quest-footer">
              <div class="rewards">
                <span class="reward xp">+{{ quest.xp_reward }} XP</span>
                <span class="reward points">+{{ quest.points_reward }} PTS</span>
              </div>
              
              @if (!quest.is_completed && quest.current_value >= quest.requirement_value) {
                <button class="btn-claim" (click)="$event.stopPropagation(); claimReward(quest)">RECLAMAR</button>
              } @else if (quest.is_completed) {
                <span class="claimed-tag"><span class="material-icons-round">check_circle</span></span>
              }
            </div>
          </div>
        } @empty {
          <p class="empty-msg">No hay misiones disponibles hoy.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .quest-widget { padding: 1.5rem; }
    .widget-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
    .widget-header h3 { font-family: 'Orbitron', sans-serif; font-size: 0.9rem; text-transform: uppercase; color: #fff; margin: 0; }
    .widget-header .material-icons-round { color: var(--primary, #7c3aed); }
    
    .quest-list { display: flex; flex-direction: column; gap: 1rem; }
    .quest-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 1rem; transition: all 0.3s; cursor: pointer; }
    .quest-card:hover { transform: translateY(-2px); border-color: rgba(124, 58, 237, 0.4); background: rgba(124, 58, 237, 0.05); }
    .quest-card.completed { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.05); }
    
    .quest-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .quest-title { font-weight: 600; font-size: 0.85rem; color: #e2e8f0; }
    .quest-progress { font-size: 0.75rem; color: #94a3b8; font-family: monospace; }
    
    .progress-track { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-bottom: 0.75rem; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #00f2ff); box-shadow: 0 0 10px rgba(0, 242, 255, 0.5); transition: width 0.5s ease; }
    
    .quest-footer { display: flex; justify-content: space-between; align-items: center; }
    .rewards { display: flex; gap: 0.5rem; }
    .reward { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    .reward.xp { background: rgba(124, 58, 237, 0.2); color: #a78bfa; border: 1px solid rgba(124, 58, 237, 0.3); }
    .reward.points { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
    
    .btn-claim { background: #22c55e; color: #fff; font-size: 9px; font-weight: 900; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer; animation: pulse 2s infinite; }
    .claimed-tag { color: #22c55e; display: flex; align-items: center; }
    .claimed-tag .material-icons-round { font-size: 1.25rem; }
    
    .empty-msg { font-size: 0.8rem; color: #94a3b8; text-align: center; font-style: italic; }
    
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
  `]
})
export class QuestWidgetComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  
  quests = signal<any[]>([]);
  
  ngOnInit() {
    this.loadQuests();
  }
  
  loadQuests() {
    const user = this.authService.currentUser();
    if (!user) return;
    
    this.http.get<any[]>(`/api/user?action=get-daily-quests&userId=${user.id}`).subscribe({
      next: (data) => this.quests.set(data),
      error: (err) => console.error('Error loading quests:', err)
    });
  }
  
  calculatePercent(quest: any): number {
    const percent = (quest.current_value / quest.requirement_value) * 100;
    return Math.min(100, Math.max(0, percent));
  }

  showQuestDetail(quest: any) {
    Swal.fire({
      title: `<span style="color: #00f2ff; font-family: 'Orbitron', sans-serif; font-size: 1.2rem;">${quest.title}</span>`,
      html: `
        <div style="text-align: left; padding: 10px;">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(0,242,255,0.2);">
            <span class="material-icons-round" style="font-size: 3rem; color: #00f2ff;">${quest.icon || 'assignment'}</span>
            <div>
              <div style="color: #a0aec0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">Objetivo</div>
              <div style="color: #fff; font-size: 1.1rem; font-weight: 600;">${quest.description || 'Completa esta misión para ganar recompensas.'}</div>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #a0aec0; font-size: 0.9rem;">Progreso Actual</span>
              <span style="color: #00f2ff; font-family: monospace; font-weight: 700;">${quest.current_value} / ${quest.requirement_value}</span>
            </div>
            <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: ${this.calculatePercent(quest)}%; background: linear-gradient(90deg, #7c3aed, #00f2ff); box-shadow: 0 0 10px rgba(0,242,255,0.5);"></div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <div style="flex: 1; background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); padding: 10px; border-radius: 8px; text-align: center;">
              <div style="color: #a78bfa; font-size: 0.7rem; text-transform: uppercase;">Experiencia</div>
              <div style="color: #fff; font-size: 1.2rem; font-weight: 700; font-family: 'Orbitron';">+${quest.xp_reward} XP</div>
            </div>
            <div style="flex: 1; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); padding: 10px; border-radius: 8px; text-align: center;">
              <div style="color: #facc15; font-size: 0.7rem; text-transform: uppercase;">Puntos</div>
              <div style="color: #fff; font-size: 1.2rem; font-weight: 700; font-family: 'Orbitron';">+${quest.points_reward} PTS</div>
            </div>
          </div>
        </div>
      `,
      background: '#0a0a1a',
      color: '#fff',
      showConfirmButton: true,
      confirmButtonText: quest.is_completed ? 'ENTENDIDO' : (quest.current_value >= quest.requirement_value ? 'RECLAMAR AHORA' : 'VOLVER'),
      confirmButtonColor: quest.current_value >= quest.requirement_value && !quest.is_completed ? '#22c55e' : '#7c3aed',
      showCloseButton: true,
      customClass: {
        popup: 'glass-modal quest-detail-modal'
      }
    }).then((result: any) => {
      if (result.isConfirmed && quest.current_value >= quest.requirement_value && !quest.is_completed) {
        this.claimReward(quest);
      }
    });
  }
  
  claimReward(quest: any) {
    const user = this.authService.currentUser();
    if (!user) return;
    
    this.http.post('/api/user?action=claim-quest-reward', { 
      userId: user.id, 
      questId: quest.id 
    }).subscribe({
      next: (res: any) => {
        Swal.fire({
          title: '¡Misión Completada!',
          text: `Has ganado ${res.xp_reward} XP y ${res.points_reward} puntos.`,
          icon: 'success',
          background: '#0d0d2b',
          color: '#fff',
          confirmButtonColor: '#7c3aed'
        });
        this.loadQuests();
      },
      error: (err) => console.error('Error claiming reward:', err)
    });
  }
}
