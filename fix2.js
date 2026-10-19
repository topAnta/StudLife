const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.backup2', html);

function replaceBetween(startMarker, endMarker, newCode, label) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker);
  if (s === -1 || e === -1 || e < s) {
    console.log('❌ ' + label + ' : repères introuvables, non modifié.');
    return;
  }
  html = html.slice(0, s) + newCode + '\n\n  ' + html.slice(e);
  console.log('✅ ' + label);
}

const authCode = String.raw`async function loadProfile(user) {
    const res = await sb.from('profiles')
      .select('full_name, school, program, city, language')
      .eq('id', user.id).maybeSingle();
    const p = res.data || {};
    const meta = user.user_metadata || {};
    profileData.name = p.full_name || meta.full_name || user.email;
    profileData.school = p.school || meta.school || '—';
    profileData.program = p.program || meta.program || '—';
    profileData.city = p.city || '—';
    profileData.language = p.language || meta.language || 'fr';
    renderProfileDisplay();
    renderDashboard();
    if (profileData.language !== currentLang) toggleLanguage();
  }

  async function validateForgotPassword() {
    const email = document.getElementById('forgotEmailInput').value.trim();
    const errorBox = document.getElementById('forgotError');
    if (email === '') {
      errorBox.innerHTML = '<b>' + t('error_intro') + '</b><ul><li>' + t('err_email') + '</li></ul>';
      errorBox.style.display = 'block';
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      errorBox.innerHTML = '<b>' + t('error_intro') + '</b><ul><li>' + t('err_email_format') + '</li></ul>';
      errorBox.style.display = 'block';
      return;
    }
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        return;
      }
      errorBox.style.display = 'none';
      document.getElementById('forgotFields').style.display = 'none';
      document.getElementById('forgotSuccess').style.display = 'block';
    } catch (err) {
      console.error(err);
      errorBox.textContent = currentLang === 'fr' ? 'Erreur réseau, réessaie.' : 'Network error, try again.';
      errorBox.style.display = 'block';
    }
  }

  async function validateLogin() {
    const email = document.getElementById('loginEmailInput').value.trim();
    const password = document.getElementById('loginPasswordInput').value;
    const errorBox = document.getElementById('loginError');

    const errors = [];
    if (email === '') errors.push(t('err_email'));
    else if (!email.includes('@') || !email.includes('.')) errors.push(t('err_email_format'));
    if (password === '') errors.push(t('err_password'));

    if (errors.length > 0) {
      errorBox.innerHTML = '<b>' + t('error_intro') + '</b><ul>' +
        errors.map(e => '<li>' + e + '</li>').join('') + '</ul>';
      errorBox.style.display = 'block';
      return;
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        errorBox.textContent = currentLang === 'fr'
          ? 'Courriel ou mot de passe incorrect.'
          : 'Incorrect email or password.';
        errorBox.style.display = 'block';
        return;
      }
      errorBox.style.display = 'none';
      await loadProfile(data.user);
      document.getElementById('loginPasswordInput').value = '';
      showPage('accueil');
    } catch (err) {
      console.error(err);
      errorBox.textContent = currentLang === 'fr' ? 'Erreur réseau, réessaie.' : 'Network error, try again.';
      errorBox.style.display = 'block';
    }
  }`;

replaceBetween('function validateForgotPassword', '/* ===== INSCRIPTION ===== */', authCode, 'connexion + mot de passe oublié + chargement du profil');

const logoutCode = String.raw`async function confirmLogout() {
    await sb.auth.signOut();
    hideAllProfileViews();
    document.getElementById('profileDisplayView').style.display = 'block';
    pageHistory = [];
    showPage('auth');
    switchAuthTab('login');
  }`;

replaceBetween('function confirmLogout', '/* ===== COURS ET HORAIRE ===== */', logoutCode, 'déconnexion réelle');

// Restaurer la session au chargement de la page
if (!html.includes('sb.auth.getSession')) {
  const line = 'const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);';
  if (html.includes(line)) {
    html = html.replace(line, line + String.raw`

    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await loadProfile(data.session.user);
        showPage('accueil');
      }
    });`);
    console.log('✅ session gardée après rechargement');
  } else {
    console.log('⚠️ ligne "const sb = ..." introuvable.');
  }
}

// Textes qui disaient encore "simulation"
const textFixes = [
  ["Lien envoyé (simulation)", "Lien envoyé"],
  ["Link sent (simulation)", "Link sent"],
  ["Si un compte existait avec cette adresse, un lien de réinitialisation lui serait envoyé. Aucun email n'a réellement été envoyé.", "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé."],
  ["If an account existed with this address, a reset link would be sent to it. No email was actually sent.", "If an account exists with this address, a reset link has just been sent."],
  ["Entre ton adresse courriel, on te dirait comment réinitialiser ton mot de passe (simulation).", "Entre ton adresse courriel, on t'enverra un lien pour réinitialiser ton mot de passe."],
  ["Enter your email, we would tell you how to reset your password (simulation).", "Enter your email, we will send you a link to reset your password."]
];
textFixes.forEach(([a, b]) => { html = html.split(a).join(b); });
console.log('✅ textes "simulation" mis à jour');

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup2');