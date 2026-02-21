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
return `     <div class="qsl-card">       <div class="qsl-image">         <img src="${imageUrl}">       </div>       <div class="qsl-text">         <h3>${data.indicatif || data.Indicatif || ''}</h3>         <p>Date: ${data.date || data.Date || ''}</p>         <p>Heure: ${data.time || data.Heure || ''}</p>         <p>Bande: ${data.band || data.Bande || ''}</p>         <p>Mode: ${data.mode || data.Mode || ''}</p>         <p>Report: ${data.report || data.Report || ''}</p>         <p>${data.note || data.Note || ''}</p>       </div>     </div>
  `;
}

// ===============================
// IMAGE RESIZE / COMPRESSION POUR CLOUDYNARI
// ===============================
function resizeAndCompressImage(file, maxWidth = 1200) {
return new Promise((resolve) => {
const img = new Image();
img.src = URL.createObjectURL(file);
img.onload = () => {
const scale = Math.min(1, maxWidth / img.width);
const canvas = document.createElement('canvas');
canvas.width = img.width * scale;
canvas.height = img.height * scale;
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
};
});
}

// ===============================
// BULK UPLOAD MODIFIÉ POUR CLOUDYNARI
// ===============================
document.getElementById("validateImportBtn").onclick=async function(){
const imageInput=document.getElementById("bulkImage");
if(!imageInput.files[0]){ alert("Choisissez une image QSL"); return; }
const compressedImage = await resizeAndCompressImage(imageInput.files[0]);

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
formData.append("qsl",compressedImage, imageInput.files[0].name);

```
try{
  const res=await fetch(API_URL+"/upload",{method:"POST",body:formData,credentials:"same-origin"});
  const data=await res.json(); if(data.success) success++;
}catch(err){}
const percent=Math.round(((i+1)/importedLogs.length)*100);
bar.style.width=percent+"%";
status.innerHTML=`Traitement ${i+1}/${importedLogs.length}`;
```

}
status.innerHTML=`✅ ${success} QSL enregistrées`;
};

// ===============================
// GENERATION QSL UNITAIRE MODIFIÉE POUR CLOUDYNARI
// ===============================
document.getElementById("genForm").addEventListener("submit",async e=>{
e.preventDefault();
const form=e.target;
const preview=document.getElementById("genPreview");
const formData=new FormData(form);
const imgFile=formData.get("qsl");
const data=Object.fromEntries(formData.entries());

const compressedImg = await resizeAndCompressImage(imgFile);
const imgURL = URL.createObjectURL(compressedImg);
preview.innerHTML = generateQSLPreview(data,imgURL);
formData.set("qsl", compressedImg, imgFile.name);

fetch(API_URL+"/upload",{method:"POST",body:formData,credentials:"same-origin"}).catch(()=>{});
});
