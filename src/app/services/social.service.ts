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

  getFriendActivities(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`/api/social/activities?userId=${userId}`);
  }

  getAwards(userId?: number | string): Observable<any[]> {
    const url = userId ? `/api/social/awards?userId=${userId}` : '/api/social/awards';
    return this.http.get<any[]>(url);
  }

  togglePinAward(userId: number, awardId: number): Observable<any> {
    return this.http.post('/api/social/awards', {
      userId,
      awardId,
      action: 'toggle-pin'
    });
  }

  getPets(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`/api/user?action=get-pets&userId=${userId}`);
  }

  setActivePet(userId: number | string, petId: number | null, active: boolean): Observable<any> {
    return this.http.post('/api/user', {
      action: 'update-active-pet',
      userId,
      petId,
      active
    });
  }
}
