import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommunityService } from '../services/community.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-informacion-communities',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './informacion-communities.html',
  styleUrl: './informacion-communities.css',
})
export class InformacionCommunities implements OnInit {
  private route = inject(ActivatedRoute);
  private communityService = inject(CommunityService);

  communityData: any = null;
  communityId: string = '';

  isMember: boolean = false;
  newMessage: string = '';
  posts: any[] = [];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.communityId = id;
      this.getCommunityDetails(id);
      this.loadMessages(id);
    }
  }

  getUserIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload.userId || null;
    } catch (e) {
      console.error('Error al leer el token:', e);
      return null;
    }
  }

  getCommunityDetails(id: string) {
    this.communityService.getCommunities().subscribe({
      next: (data) => {
        this.communityData = data.find((c: any) => c.id.toString() === id.toString());
      },
      error: (err) => console.error(err)
    });
  }

  loadMessages(id: string) {
    this.communityService.getMessages(id).subscribe({
      next: (data) => {
        this.posts = data;
      },
      error: (err) => console.error('Error cargando mensajes:', err)
    });
  }


  toggleJoin() {
    const userId = this.getUserIdFromToken();
    if (!userId) {
      alert('Debes iniciar sesión para unirte a la comunidad.');
      return;
    }

    this.communityService.joinCommunity(this.communityId, userId).subscribe({
      next: (response) => {
        this.isMember = response.isMember;
        console.log(response.message);
      },
      error: (err) => console.error('Error al unirse:', err)
    });
  }

  sendMessage() {
    const userId = this.getUserIdFromToken();

    if (!userId) {
      alert('Debes iniciar sesión para escribir.');
      return;
    }

    if (this.newMessage.trim() === '') return;

    this.communityService.sendMessage(this.communityId, userId, this.newMessage).subscribe({
      next: (response) => {
        this.loadMessages(this.communityId);
        this.newMessage = '';
      },
      error: (err) => {
        console.error('Error enviando mensaje:', err);
        alert('Hubo un error al enviar tu mensaje.');
      }
    });
  }
}