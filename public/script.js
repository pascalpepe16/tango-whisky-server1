const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// QSL PREVIEW GENERATOR (IDENTIQUE MAIS PROPRE)
// ===============================
function generateQSLPreview(data, imageUrl) {
  return `
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
  `;
}

// ===============================
// AUTH (FIX PRINCIPAL)
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

  } catch (err) {
    console.error("Auth error", err);
  }
}

// ===============================
// LOGIN (FIX)
// ===============================
async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(API_URL + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });

    if (!res.ok) {
      document.getElementById("loginError").innerText = "Identifiants incorrects";
      return;
    }

    await checkAuth();
    showTab("home");

  } catch (err) {
    document.getElementById("loginError").innerText = "Erreur réseau";
  }
}

function logout() {
  window.location.href = API_URL + "/logout";
}

// ===============================
// NAVIGATION (FIX)
// ===============================
function showTab(id) {
  const protectedTabs = ["gallery", "create"];

  if (protectedTabs.includes(id) && !window.isAuthenticated) {
    id = "home";
  }

  document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "gallery") loadGallery();
}

// ===============================
// GALERIE (FIX CLEAN)
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement…";

  try {
    const res = await fetch(API_URL + "/qsl", { credentials: "same-origin" });
    const list = await res.json();

    if (!list.length) {
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";

    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "thumbWrap";

      div.innerHTML = `<img src="${q.thumb}" onclick="window.open('${q.image || q.thumb}','_blank')">`;

      box.appendChild(div);
    });

  } catch (err) {
    box.innerHTML = "Erreur réseau";
  }
}

// ===============================
// IMPORT CSV (IDENTIQUE)
// ===============================
function processFile() {
  const file = document.getElementById("importFile").files[0];
  if (!file) return;

  const img = document.getElementById("bulkImage").files[0];
  const imgURL = img ? URL.createObjectURL(img) : "";

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {

      importedLogs = results.data;

      document.getElementById("previewArea").innerHTML =
        importedLogs.slice(0, 10).map(r => generateQSLPreview(r, imgURL)).join("");

      document.getElementById("validateImportBtn").style.display = "inline-block";
    }
  });
}

// ===============================
// PROGRESS BAR (FIX)
// ===============================
document.getElementById("validateImportBtn").onclick = async function () {

  const bar = document.getElementById("progressBar");
  const total = importedLogs.length;

  for (let i = 0; i < total; i++) {
    bar.style.width = ((i + 1) / total * 100) + "%";
    await new Promise(r => setTimeout(r, 50));
  }
};

// ===============================
// QSL UNITAIRE (OK)
// ===============================
document.getElementById("genForm").addEventListener("submit", e => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const img = formData.get("qsl");

  document.getElementById("genPreview").innerHTML =
    generateQSLPreview(Object.fromEntries(formData), URL.createObjectURL(img));

  fetch(API_URL + "/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin"
  }).catch(() => { });
});

// ===============================
// DOWNLOAD (FIX)
// ===============================
document.getElementById("btnSearch").onclick = async () => {

  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  if (!call) return;

  const box = document.getElementById("dlPreview");
  box.innerHTML = "Recherche…";

  try {
    const res = await fetch(API_URL + "/download/" + call);
    const list = await res.json();

    if (!list.length) {
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";

    list.forEach(q => {
      box.innerHTML += `
        <div class="dlWrap">
          <img src="${q.thumb}" class="dlThumb">
          <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
        </div>`;
    });

  } catch {
    box.innerHTML = "Erreur réseau";
  }
};

function downloadQSL(pid) {
  window.open(API_URL + "/file?pid=" + pid);
}

// ===============================
// INIT (IMPORTANT)
// ===============================
window.onload = () => {
  checkAuth();
  showTab("home");
};
