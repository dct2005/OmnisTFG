import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Game {
  id: number;
  name: string;
  summary?: string;
  cover?: {
    id: number;
    url: string;
  };
  rating?: number;
  developer?: string;
  genres?: string[];
  themes?: string[];
  dlcs?: any[];
  expansions?: any[];
  versions?: any[];
  bundles?: any[];
  peppixPrice?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = '/api/games';
  private genresUrl = '/api/metadata?type=genres';
  private themesUrl = '/api/metadata?type=themes';

  getGames(search?: string, offset: number = 0, genres?: string[], themes?: string[], ids?: string[] | number[]): Observable<Game[]> {
    const params: any = { offset: offset.toString() };
    if (search) {
      params.search = search;
    }
    if (ids && ids.length > 0) {
      params.id = ids.map(id => id.toString());
    }
    if (genres && genres.length > 0) {
      genres.forEach(g => {
        // Manejar parámetros de matriz para HttpParams u objeto simple
        // Angular HttpClient maneja matrices en parámetros como 'clave': ['val1', 'val2'] si usa HttpParams,
        // pero para un objeto simple puede necesitar un manejo distinto. Usemos un objeto simple con lógica de claves repetidas si es necesario,
        // o simplemente pase como espera que la serialización de HttpClient funcione para la matriz.
        // En realidad, es más sencillo pasarlo tal como está.
      });
      params.genres = genres;
    }
    if (themes && themes.length > 0) {
      params.themes = themes;
    }
    return this.http.get<Game[]>(this.apiUrl, { params }).pipe(
      map(games => games.map(game => ({
        ...game,
        cover: game.cover ? {
          ...game.cover,
          url: game.cover.url.replace('t_thumb', 't_cover_big')
        } : undefined,
        // extraer desarrollador
        developer: (game as any).involved_companies?.find((c: any) => c.developer)?.company?.name,
        genres: (game as any).genres?.map((g: any) => g.name) || [],
        themes: (game as any).themes?.map((t: any) => t.name) || [],
        dlcs: (game as any).dlcs?.map((d: any) => ({ ...d, peppixPrice: d.peppixPrice, cover: d.cover ? { ...d.cover, url: d.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || [],
        expansions: (game as any).expansions?.map((e: any) => ({ ...e, peppixPrice: e.peppixPrice, cover: e.cover ? { ...e.cover, url: e.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || [],
        versions: [],
        bundles: (game as any).bundles?.map((b: any) => ({ ...b, peppixPrice: b.peppixPrice, cover: b.cover ? { ...b.cover, url: b.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || []
      })))
    );
  }

  getGameById(id: string | number): Observable<Game> {
    const params = { id: id.toString() };
    return this.http.get<Game[]>(this.apiUrl, { params }).pipe(
      map(games => {
        if (!games || games.length === 0) {
          throw new Error('Game not found');
        }
        const game = games[0];
        return {
          ...game,
          cover: game.cover ? {
            ...game.cover,
            url: game.cover.url.replace('t_thumb', 't_cover_big')
          } : undefined,
          developer: (game as any).involved_companies?.find((c: any) => c.developer)?.company?.name,
          genres: (game as any).genres?.map((g: any) => g.name) || [],
          themes: (game as any).themes?.map((t: any) => t.name) || [],
          dlcs: (game as any).dlcs?.map((d: any) => ({ ...d, peppixPrice: d.peppixPrice, cover: d.cover ? { ...d.cover, url: d.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || [],
          expansions: (game as any).expansions?.map((e: any) => ({ ...e, peppixPrice: e.peppixPrice, cover: e.cover ? { ...e.cover, url: e.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || [],
          versions: [],
          bundles: (game as any).bundles?.map((b: any) => ({ ...b, peppixPrice: b.peppixPrice, cover: b.cover ? { ...b.cover, url: b.cover.url.replace('t_thumb', 't_cover_big') } : undefined })) || []
        };
      })
    );
  }

  getGenres(): Observable<any[]> {
    return this.http.get<any[]>(this.genresUrl);
  }

  getThemes(): Observable<any[]> {
    return this.http.get<any[]>(this.themesUrl);
  }

  getGameReviews(gameId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`/api/game-reviews?gameId=${gameId}`);
  }

  getUserReviews(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`/api/game-reviews?userId=${userId}`);
  }

  submitReview(userId: number, gameId: number, gameName: string, content: string): Observable<any> {
    return this.http.post<any>('/api/game-reviews', { userId, gameId, gameName, content });
  }
}
