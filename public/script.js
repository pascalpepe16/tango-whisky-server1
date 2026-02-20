const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

/* ===============================
   PREVIEW
=============================== */
function generateQSLPreview(data, imageUrl) {
  return `
    <div class="qsl-card">
      <div class="qsl-image">
        <img src="${imageUrl}">
      </div>
      <div class="qsl-text">
        <b>${data.Indicatif || data.indicatif || ''}</b><br>
        ${data.Date || ''}<br>
        ${data.Heure || ''}<br>
        ${data.Bande || ''}<br>
        ${data.Mode || ''}<br>
        ${data.Report || ''}<br>
      </div>
    </div>
  `;
}

/* ===============================
   AUTH
=============================== */
async function checkAuth(){
  try{
    const res = await fetch(API_URL+"/check-auth",{credentials:"same-origin"});
    const data = await res.json();
    window.isAuthenticated = data.authenticated === true;

    document.getElementById("loginBox").style.display = window.isAuthenticated ? "none":"block";
    document.getElementById("btnGallery").style.display = window.isAuthenticated ? "inline-block":"none";
    document.getElementById("btnCreate").style.display = window.isAuthenticated ? "inline-block":"none";
    document.getElementById("logoutBtn").style.display = window.isAuthenticated ? "inline-block":"none";

  }catch(e){console.log(e);}
}

async function login(){
  const indicatif = document.getElementById("loginIndicatif").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(API_URL+"/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({indicatif,password})
  });

  if(!res.ok){
    document.getElementById("loginError").innerText="Erreur login";
    return;
  }

  checkAuth();
}

function logout(){
  window.location.href = API_URL+"/logout";
}

/* ===============================
   NAV
=============================== */
function showTab(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

/* ===============================
   CREATE
=============================== */
document.getElementById("genForm").addEventListener("submit",e=>{
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const img = URL.createObjectURL(formData.get("qsl"));

  const html = generateQSLPreview(data,img);

  document.getElementById("genPreview").innerHTML = html;
});

/* ===============================
   DOWNLOAD IDENTIQUE PREVIEW
=============================== */
function downloadElement(el){
  html2canvas(el,{scale:3,useCORS:true}).then(canvas=>{
    const a = document.createElement("a");
    a.href = canvas.toDataURL();
    a.download="qsl.png";
    a.click();
  });
}

/* ===============================
   SEARCH + DOWNLOAD
=============================== */
document.getElementById("btnSearch").onclick = async ()=>{
  const call = document.getElementById("dlCall").value;
  const box = document.getElementById("dlPreview");

  const res = await fetch(API_URL+"/download/"+call);
  const list = await res.json();

  box.innerHTML="";

  list.forEach(q=>{
    const div = document.createElement("div");

    div.innerHTML = `
      <img src="${q.thumb}" width="200">
      <button>Download</button>
    `;

    div.querySelector("button").onclick = ()=>{
      const temp = document.createElement("div");
      temp.innerHTML = generateQSLPreview(q, q.image);
      document.body.appendChild(temp);

      downloadElement(temp.querySelector(".qsl-card"));

      document.body.removeChild(temp);
    };

    box.appendChild(div);
  });
};

checkAuth();
showTab("home");
