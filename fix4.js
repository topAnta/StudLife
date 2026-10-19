const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');

if (!html.includes('async function loadProfile')) {
  console.log('❌ fix2.js doit être appliqué avant (loadProfile introuvable). Rien modifié.');
  process.exit(1);
}
if (html.includes('async function loadPosts')) {
  console.log('⚠️ fix4 est déjà appliqué. Rien modifié.');
  process.exit(0);
}

fs.writeFileSync(file + '.backup4', html);

function replaceBetween(startMarker, endMarker, newCode, label) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker);
  if (s === -1 || e === -1 || e < s) {
    console.log('❌ ' + label + ' : repères introuvables. Rien modifié.');
    process.exit(1);
  }
  html = html.slice(0, s) + newCode + '\n\n  ' + html.slice(e);
  console.log('✅ ' + label);
}

function replaceOnce(search, replacement, label, critical) {
  if (!html.includes(search)) {
    console.log((critical ? '❌ ' : '⚠️ ') + label + ' : repère introuvable.');
    if (critical) process.exit(1);
    return;
  }
  html = html.replace(search, replacement);
  console.log('✅ ' + label);
}

// 1) On enlève les publications de démonstration
replaceBetween('let posts = [', 'let nextPostId = 3;',
  'let posts = [];\n  let currentUserId = null;',
  'publications de démonstration retirées');

// 2) Nouvelles fonctions liées à Supabase
const postsCode = String.raw`function timeAgo(dateStr, lang) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
    const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (s < 60) return lang === 'fr' ? "À l'instant" : 'Just now';
    if (m < 60) return lang === 'fr' ? 'il y a ' + m + ' min' : m + ' min ago';
    if (h < 24) return lang === 'fr' ? 'il y a ' + h + ' h' : h + 'h ago';
    return lang === 'fr' ? 'il y a ' + d + ' j' : d + 'd ago';
  }

  async function loadPosts() {
    if (typeof sb === 'undefined' || !currentUserId) return;
    const results = await Promise.all([
      sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
      sb.from('comments').select('*').order('created_at', { ascending: true }),
      sb.from('post_likes').select('post_id, user_id')
    ]);
    const pr = results[0], cr = results[1], lr = results[2];
    if (pr.error) { console.error('Erreur publications :', pr.error); return; }
    const comments = cr.data || [];
    const likes = lr.data || [];
    const palette = [['bg-blue', 'text-blue'], ['bg-green', 'text-green'], ['bg-orange', 'text-orange'], ['bg-red', 'text-red']];

    posts = (pr.data || []).map(function (row) {
      const g = groups.find(function (x) { return x.key === row.group_key; });
      let sum = 0;
      for (let i = 0; i < row.user_id.length; i++) sum += row.user_id.charCodeAt(i);
      const col = palette[sum % 4];
      const postLikes = likes.filter(function (l) { return l.post_id === row.id; });
      return {
        id: row.id,
        name: row.author_name || 'Étudiant',
        avatarBg: col[0],
        avatarText: col[1],
        isMine: row.user_id === currentUserId,
        group: row.group_key,
        meta: {
          fr: (g ? g.name.fr + ' · ' : '') + timeAgo(row.created_at, 'fr'),
          en: (g ? g.name.en + ' · ' : '') + timeAgo(row.created_at, 'en')
        },
        content: row.content,
        likes: postLikes.length,
        likedByMe: postLikes.some(function (l) { return l.user_id === currentUserId; }),
        comments: comments
          .filter(function (c) { return c.post_id === row.id; })
          .map(function (c) { return { name: c.author_name || 'Étudiant', text: c.content }; })
      };
    });
    refreshPosts();
  }

  async function createPost(inputId, groupKey) {
    const input = document.getElementById(inputId);
    const text = input.value.trim();
    if (text === '' || !currentUserId) return;
    const res = await sb.from('posts').insert({ content: text, group_key: groupKey });
    if (res.error) {
      console.error('Erreur publication :', res.error);
      alert(currentLang === 'fr' ? 'Impossible de publier. Réessaie.' : 'Could not post. Try again.');
      return;
    }
    input.value = '';
    await loadPosts();
  }

  function publishGroupPost() { return createPost('groupNewPostInput', currentGroupKey); }
  function publishPost() { return createPost('newPostInput', null); }

  async function togglePostLike(id) {
    const post = posts.find(function (p) { return p.id === id; });
    if (!post || !currentUserId) return;
    const wasLiked = post.likedByMe;
    post.likedByMe = !wasLiked;
    post.likes += wasLiked ? -1 : 1;
    refreshPosts();
    let res;
    if (wasLiked) {
      res = await sb.from('post_likes').delete().eq('post_id', id).eq('user_id', currentUserId);
    } else {
      res = await sb.from('post_likes').insert({ post_id: id });
    }
    if (res.error) {
      console.error('Erreur j aime :', res.error);
      await loadPosts();
    }
  }

  function toggleCommentBox(id) {
    openCommentPostId = (openCommentPostId === id) ? null : id;
    refreshPosts();
  }

  async function addComment(id) {
    const input = document.getElementById('commentInput-' + id);
    const text = input.value.trim();
    if (text === '' || !currentUserId) return;
    const res = await sb.from('comments').insert({ post_id: id, content: text });
    if (res.error) {
      console.error('Erreur commentaire :', res.error);
      alert(currentLang === 'fr' ? 'Impossible de commenter. Réessaie.' : 'Could not comment. Try again.');
      return;
    }
    await loadPosts();
  }

  function togglePostMenu(id) {
    const post = posts.find(function (p) { return p.id === id; });
    if (!post || !post.isMine) return;
    openMenuPostId = (openMenuPostId === id) ? null : id;
    refreshPosts();
  }

  function startEditPost(id) {
    const post = posts.find(function (p) { return p.id === id; });
    if (!post || !post.isMine) return;
    editingPostId = id;
    openMenuPostId = null;
    refreshPosts();
  }

  function cancelEditPost() {
    editingPostId = null;
    refreshPosts();
  }

  async function saveEditedPost(id) {
    const post = posts.find(function (p) { return p.id === id; });
    if (!post || !post.isMine) return;
    const input = document.getElementById('editPostInput-' + id);
    const newText = input.value.trim();
    if (newText === '') return;
    const res = await sb.from('posts').update({ content: newText }).eq('id', id);
    if (res.error) {
      console.error('Erreur modification :', res.error);
      alert(currentLang === 'fr' ? 'Impossible de modifier. Réessaie.' : 'Could not edit. Try again.');
      return;
    }
    editingPostId = null;
    await loadPosts();
  }

  let pendingDeletePostId = null;

  function deletePost(id) {
    const post = posts.find(function (p) { return p.id === id; });
    if (!post || !post.isMine) return;
    pendingDeletePostId = id;
    openMenuPostId = null;
    refreshPosts();
    document.getElementById('deleteConfirmOverlay').style.display = 'flex';
  }

  async function confirmDeletePost() {
    const id = pendingDeletePostId;
    pendingDeletePostId = null;
    openMenuPostId = null;
    document.getElementById('deleteConfirmOverlay').style.display = 'none';
    if (id === null) return;
    const res = await sb.from('posts').delete().eq('id', id);
    if (res.error) console.error('Erreur suppression :', res.error);
    await loadPosts();
  }

  function cancelDeletePost() {
    pendingDeletePostId = null;
    document.getElementById('deleteConfirmOverlay').style.display = 'none';
  }`;

replaceBetween('function publishGroupPost', 'function joinGroup', postsCode,
  'publications, j\'aime et commentaires branchés sur Supabase');

// 3) Charger les publications après la connexion / session restaurée
replaceOnce('async function loadProfile(user) {',
  'async function loadProfile(user) {\n    currentUserId = user.id;\n    loadPosts();',
  'chargement des publications après connexion', true);

// 4) Recharger en ouvrant Communauté ou un groupe
replaceOnce("if (name === 'accueil') renderDashboard();",
  "if (name === 'accueil') renderDashboard();\n    if (name === 'communaute' || name === 'group-detail') loadPosts();",
  'rafraîchissement en ouvrant Communauté', true);

// 5) Vider les publications à la déconnexion
replaceOnce('await sb.auth.signOut();',
  'await sb.auth.signOut();\n    currentUserId = null;\n    posts = [];\n    refreshPosts();',
  'nettoyage à la déconnexion', false);

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup4');