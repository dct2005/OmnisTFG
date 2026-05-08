import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommunityService } from '../services/community.service';
import { AuthService } from '../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
declare var Swal: any;

@Component({
  selector: 'app-informacion-communities',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;

  get paginatedPosts() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.posts.slice(start, end);
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.posts.length / this.pageSize));
  }

  changePage(delta: number) {
    this.currentPage += delta;
  }

  currentTab: 'general' | 'media' = 'general';
  mediaPreview: string | ArrayBuffer | null = null;
  uploadingMedia: boolean = false;

  isEditing: boolean = false;
  editData = {
    name: '',
    description: '',
    categoria: ''
  };

  currentUser = this.authService.currentUser;

  get communityLevel(): number {
    if (!this.communityData?.xp) return 1;
    return Math.floor(this.communityData.xp / 300) + 1;
  }

  get communityProgress(): number {
    if (!this.communityData?.xp) return 0;
    return (this.communityData.xp % 300) / 3 * 1; // Simplificando para que sea un %
  }

  get nextLevelXp(): number {
    return 300 - (this.communityData?.xp % 300 || 0);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.communityId = id;
      this.getCommunityDetails(id);
      this.loadMessages(id);


      const userId = this.authService.currentUser()?.id;
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

  switchTab(tab: 'general' | 'media') {
    this.currentTab = tab;
  }

  onMediaFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Error', 'La imagen es demasiado grande (máx 5MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => this.mediaPreview = reader.result;
      reader.readAsDataURL(file);
    }
  }

  cancelMediaUpload() {
    this.mediaPreview = null;
  }

  sendMedia() {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    if (!this.mediaPreview) return;

    this.uploadingMedia = true;
    this.communityService.sendMessage(this.communityId, userId, this.newMessage, this.mediaPreview as string).subscribe({
      next: () => {
        this.loadMessages(this.communityId);
        this.mediaPreview = null;
        this.newMessage = '';
        this.uploadingMedia = false;
        Swal.fire({
          title: '¡Publicado!',
          text: 'Tu imagen ha sido compartida',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          background: '#1a103c',
          color: '#ffffff'
        });
      },
      error: (err) => {
        console.error('Error enviando media:', err);
        this.uploadingMedia = false;
        Swal.fire('Error', 'No se pudo subir la imagen', 'error');
      }
    });
  }


  toggleJoin() {
    const userId = this.authService.currentUser()?.id;
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
    const adminId = this.authService.currentUser()?.id;
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
    const userId = this.authService.currentUser()?.id;

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