import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../services/community.service';
import { RouterModule } from '@angular/router';

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
  availableCategories: string[] = [];
  selectedCategories = signal<string[]>([]);

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
    this.communityService.getCommunities().subscribe({
      next: (data) => {
        this.communities.set(data);

        const categoriasUnicas = new Set(
          data.map((c: any) => c.categoria).filter((c: any) => c !== null && c !== undefined)
        );

        this.availableCategories = Array.from(categoriasUnicas).sort();
      },
      error: (err) => console.error(err)
    });
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