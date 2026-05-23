# Portfólio · Elder Sergio Xavier

Site portfólio estático em tema escuro, construído com HTML, CSS e JavaScript puros — sem dependências de build.

## Estrutura

```
portfolio/
├── index.html   # Marcação semântica com todas as seções
├── styles.css   # Tema escuro (violeta + ciano) e layout responsivo
└── script.js    # Menu mobile, ano dinâmico e animações de scroll
```

## Como visualizar

Abra `index.html` diretamente no navegador, ou sirva localmente:

```bash
# Com Python
cd portfolio
python3 -m http.server 8080
# Abra http://localhost:8080

# Ou com Node.js (npx)
npx --yes serve portfolio
```

## Seções

1. **Hero** — apresentação, chamadas para ação e métricas de carreira
2. **Sobre** — bio resumida + cartão com dados-chave
3. **Experiência** — timeline cronológica com todas as posições do currículo
4. **Habilidades** — agrupadas por categoria (back, front, mobile, DBs, cloud, e-commerce)
5. **Contato** — botões para LinkedIn, GitHub e e-mail

## Personalização

- **Cores**: edite as variáveis CSS em `:root` no início de `styles.css`.
- **Links de contato**: ajuste os `href` na seção `#contato` em `index.html`.
- **Foto/avatar**: caso queira adicionar, coloque o arquivo em `portfolio/assets/` e inclua um `<img>` no `.hero__inner`.

## Deploy

Por ser 100% estático, pode ser hospedado em:
- GitHub Pages (subir a pasta `portfolio/`)
- Firebase Hosting
- Netlify / Vercel (drag-and-drop)
- Qualquer servidor web simples
