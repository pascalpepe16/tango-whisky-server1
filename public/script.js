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
// IMPORT CSV
// ===============================
function processFile() {
  const file = document.getElementById("importFile").files[0];
  const previewArea = document.getElementById("previewArea");

  const imageInput = document.getElementById("bulkImage");
  const imageURL = imageInput.files[0] ? URL.createObjectURL(imageInput.files[0]) : "";

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
      const div = document.createElement("div");
      div.className = "previewItem";
      div.innerHTML = generateQSLPreview(row,imageURL);
      previewArea.appendChild(div);
    });
  };

  Papa.parse(file,{
    header:true,
    complete:res=>{
      importedLogs = res.data.map(normalizeRow).filter(r=>r.Indicatif);
      showPreview();
      document.getElementById("validateImportBtn").style.display = "inline-block";
    }
  });
}

// ===============================
// GENERATION SIMPLE
// ===============================
document.getElementById("genForm").addEventListener("submit", e=>{
  e.preventDefault();

  const formData = new FormData(e.target);
  const imgURL = URL.createObjectURL(formData.get("qsl"));
  const data = Object.fromEntries(formData.entries());

  const preview = document.getElementById("genPreview");
  preview.innerHTML = "";

  const div = document.createElement("div");
  div.className = "previewItem";
  div.innerHTML = generateQSLPreview(data,imgURL);

  preview.appendChild(div);

  fetch(API_URL+"/upload",{method:"POST",body:formData});
});

// ===============================
checkAuth();
showTab("home");
