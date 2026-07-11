import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  updatedAt = '11 de julho de 2026';
  contactEmail = 'contato@pulsar.app';
  operator = 'AppsX';
  appName = 'Pulsar';
  packageName = 'br.com.appsx.pulsar';
}
