import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { GameService } from '../services/game.service';
import { FormsModule } from '@angular/forms';
declare var Swal: any;

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.css']
})
export class SupportComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private gameService = inject(GameService);

  currentUser = this.authService.currentUser;
  
  // View states: 'main', 'games', 'game-details', 'purchases', 'store', 'community', 'community-question', 'community-report', 'tickets'
  currentView = signal<string>('main');
  
  // Data for forms
  ownedGames = signal<any[]>([]);
  loadingGames = signal(false);
  selectedGame = signal<any>(null);
  ticketSubject = '';
  ticketDetails = '';
  submitting = signal(false);
  
  // Ticket list
  tickets = signal<any[]>([]);
  loadingTickets = signal(false);

  ngOnInit() {
    if (!this.currentUser()) {
      this.router.navigate(['/login']);
    }
  }

  setView(view: string) {
    this.currentView.set(view);
    this.ticketDetails = '';
    this.ticketSubject = '';
    
    if (view === 'games' && this.ownedGames().length === 0) {
      this.loadOwnedGames();
    }
    
    if (view === 'tickets') {
      this.loadTickets();
    }
  }

  loadOwnedGames() {
    const user = this.currentUser();
    if (!user) return;
    
    this.loadingGames.set(true);
    this.authService.getUserGames(user.email).subscribe({
      next: (res) => {
        const gameRecords = res.games || [];
        if (gameRecords.length === 0) {
          this.loadingGames.set(false);
          return;
        }

        // Fetch detailed info for all games in parallel
        const detailPromises = gameRecords.map((record: any) => 
          new Promise((resolve) => {
            this.gameService.getGameById(record.game_api_id).subscribe({
              next: (detail) => resolve(detail),
              error: () => resolve({ id: record.game_api_id, name: 'Juego Desconocido' })
            });
          })
        );

        Promise.all(detailPromises).then((games: any[]) => {
          this.ownedGames.set(games);
          this.loadingGames.set(false);
        });
      },
      error: (err) => {
        console.error('Error cargando juegos:', err);
        this.loadingGames.set(false);
      }
    });
  }

  loadTickets() {
    const user = this.currentUser();
    if (!user) return;
    
    this.loadingTickets.set(true);
    this.authService.getSupportTickets(user.id).subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.loadingTickets.set(false);
      },
      error: (err) => {
        console.error('Error cargando tickets:', err);
        this.loadingTickets.set(false);
      }
    });
  }

  selectGame(game: any) {
    this.selectedGame.set(game);
    this.setView('game-details');
  }

  submitTicket(category: string, productName?: string) {
    const user = this.currentUser();
    if (!user || !this.ticketSubject.trim() || !this.ticketDetails.trim()) return;

    this.submitting.set(true);
    const finalProductName = productName || this.selectedGame()?.name || null;
    const gameId = productName ? null : (this.selectedGame()?.id?.toString() || null);

    this.authService.createSupportTicket(
      user.id,
      category,
      finalProductName,
      gameId,
      this.ticketSubject,
      this.ticketDetails
    ).subscribe({
      next: () => {
        this.submitting.set(false);
        Swal.fire({
          title: 'Solicitud enviada',
          text: 'Hemos recibido tu solicitud de ayuda. Te contactaremos pronto.',
          icon: 'success',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
        this.setView('main');
      },
      error: (err) => {
        console.error('Error enviando ticket:', err);
        this.submitting.set(false);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo enviar la solicitud. Inténtalo de nuevo.',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff'
        });
      }
    });
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'games': 'Juegos, software, etc.',
      'purchases': 'Compras',
      'store': 'Tienda',
      'community_question': 'Comunidad (Duda)',
      'community_report': 'Comunidad (Denuncia)'
    };
    return labels[category] || category;
  }
}
