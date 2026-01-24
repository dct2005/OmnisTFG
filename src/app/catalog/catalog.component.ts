import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService, Game } from '../services/game.service';

interface CatalogGame extends Game {
    isLibrary: boolean;
    isFavorite: boolean;
    categories: string[];
    themes: string[];
    price?: number;
}

@Component({
    selector: 'app-catalog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './catalog.component.html',
    styleUrls: ['./catalog.component.css']
})
export class CatalogComponent implements OnInit, OnDestroy {
    private gameService = inject(GameService);
    searchTerm: string = '';
    loading: boolean = true;
    isLoadingMore: boolean = false;
    error: string | null = null;
    offset: number = 0;
    reachedEnd: boolean = false;

    games: CatalogGame[] = [];

    categoriesInput: { name: string, selected: boolean }[] = [];
    themesInput: { name: string, selected: boolean }[] = [];

    ngOnInit() {
        this.loadGames();
        this.loadFilters();
        window.addEventListener('scroll', this.onScroll.bind(this));
    }

    loadFilters() {
        this.gameService.getGenres().subscribe(data => {
            this.categoriesInput = data.map(g => ({ name: g.name, selected: false }));
        });
        this.gameService.getThemes().subscribe(data => {
            this.themesInput = data.map(t => ({ name: t.name, selected: false }));
        });
    }

    ngOnDestroy() {
        window.removeEventListener('scroll', this.onScroll.bind(this));
    }

    onScroll() {
        const threshold = 500;
        const position = window.scrollY + window.innerHeight;
        const height = document.body.offsetHeight;

        if (position > height - threshold && !this.isLoadingMore && !this.loading) {
            this.loadMoreGames();
        }
    }

    onFilterChange() {
        this.offset = 0;
        this.reachedEnd = false;
        this.loading = true;
        this.games = []; // Clear current games
        this.loadGames();
    }

    private getSelectedFilters(): { genres: string[], themes: string[] } {
        const genres = this.categoriesInput.filter(c => c.selected).map(c => c.name);
        const themes = this.themesInput.filter(t => t.selected).map(t => t.name);
        return { genres, themes };
    }

    loadGames() {
        this.loading = true;

        const filters = this.getSelectedFilters();

        this.gameService.getGames(this.searchTerm, this.offset, filters.genres, filters.themes).subscribe({
            next: (data) => {
                this.games = this.mapGames(data); // Replace games instead of appending for first load
                this.loading = false;
                if (data.length < 20) {
                    this.reachedEnd = true;
                }
            },
            error: (err) => {
                console.error('Error loading games', err);
                this.error = 'Failed to load games.';
                this.loading = false;
            }
        });
    }

    loadMoreGames() {
        if (this.reachedEnd) return;

        this.isLoadingMore = true;
        this.offset += 20;

        const filters = this.getSelectedFilters();

        this.gameService.getGames(this.searchTerm, this.offset, filters.genres, filters.themes).subscribe({
            next: (data) => {
                if (data.length > 0) {
                    const newGames = this.mapGames(data);
                    this.games = [...this.games, ...newGames];
                    if (data.length < 20) {
                        this.reachedEnd = true;
                    }
                } else {
                    this.reachedEnd = true;
                }
                this.isLoadingMore = false;
            },
            error: (err) => {
                console.error('Error loading more games', err);
                this.isLoadingMore = false;
            }
        });
    }

    private mapGames(data: Game[]): CatalogGame[] {
        return data.map(g => ({
            ...g,
            isLibrary: false,
            isFavorite: false,
            categories: g.genres || [],
            themes: g.themes || []
        }));
    }

    // Removed client-side filteredGames since we now filter on backend
    // Template should use 'games' directly

    toggleFavorite(event: Event, game: CatalogGame) {
        event.stopPropagation();
        game.isFavorite = !game.isFavorite;
    }
}
