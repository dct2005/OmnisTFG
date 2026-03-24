import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-compras',
  imports: [],
  templateUrl: './compras.html',
  styleUrl: './compras.css',
})
export class Compras {
  constructor(private router: Router) {}

  comprar(peppix: string, precio: string) {
    this.router.navigate(['/pagos'], { queryParams: { peppix, precio } });
  }
}
