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

  } catch (err) {
    console.error(err);
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(API_URL + "/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    credentials: "same-origin",
    body: JSON.stringify({indicatif, password})
  });

  if (res.ok) {
    await checkAuth();
    showTab("home");
  } else {
    document.getElementById("loginError").innerText = "Erreur login";
  }
}

function logout() {
  window.location.href = API_URL + "/logout";
}

// ===============================
// NAVIGATION
// ===============================
function showTab(id) {
  if (["gallery","create"].includes(id) && !window.isAuthenticated) {
    showTab("home");
    return;
  }

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

  } catch {
    box.innerHTML = "Erreur";
  }
}

// ===============================
// IMPORT CSV / XLSX
// ===============================
function processFile() {
  const file = document.getElementById("importFile").files[0];
  const previewArea = document.getElementById("previewArea");
  const status = document.getElementById("importStatus");

  if (!file) {
    status.innerHTML = "Choisir un fichier";
    return;
  }

  const imageInput = document.getElementById("bulkImage");
  const imageURL = imageInput.files[0] ? URL.createObjectURL(imageInput.files[0]) : "";

  const ext = file.name.split(".").pop().toLowerCase();

  const normalizeRow = row => ({
    Indicatif:(row.indicatif||row.Indicatif||"").trim(),
    Date:(row.date||row.Date||"").trim(),
    Heure:(row.heure||row.Heure||"").trim(),
    Bande:(row.bande||row.Bande||"").trim(),
    Report:(row.report||row.Report||"").trim(),
    Mode:(row.mode||row.Mode||"").trim(),
    Note:(row.note||row.Note||"").trim()
  });

  const showPreview = () => {
    previewArea.innerHTML = "";
    importedLogs.slice(0,10).forEach(row => {
      previewArea.innerHTML += generateQSLPreview(row,imageURL);
    });
  };

  // =====================
  // CSV
  // =====================
  if (ext === "csv") {
    Papa.parse(file,{
      header:true,
      skipEmptyLines:true,
      complete:res=>{
        importedLogs = res.data.map(normalizeRow).filter(r=>r.Indicatif);
        status.innerHTML = `${importedLogs.length} lignes chargées`;
        showPreview();
        document.getElementById("validateImportBtn").style.display = "inline-block";
      }
    });
  }

  // =====================
  // XLSX (FIX ICI)
  // =====================
  else if (ext === "xlsx") {
    const reader = new FileReader();

    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      importedLogs = json.map(normalizeRow).filter(r=>r.Indicatif);

      status.innerHTML = `${importedLogs.length} lignes chargées`;
      showPreview();
      document.getElementById("validateImportBtn").style.display = "inline-block";
    };

    reader.readAsArrayBuffer(file);
  }

  else {
    status.innerHTML = "Format non supporté (csv ou xlsx)";
  }
}
// ===============================
// BULK UPLOAD (PROGRESS OK)
// ===============================
document.getElementById("validateImportBtn").onclick = async function() {
  const imageInput = document.getElementById("bulkImage");
  const status = document.getElementById("importStatus");
  const progress = document.getElementById("progressContainer");
  const bar = document.getElementById("progressBar");

  progress.style.display = "block";
  bar.style.width="0%";

  let success = 0;

  for(let i=0;i<importedLogs.length;i++){
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

    try{
      const res = await fetch(API_URL+"/upload",{method:"POST",body:formData});
      const data = await res.json();
      if(data.success) success++;
    } catch(err){}

    const percent = Math.round(((i+1)/importedLogs.length)*100);
    bar.style.width = percent+"%";
    status.innerHTML = `Traitement ${i+1}/${importedLogs.length}`;
  }

  status.innerHTML = `✅ ${success} QSL enregistrées`;
};

// ===============================
// CREATE
// ===============================
document.getElementById("genForm").addEventListener("submit", e=>{
  e.preventDefault();

  const formData = new FormData(e.target);
  const imgURL = URL.createObjectURL(formData.get("qsl"));
  const data = Object.fromEntries(formData.entries());

  const preview = document.getElementById("genPreview");
  preview.innerHTML = generateQSLPreview(data,imgURL);

  fetch(API_URL+"/upload",{method:"POST",body:formData});
});
function processFile() {
  const file = document.getElementById("importFile").files[0];
  const previewArea = document.getElementById("previewArea");
  const status = document.getElementById("importStatus");

  if (!file) {
    status.innerHTML = "Choisir un fichier";
    return;
  }

  const imageInput = document.getElementById("bulkImage");
  const imageURL = imageInput.files[0] ? URL.createObjectURL(imageInput.files[0]) : "";

  const ext = file.name.split(".").pop().toLowerCase();

  const normalizeRow = row => ({
    Indicatif:(row.indicatif||row.Indicatif||"").trim(),
    Date:(row.date||row.Date||"").trim(),
    Heure:(row.heure||row.Heure||"").trim(),
    Bande:(row.bande||row.Bande||"").trim(),
    Report:(row.report||row.Report||"").trim(),
    Mode:(row.mode||row.Mode||"").trim(),
    Note:(row.note||row.Note||"").trim()
  });

  const showPreview = () => {
    previewArea.innerHTML = "";
    importedLogs.slice(0,10).forEach(row => {
      previewArea.innerHTML += generateQSLPreview(row,imageURL);
    });
  };

  // =====================
  // CSV
  // =====================
  if (ext === "csv") {
    Papa.parse(file,{
      header:true,
      skipEmptyLines:true,
      complete:res=>{
        importedLogs = res.data.map(normalizeRow).filter(r=>r.Indicatif);
        status.innerHTML = `${importedLogs.length} lignes chargées`;
        showPreview();
        document.getElementById("validateImportBtn").style.display = "inline-block";
      }
    });
  }

  // =====================
  // XLSX (FIX ICI)
  // =====================
  else if (ext === "xlsx") {
    const reader = new FileReader();

    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      importedLogs = json.map(normalizeRow).filter(r=>r.Indicatif);

      status.innerHTML = `${importedLogs.length} lignes chargées`;
      showPreview();
      document.getElementById("validateImportBtn").style.display = "inline-block";
    };

    reader.readAsArrayBuffer(file);
  }

  else {
    status.innerHTML = "Format non supporté (csv ou xlsx)";
  }
}
// ===============================
checkAuth();
showTab("home");
