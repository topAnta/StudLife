const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.backup', html);

const newValidateSignup = String.raw`async function validateSignup() {
    const fullName = document.getElementById('fullNameInput').value.trim();
    const email    = document.getElementById('emailInput').value.trim();
    const school   = document.getElementById('schoolInput').value.trim();
    const program  = document.getElementById('programInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorBox = document.getElementById('signupError');

    const errors = [];
    if (!fullName) errors.push(t('err_fullname'));
    if (!email) errors.push(t('err_email'));
    else if (!email.includes('@') || !email.includes('.')) errors.push(t('err_email_format'));
    if (!school) errors.push(t('err_school'));
    if (!program) errors.push(t('err_program'));
    if (!password) errors.push(t('err_password'));
    else if (password.length < 6) errors.push(t('err_password_short'));

    if (errors.length > 0) {
      errorBox.innerHTML = '<b>' + t('error_intro') + '</b><ul>' +
        errors.map(e => '<li>' + e + '</li>').join('') + '</ul>';
      errorBox.style.display = 'block';
      return;
    }
    errorBox.style.display = 'none';

    try {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, school, program, language: selectedPrefLang } }
      });
      if (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        return;
      }
      profileData.name = fullName;
      profileData.school = school;
      profileData.program = program;
      profileData.language = selectedPrefLang;
      renderProfileDisplay();

      document.getElementById('signupFields').style.display = 'none';
      document.getElementById('signupSuccess').style.display = 'block';
    } catch (err) {
      console.error("Erreur lors de l'inscription :", err);
      errorBox.textContent = "Erreur réseau, réessaie.";
      errorBox.style.display = 'block';
    }
  }`;

const start = html.indexOf('async function validateSignup');
const end = html.indexOf('function completeSignup');
if (start === -1 || end === -1 || end < start) {
  console.log('❌ validateSignup / completeSignup introuvable : fichier non modifié.');
  process.exit(1);
}
html = html.slice(0, start) + newValidateSignup + '\n\n' + html.slice(end);
console.log('✅ validateSignup remplacée');

const typoCount = html.split('selectedPreflang').length - 1;
html = html.split('selectedPreflang').join('selectedPrefLang');
console.log('✅ selectedPreflang corrigé (' + typoCount + ' endroit(s))');

const before = html.length;
html = html.replace('const supabase = window.supabase.createClient', 'const sb = window.supabase.createClient');
console.log(html.length !== before ? '✅ const supabase → const sb' : '⚠️ ligne "const supabase = ..." introuvable (déjà corrigée ?)');

const leftovers = (html.match(/supabase\.auth/g) || []).length;
const sbDecl = (html.match(/const sb\b/g) || []).length;
console.log('Vérification : "supabase.auth" restant = ' + leftovers + ' (doit être 0)');
console.log('Vérification : "const sb" = ' + sbDecl + ' (doit être 1)');

fs.writeFileSync(file, html);
console.log('Terminé. Copie de sauvegarde : ' + file + '.backup');