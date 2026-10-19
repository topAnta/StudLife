const fs = require('fs');

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.backup3', html);

const newSaveProfile = String.raw`async function saveProfile() {
    const editView = document.getElementById('profileEditView');
    let errBox = document.getElementById('profileSaveError');
    if (!errBox) {
      errBox = document.createElement('div');
      errBox.id = 'profileSaveError';
      errBox.className = 'form-error';
      errBox.style.display = 'none';
      editView.insertBefore(errBox, editView.firstChild);
    }
    errBox.style.display = 'none';

    const updated = {
      name: document.getElementById('editNameInput').value.trim() || profileData.name,
      school: document.getElementById('editSchoolInput').value.trim() || profileData.school,
      program: document.getElementById('editProgramInput').value.trim() || profileData.program,
      city: document.getElementById('editCityInput').value.trim() || profileData.city,
      language: profileEditLangChoice
    };

    try {
      const { data: userData } = await sb.auth.getUser();
      const user = userData && userData.user;
      if (!user) {
        errBox.textContent = currentLang === 'fr' ? 'Tu dois être connectée pour modifier ton profil.' : 'You must be logged in to edit your profile.';
        errBox.style.display = 'block';
        return;
      }

      const { data, error } = await sb.from('profiles')
        .update({
          full_name: updated.name,
          school: updated.school,
          program: updated.program,
          city: updated.city,
          language: updated.language
        })
        .eq('id', user.id)
        .select();

      if (error || !data || data.length === 0) {
        console.error('Erreur profil :', error);
        errBox.textContent = currentLang === 'fr' ? "Impossible d'enregistrer. Réessaie." : 'Could not save. Try again.';
        errBox.style.display = 'block';
        return;
      }

      profileData.name = updated.name;
      profileData.school = updated.school;
      profileData.program = updated.program;
      profileData.city = updated.city;
      profileData.language = updated.language;
      renderProfileDisplay();
      renderDashboard();
      hideAllProfileViews();
      document.getElementById('profileDisplayView').style.display = 'block';
      if (profileData.language !== currentLang) toggleLanguage();
    } catch (err) {
      console.error(err);
      errBox.textContent = currentLang === 'fr' ? 'Erreur réseau, réessaie.' : 'Network error, try again.';
      errBox.style.display = 'block';
    }
  }`;

let start = html.indexOf('async function saveProfile');
if (start === -1) start = html.indexOf('function saveProfile');
const end = html.indexOf('function cancelProfileEdit');

if (start === -1 || end === -1 || end < start) {
  console.log('❌ saveProfile / cancelProfileEdit introuvable : fichier non modifié.');
  process.exit(1);
}

html = html.slice(0, start) + newSaveProfile + '\n\n  ' + html.slice(end);
console.log('✅ saveProfile enregistre maintenant dans Supabase');

fs.writeFileSync(file, html);
console.log('Terminé. Sauvegarde : ' + file + '.backup3');