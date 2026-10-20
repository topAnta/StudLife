const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');

if (!html.includes('async function loadPosts')) {
  console.log('❌ fix4.js doit être appliqué avant (loadPosts introuvable). Rien modifié.');
  process.exit(1);
}

fs.writeFileSync(file + '.backup5', html);

// 1) Icônes : nouveau lien pour la police Tabler
const oldIcons = 'https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.44.0/iconfont/tabler-icons.min.css';
const newIcons = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css';
if (html.includes(oldIcons)) {
  html = html.replace(oldIcons, newIcons);
  console.log('✅ lien des icônes remplacé');
} else if (html.includes(newIcons)) {
  console.log('✅ lien des icônes déjà corrigé');
} else {
  console.log('⚠️ lien des icônes introuvable : vérifie la ligne <link ... tabler-icons ...> dans le <head>.');
}

// 2) Rafraîchissement automatique de la Communauté
if (html.includes('startPostsAutoRefresh')) {
  console.log('✅ rafraîchissement automatique déjà présent');
} else {
  const marker = 'async function createPost(inputId, groupKey) {';
  if (!html.includes(marker)) {
    console.log('❌ repère de createPost introuvable. Rien modifié.');
    process.exit(1);
  }
  const autoRefresh = String.raw`function postsInputBusy() {
    const a = document.activeElement;
    const inPosts = function (el) { return el && el.closest && el.closest('#postsContainer, #groupPostsContainer'); };
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && inPosts(a)) return true;
    if (editingPostId !== null) return true;
    const typed = document.querySelectorAll('#postsContainer input, #groupPostsContainer input');
    for (let i = 0; i < typed.length; i++) {
      if (typed[i].value && typed[i].value.trim() !== '') return true;
    }
    return false;
  }

  function startPostsAutoRefresh() {
    setInterval(function () {
      if (!currentUserId || document.hidden) return;
      if (postsInputBusy()) return;
      loadPosts();
    }, 10000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && currentUserId && !postsInputBusy()) loadPosts();
    });
  }
  startPostsAutoRefresh();

  `;
  html = html.replace(marker, autoRefresh + marker);
  console.log('✅ rafraîchissement automatique toutes les 10 secondes');
}

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup5');