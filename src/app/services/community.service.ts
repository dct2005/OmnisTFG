import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CommunityService {
    private http = inject(HttpClient);


    private apiUrl = '/api/communities';

    getCommunities(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }
    getCommunityById(id: String): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${id}`);
    }
    joinCommunity(communityId: string, userId: number): Observable<any> {
        return this.http.post<any>(`/api/communities/${communityId}/join`, { userId });
    }

    getMessages(communityId: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/communities/${communityId}/messages`);
    }

    sendMessage(communityId: string, userId: number, content: string): Observable<any> {
        return this.http.post<any>(`/api/communities/${communityId}/messages`, { userId, content });
    }
}