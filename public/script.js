const API_URL = window.location.origin;

let lastQslCount = 0;
let currentIndicatif = null;

// ===============================
// AUTH
// ===============================
async function checkAuth() {
  const res = await fetch(API_URL + "/check-auth");
  const data = await res.json();

  if (data.authenticated) {
    currentIndicatif = data.indicatif;
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("appBox").style.display = "block";
    checkNewQSL();
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("appBox").style.display = "none";
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indicatif, password })
  });

  if (!res.ok) {
    alert("Identifiants incorrects");
    return;
  }

  checkAuth();
}

function logout() {
  window.location.href = "/logout";
}

// ===============================
// GENERATION QSL
// ===============================
document.getElementById("genForm")?.addEventListener("submit", async (e) => {

  e.preventDefault();

  const preview = document.getElementById("genPreview");
  preview.innerHTML = "Génération...";

  const formData = new FormData(e.target);

  try {
    const res = await fetch("/upload-single-qsl", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      preview.innerHTML = "Erreur serveur";
      return;
    }

    const data = await res.json();

    preview.innerHTML = `
      <img src="${data.qsl.url}" style="max-width:300px;">
      <p>QSL générée avec succès</p>
    `;

  } catch (err) {
    preview.innerHTML = "Erreur réseau";
  }
});

// ===============================
// NOTIFICATION
// ===============================
async function checkNewQSL() {

  if (!currentIndicatif) return;

  try {
    const res = await fetch("/download/" + currentIndicatif);
    const list = await res.json();

    if (lastQslCount === 0) {
      lastQslCount = list.length;
      return;
    }

    if (list.length > lastQslCount) {
      alert("📩 Vous avez une nouvelle QSL !");
      lastQslCount = list.length;
    }

  } catch (err) {
    console.error("Notification error", err);
  }
}

setInterval(checkNewQSL, 30000);

// ===============================
document.addEventListener("DOMContentLoaded", checkAuth);
