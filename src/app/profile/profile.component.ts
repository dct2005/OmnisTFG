import { Component, inject, signal, OnInit, effect, computed, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { GameService, Game } from '../services/game.service';
import { CommunityService } from '../services/community.service';
import { FormsModule } from '@angular/forms';
declare var Swal: any;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnDestroy {
  authService = inject(AuthService);
  gameService = inject(GameService);
  communityService = inject(CommunityService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private renderer = inject(Renderer2);

  // Profile data signal
  profileData = signal({
    // ... existings fields ...
    level: 21,
    currentBadge: {
      name: 'Novato de Élite',
      exp: 1000,
      icon: 'images/ins_nonecesito.png'
    },
    favoriteGroup: {
      name: 'Frozen Mind PEEK',
      type: 'Grupo Público',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3', // Placeholder banner
      stats: {
        members: '23.526',
        playing: '10.532',
        connected: '15.221'
      }
    },
    recentActivity: {
      gameName: 'Grand Theft Auto V',
      image: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3', // Placeholder game
      hoursPlayed: '5.725',
      lastSession: '20/10',
      achievements: '47/51'
    },
    stats: {
      awards: 99,
      badges: 99,
      friends: 99,
      comments: 99,
      reviews: 99,
      groups: 0,
      games: 0
    }
  });

  comments = signal<any[]>([]);
  viewedUser = signal<any>(null);
  friendshipStatus = signal<'none' | 'pending' | 'requested' | 'accepted'>('none');
  friendshipId = signal<number | null>(null);
  friendsList = signal<any[]>([]);
  purchasedGamesList = signal<any[]>([]);
  userCommunitiesList = signal<any[]>([]);
  userReviewsList = signal<any[]>([]);

  // Edit Profile signals
  isEditModalOpen = signal(false);
  userGames = signal<any[]>([]);
  userCommunities = signal<any[]>([]);
  editForm = signal({
    favorite_group_id: null,
    favorite_game_id: '',
    country: '',
    state: '',
    city: '',
    privacy_profile: 'public',
    privacy_games: 'public',
    privacy_inventory: 'public',
    privacy_comments: 'public',
    status_message: '',
    estado: 'en-linea',
    selected_badge_id: null
  });

  isOwnProfile = computed(() => {
    const current = this.authService.currentUser();
    const viewed = this.viewedUser();
    return current && viewed && current.id === viewed.id;
  });

  userLevel = computed(() => {
    const user = this.viewedUser();
    const xp = user?.xp || 0;
    return Math.floor(xp / 1000);
  });

  levelTier = computed(() => {
    return Math.floor(this.userLevel() / 10);
  });

  profileBackground = computed(() => {
    return this.viewedUser()?.profile_background;
  });

  constructor() {
    this.loadInitialData();

    // Reaccionamos a cambios en la ruta (username)
    this.route.params.subscribe(params => {
      let username = params['username'];
      if (username === 'me') {
        const current = this.authService.currentUser();
        if (current) {
          username = current.username;
        } else {
          // Si no hay usuario logueado y es 'me', redirigir a login o similar
          return;
        }
      }
      this.loadProfileByUsername(username);
    });

    // Reaccionamos cuando el usuario visualizado cambie para cargar sus datos
    effect(() => {
      const user = this.viewedUser();
      if (user) {
        this.loadUserData(user);
        this.checkFriendshipStatus(user);
      }
    }, { allowSignalWrites: true });

    // Efecto para controlar el fondo global del body
    effect(() => {
      const background = this.profileBackground();
      if (background) {
        this.renderer.setStyle(document.body, 'background-image', `url(${background})`);
      } else {
        this.renderer.setStyle(document.body, 'background-image', "url('/images/background.webp')");
      }
    });
  }

  loadProfileByUsername(username: string) {
    this.authService.getUserByUsername(username).subscribe({
      next: (res: any) => {
        if (res.user) {
          this.viewedUser.set(res.user);
        }
      },
      error: (err) => console.error('Error loading profile:', err)
    });
  }

  checkFriendshipStatus(targetUser: any) {
    const currentUser = this.authService.currentUser();
    if (!currentUser || currentUser.id === targetUser.id) {
      this.friendshipStatus.set('none');
      return;
    }

    this.authService.getFriends(currentUser.id).subscribe({
      next: (friends: any[]) => {
        const relation = friends.find(f => f.id === targetUser.id);
        if (relation) {
          this.friendshipId.set(relation.friendship_id);
          if (relation.status === 'accepted') {
            this.friendshipStatus.set('accepted');
          } else if (relation.sender_id === currentUser.id) {
            this.friendshipStatus.set('requested');
          } else {
            this.friendshipStatus.set('pending');
          }
        } else {
          this.friendshipStatus.set('none');
          this.friendshipId.set(null);
        }
      }
    });
  }

  sendRequest() {
    const current = this.authService.currentUser();
    const target = this.viewedUser();
    if (!current || !target) return;

    this.authService.sendFriendRequest(current.id, target.id).subscribe(() => {
      this.checkFriendshipStatus(target);
    });
  }

  acceptRequest() {
    const id = this.friendshipId();
    if (!id) return;
    this.authService.acceptFriendRequest(id).subscribe(() => {
      this.checkFriendshipStatus(this.viewedUser());
    });
  }

  removeFriend() {
    const id = this.friendshipId();
    if (!id) return;
    this.authService.removeFriend(id).subscribe(() => {
      this.checkFriendshipStatus(this.viewedUser());
    });
  }

  ngOnDestroy() {
    // Cuando salimos del perfil, restauramos el fondo por defecto de la aplicación
    this.renderer.setStyle(document.body, 'background-image', "url('/images/background.webp')");
  }

  loadInitialData() {
    // Cargar lo primero que haya en la base de datos por defecto
    this.communityService.getCommunities(null, false).subscribe(allComms => {
      if (allComms && allComms.length > 0) {
        this.setFavoriteGroup(allComms[0], 0);
      }
    });

    this.authService.getAnyGame().subscribe({
      next: (res: any) => {
        if (res.games && res.games.length > 0) {
          this.updateRecentActivity(res.games[0]);
        }
      },
      error: (err) => console.error('Error fetching any game:', err)
    });
  }

  loadUserData(user: any) {
    // Refinar con datos del usuario
    this.authService.getUserGames(user.email).subscribe({
      next: (res: any) => {
        const games = res.games || [];
        this.purchasedGamesList.set(games);
        const gameIds = games.map((g: any) => g.game_api_id);
        
        // Priorizar el juego favorito si está marcado, si no el primero
        const favGameId = user.favorite_game_id || (gameIds.length > 0 ? gameIds[0] : null);
        if (favGameId) {
          this.updateRecentActivity(favGameId);
        }

        // Actualizamos los stats de juegos
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, games: gameIds.length }
        }));
      }
    });

    // ... insignias ...

    this.communityService.getCommunities(user.id, true).subscribe({
      next: (myComms: any[]) => {
        this.userCommunitiesList.set(myComms);
        if (myComms && myComms.length > 0) {
          // Priorizar el grupo favorito
          const favGroup = myComms.find(c => c.id === user.favorite_group_id) || myComms[0];
          this.setFavoriteGroup(favGroup, myComms.length);
        }
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, groups: myComms.length }
        }));
      }
    });

    this.authService.getFriends(user.id).subscribe({
      next: (friends) => {
        const acceptedFriends = friends.filter(f => f.status === 'accepted');
        this.friendsList.set(acceptedFriends);
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, friends: acceptedFriends.length }
        }));
      }
    });

    this.authService.getUserComments(user.id).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, comments: comments.length }
        }));
      }
    });

    this.gameService.getUserReviews(user.id).subscribe({
      next: (reviews) => {
        this.userReviewsList.set(reviews);
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, reviews: reviews.length }
        }));
      }
    });
  }

  setFavoriteGroup(comm: any, count: number) {
    this.profileData.update(data => ({
      ...data,
      favoriteGroup: {
        name: comm.name,
        type: comm.categoria || 'Grupo Público',
        image: comm.image_url || '',
        stats: {
          members: comm.member_count?.toString() || '0',
          playing: comm.online_count?.toString() || '0',
          connected: comm.online_count?.toString() || '0'
        }
      },
      stats: { ...data.stats, groups: count }
    }));
  }

  updateRecentActivity(gameId: string) {
    this.gameService.getGameById(gameId).subscribe({
      next: (game: Game) => {
        let coverUrl = game.cover?.url || '';
        if (coverUrl.startsWith('//')) {
          coverUrl = 'https:' + coverUrl;
        }

        this.profileData.update(data => ({
          ...data,
          recentActivity: {
            ...data.recentActivity,
            gameName: game.name,
            image: coverUrl
          }
        }));
      },
      error: (err) => console.error('Error fetching game details:', err)
    });
  }

  triggerFileInput(fileInput: HTMLInputElement) {
    fileInput.click();
  }

  showBadgeDetail(badge: any) {
    Swal.fire({
      title: badge.name,
      text: badge.description,
      imageUrl: badge.icon,
      imageWidth: 150,
      imageHeight: 150,
      imageAlt: badge.name,
      background: '#0d1b2a',
      color: '#ffffff',
      confirmButtonColor: '#00f2ff',
      confirmButtonText: 'Genial'
    });
  }

  showFriendsList() {
    const friends = this.friendsList();
    if (!friends || friends.length === 0) {
      Swal.fire({
        title: 'Amigos',
        text: 'Aún no tiene amigos agregados.',
        icon: 'info',
        background: '#0d1b2a',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    let friendsHtml = `
      <div style="max-height: 400px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; text-align: left;">
    `;

    friends.forEach(f => {
      const avatar = f.profile_image || `https://ui-avatars.com/api/?name=${f.username}&background=0d1b2a&color=fff`;
      const statusClass = f.estado === 'en-linea' ? 'text-blue-400' : (f.estado === 'jugando' ? 'text-green-400' : 'text-gray-400');
      
      friendsHtml += `
        <div class="swal-friend-item" style="display: flex; align-items: center; gap: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <img src="${avatar}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; border: 2px solid #00f2ff;">
          <div style="flex-grow: 1;">
            <div style="font-weight: 700; color: #fff; font-size: 1.1rem;">${f.username}</div>
            <div style="font-size: 0.85rem; color: #a0aec0;">${f.estado || 'Desconectado'}</div>
          </div>
          <button onclick="window.location.href='/perfil/${f.username}'" 
                  style="background: linear-gradient(135deg, #7c3aed, #5b21b6); color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; border: none; font-weight: 600; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3); transition: all 0.3s ease;">
            Ver Perfil
          </button>
        </div>
      `;
    });

    friendsHtml += '</div>';

    Swal.fire({
      title: `<span style="color: #00f2ff; letter-spacing: 2px;">LISTA DE AMIGOS</span>`,
      html: friendsHtml,
      width: '500px',
      background: '#050510',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'swal-premium-popup'
      }
    });
  }

  showGamesList() {
    const gameRecords = this.purchasedGamesList();
    if (!gameRecords || gameRecords.length === 0) {
      Swal.fire({
        title: 'Biblioteca',
        text: 'Aún no tiene juegos comprados.',
        icon: 'info',
        background: '#0d1b2a',
        color: '#ffffff',
        confirmButtonColor: '#00f2ff'
      });
      return;
    }

    Swal.fire({
      title: 'Cargando Biblioteca...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
        
        // Fetch detailed info for all games in parallel
        const detailPromises = gameRecords.map(record => 
          new Promise((resolve) => {
            this.gameService.getGameById(record.game_api_id).subscribe({
              next: (detail) => resolve({ ...detail, purchaseDate: record.purchase_date }),
              error: () => resolve({ id: record.game_api_id, name: 'Juego Desconocido', purchaseDate: record.purchase_date })
            });
          })
        );

        Promise.all(detailPromises).then((games: any[]) => {
          let gamesHtml = `
            <div style="max-height: 450px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 15px; text-align: left;">
          `;

          games.forEach(g => {
            let coverUrl = g.cover?.url || 'https://placehold.co/100x120';
            if (coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
            
            const pDate = new Date(g.purchaseDate).toLocaleDateString();

            gamesHtml += `
              <div class="swal-game-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(0, 242, 255, 0.05); border-radius: 10px; border: 1px solid rgba(0, 242, 255, 0.2);">
                <img src="${coverUrl}" style="width: 60px; height: 80px; border-radius: 6px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
                <div style="flex-grow: 1;">
                  <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom: 4px;">${g.name}</div>
                  <div style="font-size: 0.85rem; color: #718096;">Comprado: ${pDate}</div>
                </div>
                <button onclick="window.location.href='/game/${g.id}'" 
                        style="background: linear-gradient(135deg, #00f2ff, #0099ff); color: #000; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; border: none; font-weight: 700; transition: all 0.3s ease;">
                  Ver Ficha
                </button>
              </div>
            `;
          });

          gamesHtml += '</div>';

          Swal.fire({
            title: `<span style="color: #00f2ff; letter-spacing: 2px;">MI BIBLIOTECA</span>`,
            html: gamesHtml,
            width: '600px',
            background: '#050510',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
              popup: 'swal-premium-popup'
            }
          });
        });
      }
    });
  }

  showGroupsList() {
    const groups = this.userCommunitiesList();
    if (!groups || groups.length === 0) {
      Swal.fire({
        title: 'Comunidades',
        text: 'Aún no te has unido a ninguna comunidad.',
        icon: 'info',
        background: '#0d1b2a',
        color: '#ffffff',
        confirmButtonColor: '#00f2ff'
      });
      return;
    }

    let groupsHtml = `
      <div style="max-height: 450px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; text-align: left;">
    `;

    groups.forEach(g => {
      const banner = g.image_url || 'images/default_community.jpg';
      
      groupsHtml += `
        <div class="swal-group-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(72, 187, 120, 0.05); border-radius: 10px; border: 1px solid rgba(72, 187, 120, 0.2);">
          <img src="${banner}" style="width: 80px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid #48bb78;">
          <div style="flex-grow: 1;">
            <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom: 2px;">${g.name}</div>
            <div style="font-size: 0.85rem; color: #a0aec0; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${g.description || 'Sin descripción'}</div>
          </div>
          <button onclick="window.location.href='/informacion-communities/${g.id}'" 
                  style="background: linear-gradient(135deg, #48bb78, #38a169); color: #000; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; border: none; font-weight: 700; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);">
            Entrar
          </button>
        </div>
      `;
    });

    groupsHtml += '</div>';

    Swal.fire({
      title: `<span style="color: #48bb78; letter-spacing: 2px;">MIS COMUNIDADES</span>`,
      html: groupsHtml,
      width: '600px',
      background: '#050510',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'swal-premium-popup'
      }
    });
  }

  showReviewsList() {
    const reviews = this.userReviewsList();
    if (!reviews || reviews.length === 0) {
      Swal.fire({
        title: 'Reseñas',
        text: 'Aún no has escrito ninguna reseña.',
        icon: 'info',
        background: '#0d1b2a',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    let reviewsHtml = `
      <div style="max-height: 450px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 15px; text-align: left;">
    `;

    reviews.forEach(r => {
      const date = new Date(r.created_at).toLocaleDateString();
      reviewsHtml += `
        <div class="swal-review-item" style="padding: 15px; background: rgba(124, 58, 237, 0.05); border-radius: 10px; border: 1px solid rgba(124, 58, 237, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: 700; color: #fff; font-size: 1.1rem;">${r.game_name || 'Juego'}</div>
            <div style="font-size: 0.8rem; color: #718096;">${date}</div>
          </div>
          <div style="color: #cbd5e0; font-size: 0.95rem; line-height: 1.5;">${r.content}</div>
          <div style="margin-top: 10px; text-align: right;">
            <button onclick="window.location.href='/game/${r.game_api_id}'" 
                    style="background: transparent; color: #7c3aed; padding: 4px 8px; border: 1px solid #7c3aed; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.3s;">
              Ver Juego
            </button>
          </div>
        </div>
      `;
    });

    reviewsHtml += '</div>';

    Swal.fire({
      title: `<span style="color: #7c3aed; letter-spacing: 2px;">MIS RESEÑAS</span>`,
      html: reviewsHtml,
      width: '600px',
      background: '#050510',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'swal-premium-popup'
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;
      this.authService.updateProfileImage(base64Image).subscribe({
        next: (res) => {
          console.log('Imagen actualizada');
          // El signal ya se actualiza en el service via tap
        },
        error: (err) => console.error('Error subiendo imagen:', err)
      });
    };
    reader.readAsDataURL(file);
  }

  onBackgroundSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;
      this.authService.updateProfileBackground(base64Image).subscribe({
        next: (res) => {
          console.log('Fondo actualizado');
        },
        error: (err) => console.error('Error subiendo fondo:', err)
      });
    };
    reader.readAsDataURL(file);
  }

  get user() {
    return this.viewedUser();
  }

  get userStatus() {
    return this.user?.estado || 'desconectado';
  }

  openEditModal() {
    this.isEditModalOpen.set(true);
    const user = this.isOwnProfile() ? this.viewedUser() : this.authService.currentUser();
    if (user) {
      this.editForm.set({
        favorite_group_id: user.favorite_group_id || null,
        favorite_game_id: user.favorite_game_id || '',
        country: user.country || '',
        state: user.state || '',
        city: user.city || '',
        privacy_profile: user.privacy_profile || 'public',
        privacy_games: user.privacy_games || 'public',
        privacy_inventory: user.privacy_inventory || 'public',
        privacy_comments: user.privacy_comments || 'public',
        status_message: user.status_message || '',
        estado: user.estado || 'en-linea',
        selected_badge_id: user.selected_badge_id || null
      });

      // Cargar juegos y comunidades para los selectores
      this.authService.getUserGames().subscribe({
        next: (res: any) => {
          this.userGames.set(res.games || []);
          // También necesitamos obtener los detalles de los juegos para mostrar los nombres
          this.loadGameDetailsForSelect(res.games || []);
        }
      });

      this.communityService.getCommunities(user.id, true).subscribe({
        next: (comms: any[]) => this.userCommunities.set(comms)
      });
    }
  }

  gameDetailsMap = signal<Map<string, string>>(new Map());

  loadGameDetailsForSelect(games: any[]) {
    games.forEach(g => {
      if (!this.gameDetailsMap().has(g.game_api_id)) {
        this.gameService.getGameById(g.game_api_id).subscribe(detail => {
          this.gameDetailsMap.update(map => {
            const newMap = new Map(map);
            newMap.set(g.game_api_id, detail.name);
            return newMap;
          });
        });
      }
    });
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
  }

  saveProfile() {
    const settings = this.editForm();
    this.authService.updateProfileSettings(settings).subscribe({
      next: (res) => {
        Swal.fire({
          icon: 'success',
          title: 'Perfil actualizado',
          text: 'Se han guardado tus cambios con éxito.',
          background: '#0d1b2a',
          color: '#ffffff',
          confirmButtonColor: '#00f2ff'
        });
        this.closeEditModal();
        // Recargar el perfil visualizado si es el propio
        if (this.isOwnProfile()) {
          this.viewedUser.set(res.user);
        }
      },
      error: (err) => {
        console.error('Error al guardar el perfil:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo actualizar el perfil.',
          background: '#0d1b2a',
          color: '#ffffff'
        });
      }
    });
  }

  onProfileStatusChange(status: string) {
    this.editForm.update(form => ({ ...form, estado: status }));
  }
}
