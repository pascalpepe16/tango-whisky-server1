// ===============================
// CONFIG
// ===============================
const API_URL = window.location.origin;

// ===============================
// ETAT GLOBAL
// ===============================
let lastQslCount = 0;
let currentIndicatif = null;

// ===============================
// AUTHENTIFICATION
// ===============================
async function checkAuth() {
  try {
    const res = await fetch(API_URL + "/check-auth");
    const data = await res.json();

    window.isAuthenticated = data.authenticated === true;
    currentIndicatif = data.indicatif || null;

    if (!window.isAuthenticated) {
      showTab("login");
    } else {
      showTab("home");
    }
  } catch (err) {
    console.error("Erreur auth:", err);
    showTab("login");
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(API_URL + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indicatif, password })
  });

  const data = await res.json();

  if (data.success) {
    await checkAuth();
    showTab("home");
    checkNewQSL();
  } else {
    alert("Identifiants incorrects");
  }
}

async function logout() {
  await fetch(API_URL + "/logout");
  window.location.reload();
}

// ===============================
// NAVIGATION
// ===============================
function showTab(tab) {
  document.querySelectorAll(".tab").forEach(el => el.style.display = "none");
  const target = document.getElementById(tab);
  if (target) target.style.display = "block";
}

// ===============================
// GENERATION QSL UNITAIRE
// ===============================
async function generateSingleQSL() {
  const fileInput = document.getElementById("qslFile");
  const preview = document.getElementById("qslPreview");

  if (!fileInput.files.length) {
    alert("Sélectionnez une image");
    return;
  }

  const formData = new FormData();
  formData.append("qsl", fileInput.files[0]);

  preview.innerHTML = "Génération en cours...";

  try {
    const res = await fetch(API_URL + "/upload-single-qsl", {
      method: "POST",
      body: formData
    });

    if (res.status === 401) {
      preview.innerHTML = "Session expirée, reconnectez-vous";
      return;
    }

    if (!res.ok) {
      throw new Error("Erreur serveur");
    }

    const data = await res.json();

    preview.innerHTML = `
      <img src="${data.url}" style="max-width:100%;border-radius:8px;">
      <br><br>
      <a href="${data.url}" target="_blank">Télécharger la QSL</a>
    `;

  } catch (err) {
    preview.innerHTML = "Erreur réseau";
    console.error(err);
  }
}

// ===============================
// TELECHARGEMENT DES QSL
// ===============================
async function loadMyQSL() {
  if (!currentIndicatif) return;

  const container = document.getElementById("myQslList");
  container.innerHTML = "Chargement...";

  try {
    const res = await fetch(API_URL + "/download/" + currentIndicatif);
    const list = await res.json();

    if (!Array.isArray(list)) {
      container.innerHTML = "Erreur de chargement";
      return;
    }

    if (list.length === 0) {
      container.innerHTML = "Aucune QSL reçue";
      return;
    }

    container.innerHTML = list.map(qsl => `
      <div style="margin:10px 0;">
        <img src="${qsl.url}" style="max-width:200px;border-radius:6px;">
        <br>
        <a href="${qsl.url}" target="_blank">Télécharger</a>
      </div>
    `).join("");

  } catch (err) {
    container.innerHTML = "Erreur de chargement";
    console.error(err);
  }
}

// ===============================
// NOTIFICATION NOUVELLE QSL
// ===============================
async function checkNewQSL() {
  try {
    if (!currentIndicatif) return;

    const res = await fetch(API_URL + "/download/" + currentIndicatif);
    const list = await res.json();

    if (!Array.isArray(list)) return;

    if (lastQslCount === 0) {
      lastQslCount = list.length;
      return;
    }

    if (list.length > lastQslCount) {
      alert("📩 Vous avez une nouvelle QSL !");
      lastQslCount = list.length;
    }
  } catch (err) {
    console.error("Notification QSL:", err);
  }
}

// Vérification toutes les 30 secondes
setInterval(checkNewQSL, 30000);

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});
