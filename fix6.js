const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');

if (!html.includes('async function loadPosts')) {
  console.log('❌ fix4.js doit être appliqué avant (loadPosts introuvable). Rien modifié.');
  process.exit(1);
}
if (html.includes('async function loadAppData')) {
  console.log('⚠️ fix6 est déjà appliqué. Rien modifié.');
  process.exit(0);
}

fs.writeFileSync(file + '.backup6', html);

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
  html = html.replace(search, function () { return replacement; });
  console.log('✅ ' + label);
}

// 1) On retire les logements et événements écrits en dur
replaceBetween('const listings = [', 'let currentListingIndex = 0;',
  'let listings = [];', 'logements retirés du code');
replaceBetween('const events = [', 'let currentEventIndex = 0;',
  'let events = [];', 'événements retirés du code');
replaceOnce('const rsvpStatus = [false, false, false];',
  'let rsvpStatus = [];', 'participations remises à zéro', true);

// 2) Chargement des données après la connexion
replaceOnce('currentUserId = user.id;',
  'currentUserId = user.id;\n    loadAppData();',
  'chargement des données après connexion', true);

// 3) Protections quand les listes sont encore vides
replaceOnce('function renderListingText(index) {',
  'function renderListingText(index) {\n    if (!listings[index]) return;',
  'protection renderListingText', true);
replaceOnce('function renderEventText(index) {',
  'function renderEventText(index) {\n    if (!events[index]) return;',
  'protection renderEventText', true);
replaceOnce('function updateRsvpDisplay() {',
  'function updateRsvpDisplay() {\n    if (!events[currentEventIndex]) return;',
  'protection updateRsvpDisplay', true);

// 4) Rafraîchir en ouvrant Logements ou Événements
replaceOnce("if (name === 'communaute' || name === 'group-detail') loadPosts();",
  "if (name === 'communaute' || name === 'group-detail') loadPosts();\n    if (name === 'evenements' || name === 'logements') loadAppData();",
  'rafraîchissement en ouvrant Logements / Événements', false);

// 5) Nouvelles fonctions liées à Supabase
const appDataCode = String.raw`/* ===== LOGEMENTS ET ÉVÉNEMENTS DEPUIS SUPABASE ===== */
  const MONTHS_APP = {
    fr: ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function fmtClock(d, lang) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    if (lang === 'fr') return h + 'h' + m;
    const h12 = h % 12 || 12;
    return h12 + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  async function loadAppData() {
    if (typeof sb === 'undefined' || !currentUserId) return;
    const results = await Promise.all([
      sb.from('listings').select('*').order('id', { ascending: true }),
      sb.from('events').select('*').order('starts_at', { ascending: true }),
      sb.from('listing_favorites').select('listing_id').eq('user_id', currentUserId),
      sb.from('event_favorites').select('event_id').eq('user_id', currentUserId),
      sb.from('event_attendees').select('event_id, user_id')
    ]);
    const lr = results[0], er = results[1], lf = results[2], ef = results[3], ea = results[4];
    if (lr.error || er.error) {
      console.error('Erreur chargement données :', lr.error || er.error);
      return;
    }

    listings = (lr.data || []).map(function (r) {
      const tags = (r.tags || []).slice(0, 2);
      while (tags.length < 2) tags.push({ fr: '', en: '' });
      return {
        id: r.id,
        title: r.title,
        price: { fr: r.price_value + ' $ / mois', en: r.price_value + ' $ / month' },
        priceValue: r.price_value,
        typeKey: r.type_key,
        neighborhoodKey: r.neighborhood_key,
        neighborhoodLabel: r.neighborhood_label,
        icon: r.icon || 'ti-home',
        tags: tags,
        addr: r.address || { fr: '', en: '' },
        size: r.size || '',
        rooms: r.rooms || { fr: '', en: '' },
        desc: r.description || { fr: '', en: '' },
        roommateName: r.roommate_name || { fr: '', en: '' },
        roommateInfo: r.roommate_info || { fr: '', en: '' }
      };
    });

    const attendeeRows = ea.data || [];
    const dateOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    events = (er.data || []).map(function (r) {
      const s = new Date(r.starts_at);
      const e = r.ends_at ? new Date(r.ends_at) : null;
      const loc = r.location || { fr: '', en: '' };
      const rows = attendeeRows.filter(function (a) { return a.event_id === r.id; });
      const mine = rows.some(function (a) { return a.user_id === currentUserId; });
      return {
        id: r.id,
        dayNum: s.getDate(),
        mon: { fr: MONTHS_APP.fr[s.getMonth()], en: MONTHS_APP.en[s.getMonth()] },
        listMeta: {
          fr: fmtClock(s, 'fr') + ' · ' + String(loc.fr || '').split(',')[0],
          en: fmtClock(s, 'en') + ' · ' + String(loc.en || '').split(',')[0]
        },
        category: r.category,
        categoryKey: r.category_key,
        title: r.title,
        date: {
          fr: capFirst(s.toLocaleDateString('fr-CA', dateOpts)),
          en: capFirst(s.toLocaleDateString('en-CA', dateOpts))
        },
        time: {
          fr: fmtClock(s, 'fr') + (e ? ' - ' + fmtClock(e, 'fr') : ''),
          en: fmtClock(s, 'en') + (e ? ' - ' + fmtClock(e, 'en') : '')
        },
        location: loc,
        desc: r.description || { fr: '', en: '' },
        attendees: rows.length - (mine ? 1 : 0)
      };
    });

    const favListingIds = (lf.data || []).map(function (x) { return x.listing_id; });
    const favEventIds = (ef.data || []).map(function (x) { return x.event_id; });
    favoriteListingIndices = [];
    listings.forEach(function (l, i) { if (favListingIds.indexOf(l.id) !== -1) favoriteListingIndices.push(i); });
    eventFavorites = [];
    events.forEach(function (ev, i) { if (favEventIds.indexOf(ev.id) !== -1) eventFavorites.push(i); });
    rsvpStatus = events.map(function (ev) {
      return attendeeRows.some(function (a) { return a.event_id === ev.id && a.user_id === currentUserId; });
    });

    populateNeighborhoodOptions();
    renderHousingList();
    renderFavoritesList();
    renderEventsList();
    renderFavoriteEventsList();
    renderDashboard();
    if (document.getElementById('page-evenement-detail').classList.contains('active')) updateRsvpDisplay();
  }

  async function persistToggle(table, col, id, nowOn) {
    if (typeof sb === 'undefined' || !currentUserId || id === undefined) return;
    let res;
    if (nowOn) {
      const row = {};
      row[col] = id;
      res = await sb.from(table).insert(row);
    } else {
      res = await sb.from(table).delete().eq(col, id).eq('user_id', currentUserId);
    }
    if (res.error) console.error('Erreur ' + table, res.error);
  }

  const _origToggleFavoriteListing = toggleFavoriteListing;
  toggleFavoriteListing = function (index, event) {
    const l = listings[index];
    if (!l) return;
    const wasFav = isListingFavorite(index);
    _origToggleFavoriteListing(index, event);
    persistToggle('listing_favorites', 'listing_id', l.id, !wasFav);
  };

  const _origToggleFavoriteEvent = toggleFavoriteEvent;
  toggleFavoriteEvent = function (index, event) {
    const ev = events[index];
    if (!ev) return;
    const wasFav = isEventFavorite(index);
    _origToggleFavoriteEvent(index, event);
    persistToggle('event_favorites', 'event_id', ev.id, !wasFav);
  };

  const _origToggleRsvp = toggleRsvp;
  toggleRsvp = function () {
    const idx = currentEventIndex;
    const ev = events[idx];
    if (!ev) return;
    const wasGoing = rsvpStatus[idx];
    _origToggleRsvp();
    persistToggle('event_attendees', 'event_id', ev.id, !wasGoing);
  };

  const _origShowEvent = showEvent;
  showEvent = function (i) { if (!events[i]) return; _origShowEvent(i); };

  const _origShowListing = showListing;
  showListing = function (i) { if (!listings[i]) return; _origShowListing(i); };

  const _origConfirmLogout = confirmLogout;
  confirmLogout = async function () {
    await _origConfirmLogout();
    listings = [];
    events = [];
    rsvpStatus = [];
    favoriteListingIndices = [];
    eventFavorites = [];
    populateNeighborhoodOptions();
    renderHousingList();
    renderFavoritesList();
    renderEventsList();
    renderFavoriteEventsList();
    renderDashboard();
  };`;

const initMarker = '/* ===== INITIALISATION AU CHARGEMENT DE LA PAGE ===== */';
if (!html.includes(initMarker)) {
  console.log("❌ repère d'initialisation introuvable. Rien modifié.");
  process.exit(1);
}
html = html.replace(initMarker, function () { return appDataCode + '\n\n  ' + initMarker; });
console.log('✅ fonctions Supabase ajoutées (logements, événements, favoris, participations)');

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup6');