```javascript
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
// ✅ GALLERY CORRIGÉE (AVEC TEXTE)
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
      const div=document.createElement("div");
      div.className="qsl-card";

      div.innerHTML=`
        <div class="qsl-image">
          <img src="${q.thumb}">
        </div>
        <div class="qsl-text">
          <h3>${q.data?.indicatif || ""}</h3>
          <p>Date: ${q.data?.date || ""}</p>
          <p>Heure: ${q.data?.time || ""}</p>
          <p>Bande: ${q.data?.band || ""}</p>
          <p>Mode: ${q.data?.mode || ""}</p>
          <p>Report: ${q.data?.report || ""}</p>
          <p>${q.data?.note || ""}</p>
        </div>
      `;

      box.appendChild(div);
    });

  }catch(err){
    box.innerHTML="Erreur réseau";
  }
}

// ===============================
// GENERATION QSL UNITAIRE
// ===============================
document.getElementById("genForm").addEventListener("submit",async e=>{
  e.preventDefault();

  const form=e.target;
  const preview=document.getElementById("genPreview");
  const formData=new FormData(form);

  const imgFile=formData.get("qsl");
  const data=Object.fromEntries(formData.entries());
  const imgURL=URL.createObjectURL(imgFile);

  preview.innerHTML=generateQSLPreview(data,imgURL);

  await new Promise(r=>setTimeout(r,300));

  const card = preview.querySelector(".qsl-card");

  const canvas = await html2canvas(card, {scale:2});
  
  canvas.toBlob(async blob=>{
    const newFormData = new FormData();

    newFormData.append("indicatif", data.indicatif);
    newFormData.append("date", data.date);
    newFormData.append("time", data.time);
    newFormData.append("band", data.band);
    newFormData.append("report", data.report);
    newFormData.append("mode", data.mode);
    newFormData.append("note", data.note);

    newFormData.append("qsl", blob, "qsl.png");

    await fetch(API_URL+"/upload",{
      method:"POST",
      body:newFormData,
      credentials:"same-origin"
    });
  });
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
```
