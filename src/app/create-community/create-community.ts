import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-create-community',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-community.html',
  styleUrl: './create-community.css'
})
export class CreateCommunity {
  community = {
    name: '',
    description: '',
    categoria: ''
  };

  imagePreview: string | ArrayBuffer | null = null;

  private router = inject(Router);
  private communityService = inject(CommunityService);


  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => this.imagePreview = reader.result;
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    if (!this.community.name || !this.community.categoria) {
      alert('Por favor, rellena los campos obligatorios.');
      return;
    }


    const newCommunityData = {
      name: this.community.name,
      description: this.community.description,
      categoria: this.community.categoria,
      image_url: this.imagePreview
    };


    this.communityService.createCommunity(newCommunityData).subscribe({
      next: (response) => {
        alert('¡Comunidad creada con éxito!');
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Error creando comunidad:', err);
        alert('Hubo un error al crear la comunidad.');
      }
    });
  }
}