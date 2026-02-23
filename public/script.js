// ===============================
// CONFIG
// ===============================
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// QSL PREVIEW GENERATOR
// ===============================
function generateQSLPreview(data, imageUrl) {
  return `
    <div class="previewItem">
      <div class="qsl-card">
        <div class="qsl-image">
          <img src="${imageUrl}">
        </div>
        <div class="qsl-text">
          <h3>${data.indicatif || data.Indicatif || ''}</h3>
          <p>Date: ${data.date || data.Date || ''}</p>
          <p>Heure: ${data.time || data.Heure || ''}</p>
          <p>Bande: ${data.band || data.Bande || ''}</p>
          <p>Mode: ${data.mode || data.Mode || ''}</p>
          <p>Report: ${data.report || data.Report || ''}</p>
          <p>${data.note || data.Note || ''}</p>
        </div>
      </div>
    </div>
  `;
}

// ===============================
// AUTH
// ===============================
async function checkAuth() {
  try {
    const res = await fetch(API_URL + "/check-auth", { credentials: "same-origin" });
    const data = await res.json();
    window.isAuthenticated = data.authenticated === true;

    document.getElementById("loginBox").style.display = window.isAuthenticated ? "none" : "block";
    document.getElementById("logoutBtn").style.display = window.isAuthenticated ? "inline-block" : "none";
    document.getElementById("btnGallery").style.display = window.isAuthenticated ? "inline-block" : "none";
    document.getElementById("btnCreate").style.display = window.isAuthenticated ? "inline-block" : "none";

  } catch (err) { console.error(err); }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    const res = await fetch(API_URL + "/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      credentials: "same-origin",
      body: JSON.stringify({indicatif, password})
    });
    if(res.ok){ await checkAuth(); showTab("home"); }
    else { document.getElementById("loginError").innerText = "Erreur login"; }
  } catch { document.getElementById("loginError").innerText = "Erreur réseau"; }
}

function logout(){ window.location.href = API_URL + "/logout"; }

// ===============================
// NAVIGATION
// ===============================
function showTab(id) {
  if (["gallery","create"].includes(id) && !window.isAuthenticated) { showTab("home"); return; }
  document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
  if (id === "gallery") loadGallery();
}

// ===============================
// GALLERY
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement...";
  try {
    const res = await fetch(API_URL + "/qsl", { credentials:"same-origin" });
    const list = await res.json();
    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "thumbWrap";
      div.innerHTML = `<img src="${q.thumb}">`;
      box.appendChild(div);
    });
  } catch { box.innerHTML = "Erreur réseau"; }
}

// ===============================
// IMPORT / PREVIEW / BULK UPLOAD
// ===============================
// Inchangé, stable, comme discuté plus haut

checkAuth();
showTab("home");
