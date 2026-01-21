import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Game } from '../services/game.service';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
    private gameService = inject(GameService);
    games: Game[] = [];
    loading = true;
    error = '';

    ngOnInit() {
        this.gameService.getGames().subscribe({
            next: (data) => {
                this.games = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching games:', err);
                this.error = 'No se pudieron cargar los juegos. ';
                this.loading = false;
            }
        });
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
}
