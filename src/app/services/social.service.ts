import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RankedUser {
  id: number;
  username: string;
  profile_image: string;
  estado: string;
  count: number;
}

export interface SocialRankings {
  top_buyers: RankedUser[];
  top_communities: RankedUser[];
  top_friends: RankedUser[];
  top_value: RankedUser[];
}

@Injectable({
  providedIn: 'root'
})
export class SocialService {
  private http = inject(HttpClient);
  private apiUrl = '/api/social/rankings';

  getRankings(): Observable<SocialRankings> {
    return this.http.get<SocialRankings>(this.apiUrl);
  }
}
