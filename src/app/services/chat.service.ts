import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private apiUrl = '/api/messages';

  getConversations(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-conversations&userId=${userId}`);
  }

  getChatHistory(user1: number, user2: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-chat&user1=${user1}&user2=${user2}`);
  }

  sendMessage(senderId: number, receiverId: number, content: string, imageUrl?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=send`, { senderId, receiverId, content, imageUrl });
  }

  markAsRead(userId: number, otherId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=mark-read`, { userId, otherId });
  }

  getUnreadMessages(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-unread-messages&userId=${userId}`);
  }

  setTypingStatus(userId: number, otherId: number, isTyping: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=set-typing`, { userId, otherId, isTyping });
  }

  getTypingStatus(userId: number, otherId: number): Observable<{ isTyping: boolean }> {
    return this.http.get<{ isTyping: boolean }>(`${this.apiUrl}?action=get-typing&userId=${userId}&otherId=${otherId}`);
  }

  getGroups(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-groups&userId=${userId}`);
  }

  getGroupChat(groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-group-chat&groupId=${groupId}`);
  }

  getGroupMembers(groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=get-group-members&groupId=${groupId}`);
  }

  createGroup(name: string, creatorId: number, memberIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=create-group`, { name, creatorId, memberIds });
  }

  sendGroupMessage(groupId: number, senderId: number, content: string, imageUrl?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=send-group-message`, { groupId, senderId, content, imageUrl });
  }
}
