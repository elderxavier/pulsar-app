import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  highlights = [
    'Posts geolocalizados que vivem 6 horas',
    'Mapa de calor com o que está acontecendo agora',
    'Voz, texto e foto em até 280 caracteres',
    'Geofencing com palavras-chave que importam pra você',
  ];

  features = [
    { icon: 'radar',   title: 'Radar de mapa',         text: 'Veja em tempo real o que está pulsando perto de você. Quanto mais atividade, mais intenso o calor do bairro.' },
    { icon: 'mic',     title: 'Check-in por voz',      text: 'Widget na tela de bloqueio: segure para gravar até 15 segundos. Texto transcrito e postado com sua localização.' },
    { icon: 'pin',     title: 'Geofencing inteligente',text: 'Defina palavras-chave (“brechó”, “show”, “fila zerada”) e o app te avisa quando elas aparecem perto.' },
    { icon: 'shield',  title: 'Verificação social',    text: 'Posts ganham destaque quando outras pessoas no local confirmam que o evento é real. Menos boato, mais sinal.' },
    { icon: 'flash',   title: 'Flash Promo (PRO)',     text: 'Comerciantes mandam ofertas com raio e duração: a promoção alcança quem está perto, no momento certo.' },
    { icon: 'replay',  title: 'Análise de fluxo',      text: 'Replay temporal mostra horários de pico de movimento no seu bairro nos últimos 7 dias (dados anonimizados).' },
  ];

  steps = [
    { step: '01', title: 'Publique em segundos',  text: 'Texto, áudio ou foto com até 280 caracteres. Sua posição entra no mapa automaticamente.' },
    { step: '02', title: 'Quem está perto, vê',   text: 'Pessoas em até 2 km recebem o pulso. Mapa de calor mostra o que está vivo agora.' },
    { step: '03', title: 'Some em 6 horas',        text: 'Sem feed eterno, sem ruído antigo. O Pulsar mostra o agora — depois apaga.' },
  ];

  audiences = [
    { title: 'Para você',          text: 'Descobrir filas, shows, food trucks, brechós, animais perdidos e o que mais o bairro está vivendo agora.' },
    { title: 'Para comerciantes',  text: 'Painel Pulsar PRO com Flash Promos: alcance pessoas a 500 m em 30 min. Sem precisar lutar contra o algoritmo.' },
    { title: 'Para criadores',     text: 'Disparo de eventos com geofencing. Atinja quem realmente está na sua zona de atuação.' },
  ];

  plans = [
    {
      name: 'Explorador', price: 'Grátis', for: 'Quem quer ver e participar',
      features: ['Postar e ler eventos no mapa', 'Mapa de calor em tempo real', '3 alertas de geofence ativos', 'Comentários e confirmações'],
      cta: 'Baixar grátis', primary: false,
    },
    {
      name: 'Pulsar PRO', price: 'R$ 19,90 / mês', for: 'Comerciantes e criadores',
      features: ['Tudo do Explorador', 'Painel Web (Pulsar PRO)', '2 Flash Promos por dia', 'Destaque visual no mapa', 'Replay temporal de 7 dias'],
      cta: 'Quero o PRO', primary: true,
    },
  ];
}
