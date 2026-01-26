import { Component, OnInit, inject, signal, computed } from '@angular/core'; // <--- OJO: añadir 'computed'
import { CommonModule } from '@angular/common';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './communities.html',
  styleUrl: './communities.css'
})
export class CommunitiesComponent implements OnInit {
  private communityService = inject(CommunityService);

  // 1. La lista original (todos los datos de la base de datos)
  communities = signal<any[]>([]);

  // 2. El texto que escribe el usuario
  searchTerm = signal<string>('');

  // 3. La lista FILTRADA (esta es la magia, se calcula sola)
  filteredCommunities = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.communities();

    // Si no hay texto, devolvemos todo. Si hay texto, filtramos.
    if (!term) return all;
    return all.filter(c => c.name.toLowerCase().includes(term));
  });

  ngOnInit() {
    this.communityService.getCommunities().subscribe({
      next: (data) => {
        this.communities.set(data);
      },
      error: (err) => console.error('Error:', err)
    });
  }

  // Función que se ejecuta al escribir en el input
  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }
}