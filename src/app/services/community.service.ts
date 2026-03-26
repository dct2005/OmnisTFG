import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CommunityService {
    private http = inject(HttpClient);


    private apiUrl = '/api/communities';


    getCommunities(userId?: number | null, myCommunities: boolean = false): Observable<any[]> {
        let url = '/api/communities';


        if (userId && myCommunities) {
            url += `?userId=${userId}&myCommunities=true`;
        }

        return this.http.get<any[]>(url);
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
    createCommunity(data: any): Observable<any> {
        return this.http.post<any>('/api/communities', data);
    }
    checkMembership(communityId: string, userId: number): Observable<any> {
        return this.http.get<any>(`/api/communities/${communityId}/join?userId=${userId}`);
    }

    getCommunityMembers(communityId: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/communities/${communityId}/members`);
    }

    kickMember(communityId: string, userId: number, adminId: number): Observable<any> {
        return this.http.delete<any>(`/api/communities/${communityId}/members`, {
            body: { userId, adminId }
        });
    }

    updateCommunity(data: any): Observable<any> {
        return this.http.post<any>('/api/communities', { action: 'update', ...data });
    }
}