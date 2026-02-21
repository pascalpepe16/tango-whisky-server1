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
// AUTH / SESSION
// ===============================
async function checkAuth() {
  try {
    const res = await fetch(API_URL + "/check-auth", { credentials: "same-origin" });
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
  } catch (err) { console.error("checkAuth error", err); }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");
  errBox.innerText = "";
  try {
    const res = await fetch(API_URL + "/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      credentials: "same-origin",
      body: JSON.stringify({indicatif, password})
    });
    if (!res.ok) { errBox.innerText = "Identifiants incorrects"; return; }
    await checkAuth();
    showTab("home");
  } catch(err){ errBox.innerText="Erreur réseau"; }
}

function logout(){ window.location.href = API_URL + "/logout"; }

// ===============================
// NAVIGATION
// ===============================
function showTab(id){
  const protectedTabs = ["gallery","create"];
  if(protectedTabs.includes(id) && !window.isAuthenticated){ showTab("home"); return; }
  document.querySelectorAll(".section").forEach(sec=>sec.classList.add("hidden"));
  const el=document.getElementById(id); if(el) el.classList.remove("hidden");
  if(id==="gallery") loadGallery();
}

// ===============================
// GALLERY
// ===============================
async function loadGallery(){
  const box=document.getElementById("galleryContent");
  box.innerHTML="Chargement…";

  try{
    const res=await fetch(API_URL+"/qsl",{credentials:"same-origin"});
    const list=await res.json();

    if(!Array.isArray(list)||!list.length){
      box.innerHTML="Aucune QSL";
      return;
    }

    box.innerHTML="";

    list.forEach(q=>{
      const d = q.data || {};

      const div=document.createElement("div");
      div.className="qsl-card";

      div.innerHTML=`
        <div class="qsl-image">
          <img src="${q.thumb}">
        </div>
        <div class="qsl-text">
          <h3>${d.indicatif || ""}</h3>
          <p>Date: ${d.date || ""}</p>
          <p>Heure: ${d.time || ""}</p>
          <p>Bande: ${d.band || ""}</p>
          <p>Mode: ${d.mode || ""}</p>
          <p>Report: ${d.report || ""}</p>
        </div>
      `;

      box.appendChild(div);
    });

  }catch(err){
    box.innerHTML="Erreur réseau";
  }
}

// ===============================
// IMPORT CSV / XLSX
// ===============================
function processFile(){
  const fileInput=document.getElementById("importFile");
  const file=fileInput.files[0];
  const status=document.getElementById("importStatus");
  const previewArea=document.getElementById("previewArea");
  if(!file){ status.innerHTML="Choisissez un fichier"; return; }
  const imageInput=document.getElementById("bulkImage");
  const imageURL=imageInput.files[0]?URL.createObjectURL(imageInput.files[0]):"";
  const ext=file.name.split(".").pop().toLowerCase();
  const normalizeRow=row=>({
    Indicatif:(row.indicatif||row.Indicatif||"").trim(),
    Date:(row.date||row.Date||"").trim(),
    Heure:(row.heure||row.Heure||"").trim(),
    Bande:(row.bande||row.Bande||"").trim(),
    Report:(row.report||row.Report||"").trim(),
    Mode:(row.mode||row.Mode||"").trim(),
    Note:(row.note||row.Note||"").trim()
  });
  const showPreview=()=>{
    previewArea.innerHTML="";
    importedLogs.slice(0,10).forEach(row=>{ previewArea.innerHTML+=generateQSLPreview(row,imageURL); });
  };
  if(ext==="csv"){
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:function(results){
      importedLogs=results.data.map(normalizeRow).filter(r=>r.Indicatif!=="");
      status.innerHTML=`${importedLogs.length} lignes valides chargées`;
      showPreview();
      document.getElementById("validateImportBtn").style.display="inline-block";
    }});
  } else if(ext==="xlsx"){
    const reader=new FileReader();
    reader.onload=function(e){
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws);
      importedLogs=raw.map(normalizeRow).filter(r=>r.Indicatif!=="");
      status.innerHTML=`${importedLogs.length} lignes valides chargées`;
      showPreview();
      document.getElementById("validateImportBtn").style.display="inline-block";
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
  progress.style.display="block";
  bar.style.width="0%";
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
    }catch(err){}
    const percent=Math.round(((i+1)/importedLogs.length)*100);
    bar.style.width=percent+"%";
    status.innerHTML=`Traitement ${i+1}/${importedLogs.length}`;
  }
  status.innerHTML=`✅ ${success} QSL enregistrées`;
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
  preview.innerHTML=generateQSLPreview(data,imgURL);
  fetch(API_URL+"/upload",{method:"POST",body:formData,credentials:"same-origin"}).catch(()=>{});
});

// ===============================
// DOWNLOAD SEARCH
// ===============================
document.getElementById("btnSearch").onclick=async()=>{
  const call=document.getElementById("dlCall").value.trim().toUpperCase();
  const box=document.getElementById("dlPreview");
  if(!call){ alert("Entrer un indicatif"); return; }
  box.innerHTML="Recherche…";
  try{
    const res=await fetch(API_URL+"/download/"+call);
    const list=await res.json();
    if(!list.length){ box.innerHTML="Aucune QSL trouvée"; return; }
    box.innerHTML="";
    list.forEach(q=>{
      const div=document.createElement("div");
      div.className="dlWrap";
      div.innerHTML=`<img src="${q.thumb}" class="dlThumb"><button onclick="downloadQSL('${q.public_id}')">Télécharger</button>`;
      box.appendChild(div);
    });
  }catch(err){ box.innerHTML="Erreur réseau"; console.error(err); }
};

function downloadQSL(pid){
  const a=document.createElement("a");
  a.href=API_URL+"/file?pid="+encodeURIComponent(pid);
  a.click();
}

// ===============================
// INIT
// ===============================
checkAuth();
showTab("home");
