import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
    providedIn: 'root'
})
export class CommunityService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);


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
        return this.http.post<any>(`/api/communities/${communityId}?action=join`, { userId }, this.authService.getAuthHeaders());
    }

    getMessages(communityId: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/communities/${communityId}?action=messages`);
    }

    sendMessage(communityId: string, userId: number, content: string, imageUrl?: string): Observable<any> {
        return this.http.post<any>(`/api/communities/${communityId}?action=messages`, { userId, content, image_url: imageUrl }, this.authService.getAuthHeaders());
    }
    createCommunity(data: any): Observable<any> {
        return this.http.post<any>('/api/communities', data);
    }
    checkMembership(communityId: string, userId: number): Observable<any> {
        return this.http.get<any>(`/api/communities/${communityId}?action=join&userId=${userId}`);
    }

    getCommunityMembers(communityId: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/communities/${communityId}?action=members`);
    }

    kickMember(communityId: string, userId: number, adminId: number): Observable<any> {
        return this.http.delete<any>(`/api/communities/${communityId}?action=members`, {
            body: { userId, adminId }
        });
    }

    updateCommunity(data: any): Observable<any> {
        return this.http.post<any>('/api/communities', { action: 'update', ...data });
    }
}