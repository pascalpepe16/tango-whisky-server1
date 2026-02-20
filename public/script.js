const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// =================== QSL PREVIEW ===================
function generateQSLPreview(data, imageUrl) {
  return `
  <div class="qsl-card">
    <div class="qsl-image">
      <img src="${imageUrl}">
    </div>
    <div class="qsl-text">
      <h3>${data.indicatif || data.Indicatif || ''}</h3>
      <p>${data.date || data.Date || ''}</p>
      <p>${data.mode || data.Mode || ''}</p>
    </div>
  </div>`;
}

// =================== AUTH ===================
async function checkAuth() {
  try {
    const res = await fetch(API_URL + "/check-auth", { credentials: "same-origin" });
    const data = await res.json();
    window.isAuthenticated = data.authenticated;

    document.getElementById("btnGallery").style.display = window.isAuthenticated ? "inline-block" : "none";
    document.getElementById("btnCreate").style.display = window.isAuthenticated ? "inline-block" : "none";
  } catch {}
}

// =================== NAV ===================
function showTab(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if(id==="gallery") loadGallery();
}

// =================== GALERIE FIX ===================
async function loadGallery(){
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement...";

  try{
    const res = await fetch(API_URL + "/qsl");
    const list = await res.json();

    if(!list.length){
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";

    list.forEach(q=>{
      const div = document.createElement("div");
      div.className = "thumbWrap";

      div.innerHTML = `
        <img src="${q.thumb}" onclick="window.open('${q.image || q.thumb}','_blank')">
      `;

      box.appendChild(div);
    });

  }catch(err){
    box.innerHTML = "Erreur";
  }
}

// =================== IMPORT ===================
function processFile(){
  const file = document.getElementById("importFile").files[0];
  const img = document.getElementById("bulkImage").files[0];
  const imgURL = img ? URL.createObjectURL(img) : "";

  Papa.parse(file,{
    header:true,
    complete:(res)=>{
      importedLogs = res.data;

      document.getElementById("previewArea").innerHTML =
        importedLogs.slice(0,5).map(r=>generateQSLPreview(r,imgURL)).join("");

      document.getElementById("validateImportBtn").style.display="inline-block";
    }
  });
}

// =================== PROGRESS FIX ===================
document.getElementById("validateImportBtn").onclick = async ()=>{
  const bar = document.getElementById("progressBar");
  let total = importedLogs.length;

  for(let i=0;i<total;i++){
    bar.style.width = ((i+1)/total*100)+"%";
    await new Promise(r=>setTimeout(r,50));
  }
};

// =================== CREATE ===================
document.getElementById("genForm").addEventListener("submit",e=>{
  e.preventDefault();
  const formData = new FormData(e.target);
  const img = formData.get("qsl");

  document.getElementById("genPreview").innerHTML =
    generateQSLPreview(Object.fromEntries(formData), URL.createObjectURL(img));
});

// =================== DOWNLOAD ===================
document.getElementById("btnSearch").onclick = async ()=>{
  const call = document.getElementById("dlCall").value;

  const res = await fetch(API_URL+"/download/"+call);
  const list = await res.json();

  document.getElementById("dlPreview").innerHTML =
    list.map(q=>`<img src="${q.thumb}" class="dlThumb">`).join("");
};

// =================== INIT ===================
checkAuth();
showTab("home");
