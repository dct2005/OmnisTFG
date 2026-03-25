import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth';
import { GameService, Game } from '../services/game.service';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  authService = inject(AuthService);
  gameService = inject(GameService);
  communityService = inject(CommunityService);
  private route = inject(ActivatedRoute);

  // Profile data signal
  profileData = signal({
    // ... existings fields ...
    level: 21,
    currentBadge: {
      name: 'Novato de Élite',
      exp: 1000,
      icon: 'images/ins_nonecesito.webp'
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

  constructor() {
    this.loadInitialData();
    // Reaccionamos cuando el usuario esté disponible para personalizar
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadUserData(user);
      }
    });
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
    this.authService.getUserGames().subscribe({
      next: (res: any) => {
        const games = res.games || [];
        const gameIds = games.map((g: any) => g.game_api_id);
        
        if (gameIds.length > 0) {
          this.updateRecentActivity(gameIds[0]);
        }
        // Actualizamos los stats de juegos
        this.profileData.update(data => ({
          ...data,
          stats: { ...data.stats, games: gameIds.length }
        }));
      }
    });

    // Sincronizamos insignias si vienen del usuario (ya vienen del AuthService en el effect)
    if (user.current_badge) {
      this.profileData.update(data => ({
        ...data,
        currentBadge: {
          name: user.current_badge.name,
          exp: user.current_badge.tier * 1000, // Simulación de exp base
          icon: user.current_badge.icon
        }
      }));
    }

    this.communityService.getCommunities(user.id, true).subscribe({
      next: (myComms: any[]) => {
        if (myComms && myComms.length > 0) {
          this.setFavoriteGroup(myComms[0], myComms.length);
        }
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

  get user() {
    return this.authService.currentUser();
  }

  get userStatus() {
    return this.user?.estado || 'desconectado';
  }
}
