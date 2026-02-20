const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// QSL PREVIEW
// ===============================
function generateQSLPreview(data, imageUrl) {
  return `
    <div class="qsl-card">
      <div class="qsl-image">
        <img src="${imageUrl}">
      </div>
      <div class="qsl-text">
        <h3>${data.indicatif || data.Indicatif || ''}</h3>

        <div class="line"><span>Date</span><span>${data.date || data.Date || ''}</span></div>
        <div class="line"><span>Heure</span><span>${data.time || data.Heure || ''}</span></div>
        <div class="line"><span>Bande</span><span>${data.band || data.Bande || ''}</span></div>
        <div class="line"><span>Mode</span><span>${data.mode || data.Mode || ''}</span></div>
        <div class="line"><span>Report</span><span>${data.report || data.Report || ''}</span></div>

        <div style="margin-top:10px;">
          ${data.note || data.Note || ''}
        </div>
      </div>
    </div>
  `;
}

// ===============================
// DOWNLOAD IDENTIQUE AU PREVIEW
// ===============================
function downloadElementAsImage(element) {
  html2canvas(element, {
    scale: 3,
    useCORS: true
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "qsl.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

function downloadSameRender(image, indicatif, date, time, band, mode, report, note) {

  const temp = document.createElement("div");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";

  const data = { indicatif, date, time, band, mode, report, note };

  temp.innerHTML = generateQSLPreview(data, image);

  document.body.appendChild(temp);

  const card = temp.querySelector(".qsl-card");

  downloadElementAsImage(card);

  document.body.removeChild(temp);
}

// ===============================
// DOWNLOAD SEARCH
// ===============================
document.getElementById("btnSearch").onclick = async () => {
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");

  if (!call) return;

  box.innerHTML = "Recherche…";

  const res = await fetch(API_URL + "/download/" + call);
  const list = await res.json();

  box.innerHTML = "";

  list.forEach(q => {
    const div = document.createElement("div");

    div.innerHTML = `
      <img src="${q.thumb}" class="dlThumb">
      <button onclick="downloadSameRender(
        '${q.image}',
        '${q.indicatif}',
        '${q.date}',
        '${q.time}',
        '${q.band}',
        '${q.mode}',
        '${q.report}',
        '${q.note}'
      )">Télécharger</button>
    `;

    box.appendChild(div);
  });
};
