import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, Game } from '../services/game.service';

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
  private location = inject(Location);

  game: Game | null = null;
  similarGames: Game[] = [];
  loading = true;
  error: string | null = null;
  loadingSimilar = false;

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
    
    const genres = this.game.genres?.slice(0, 2);
    const themes = this.game.themes?.slice(0, 2);
    
    this.gameService.getGames(undefined, 0, genres, themes).subscribe({
      next: (games) => {
        // Exclude the current game from similar games
        this.similarGames = games.filter(g => g.id !== this.game?.id).slice(0, 3);
        this.loadingSimilar = false;
      },
      error: (err) => {
        console.error('Error loading similar games', err);
        this.loadingSimilar = false;
      }
    });
  }

  goBack() {
    this.location.back();
  }

  goToSimilar(id: number) {
    this.router.navigate(['/game', id]);
  }
}
