const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

/* PREVIEW */
function generateQSLPreview(data, imageUrl) {
  return `
    <div class="qsl-card">
      <div class="qsl-image">
        <img src="${imageUrl}">
      </div>
      <div class="qsl-text">
        <h3>${data.indicatif || ''}</h3>
        <p>${data.date || ''}</p>
        <p>${data.time || ''}</p>
        <p>${data.band || ''}</p>
        <p>${data.mode || ''}</p>
        <p>${data.report || ''}</p>
      </div>
    </div>
  `;
}

/* NAV */
function showTab(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

/* LOGIN */
async function login(){
  const indicatif=document.getElementById("loginIndicatif").value;
  const password=document.getElementById("loginPassword").value;

  const res=await fetch(API_URL+"/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({indicatif,password})
  });

  if(res.ok){
    document.getElementById("loginBox").style.display="none";
    document.getElementById("btnGallery").style.display="inline-block";
    document.getElementById("btnCreate").style.display="inline-block";
    document.getElementById("logoutBtn").style.display="inline-block";
  } else {
    document.getElementById("loginError").innerText="Erreur login";
  }
}

function logout(){
  window.location.href="/logout";
}

/* IMPORT */
function processFile(){
  const file=document.getElementById("importFile").files[0];
  const img=document.getElementById("bulkImage").files[0];
  const imgURL=URL.createObjectURL(img);

  Papa.parse(file,{
    header:true,
    complete:function(results){
      importedLogs=results.data;
      const box=document.getElementById("previewArea");
      box.innerHTML="";
      importedLogs.slice(0,10).forEach(r=>{
        box.innerHTML+=generateQSLPreview(r,imgURL);
      });
    }
  });
}

/* GENERATE */
document.getElementById("genForm").addEventListener("submit",e=>{
  e.preventDefault();

  const formData=new FormData(e.target);
  const img=formData.get("qsl");
  const url=URL.createObjectURL(img);
  const data=Object.fromEntries(formData.entries());

  document.getElementById("genPreview").innerHTML=
    generateQSLPreview(data,url);

  fetch(API_URL+"/upload",{method:"POST",body:formData});
});

/* SEARCH FIX */
document.getElementById("btnSearch").addEventListener("click", async ()=>{
  const call=document.getElementById("dlCall").value;
  const box=document.getElementById("dlPreview");

  const res=await fetch(API_URL+"/download/"+call);
  const list=await res.json();

  box.innerHTML="";

  list.forEach(q=>{
    box.innerHTML+=`
      <div class="dlWrap">
        <img src="${q.thumb}" class="dlThumb">
        <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
      </div>
    `;
  });
});

function downloadQSL(id){
  window.open(API_URL+"/file?pid="+id);
}
