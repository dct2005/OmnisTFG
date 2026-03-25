import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommunityService } from '../services/community.service';
declare var Swal: any;

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
      Swal.fire({
        title: 'Atención',
        text: 'Por favor, rellena los campos obligatorios.',
        icon: 'warning',
        background: '#1a103c',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed'
      });
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
        Swal.fire({
          title: '¡Éxito!',
          text: '¡Comunidad creada con éxito!',
          icon: 'success',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        }).then(() => {
          this.router.navigate(['/']);
        });
      },
      error: (err) => {
        console.error('Error creando comunidad:', err);
        Swal.fire({
          title: 'Error',
          text: 'Hubo un error al crear la comunidad.',
          icon: 'error',
          background: '#1a103c',
          color: '#ffffff',
          confirmButtonColor: '#7c3aed'
        });
      }
    });
  }
}