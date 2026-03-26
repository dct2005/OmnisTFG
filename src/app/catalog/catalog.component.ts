import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService, Game } from '../services/game.service';
import { AuthService } from '../services/auth';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

interface CatalogGame extends Game {
    isLibrary: boolean;
    isFavorite: boolean;
    categories: string[];
    themes: string[];
    peppixPrice?: number;
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
    private authService = inject(AuthService);
    private router = inject(Router);

    currentUser = this.authService.currentUser;
    activeTab = signal<'explore' | 'mine'>('explore');

    searchTerm = signal<string>('');
    loading = signal<boolean>(true);
    isLoadingMore = signal<boolean>(false);
    error = signal<string | null>(null);
    offset = 0;
    reachedEnd = false;

    games: CatalogGame[] = [];
    private searchSubject = new Subject<string>();

    categoriesInput: { name: string, selected: boolean }[] = [];
    themesInput: { name: string, selected: boolean }[] = [];
    userWishlist: string[] = [];

    private route = inject(ActivatedRoute);

    ngOnInit() {
        this.route.queryParams.subscribe((params: any) => {
            if (params['tab'] === 'mine' && this.currentUser()) {
                this.activeTab.set('mine');
            } else {
                this.activeTab.set('explore');
            }
            this.resetAndLoad();
        });

        this.loadFilters();
        window.addEventListener('scroll', this.onScroll.bind(this));

        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged()
        ).subscribe(searchTerm => {
            this.searchTerm.set(searchTerm);
            this.resetAndLoad();
        });
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

        if (position > height - threshold && !this.isLoadingMore() && !this.loading()) {
            this.loadMoreGames();
        }
    }

    onSearchTermChange(term: string) {
        this.searchSubject.next(term);
    }

    onFilterChange() {
        this.resetAndLoad();
    }

    setTab(tab: 'explore' | 'mine') {
        if (this.activeTab() === tab) return;
        this.activeTab.set(tab);
        this.resetAndLoad();
    }

    private resetAndLoad() {
        this.offset = 0;
        this.reachedEnd = false;
        this.games = [];
        if (this.currentUser()) {
            this.authService.getWishlist().subscribe({
                next: (res: any) => {
                    this.userWishlist = res.wishlist || [];
                    this.loadGames();
                },
                error: (err) => {
                    console.error('Error fetching wishlist', err);
                    this.loadGames();
                }
            });
        } else {
            this.loadGames();
        }
    }

    private getSelectedFilters(): { genres: string[], themes: string[] } {
        const genres = this.categoriesInput.filter(c => c.selected).map(c => c.name);
        const themes = this.themesInput.filter(t => t.selected).map(t => t.name);
        return { genres, themes };
    }

    loadGames() {
        this.loading.set(true);
        this.error.set(null);

        const filters = this.getSelectedFilters();

        if (this.activeTab() === 'mine') {
            this.authService.getUserGames().pipe(
                switchMap((res: any) => {
                    const games = res.games || [];
                    const ids = games.map((g: any) => g.game_api_id);
                    if (ids.length === 0) return of([]);
                    // En "Mis Juegos", cargamos todos de una vez por ahora (o paginados si implementamos después)
                    return this.gameService.getGames(this.searchTerm(), 0, [], [], ids);
                })
            ).subscribe({
                next: (data) => {
                    this.games = this.mapGames(data, true);
                    this.loading.set(false);
                    this.reachedEnd = true; // Por ahora no paginamos "Mis Juegos"
                },
                error: (err) => {
                    console.error('Error loading my games', err);
                    this.error.set('Error al cargar tus juegos.');
                    this.loading.set(false);
                }
            });
        } else {
            this.gameService.getGames(this.searchTerm(), this.offset, filters.genres, filters.themes).subscribe({
                next: (data) => {
                    this.games = this.mapGames(data);
                    this.loading.set(false);
                    if (data.length < 20) {
                        this.reachedEnd = true;
                    }
                },
                error: (err) => {
                    console.error('Error loading games', err);
                    this.error.set('Error al cargar el catálogo.');
                    this.loading.set(false);
                }
            });
        }
    }

    loadMoreGames() {
        if (this.reachedEnd || this.activeTab() === 'mine') return;

        this.isLoadingMore.set(true);
        this.offset += 20;

        const filters = this.getSelectedFilters();

        this.gameService.getGames(this.searchTerm(), this.offset, filters.genres, filters.themes).subscribe({
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
                this.isLoadingMore.set(false);
            },
            error: (err) => {
                console.error('Error loading more games', err);
                this.isLoadingMore.set(false);
            }
        });
    }

    private mapGames(data: Game[], isLibrary = false): CatalogGame[] {
        return data.map(g => ({
            ...g,
            isLibrary: isLibrary,
            isFavorite: this.userWishlist.includes(g.id.toString()),
            categories: g.genres || [],
            themes: g.themes || []
        }));
    }

    toggleFavorite(event: Event, game: CatalogGame) {
        event.stopPropagation();
        if (!this.currentUser()) {
            this.router.navigate(['/login']);
            return;
        }
        
        game.isFavorite = !game.isFavorite;
        this.authService.toggleWishlist(game.id).subscribe({
            next: (res: any) => {
                if (res.inWishlist) {
                    if (!this.userWishlist.includes(game.id.toString())) {
                        this.userWishlist.push(game.id.toString());
                    }
                } else {
                    this.userWishlist = this.userWishlist.filter(id => id !== game.id.toString());
                }
            },
            error: (err) => {
                console.error('Error toggling wishlist', err);
                game.isFavorite = !game.isFavorite; // Revert on error
            }
        });
    }

    goToGame(id: number) {
        this.router.navigate(['/game', id]);
    }
}

