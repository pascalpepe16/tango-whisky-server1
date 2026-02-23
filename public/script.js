// CONFIG
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// QSL Preview
function generateQSLPreview(data, imageUrl) {
  return `<div class="previewItem">
    <div class="qsl-card">
      <div class="qsl-image"><img src="${imageUrl}"></div>
      <div class="qsl-text">
        <h3>${data.indicatif||data.Indicatif||''}</h3>
        <p>Date: ${data.date||data.Date||''}</p>
        <p>Heure: ${data.time||data.Heure||''}</p>
        <p>Bande: ${data.band||data.Bande||''}</p>
        <p>Mode: ${data.mode||data.Mode||''}</p>
        <p>Report: ${data.report||data.Report||''}</p>
        <p>${data.note||data.Note||''}</p>
      </div>
    </div>
  </div>`;
}

// AUTH
async function checkAuth(){
  try {
    const res = await fetch(API_URL+"/check-auth",{credentials:"same-origin"});
    const data = await res.json();
    window.isAuthenticated = data.authenticated===true;
    document.getElementById("loginBox").style.display = window.isAuthenticated?"none":"block";
    document.getElementById("logoutBtn").style.display = window.isAuthenticated?"inline-block":"none";
    document.getElementById("btnGallery").style.display = window.isAuthenticated?"inline-block":"none";
    document.getElementById("btnCreate").style.display = window.isAuthenticated?"inline-block":"none";
  }catch(err){console.error(err);}
}

async function login(){
  const indicatif=document.getElementById("loginIndicatif").value.trim();
  const password=document.getElementById("loginPassword").value;
  try{
    const res=await fetch(API_URL+"/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({indicatif,password})});
    if(res.ok){await checkAuth(); showTab("home");} else {document.getElementById("loginError").innerText="Erreur login";}
  }catch{document.getElementById("loginError").innerText="Erreur réseau";}
}

function logout(){window.location.href=API_URL+"/logout";}

// NAVIGATION
function showTab(id){
  if(["gallery","create"].includes(id) && !window.isAuthenticated){ showTab("home"); return;}
  document.querySelectorAll(".section").forEach(sec=>sec.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
  if(id==="gallery") loadGallery();
}

// GALLERY
async function loadGallery(){
  const box=document.getElementById("galleryContent");
  box.innerHTML="Chargement...";
  try{
    const res=await fetch(API_URL+"/qsl",{credentials:"same-origin"});
    const list=await res.json();
    box.innerHTML="";
    list.forEach(q=>{
      const div=document.createElement("div");
      div.className="thumbWrap";
      div.innerHTML=`<img src="${q.thumb}" onclick="downloadQSL('${q.public_id}')">`;
      box.appendChild(div);
    });
  }catch{box.innerHTML="Erreur";}
}

// POPUP
function showPopup(msg){document.getElementById("popup-message").innerText=msg; document.getElementById("popup").classList.remove("hidden");}
function closePopup(){document.getElementById("popup").classList.add("hidden");}

// DOWNLOAD
async function downloadQSL(pid){
  try{
    const res=await fetch(API_URL+"/file?pid="+encodeURIComponent(pid));
    const data=await res.json();
    if(!data.success){showPopup("❌ Téléchargement impossible"); return;}
    const link=document.createElement("a");
    link.href=`data:${data.type};base64,${data.file}`;
    link.download=data.filename;
    document.body.appendChild(link); link.click(); link.remove();
    if(data.last){showPopup("⚠️ Dernier téléchargement !");}
    else{showPopup("✅ Téléchargement réussi");}
  }catch(err){console.error(err); showPopup("❌ Erreur réseau");}
}

// AUTO NOUVELLE QSL 🔔
async function checkNewQSL(){
  if(!window.isAuthenticated) return;
  const res=await fetch(API_URL+"/download/"+document.getElementById("dlCall").value.trim().toUpperCase());
  const list=await res.json();
  if(list.length>0) showPopup("🔔 Nouvelle QSL disponible !");
}

// IMPORT / GENERATE / BULK UPLOAD
// ... tu peux réutiliser ton code existant avec la barre de progression et preview ...

checkAuth();
showTab("home");
setInterval(checkNewQSL, 30000); // toutes les 30s
