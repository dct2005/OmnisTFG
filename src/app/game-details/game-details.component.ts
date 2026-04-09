import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, Game } from '../services/game.service';
import { AuthService } from '../services/auth';
declare var Swal: any;

@Component({
  selector: 'app-game-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  isOwned = false;
  ownedGameIds: string[] = [];

  isDescriptionExpanded = false;
  isDlcsExpanded = false;

  gameReviews = signal<any[]>([]);
  reviewContent = '';
  submittingReview = false;

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

    // Check ownership if user is already logged in
    if (this.currentUser()) {
      this.fetchOwnedGames();
    }
  }

  fetchOwnedGames() {
    this.authService.getUserGames().subscribe({
      next: (res) => {
        this.ownedGameIds = res.games.map((g: any) => g.game_api_id.toString());
        this.checkIfOwned();
      },
      error: (err) => {
        console.error('Error fetching owned games', err);
      }
    });
  }

  checkIfOwned() {
    this.isOwned = this.isItemOwned(this.game?.id);
  }

  isItemOwned(itemId: number | string | undefined): boolean {
    if (!itemId) return false;
    return this.ownedGameIds.includes(itemId.toString());
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

        this.checkIfOwned();
        this.loading = false;
        this.loadReviews(game.id);
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

  onObtenerClick(priceStr: string | number) {
    const user = this.currentUser();
    if (!user) {
      this.router.navigate(['/catalogo'], { queryParams: { tab: 'mine' } });
      return;
    }

    if (!this.game) return;

    const price = parseInt(priceStr.toString().replace(/\./g, ''), 10);
    const currentPeppix = typeof user.peppix === 'string' ? parseInt(user.peppix.toString().replace(/\./g, ''), 10) : (user.peppix || 0);

    if (currentPeppix >= price) {
      this.authService.purchaseGame(this.game.id, price, this.game.name).subscribe({
        next: () => {
          this.isOwned = true;
          this.ownedGameIds.push(this.game!.id.toString());
          Swal.fire({
            title: '¡Gracias por tu compra!',
            text: 'El juego se ha añadido a tu biblioteca.',
            icon: 'success',
            background: '#1a103c',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
          });
        },
        error: (err: any) => {
          console.error('Error en la compra:', err);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo completar la compra. Inténtalo de nuevo.',
            icon: 'error',
            background: '#1a103c',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
          });
        }
      });
    } else {
      Swal.fire({
        title: 'Saldo insuficiente',
        text: '¿Deseas recargar Peppix en la tienda?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Recargar',
        cancelButtonText: 'Cancelar',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#d33'
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.router.navigate(['/compras']);
        }
      });
    }
  }

  loadReviews(gameId: number | string) {
    this.gameService.getGameReviews(gameId).subscribe({
      next: (reviews) => this.gameReviews.set(reviews),
      error: (err) => console.error('Error cargando reseñas', err)
    });
  }

  submitReview() {
    const user = this.currentUser();
    if (!user || !this.game || !this.reviewContent.trim()) return;

    this.submittingReview = true;
    this.gameService.submitReview(
      user.id,
      this.game.id,
      this.game.name,
      this.reviewContent
    ).subscribe({
      next: (newReview) => {
        this.gameReviews.update(prev => [
          { ...newReview, username: user.username, profile_image: user.profile_image },
          ...prev
        ]);
        this.reviewContent = '';
        this.submittingReview = false;
        Swal.fire({
          title: 'Reseña enviada',
          text: '¡Gracias por compartir tu opinión!',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          background: '#1a103c',
          color: '#ffffff'
        });
      },
      error: (err) => {
        console.error('Error enviando reseña', err);
        this.submittingReview = false;
      }
    });
  }
}
