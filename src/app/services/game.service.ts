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
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = '/api/games';

  getGames(search?: string, offset: number = 0): Observable<Game[]> {
    const params: any = { offset: offset.toString() };
    if (search) {
      params.search = search;
    }
    return this.http.get<Game[]>(this.apiUrl, { params }).pipe(
      map(games => games.map(game => ({
        ...game,
        cover: game.cover ? {
          ...game.cover,
          url: game.cover.url.replace('t_thumb', 't_cover_big')
        } : undefined,
        // extraer desarrollador
        developer: (game as any).involved_companies?.find((c: any) => c.developer)?.company?.name
      })))
    );
  }
}
