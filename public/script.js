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

  } catch (err) {}
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

      div.innerHTML = `
        <img src="${q.thumb}" onclick="openModal('${q.url || q.thumb}')">
      `;

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

  if (!file) return;

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
      previewArea.innerHTML += generateQSLPreview(row,imageURL);
    });
  };

  Papa.parse(file,{
    header:true,
    skipEmptyLines:true,
    complete:res=>{
      importedLogs = res.data.map(normalizeRow).filter(r=>r.Indicatif);
      showPreview();
      document.getElementById("validateImportBtn").style.display = "inline-block";
    }
  });
}

// ===============================
// BULK UPLOAD
// ===============================
document.getElementById("validateImportBtn").onclick = async function() {
  const imageInput = document.getElementById("bulkImage");

  for(let row of importedLogs){
    const formData = new FormData();

    formData.append("indicatif", row.Indicatif);
    formData.append("date", row.Date);
    formData.append("time", row.Heure);
    formData.append("band", row.Bande);
    formData.append("report", row.Report);
    formData.append("mode", row.Mode);
    formData.append("note", row.Note);
    formData.append("qsl", imageInput.files[0]);

    await fetch(API_URL+"/upload",{method:"POST",body:formData});
  }
};

// ===============================
// CREATE
// ===============================
document.getElementById("genForm").addEventListener("submit", e=>{
  e.preventDefault();

  const formData = new FormData(e.target);
  const imgURL = URL.createObjectURL(formData.get("qsl"));
  const data = Object.fromEntries(formData.entries());

  document.getElementById("genPreview").innerHTML = generateQSLPreview(data,imgURL);

  fetch(API_URL+"/upload",{method:"POST",body:formData});
});

// ===============================
// MODAL IMAGE
// ===============================
function openModal(src){
  const modal = document.getElementById("imgModal");
  const img = document.getElementById("modalImg");

  img.src = src;
  modal.classList.remove("hidden");
}

document.getElementById("closeModal").onclick = () => {
  document.getElementById("imgModal").classList.add("hidden");
};

document.getElementById("imgModal").onclick = (e) => {
  if(e.target.id === "imgModal"){
    e.currentTarget.classList.add("hidden");
  }
};

// ===============================
checkAuth();
showTab("home");
