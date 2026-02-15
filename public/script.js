// ===============================
// CONFIG
// ===============================
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// AUTH / SESSION
// ===============================
async function checkAuth() {
  try {
    const res = await fetch("/check-auth", { credentials: "same-origin" });
    const data = await res.json();

    window.isAuthenticated = data.authenticated === true;

    const loginBox = document.getElementById("loginBox");
    const logoutBtn = document.getElementById("logoutBtn");
    const btnGallery = document.getElementById("btnGallery");
    const btnCreate = document.getElementById("btnCreate");

    if (window.isAuthenticated) {
      loginBox.style.display = "none";
      logoutBtn.style.display = "inline-block";
      btnGallery.style.display = "inline-block";
      btnCreate.style.display = "inline-block";
    } else {
      loginBox.style.display = "block";
      logoutBtn.style.display = "none";
      btnGallery.style.display = "none";
      btnCreate.style.display = "none";
    }
  } catch (err) {
    console.error("checkAuth error", err);
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");

  errBox.innerText = "";

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });

    if (!res.ok) {
      errBox.innerText = "Identifiants incorrects";
      return;
    }

    await checkAuth();
    showTab("home");
  } catch (err) {
    errBox.innerText = "Erreur réseau";
  }
}

function logout() {
  window.location.href = "/logout";
}

// ===============================
// NAVIGATION
// ===============================
function showTab(id) {

  const protectedTabs = ["gallery", "create"];

  if (protectedTabs.includes(id) && !window.isAuthenticated) {
    showTab("home");
    return;
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
// IMPORT CSV / EXCEL
// ===============================
function processFile() {
  const file = document.getElementById("importFile").files[0];
  const status = document.getElementById("importStatus");
  const previewArea = document.getElementById("previewArea");

  if (!file) {
    status.innerHTML = "Choisissez un fichier";
    return;
  }

  const normalizeRow = row => ({
    Indicatif: (row.indicatif || row.Indicatif || "").trim(),
    Date: (row.date || row.Date || "").trim(),
    Heure: (row.heure || row.Heure || "").trim(),
    Bande: (row.bande || row.Bande || "").trim(),
    Report: (row.report || row.Report || "").trim(),
    Mode: (row.mode || row.Mode || "").trim(),
    Note: (row.note || row.Note || "").trim()
  });

  const showPreview = () => {
    previewArea.innerHTML = "";
    importedLogs.slice(0, 10).forEach(row => {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${row.Indicatif}</strong> ${row.Date} ${row.Heure}`;
      previewArea.appendChild(div);
    });
  };

  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws);

    importedLogs = raw
      .map(normalizeRow)
      .filter(row => row.Indicatif !== "");

    status.innerHTML = `${importedLogs.length} lignes valides chargées`;
    showPreview();
    document.getElementById("validateImportBtn").style.display = "inline-block";
  };
  reader.readAsArrayBuffer(file);
}

// ===============================
// VALIDATION IMPORT + PROGRESSION
// ===============================
document.getElementById("validateImportBtn").onclick = async function () {

  const imageInput = document.getElementById("bulkImage");
  const status = document.getElementById("importStatus");
  const progress = document.getElementById("progressContainer");
  const bar = document.getElementById("progressBar");

  progress.style.display = "block";
  bar.style.width = "0%";

  let success = 0;

  for (let i = 0; i < importedLogs.length; i++) {

    const row = importedLogs[i];
    const formData = new FormData();

    formData.append("indicatif", row.Indicatif);
    formData.append("date", row.Date);
    formData.append("time", row.Heure);
    formData.append("band", row.Bande);
    formData.append("report", row.Report);
    formData.append("mode", row.Mode);
    formData.append("note", row.Note);
    formData.append("qsl", imageInput.files[0]);

    try {
      const res = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      const data = await res.json();
      if (data.success) success++;
    } catch (err) {}

    const percent = Math.round(((i + 1) / importedLogs.length) * 100);
    bar.style.width = percent + "%";
    status.innerHTML = `Traitement ${i + 1}/${importedLogs.length}`;
  }

  status.innerHTML = `✅ ${success} QSL enregistrées`;
};
// ===============================
// DOWNLOAD SEARCH
// ===============================
document.getElementById("btnSearch").onclick = async () => {
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");

  if (!call) {
    alert("Entrer un indicatif");
    return;
  }

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
      div.className = "dlWrap";
      div.innerHTML = `
        <img src="${q.thumb}" class="dlThumb">
        <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = "Erreur réseau";
  }
};

function downloadQSL(pid) {
  const a = document.createElement("a");
  a.href = API_URL + "/file?pid=" + encodeURIComponent(pid);
  a.click();
}



// ===============================
// INIT
// ===============================
// ===============================
// GENERATION QSL FORMULAIRE NORMAL
// ===============================
const genForm = document.getElementById("genForm");

if (genForm) {
  genForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const preview = document.getElementById("genPreview");
    preview.innerHTML = "Génération en cours…";

    const formData = new FormData(genForm);

    try {
      const res = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      const data = await res.json();

      if (data.success) {
        preview.innerHTML = `
          <img src="${data.thumb}" style="max-width:100%;">
          <p>✅ QSL générée</p>
        `;
      } else {
        preview.innerHTML = "❌ Erreur génération";
      }

    } catch (err) {
      console.error(err);
      preview.innerHTML = "❌ Erreur réseau";
    }
  });
}

checkAuth();
showTab("home");

