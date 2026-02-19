const API_URL = location.origin;
let importedLogs = [];

// ================= NAV =================
function showTab(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// ================= QSL PREVIEW =================
function generateQSLPreview(data, imageUrl){
  return `
  <div class="qsl-card">
    <div class="qsl-image">
      <img src="${imageUrl}">
    </div>
    <div class="qsl-text">
      <h3>${data.indicatif || data.Indicatif || ''}</h3>
      <p>${data.date || ''}</p>
      <p>${data.time || ''}</p>
      <p>${data.band || ''}</p>
      <p>${data.mode || ''}</p>
      <p>${data.report || ''}</p>
      <p>${data.note || ''}</p>
    </div>
  </div>`;
}

// ================= CREATE =================
document.getElementById("genForm").addEventListener("submit", e=>{
  e.preventDefault();

  const form = new FormData(e.target);
  const file = form.get("qsl");

  const url = URL.createObjectURL(file);

  document.getElementById("genPreview").innerHTML =
    generateQSLPreview(Object.fromEntries(form), url);

  fetch(API_URL+"/upload",{method:"POST",body:form});
});

// ================= IMPORT =================
function processFile(){
  const file = document.getElementById("importFile").files[0];
  const img = document.getElementById("bulkImage").files[0];
  const imgURL = URL.createObjectURL(img);

  Papa.parse(file,{
    header:true,
    complete:res=>{
      importedLogs = res.data;

      document.getElementById("previewArea").innerHTML =
        importedLogs.slice(0,5)
          .map(r=>generateQSLPreview(r,imgURL))
          .join("");
    }
  });
}

// ================= BULK =================
document.getElementById("validateImportBtn").onclick = async ()=>{
  const bar = document.getElementById("progressBar");

  for(let i=0;i<importedLogs.length;i++){
    bar.style.width = (i/importedLogs.length*100)+"%";

    await fetch(API_URL+"/upload",{method:"POST"});
  }

  bar.style.width="100%";
};

// ================= DOWNLOAD =================
document.getElementById("btnSearch").onclick = async ()=>{
  const call = document.getElementById("dlCall").value;

  const res = await fetch(API_URL+"/download/"+call);
  const list = await res.json();

  const box = document.getElementById("dlPreview");

  box.innerHTML = list.map(q=>`
    <img src="${q.thumb}" width="120">
  `).join("");
};
