import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent {
  scrolled = signal(false);
  menuOpen = signal(false);

  links = [
    { label: 'O Pulsar',      anchor: '/#sobre'        },
    { label: 'Como funciona', anchor: '/#como-funciona'},
    { label: 'Recursos',      anchor: '/#recursos'     },
    { label: 'Para você',     anchor: '/#publico'      },
    { label: 'Planos',        anchor: '/#planos'       },
  ];

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 12);
  }

  toggleMenu() { this.menuOpen.update(v => !v); }
  closeMenu()  { this.menuOpen.set(false); }
}
