import { Component, inject, signal, OnInit, effect, computed, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../services/auth';
import { GameService, Game } from '../services/game.service';
import { CommunityService } from '../services/community.service';
import { SocialService } from '../services/social.service';
import { FormsModule } from '@angular/forms';
import { MusicHudComponent } from '../shared/music-hud.component';
declare var Swal: any;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MusicHudComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnDestroy {
  authService = inject(AuthService);
  gameService = inject(GameService);
  communityService = inject(CommunityService);
  socialService = inject(SocialService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private renderer = inject(Renderer2);

  // Profile data signal
  profileData = signal({
    level: 1,
    currentBadge: {
      name: 'Sin Insignias',
      exp: 0,
      icon: 'images/ins_nonecesito.png'
    },
    favoriteGroup: {
      name: '',
      type: '',
      image: '',
      stats: {
        members: '0',
        playing: '0',
        connected: '0'
      }
    },
    recentActivity: {
      gameName: '',
      image: '',
      hoursPlayed: '0',
      lastSession: '',
      achievements: '0/0'
    },
    stats: {
      awards: 0,
      badges: 0,
      friends: 0,
      comments: 0,
      reviews: 0,
      groups: 0,
      games: 0
    }
  });

  // Signals
  viewedUser = signal<any>(null);
  cacheBuster = Date.now();
  pinnedAwards = computed(() => this.viewedUser()?.pinned_awards || []);
  allAwardsList = signal<any[]>([]);
  allPetsList = signal<any[]>([]);
  activePet = computed(() => this.viewedUser()?.active_pet);
  comments = signal<any[]>([]);
  friendshipStatus = signal<'none' | 'pending' | 'requested' | 'accepted'>('none');
  friendshipId = signal<number | null>(null);
  friendsList = signal<any[]>([]);
  purchasedGamesList = signal<any[]>([]);
  userCommunitiesList = signal<any[]>([]);
  userReviewsList = signal<any[]>([]);
  totalLibraryValue = signal<number>(0);
  friendActivities = signal<any[]>([]);

  // Edit Profile signals
  isEditModalOpen = signal(false);
  userGames = signal<any[]>([]);
  userCommunities = signal<any[]>([]);
  editForm = signal({
    username: '',
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
    selected_badge_id: null,
    display_comments_type: 'community',
    profile_theme_color: '#00f2ff',
    profile_bg_color: '#00f2ff',
    profile_name_color: '#ffffff',
    profile_music_url: ''
  });
  
  currentTime = signal(Date.now());
  private refreshInterval: any;
  private statusInterval: any;

  commentInput = signal('');
  commentsOffset = signal(0);
  hasMoreComments = signal(true);

  isOwnProfile = computed(() => {
    const current = this.authService.currentUser();
    const viewed = this.viewedUser();
    return current && viewed && current.id == viewed.id;
  });

  statusLabel = computed(() => {
    const user = this.viewedUser();
    const estado = user?.estado;
    
    if (estado === 'en-linea') return 'En línea';
    if (estado === 'ausente') return 'Ausente';
    
    // Tanto invisible como desconectado muestran "Desconectado"
    // Pero desconectado muestra el tiempo transcurrido
    if (estado === 'desconectado' && user?.last_activity) {
      // Usamos currentTime() para que el computed se reevalúe periódicamente
      this.currentTime(); 
      const timeStr = this.formatRelativeTime(new Date(user.last_activity));
      return `Desconectado hace ${timeStr}`;
    }
    
    return 'Desconectado';
  });

  formatRelativeTime(lastSeen: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    if (diffMs < 0) return 'poco tiempo';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) {
      const mins = diffMins % 60;
      return mins > 0 ? `${diffHours}h ${mins}m` : `${diffHours}h`;
    }
    return `${Math.max(1, diffMins)}min`;
  }

  statusClass = computed(() => {
    const estado = this.viewedUser()?.estado || 'desconectado';
    return `status-${estado}`;
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
    
    // Iniciar timer para actualizar el contador de "hace X min" cada minuto
    this.refreshInterval = setInterval(() => {
      this.currentTime.set(Date.now());
    }, 60000);

    // Reaccionamos a cambios en la ruta (username)
    this.route.params.subscribe(params => {
      let username = params['username'];
      if (username === 'me') {
        const current = this.authService.currentUser();
        if (current) {
          username = current.username;
        } else {
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
    });

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
          this.comments.set(res.initialComments || []);
          this.commentsOffset.set(res.initialComments?.length || 0);
          this.hasMoreComments.set((res.initialComments?.length || 0) === 5);
          
          this.startStatusPolling(username);
        }
      },
      error: (err) => console.error('Error loading profile:', err)
    });
  }

  startStatusPolling(username: string) {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.statusInterval = setInterval(() => {
      // Usar getLightweightUpdate si es el propio perfil, o mantener getUserStatus si es otro pero con intervalo mayor
      const isOwn = this.isOwnProfile();
      if (isOwn) {
        this.authService.getLightweightUpdate().subscribe({
          next: (update) => {
            const current = this.viewedUser();
            if (update && current) {
              this.viewedUser.set({
                ...current,
                estado: update.estado,
                last_activity: update.last_activity
              });
            }
          }
        });
      } else {
        this.authService.getUserStatus(username).subscribe({
          next: (status: any) => {
            const current = this.viewedUser();
            if (status && status.username === username) {
              this.viewedUser.set({
                ...current,
                estado: status.estado,
                last_activity: status.last_activity
              });
            }
          }
        });
      }
    }, 60000); // Aumentado a 60s
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

  goToChat() {
    const user = this.viewedUser();
    if (user) {
      this.router.navigate(['/mensajes'], { queryParams: { userId: user.id } });
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.statusInterval) clearInterval(this.statusInterval);
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
        this.totalLibraryValue.set(res.totalLibraryValue || 0);
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

    // Comentarios basados en preferencia
    if (user.display_comments_type === 'profile') {
      this.authService.getProfileComments(user.id).subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.commentsOffset.set(comments.length);
          this.hasMoreComments.set(comments.length === 5);
          this.profileData.update(data => ({
            ...data,
            stats: { ...data.stats, comments: comments.length }
          }));
        }
      });
    } else {
      this.authService.getUserComments(user.id).subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.commentsOffset.set(comments.length);
          this.hasMoreComments.set(comments.length === 5);
          this.profileData.update(data => ({
            ...data,
            stats: { ...data.stats, comments: comments.length }
          }));
        }
      });
    }

    this.gameService.getUserReviews(user.id).subscribe({
      next: (reviews) => {
        this.userReviewsList.set(reviews);
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, reviews: reviews.length }
        }));
      }
    });

    this.loadFriendActivities(user.id);
  }

  loadFriendActivities(userId: number) {
    this.socialService.getFriendActivities(userId).subscribe({
      next: (activities) => {
        this.friendActivities.set(activities);
      },
      error: (err) => console.error('Error loading friend activities:', err)
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
      title: `<span style="color: #00f2ff; letter-spacing: 1px;">${badge.name}</span>`,
      html: `
        <div style="text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; background-image: url('${badge.icon}'); background-size: 160%; background-position: center; background-repeat: no-repeat; margin-bottom: 20px; filter: drop-shadow(0 0 25px rgba(0,242,255,0.4)); clip-path: circle(35%);"></div>
          <p style="color: #cbd5e0; font-size: 1.1rem; line-height: 1.6; font-weight: 500;">${badge.description}</p>
        </div>
      `,
      background: '#0d1b2a',
      color: '#ffffff',
      showConfirmButton: true,
      confirmButtonText: 'Genial',
      confirmButtonColor: '#00f2ff',
      showCloseButton: true
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
        <div class="swal-group-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(72, 187, 120, 0.05); border-radius: 10px; border: 1px solid rgba(72, 187, 120, 0.2); width: 100%; box-sizing: border-box;">
          <img src="${banner}" style="width: 80px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid #48bb78; flex-shrink: 0;">
          <div style="flex-grow: 1; min-width: 0;">
            <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g.name}</div>
            <div style="font-size: 0.85rem; color: #a0aec0; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${g.description || 'Sin descripción'}</div>
          </div>
          <button onclick="window.location.href='/informacion-communities/${g.id}'" 
                  style="background: linear-gradient(135deg, #48bb78, #38a169); color: #000; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; border: none; font-weight: 700; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); flex-shrink: 0; white-space: nowrap;">
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

  postComment() {
    const content = this.commentInput().trim();
    if (!content) return;

    const current = this.authService.currentUser();
    const viewed = this.viewedUser();
    
    if (!current || !viewed) return;

    this.authService.addProfileComment(viewed.id, current.id, content).subscribe({
      next: (newComment: any) => {
        if (viewed.display_comments_type === 'profile') {
          this.comments.update(all => [newComment, ...all]);
        }
        this.commentInput.set('');
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Comentario publicado',
          showConfirmButton: false,
          timer: 2000,
          background: '#0d1b2a',
          color: '#fff'
        });
      },
      error: (err: any) => console.error('Error posting comment:', err)
    });
  }

  deleteComment(commentId: number) {
    const current = this.authService.currentUser();
    if (!current) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      background: '#0d1b2a',
      color: '#fff'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.authService.deleteProfileComment(commentId, current.id).subscribe({
          next: () => {
            this.comments.update(all => all.filter(c => c.id !== commentId));
            Swal.fire({
              title: '¡Borrado!',
              text: 'El comentario ha sido eliminado.',
              icon: 'success',
              background: '#0d1b2a',
              color: '#fff'
            });
          },
          error: (err: any) => {
            console.error('Error deleting comment:', err);
            Swal.fire('Error', 'No tienes permiso o el comentario no existe', 'error');
          }
        });
      }
    });
  }

  loadMoreComments() {
    const user = this.viewedUser();
    if (!user) return;

    const offset = this.commentsOffset();
    const limit = 5;

    if (user.display_comments_type === 'profile') {
      this.authService.getProfileComments(user.id, limit, offset).subscribe({
        next: (more: any[]) => {
          if (more.length > 0) {
            this.comments.update(all => [...all, ...more]);
            this.commentsOffset.update(v => v + more.length);
          }
          this.hasMoreComments.set(more.length === limit);
        }
      });
    } else {
      this.authService.getUserComments(user.id, limit, offset).subscribe({
        next: (more: any[]) => {
          if (more.length > 0) {
            this.comments.update(all => [...all, ...more]);
            this.commentsOffset.update(v => v + more.length);
          }
          this.hasMoreComments.set(more.length === limit);
        }
      });
    }
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

  onMusicSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Archivo muy grande',
        text: 'Por restricciones del servidor (Vercel), la canción no puede superar los 3MB.',
        background: '#0d1b2a',
        color: '#ffffff',
        confirmButtonColor: '#00f2ff'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Music = reader.result as string;
      
      Swal.fire({
        title: 'Subiendo música...',
        text: 'Esto puede tardar unos segundos dependiendo del tamaño.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      this.authService.updateProfileMusic(base64Music).subscribe({
        next: (res) => {
          Swal.close();
          console.log('Música actualizada');
          
          if (this.isOwnProfile() && res.user) {
            this.viewedUser.set({ ...this.viewedUser(), ...res.user });
          }
          this.editForm.update(form => ({ ...form, profile_music_url: base64Music }));
          
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '¡Música actualizada!',
            showConfirmButton: false,
            timer: 3000,
            background: '#0d1b2a',
            color: '#fff'
          });
        },
        error: (err) => {
          Swal.close();
          console.error('Error subiendo música:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error al subir',
            text: 'No se pudo guardar la canción. Es posible que el archivo sea demasiado grande para el servidor.',
            background: '#0d1b2a',
            color: '#ffffff',
            confirmButtonColor: '#00f2ff'
          });
        }
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
        username: user.username || '',
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
        selected_badge_id: user.selected_badge_id || null,
        display_comments_type: user.display_comments_type || 'community',
        profile_theme_color: user.profile_theme_color || '#00f2ff',
        profile_bg_color: user.profile_bg_color || '#00f2ff',
        profile_name_color: user.profile_name_color || '#ffffff',
        profile_music_url: user.profile_music_url || ''
      });

      this.authService.getUserGames().subscribe({
        next: (res: any) => {
          this.userGames.set(res.games || []);
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
          const oldUsername = this.viewedUser()?.username;
          this.viewedUser.set(res.user);
          this.comments.set(res.initialComments || []);
          this.commentsOffset.set(res.initialComments?.length || 0);
          this.hasMoreComments.set((res.initialComments?.length || 0) === 5);

          // Si el username cambió, redirigir a la nueva URL
          if (oldUsername && res.user.username !== oldUsername) {
            this.router.navigate(['/perfil', res.user.username]);
          }
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

  openAwardsModal() {
    // Intentar obtener ID por varias vías para asegurar que no sea undefined
    const currentUser = this.authService.currentUser();
    const viewedUser = this.viewedUser();
    const userId = currentUser?.id || viewedUser?.id;
    
    if (!userId) {
      console.warn('No se pudo encontrar ID de usuario para abrir galería');
      return;
    }

    // Mostrar un pequeño indicador de carga para que el usuario sepa que está pasando algo
    Swal.fire({
      title: 'Abriendo Colección...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      background: '#0d1b2a',
      color: '#fff'
    });

    this.socialService.getAwards(userId).subscribe({
      next: (awards) => {
        this.allAwardsList.set(awards);
        this.socialService.getPets(userId).subscribe({
          next: (pets) => {
            this.allPetsList.set(pets);
            // Cerramos el loading y abrimos la modal real
            Swal.close();
            setTimeout(() => {
              this.showCollectionModal('premios');
            }, 100);
          },
          error: (err) => {
            console.error('Error cargando mascotas:', err);
            Swal.close();
            this.showCollectionModal('premios');
          }
        });
      },
      error: (err) => {
        console.error('Error cargando premios:', err);
        Swal.close();
        Swal.fire('Error', 'No se pudo cargar tu colección', 'error');
      }
    });
  }

  showCollectionModal(tab: 'premios' | 'mascotas') {
    const userId = this.authService.currentUser()?.id;
    const ownedAwards = this.allAwardsList().filter(award => award.owned);
    const pets = this.allPetsList();

    const tabsHtml = `
      <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
        <button onclick="window.switchCollectionTab('premios')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: ${tab === 'premios' ? 'rgba(0,242,255,0.2)' : 'transparent'}; color: ${tab === 'premios' ? '#00f2ff' : '#a0aec0'}; cursor: pointer; font-weight: 700;">PREMIOS (${ownedAwards.length})</button>
        <button onclick="window.switchCollectionTab('mascotas')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: ${tab === 'mascotas' ? 'rgba(0,242,255,0.2)' : 'transparent'}; color: ${tab === 'mascotas' ? '#00f2ff' : '#a0aec0'}; cursor: pointer; font-weight: 700;">MASCOTAS (${pets.filter(p => p.unlocked).length})</button>
      </div>
    `;

    let contentHtml = '';
    if (tab === 'premios') {
      if (ownedAwards.length === 0) {
        contentHtml = `<p style="text-align: center; color: #a0aec0; padding: 20px;">Aún no has desbloqueado ningún premio 3D.</p>`;
      } else {
        contentHtml = `
          <div class="awards-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; max-height: 400px; overflow-y: auto; padding: 10px;">
            ${ownedAwards.map(award => `
              <div class="award-gallery-item owned" style="text-align: center; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(0,242,255,0.4); position: relative; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; margin-bottom: 10px; cursor: pointer; filter: drop-shadow(0 0 10px rgba(0,242,255,0.3)); clip-path: circle(35%); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2);">
                    <img src="${award.icon_url}" 
                         onclick="window.showDetail(${award.id})"
                         style="width: 150%; height: 150%; object-fit: contain;" 
                         title="Ver detalles">
                </div>
                <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 5px;">${award.name}</div>
                <button onclick="window.togglePin(${award.id})" style="width: 100%; padding: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${award.is_pinned ? '#f56565' : '#48bb78'}; color: white; border: none; border-radius: 6px;">
                  ${award.is_pinned ? 'Desanclar' : 'Anclar'}
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }
    } else {
      contentHtml = `
        <div class="pets-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; max-height: 400px; overflow-y: auto; padding: 10px;">
          ${pets.map(pet => `
            <div class="pet-gallery-item ${pet.unlocked ? 'owned' : 'locked'}" style="text-align: center; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid ${pet.is_active ? 'rgba(0,242,255,0.6)' : 'rgba(255,255,255,0.1)'}; opacity: ${pet.unlocked ? '1' : '0.4'}; position: relative;">
              <img src="${pet.icon_url}" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: 10px; filter: ${pet.unlocked ? 'drop-shadow(0 0 10px rgba(0,242,255,0.3))' : 'grayscale(100%)'};">
              <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 5px;">${pet.name}</div>
              ${pet.unlocked ? `
                <button onclick="window.togglePet(${pet.id}, ${pet.is_active})" style="width: 100%; padding: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${pet.is_active ? '#f56565' : '#48bb78'}; color: white; border: none; border-radius: 6px;">
                  ${pet.is_active ? 'Desactivar' : 'Equipar'}
                </button>
              ` : `<div style="font-size: 0.65rem; color: #f56565; margin-top: 5px;">BLOQUEADO</div>`}
            </div>
          `).join('')}
        </div>
      `;
    }

    (window as any).switchCollectionTab = (newTab: 'premios' | 'mascotas') => {
      this.showCollectionModal(newTab);
    };

    (window as any).showDetail = (awardId: number) => {
      const award = this.allAwardsList().find(a => a.id === awardId);
      if (award) this.showAwardDetail(award);
    };

    (window as any).togglePin = (awardId: number) => {
      this.socialService.togglePinAward(userId!, awardId).subscribe({
        next: () => {
          Swal.close();
          this.refreshProfileData();
        }
      });
    };

    (window as any).togglePet = (petId: number, currentActive: boolean) => {
      this.socialService.setActivePet(userId!, petId, !currentActive).subscribe({
        next: () => {
          Swal.close();
          this.refreshProfileData();
        }
      });
    };

    Swal.fire({
      title: 'Tu Colección',
      html: `
        <div class="collection-modal">
          ${tabsHtml}
          ${contentHtml}
        </div>
      `,
      width: '600px',
      showConfirmButton: false,
      showCloseButton: true,
      background: '#0d1b2a',
      color: '#fff'
    });
  }

  refreshProfileData() {
    const currentId = this.viewedUser()?.id;
    if (currentId) {
      this.authService.getUserById(currentId.toString()).subscribe({
        next: (userData) => {
          if (this.isOwnProfile()) {
            this.authService.currentUser.set(userData);
          }
          this.viewedUser.set(userData);
        }
      });
    }
  }

  showAwardDetail(award: any) {
    const isWitch = award.icon_url.includes('witch');
    const zoom = isWitch ? '100%' : '160%';
    const crop = isWitch ? '50%' : '35%';

    Swal.fire({
      title: `<span style="color: #00f2ff; letter-spacing: 1px;">${award.name}</span>`,
      html: `
        <div style="text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; background-image: url('${award.icon_url}'); background-size: ${zoom}; background-position: center; background-repeat: no-repeat; margin-bottom: 20px; filter: drop-shadow(0 0 25px rgba(0,242,255,0.4)); clip-path: circle(${crop});"></div>
          <p style="color: #cbd5e0; font-size: 1rem; margin-bottom: 15px; line-height: 1.5;">${award.description}</p>
          <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.9rem; font-weight: 800; background: rgba(0,242,255,0.1); color: #00f2ff; border: 1px solid rgba(0,242,255,0.3); text-transform: uppercase;">
            ${award.rarity}
          </div>
        </div>
      `,
      background: '#0d1b2a',
      color: '#fff',
      showConfirmButton: false,
      showCloseButton: true,
      width: '450px'
    });
  }
}
