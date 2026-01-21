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
  private apiUrl = '/api/games'; // Relative path to the serverless function

  getGames(): Observable<Game[]> {
    return this.http.get<Game[]>(this.apiUrl).pipe(
      map(games => games.map(game => ({
        ...game,
        cover: game.cover ? {
          ...game.cover,
          // Replace 't_thumb' with 't_cover_big' or 't_720p' for better quality
          url: game.cover.url.replace('t_thumb', 't_cover_big')
        } : undefined,
        // Extract developer
        developer: (game as any).involved_companies?.find((c: any) => c.developer)?.company?.name
      })))
    );
  }
}
