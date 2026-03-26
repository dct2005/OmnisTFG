import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommunityService } from '../services/community.service';
import { AuthService } from '../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
declare var Swal: any;

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
  private authService = inject(AuthService);

  communityData: any = null;
  communityId: string = '';

  isMember: boolean = false;
  userRole: string = '';
  members: any[] = [];
  newMessage: string = '';
  posts: any[] = [];

  isEditing: boolean = false;
  editData = {
    name: '',
    description: '',
    categoria: ''
  };

  currentUser = this.authService.currentUser;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.communityId = id;
      this.getCommunityDetails(id);
      this.loadMessages(id);


      const userId = this.getUserIdFromToken();
      if (userId) {
        this.communityService.checkMembership(id, userId).subscribe({
          next: (res: any) => {
            this.isMember = res.isMember;
            this.userRole = res.role;
            if (this.userRole === 'administrador') {
              this.loadMembers(id);
            }
          },
          error: (err: any) => console.error('Error comprobando si es miembro:', err)
        });
      }
    }
  }

  loadMembers(id: string) {
    this.communityService.getCommunityMembers(id).subscribe({
      next: (members) => this.members = members,
      error: (err) => console.error('Error cargando miembros:', err)
    });
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
      next: (data: any[]) => {
        this.communityData = data.find((c: any) => c.id.toString() === id.toString());
      },
      error: (err: any) => console.error(err)
    });
  }

  loadMessages(id: string) {
    this.communityService.getMessages(id).subscribe({
      next: (data: any[]) => {
        this.posts = data.map(m => ({
          ...m,
          avatar: m.profile_image || `https://ui-avatars.com/api/?name=${m.author}&background=0d1b2a&color=fff`
        }));
      },
      error: (err: any) => console.error('Error cargando mensajes:', err)
    });
  }


  toggleJoin() {
    const userId = this.getUserIdFromToken();
    if (!userId) {
      Swal.fire({
        title: 'Aviso',
        text: 'Debes iniciar sesión para unirte a la comunidad.',
        icon: 'warning',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    this.communityService.joinCommunity(this.communityId, userId).subscribe({
      next: (response: any) => {
        this.isMember = response.isMember;
        this.userRole = response.role;
        if (this.userRole === 'administrador') {
          this.loadMembers(this.communityId);
        }
        console.log(response.message);
      },
      error: (err: any) => console.error('Error al unirse:', err)
    });
  }

  startEditing() {
    this.isEditing = true;
    this.editData = {
      name: this.communityData.name,
      description: this.communityData.description,
      categoria: this.communityData.categoria
    };
  }

  cancelEditing() {
    this.isEditing = false;
  }

  saveChanges() {
    this.communityService.updateCommunity({ id: this.communityId, ...this.editData }).subscribe({
      next: (res) => {
        this.communityData.name = this.editData.name;
        this.communityData.description = this.editData.description;
        this.communityData.categoria = this.editData.categoria;
        this.isEditing = false;
        Swal.fire({
          title: '¡Éxito!',
          text: 'Comunidad actualizada',
          icon: 'success',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
      },
      error: (err) => {
        console.error('Error actualizando:', err);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo actualizar la comunidad',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
      }
    });
  }

  kickMember(memberId: number) {
    const adminId = this.getUserIdFromToken();
    if (!adminId) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: "Este usuario será expulsado de la comunidad",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, expulsar',
      cancelButtonText: 'Cancelar',
      background: '#1a103c',
      color: '#ffffff',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#7c3aed'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.communityService.kickMember(this.communityId, memberId, adminId).subscribe({
          next: () => {
            this.members = this.members.filter(m => m.id !== memberId);
            Swal.fire({
              title: 'Expulsado',
              text: 'El miembro ha sido expulsado',
              icon: 'success',
              background: '#1a103c',
              color: '#ffffff',
              confirmButtonColor: '#7c3aed'
            });
          },
          error: (err: any) => {
            console.error('Error expulsando:', err);
            Swal.fire('Error', 'No se pudo expulsar al miembro', 'error');
          }
        });
      }
    });
  }

  sendMessage() {
    const userId = this.getUserIdFromToken();

    if (!userId) {
      Swal.fire({
        title: 'Aviso',
        text: 'Debes iniciar sesión para escribir.',
        icon: 'warning',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    if (this.newMessage.trim() === '') return;

    this.communityService.sendMessage(this.communityId, userId, this.newMessage).subscribe({
      next: (response: any) => {
        this.loadMessages(this.communityId);
        this.newMessage = '';
      },
      error: (err: any) => {
        console.error('Error enviando mensaje:', err);
        Swal.fire({
          title: 'Error',
          text: 'Hubo un error al enviar tu mensaje.',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
      }
    });
  }
}