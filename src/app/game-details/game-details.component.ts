import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, Game } from '../services/game.service';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-game-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-details.component.html',
  styleUrls: ['./game-details.component.css']
})
export class GameDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameService = inject(GameService);
  private authService = inject(AuthService);
  private location = inject(Location);

  currentUser = this.authService.currentUser;

  game: Game | null = null;
  additionalContent: any[] = [];
  specialEditions: any[] = [];
  allSimilarGames: Game[] = [];
  scrollIndex = 0;
  loading = true;
  error: string | null = null;
  loadingSimilar = false;

  isDescriptionExpanded = false;
  isDlcsExpanded = false;

  get truncatedSummary(): string {
    const summary = this.game?.summary || 'Durante las dos últimas décadas, Counter-Strike ha proporcionado una experiencia competitiva de primer nivel para los millones de jugadores de todo el mundo que contribuyeron a darle forma. Ahora el próximo capítulo en la historia de CS está a punto de comenzar. Hablamos de Counter-Strike 2.';
    if (this.isDescriptionExpanded || summary.length <= 840) {
      return summary;
    }
    return summary.substring(0, 840) + '...';
  }

  get displayedDlcs() {
    return this.isDlcsExpanded ? this.additionalContent : this.additionalContent.slice(0, 4);
  }

  toggleDescription() {
    this.isDescriptionExpanded = !this.isDescriptionExpanded;
  }

  toggleDlcs() {
    this.isDlcsExpanded = !this.isDlcsExpanded;
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadGame(id);
      }
    });
  }

  loadGame(id: string) {
    this.loading = true;
    this.error = null;
    this.gameService.getGameById(id).subscribe({
      next: (game) => {
        this.game = game;
        this.additionalContent = [...(game.dlcs || []), ...(game.expansions || [])];
        
        // Buscar ediciones especiales en DLCs, expansiones y bundles del juego
        const allRelated = [
          ...(game.dlcs || []),
          ...(game.expansions || []),
          ...(game.bundles || [])
        ];
        const specialKeywords = ['edition', 'edición', 'gold', 'platinum', 'premium', 'deluxe', 'ultimate', 'definitive', 'goty', 'game of the year', "director's cut", 'complete', 'enhanced', 'remaster', 'collection'];
        this.specialEditions = allRelated.filter(item => {
          const lowerName = (item.name || '').toLowerCase();
          return specialKeywords.some(kw => lowerName.includes(kw));
        });
        
        this.loading = false;
        this.loadSimilarGames();
      },
      error: (err) => {
        console.error('Error loading game', err);
        this.error = 'Failed to load game details.';
        this.loading = false;
      }
    });
  }

  loadSimilarGames() {
    if (!this.game) return;
    this.loadingSimilar = true;
    this.scrollIndex = 0;
    
    const genres = this.game.genres?.slice(0, 2);
    const themes = this.game.themes?.slice(0, 2);
    
    this.gameService.getGames(undefined, 0, genres, themes).subscribe({
      next: (games) => {
        // Exclude the current game from similar games. Get up to 12.
        this.allSimilarGames = games.filter(g => g.id !== this.game?.id).slice(0, 12);
        this.loadingSimilar = false;
      },
      error: (err) => {
        console.error('Error loading similar games', err);
        this.loadingSimilar = false;
      }
    });
  }

  scrollDown() {
    const maxScroll = Math.max(0, this.allSimilarGames.length - 3);
    if (this.scrollIndex < maxScroll) {
      this.scrollIndex = Math.min(maxScroll, this.scrollIndex + 3);
    } else {
      // Loop back to start if reached the end
      this.scrollIndex = 0;
    }
  }

  goBack() {
    this.location.back();
  }

  goToSimilar(id: number) {
    this.router.navigate(['/game', id]);
  }

  onObtenerClick() {
    if (!this.currentUser()) {
      this.router.navigate(['/login']);
    } else {
      alert('¡Gracias por tu compra! El producto se ha añadido a tu cuenta.');
    }
  }
}
