import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../services/community.service';
import { RouterModule } from '@angular/router';
declare var Swal: any;

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './communities.html',
  styleUrl: './communities.css'
})
export class CommunitiesComponent implements OnInit {
  private communityService = inject(CommunityService);


  communities = signal<any[]>([]);
  searchTerm = signal<string>('');
  selectedCategories = signal<string[]>([]);
  activeTab = signal<'all' | 'mine'>('all');
  isLoggedIn = signal<boolean>(false);


  availableCategories: string[] = [
    'Arte y Diseño',
    'Deportes',
    'Entretenimiento',
    'Gaming',
    'General',
    'Música',
    'Tecnología'
  ];


  filteredCommunities = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const selected = this.selectedCategories();
    const all = this.communities();

    return all.filter(community => {
      const matchesSearch = community.name.toLowerCase().includes(term);
      const matchesCategory = selected.length === 0 || selected.includes(community.categoria);

      return matchesSearch && matchesCategory;
    });
  });

  ngOnInit() {
    this.isLoggedIn.set(!!this.getUserIdFromToken());
    this.loadCommunities();
  }



  getUserIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload.userId || null;
    } catch (e) {
      return null;
    }
  }


  loadCommunities() {
    const userId = this.getUserIdFromToken();
    const isMine = this.activeTab() === 'mine';


    if (isMine && !userId) {
      Swal.fire({
        title: 'Error',
        text: 'Debes iniciar sesión para ver tus comunidades',
        icon: 'error',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
      this.activeTab.set('all');
      return;
    }


    this.communityService.getCommunities(userId || undefined, isMine).subscribe({
      next: (data) => {

        this.communities.set(data);
      },
      error: (err) => {
        console.error('Error cargando las comunidades:', err);
      }
    });
  }


  setTab(tab: 'all' | 'mine') {
    this.activeTab.set(tab);
    this.loadCommunities();
  }



  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  toggleCategory(category: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;

    this.selectedCategories.update(current => {
      if (isChecked) {
        return [...current, category];
      } else {
        return current.filter(c => c !== category);
      }
    });
  }
}