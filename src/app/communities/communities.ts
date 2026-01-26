import { Component, OnInit, inject, signal } from '@angular/core';
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

  communities = signal<any[]>([]);
  isLoading = signal(true);

  private communityService = inject(CommunityService);

  ngOnInit() {
    this.communityService.getCommunities().subscribe({
      next: (data) => {
        console.log('Comunidades de la DB:', data);
        this.communities.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error:', err);
        this.isLoading.set(false);
      }
    });
  }
}