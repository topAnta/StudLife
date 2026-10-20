const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');

if (html.includes('AFFICHAGE ADAPTE')) {
  console.log('⚠️ fix7 est déjà appliqué. Rien modifié.');
  process.exit(0);
}

fs.writeFileSync(file + '.backup7', html);

// 1) Enlever le texte "Prototype interactif..."
const captionRegex = /\s*<p class="caption"[^>]*>[\s\S]*?<\/p>/;
if (captionRegex.test(html)) {
  html = html.replace(captionRegex, '');
  console.log('✅ texte "Prototype" retiré');
} else {
  console.log('⚠️ texte "Prototype" introuvable (déjà retiré ?)');
}

// 2) Viewport compatible avec les encoches de téléphone
const oldViewport = '<meta name="viewport" content="width=device-width, initial-scale=1">';
if (html.includes(oldViewport)) {
  html = html.replace(oldViewport, function () {
    return '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
  });
  console.log('✅ viewport mis à jour');
} else {
  console.log('⚠️ balise viewport introuvable (non critique)');
}

// 3) Icône du site + couleur de la barre du navigateur sur téléphone
const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<rect width='100' height='100' rx='24' fill='#FF7A5C'/>" +
  "<text x='50' y='70' font-size='58' text-anchor='middle'>🎓</text></svg>";
const headExtra =
  '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(svg) + '">\n' +
  '<meta name="theme-color" content="#FF7A5C">\n';
if (!html.includes('</head>')) {
  console.log('❌ </head> introuvable. Rien modifié.');
  process.exit(1);
}
html = html.replace('</head>', function () { return headExtra + '</head>'; });
console.log('✅ icône et couleur du navigateur ajoutées');

// 4) Affichage plein écran sur téléphone
const css = String.raw`
  /* ===== AFFICHAGE ADAPTE ===== */
  .caption { display: none; }
  .top-bar { margin-bottom: 12px; }
  @media (max-width: 480px) {
    body { display: block; padding: 0; background: #FFF6EE; }
    .top-bar {
      width: 100%; margin: 0; min-height: 44px;
      padding: env(safe-area-inset-top, 0px) 14px 0;
      justify-content: flex-end;
      background: linear-gradient(160deg, #FFF6EE 0%, #FFEDE0 100%);
    }
    .phone {
      width: 100%;
      height: calc(100vh - 44px - env(safe-area-inset-top, 0px));
      height: calc(100dvh - 44px - env(safe-area-inset-top, 0px));
      border-radius: 0; box-shadow: none;
    }
    .navbar { padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)); }
  }
`;
if (!html.includes('</style>')) {
  console.log('❌ </style> introuvable. Rien modifié.');
  process.exit(1);
}
html = html.replace('</style>', function () { return css + '</style>'; });
console.log('✅ affichage plein écran sur téléphone');

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup7');