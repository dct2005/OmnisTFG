import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Game } from '../services/game.service';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { DailyRewardComponent } from '../daily-reward/daily-reward.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, DailyRewardComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
    private gameService = inject(GameService);
    public authService = inject(AuthService);
    private router = inject(Router);
    games: Game[] = [];
    loading = true;
    error = '';
    
    showReward = signal(false);

    ngOnInit() {
        this.gameService.getGames().subscribe({
            next: (data) => {
                this.games = data;
                this.loading = false;
                this.checkReward();
            },
            error: (err) => {
                console.error('Error fetching games:', err);
                this.error = 'No se pudieron cargar los juegos. ';
                this.loading = false;
                this.checkReward();
            }
        });
    }

    checkReward() {
        const user = this.authService.currentUser();
        if (user) {
            this.authService.checkDailyReward().subscribe({
                next: (res: any) => {
                    if (res.canClaim) {
                        this.showReward.set(true);
                    }
                }
            });
        }
    }

    scrollLeft() {
        const container = document.querySelector('.cards-container');
        if (container) {
            container.scrollBy({ left: -300, behavior: 'smooth' });
        }
    }

    scrollRight() {
        const container = document.querySelector('.cards-container');
        if (container) {
            container.scrollBy({ left: 300, behavior: 'smooth' });
        }
    }

    goToGame(id: number) {
        this.router.navigate(['/game', id]);
    }
}
