// ===============================
// CONFIG
// ===============================
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// INIT PRINCIPAL
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initNavigation();
  initForm();
  initImport();
  initDownload();
  showTab("home");
});

// ===============================
// AUTH
// ===============================
function initAuth() {
  checkAuth();
}

async function checkAuth() {
  try {
    const res = await fetch("/check-auth", { credentials: "same-origin" });
    const data = await res.json();

    window.isAuthenticated = data.authenticated === true;

    const loginBox = document.getElementById("loginBox");
    const logoutBtn = document.getElementById("logoutBtn");
    const btnGallery = document.getElementById("btnGallery");
    const btnCreate = document.getElementById("btnCreate");

    if (loginBox) loginBox.style.display = window.isAuthenticated ? "none" : "block";
    if (logoutBtn) logoutBtn.style.display = window.isAuthenticated ? "inline-block" : "none";
    if (btnGallery) btnGallery.style.display = window.isAuthenticated ? "inline-block" : "none";
    if (btnCreate) btnCreate.style.display = window.isAuthenticated ? "inline-block" : "none";

  } catch (err) {
    console.error("checkAuth error:", err);
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  const errBox = document.getElementById("loginError");

  if (!indicatif || !password) {
    if (errBox) errBox.innerText = "Champs manquants";
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });

    if (!res.ok) {
      if (errBox) errBox.innerText = "Identifiants incorrects";
      return;
    }

    await checkAuth();
    showTab("home");

  } catch (err) {
    if (errBox) errBox.innerText = "Erreur réseau";
  }
}

function logout() {
  window.location.href = "/logout";
}

// ===============================
// NAVIGATION
// ===============================
function initNavigation() {
  // rien à initialiser pour l’instant
}

function showTab(id) {
  const protectedTabs = ["gallery", "create"];

  if (protectedTabs.includes(id) && !window.isAuthenticated) {
    id = "home";
  }

  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );

  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");

  if (id === "gallery") loadGallery();
}

// ===============================
// GALLERY
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  if (!box) return;

  box.innerHTML = "Chargement…";

  try {
    const res = await fetch(API_URL + "/qsl", {
      credentials: "same-origin"
    });

    const list = await res.json();

    if (!Array.isArray(list) || !list.length) {
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "thumbWrap";
      div.innerHTML = `<img src="${q.thumb}">`;
      box.appendChild(div);
    });

  } catch (err) {
    box.innerHTML = "Erreur réseau";
  }
}

// ===============================
// FORMULAIRE GENERATION QSL
// ===============================
function initForm() {
  const form = document.getElementById("genForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const preview = document.getElementById("genPreview");
    if (preview) preview.innerHTML = "Génération…";

    const formData = new FormData(form);

    try {
      const res = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      const data = await res.json();

      if (data.success) {
        if (preview) {
          preview.innerHTML = `
            <p>QSL générée :</p>
            <img src="${data.qsl.thumb}">
          `;
        }
        form.reset();
      } else {
        if (preview) preview.innerHTML = "Erreur génération";
      }

    } catch (err) {
      if (preview) preview.innerHTML = "Erreur réseau";
    }
  });
}

// ===============================
// IMPORT CSV
// ===============================
function initImport() {
  const validateBtn = document.getElementById("validateImportBtn");
  if (validateBtn) {
    validateBtn.onclick = validateImport;
  }
}

function processFile() {
  const file = document.getElementById("importFile")?.files[0];
  const status = document.getElementById("importStatus");

  if (!file) {
    if (status) status.innerHTML = "Choisissez un fichier";
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    importedLogs = XLSX.utils.sheet_to_json(ws);

    if (status) status.innerHTML = importedLogs.length + " lignes chargées";
    document.getElementById("validateImportBtn").style.display = "inline-block";
  };
  reader.readAsArrayBuffer(file);
}

async function validateImport() {
  const imageInput = document.getElementById("bulkImage");
  const status = document.getElementById("importStatus");

  let success = 0;

  for (let row of importedLogs) {
    const formData = new FormData();
    formData.append("indicatif", row.Indicatif || "");
    formData.append("date", row.Date || "");
    formData.append("time", row.Heure || "");
    formData.append("band", row.Bande || "");
    formData.append("report", row.Report || "");
    formData.append("mode", row.Mode || "");
    formData.append("note", row.Note || "");
    formData.append("qsl", imageInput.files[0]);

    try {
      const res = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      const data = await res.json();
      if (data.success) success++;

    } catch {}
  }

  if (status) status.innerHTML = "✅ " + success + " QSL enregistrées";
}

// ===============================
// DOWNLOAD
// ===============================
function initDownload() {
  const btn = document.getElementById("btnSearch");
  if (!btn) return;

  btn.onclick = async () => {
    const call = document.getElementById("dlCall")?.value.trim().toUpperCase();
    const box = document.getElementById("dlPreview");

    if (!call) return;

    box.innerHTML = "Recherche…";

    try {
      const res = await fetch(API_URL + "/download/" + call);
      const list = await res.json();

      if (!list.length) {
        box.innerHTML = "Aucune QSL trouvée";
        return;
      }

      box.innerHTML = "";
      list.forEach(q => {
        const div = document.createElement("div");
        div.innerHTML = `
          <img src="${q.thumb}" style="max-width:250px;"><br>
          <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
        `;
        box.appendChild(div);
      });

    } catch {
      box.innerHTML = "Erreur réseau";
    }
  };
}

function downloadQSL(pid) {
  const a = document.createElement("a");
  a.href = API_URL + "/file?pid=" + encodeURIComponent(pid);
  a.click();
}
 
