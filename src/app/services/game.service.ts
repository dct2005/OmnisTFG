import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Game {
  id: number;
  name: string;
  cover?: {
    id: number;
    url: string;
  };
  rating?: number;
  developer?: string;
  genres?: string[];
  themes?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = '/api/games';
  private genresUrl = '/api/genres';
  private themesUrl = '/api/themes';

  getGames(search?: string, offset: number = 0, genres?: string[], themes?: string[]): Observable<Game[]> {
    const params: any = { offset: offset.toString() };
    if (search) {
      params.search = search;
    }
    if (genres && genres.length > 0) {
      genres.forEach(g => {
        // Handle array params for HttpParams or simple object
        // Angular HttpClient handles arrays in params as 'key': ['val1', 'val2'] if using HttpParams,
        // but for simple object it might need distinct handling. Let's use simple object with repeating keys logic if needed,
        // or just pass as is hoping HttpClient serialization works for array.
        // Actually, simpler to pass as is.
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
        themes: (game as any).themes?.map((t: any) => t.name) || []
      })))
    );
  }

  getGenres(): Observable<any[]> {
    return this.http.get<any[]>(this.genresUrl);
  }

  getThemes(): Observable<any[]> {
    return this.http.get<any[]>(this.themesUrl);
  }
}
