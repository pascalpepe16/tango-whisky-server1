const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// QSL PREVIEW
// ===============================
function generateQSLPreview(data, imageUrl, mini=false) {
  const cardClass = mini ? 'thumbWrap' : 'qsl-card';
  const textClass = mini ? '' : 'qsl-text';
  const imgClass = mini ? '' : 'qsl-image';

  return `
    <div class="${cardClass}">
      <div class="${imgClass}">
        <img src="${imageUrl}" style="object-fit:contain;">
      </div>
      ${mini ? '' : `<div class="${textClass}">
        <h3>${data.indicatif || data.Indicatif || ''}</h3>
        <p>Date: ${data.date || data.Date || ''}</p>
        <p>Heure: ${data.time || data.Heure || ''}</p>
        <p>Bande: ${data.band || data.Bande || ''}</p>
        <p>Mode: ${data.mode || data.Mode || ''}</p>
        <p>Report: ${data.report || data.Report || ''}</p>
        <p>${data.note || data.Note || ''}</p>
      </div>`}
    </div>
  `;
}

// ===============================
// AUTH / SESSION
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
  } catch(e){ console.error(e); }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");
  errBox.innerText = "";
  try {
    const res = await fetch(API_URL + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });
    if(!res.ok){ errBox.innerText="Identifiants incorrects"; return; }
    await checkAuth(); showTab("home");
  } catch(e){ errBox.innerText="Erreur réseau"; }
}

function logout(){ window.location.href = API_URL+"/logout"; }

// ===============================
// NAVIGATION
// ===============================
function showTab(id){
  const protectedTabs = ["gallery","create"];
  if(protectedTabs.includes(id) && !window.isAuthenticated){ showTab("home"); return; }

  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  const el=document.getElementById(id);
  if(el) el.classList.remove("hidden");

  if(id==="gallery") loadGallery();
}

// ===============================
// NAV BOUTONS
// ===============================
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("btnHome").addEventListener("click",()=>showTab("home"));
  document.getElementById("btnGallery").addEventListener("click",()=>showTab("gallery"));
  document.getElementById("btnCreate").addEventListener("click",()=>showTab("create"));
  document.getElementById("btnDownload").addEventListener("click",()=>showTab("download"));
  document.getElementById("logoutBtn").addEventListener("click",logout);
  document.getElementById("loginBtn").addEventListener("click",login);

  document.getElementById("btnSearch").addEventListener("click", searchQSL);
});

// ===============================
// GALLERY
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement…";
  try {
    const res = await fetch(API_URL+"/qsl",{credentials:"same-origin"});
    const list = await res.json();
    if(!Array.isArray(list)||!list.length){ box.innerHTML="Aucune QSL"; return; }
    box.innerHTML = "";
    list.forEach(q=>{
      const div=document.createElement("div");
      div.className="thumbWrap";
      div.innerHTML = `<img src="${q.thumb}">`;
      box.appendChild(div);
    });
  } catch(e){ box.innerHTML="Erreur réseau"; }
}

// ===============================
// RECHERCHE QSL (DOWNLOAD)
function searchQSL(){
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");
  if(!call){ alert("Entrez un indicatif"); return; }
  box.innerHTML = "Recherche…";
  fetch(API_URL+"/download/"+call)
    .then(res => res.json())
    .then(list=>{
      if(!list.length){ box.innerHTML="Aucune QSL trouvée"; return; }
      box.innerHTML="";
      list.forEach(q=>{
        const div=document.createElement("div");
        div.className="thumbWrap";
        div.innerHTML = `<img src="${q.thumb}" style="height:100px;object-fit:cover;">
        <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>`;
        box.appendChild(div);
      });
    }).catch(()=>{ box.innerHTML="Erreur réseau"; });
}

function downloadQSL(pid){
  const a = document.createElement("a");
  a.href = API_URL+"/file?pid="+encodeURIComponent(pid);
  a.click();
}

// ===============================
// IMPORT CSV/XLSX
// ===============================
function processFile(){
  const fileInput=document.getElementById("importFile");
  const file=fileInput.files[0];
  const previewArea=document.getElementById("previewArea");
  const status=document.getElementById("importStatus");
  if(!file){ status.innerText="Choisissez un fichier"; return; }

  const imageInput=document.getElementById("bulkImage");
  let imageURL=imageInput.files[0]? URL.createObjectURL(imageInput.files[0]) : "";

  const ext=file.name.split(".").pop().toLowerCase();
  const normalizeRow=r=>({Indicatif:(r.indicatif||r.Indicatif||"").trim(),Date:(r.date||r.Date||"").trim(),Heure:(r.heure||r.Heure||"").trim(),Bande:(r.bande||r.Bande||"").trim(),Report:(r.report||r.Report||"").trim(),Mode:(r.mode||r.Mode||"").trim(),Note:(r.note||r.Note||"").trim()});

  const showPreview=()=>{
    previewArea.innerHTML="";
    importedLogs.slice(0,10).forEach(r=>{
      previewArea.innerHTML += generateQSLPreview(r,imageURL,true); // miniature
    });
  };

  if(ext==="csv"){ Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{ importedLogs=r.data.map(normalizeRow).filter(r=>r.Indicatif!==""); status.innerText=`${importedLogs.length} lignes valides chargées`; showPreview(); document.getElementById("validateImportBtn").style.display="inline-block"; } }); }
  else if(ext==="xlsx"){
    const reader=new FileReader();
    reader.onload=e=>{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws);
      importedLogs=raw.map(normalizeRow).filter(r=>r.Indicatif!=="");
      status.innerText=`${importedLogs.length} lignes valides chargées`; showPreview(); document.getElementById("validateImportBtn").style.display="inline-block";
    };
    reader.readAsArrayBuffer(file);
  }
}

// ===============================
// BULK UPLOAD
// ===============================
document.getElementById("validateImportBtn").onclick=async function(){
  const imageInput=document.getElementById("bulkImage");
  const status=document.getElementById("importStatus");
  const progress=document.getElementById("progressContainer");
  const bar=document.getElementById("progressBar");

  progress.style.display="block"; bar.style.width="0%";
  let success=0;
  for(let i=0;i<importedLogs.length;i++){
    const row=importedLogs[i];
    const formData=new FormData();
    formData.append("indicatif",row.Indicatif);
    formData.append("date",row.Date);
    formData.append("time",row.Heure);
    formData.append("band",row.Bande);
    formData.append("report",row.Report);
    formData.append("mode",row.Mode);
    formData.append("note",row.Note);
    formData.append("qsl",imageInput.files[0]);
    try{
      const res=await fetch(API_URL+"/upload",{method:"POST",body:formData,credentials:"same-origin"});
      const data=await res.json(); if(data.success) success++;
    }catch(e){}
    bar.style.width = Math.round(((i+1)/importedLogs.length)*100)+"%";
    status.innerText=`Traitement ${i+1}/${importedLogs.length}`;
  }
  status.innerText=`✅ ${success} QSL enregistrées`;
};

// ===============================
// GENERATION QSL UNITAIRE
// ===============================
document.getElementById("genForm").addEventListener("submit",e=>{
  e.preventDefault();
  const form=e.target;
  const preview=document.getElementById("genPreview");
  const formData=new FormData(form);
  const imgFile=formData.get("qsl");
  const data=Object.fromEntries(formData.entries());
  const imgURL=URL.createObjectURL(imgFile);
  preview.innerHTML = generateQSLPreview(data,imgURL,true); // miniature avec texte gris
  fetch(API_URL+"/upload",{method:"POST",body:formData,credentials:"same-origin"}).catch(()=>{});
});

// ===============================
// INIT
checkAuth(); showTab("home");
