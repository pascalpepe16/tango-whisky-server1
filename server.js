// ==========================// ===============================
// CONFIG
// ===============================
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;

// ===============================
// AUTH / SESSION
// ===============================
async function checkAuth() {
  try {
    const res = await fetch("/check-auth", { credentials: "same-origin" });
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
  } catch (err) {
    console.error("checkAuth error", err);
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");

  errBox.innerText = "";

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });

    if (!res.ok) {
      errBox.innerText = "Identifiants incorrects";
      return;
    }

    await checkAuth();
    showTab("home");
  } catch (err) {
    errBox.innerText = "Erreur réseau";
  }
}

function logout() {
  window.location.href = "/logout";
}

// ===============================
// NAVIGATION
// ===============================
function showTab(id) {

  const protectedTabs = ["gallery", "create"];

  if (protectedTabs.includes(id) && !window.isAuthenticated) {
    showTab("home");
    return;
  }

  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );

  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");

  if (id === "gallery") loadGallery();
}

// ===============================
// GALLERY
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement…";

  try {
    const res = await fetch(API_URL + "/qsl", {
      credentials: "same-origin"
    });

    const list = await res.json();

    if (!Array.isArray(list) || !list.length) {
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "thumbWrap";
      div.innerHTML = `<img src="${q.thumb}">`;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = "Erreur réseau";
  }
}

// ===============================
// IMPORT CSV / EXCEL
// ===============================
function processFile() {
  const file = document.getElementById("importFile").files[0];
  const status = document.getElementById("importStatus");
  const previewArea = document.getElementById("previewArea");

  if (!file) {
    status.innerHTML = "Choisissez un fichier";
    return;
  }

  const normalizeRow = row => ({
    Indicatif: (row.indicatif || row.Indicatif || "").trim(),
    Date: (row.date || row.Date || "").trim(),
    Heure: (row.heure || row.Heure || "").trim(),
    Bande: (row.bande || row.Bande || "").trim(),
    Report: (row.report || row.Report || "").trim(),
    Mode: (row.mode || row.Mode || "").trim(),
    Note: (row.note || row.Note || "").trim()
  });

  const showPreview = () => {
    previewArea.innerHTML = "";
    importedLogs.slice(0, 10).forEach(row => {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${row.Indicatif}</strong> ${row.Date} ${row.Heure}`;
      previewArea.appendChild(div);
    });
  };

  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws);

    importedLogs = raw
      .map(normalizeRow)
      .filter(row => row.Indicatif !== "");

    status.innerHTML = `${importedLogs.length} lignes valides chargées`;
    showPreview();
    document.getElementById("validateImportBtn").style.display = "inline-block";
  };
  reader.readAsArrayBuffer(file);
}

// ===============================
// VALIDATION IMPORT + PROGRESSION
// ===============================
document.getElementById("validateImportBtn").onclick = async function () {

  const imageInput = document.getElementById("bulkImage");
  const status = document.getElementById("importStatus");
  const progress = document.getElementById("progressContainer");
  const bar = document.getElementById("progressBar");

  progress.style.display = "block";
  bar.style.width = "0%";

  let success = 0;

  for (let i = 0; i < importedLogs.length; i++) {

    const row = importedLogs[i];
    const formData = new FormData();

    formData.append("indicatif", row.Indicatif);
    formData.append("date", row.Date);
    formData.append("time", row.Heure);
    formData.append("band", row.Bande);
    formData.append("report", row.Report);
    formData.append("mode", row.Mode);
    formData.append("note", row.Note);
    formData.append("qsl", imageInput.files[0]);

    try {
      const res = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      const data = await res.json();
      if (data.success) success++;
    } catch (err) {}

    const percent = Math.round(((i + 1) / importedLogs.length) * 100);
    bar.style.width = percent + "%";
    status.innerHTML = `Traitement ${i + 1}/${importedLogs.length}`;
  }

  status.innerHTML = `✅ ${success} QSL enregistrées`;
};
// ===============================
// DOWNLOAD SEARCH
// ===============================
document.getElementById("btnSearch").onclick = async () => {
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");

  if (!call) {
    alert("Entrer un indicatif");
    return;
  }

  box.innerHTML = "Recherche…";

  try {
    const res = await fetch(API_URL + "/download/" + call);
    const list = await res.json();

    if (!list.length) {
      box.innerHTML = "Aucune QSL trouvée";
      return;
    }

    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "dlWrap";
      div.innerHTML = `
        <img src="${q.thumb}" class="dlThumb">
        <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = "Erreur réseau";
  }
};

function downloadQSL(pid) {
  const a = document.createElement("a");
  a.href = API_URL + "/file?pid=" + encodeURIComponent(pid);
  a.click();
}



// ===============================
// INIT
// ===============================
checkAuth();
showTab("home");

===================
//  TANGO WHISKY — SERVER.JS COMPLET
// =============================================

import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import sharp from "sharp";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import fs from "fs";

// ================= CONFIG =================
const MAX_DOWNLOADS = 2;
const MAX_DAYS = 30;

// ================= INIT =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));
app.use(express.static(path.join(__dirname, "public")));

// ================= SESSION =================
app.use(
session({
name: "tw-session",
secret: process.env.SESSION_SECRET || "tw-whisky-secret",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
sameSite: "lax"
}
})
);

// ================= USERS =================
const USERS = JSON.parse(
fs.readFileSync(path.join(__dirname, "users.json"), "utf8")
);

// ================= DOWNLOAD TRACKING =================
const DOWNLOADS_PATH = path.join(__dirname, "downloads.json");

function readDownloads() {
if (!fs.existsSync(DOWNLOADS_PATH)) return {};
return JSON.parse(fs.readFileSync(DOWNLOADS_PATH, "utf8"));
}

function saveDownloads(data) {
fs.writeFileSync(DOWNLOADS_PATH, JSON.stringify(data, null, 2));
}

function isExpired(entry) {
const ageMs = Date.now() - entry.createdAt;
return ageMs >= MAX_DAYS * 24 * 60 * 60 * 1000;
}

// ================= AUTH =================
function requireAuth(req, res, next) {
if (req.session?.authenticated) return next();
res.status(401).json({ error: "Non autorisé" });
}

app.post("/login", (req, res) => {
const { indicatif, password } = req.body || {};

if (USERS[indicatif] && USERS[indicatif] === password) {
req.session.authenticated = true;
req.session.indicatif = indicatif;
return res.json({ success: true });
}

res.status(401).json({ success: false });
});

app.get("/logout", (req, res) => {
req.session.destroy(() => res.redirect("/"));
});

app.get("/check-auth", (req, res) => {
res.json({
authenticated: !!req.session?.authenticated,
indicatif: req.session?.indicatif || null
});
});

// ================= CLOUDINARY =================
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

// ================= HELPERS =================
function escapeXml(str = "") {
return String(str)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function wrapText(text = "", max = 32) {
const words = text.split(/\s+/);
const lines = [];
let line = "";

for (const w of words) {
if ((line + " " + w).trim().length > max) {
if (line) lines.push(line);
line = w;
} else {
line = (line + " " + w).trim();
}
}

if (line) lines.push(line);
return lines;
}

function parseContext(ctx) {
if (!ctx || !ctx.custom || !ctx.custom.entry) return {};
return ctx.custom.entry.split("|").reduce((acc, p) => {
const [k, ...rest] = p.split("=");
acc[k] = decodeURIComponent(rest.join("="));
return acc;
}, {});
}

// ================= GALERIE =================
app.get("/qsl", requireAuth, async (req, res) => {
try {
const result = await cloudinary.search
.expression("folder:TW-eQSL")
.sort_by("created_at", "desc")
.max_results(200)
.execute();

```
res.json(result.resources.map(r => ({
  public_id: r.public_id,
  url: r.secure_url,
  thumb: r.secure_url.replace("/upload/", "/upload/w_300/")
})));
```

} catch (err) {
console.error(err);
res.status(500).json([]);
}
});

// ================= RECHERCHE =================
app.get("/download/:call", async (req, res) => {
try {
const call = req.params.call.toUpperCase();

```
const result = await cloudinary.search
  .expression(`folder:TW-eQSL AND tags=indicatif_${call}`)
  .max_results(100)
  .execute();

const list = result.resources.map(r => ({
  public_id: r.public_id,
  url: r.secure_url,
  thumb: r.secure_url.replace("/upload/", "/upload/w_300/")
}));

res.json(list);
```

} catch (err) {
console.error(err);
res.status(500).json([]);
}
});

// ================= UPLOAD =================
app.post("/upload", requireAuth, async (req, res) => {
try {
if (!req.files || !req.files.qsl) {
return res.status(400).json({ success: false, error: "Aucune image reçue" });
}

```
const file = req.files.qsl;
const indicatif = (req.body.indicatif || "").toUpperCase();
const date = req.body.date || "";
const time = req.body.time || "";
const band = req.body.band || "";
const mode = req.body.mode || "";
const report = req.body.report || "";
const note = req.body.note || "";
const template = req.body.template || "classic";

// image toujours en 820x410
const finalImage = await sharp(file.tempFilePath)
  .resize(820, 410, { fit: "cover", position: "center" })
  .toBuffer();

let finalBuffer;

// ================= MODERNE =================
if (template === "modern") {
  const svg = `
```

<svg width="820" height="410" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="black" opacity="0.35"/>
  <text x="30" y="80" font-size="60" fill="white" font-weight="bold">
    ${escapeXml(indicatif)}
  </text>
  <text x="30" y="130" font-size="24" fill="white">
    ${escapeXml(date)} ${escapeXml(time)} UTC
  </text>
  <text x="30" y="170" font-size="24" fill="white">
    ${escapeXml(band)} ${escapeXml(mode)} RST ${escapeXml(report)}
  </text>
  <text x="30" y="210" font-size="20" fill="white">
    ${escapeXml(note)}
  </text>
</svg>
`;

```
  finalBuffer = await sharp(finalImage)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

} else {
  // ================= CLASSIQUE =================
  const panelWidth = 350;
  const noteLines = wrapText(note, 32);

  const noteSVG = noteLines
    .map((line, i) =>
      `<tspan x="20" dy="${i === 0 ? 0 : 22}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const panelSVG = `
```

<svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="410">
  <rect width="100%" height="100%" fill="#f4f4f4"/>
  <text x="20" y="50" font-size="36" font-weight="bold">
    ${escapeXml(indicatif)}
  </text>
  <text x="20" y="90">Date : ${escapeXml(date)}</text>
  <text x="20" y="120">UTC : ${escapeXml(time)}</text>
  <text x="20" y="150">Bande : ${escapeXml(band)}</text>
  <text x="20" y="180">Mode : ${escapeXml(mode)}</text>
  <text x="20" y="210">RST : ${escapeXml(report)}</text>
  <text x="20" y="240">${noteSVG}</text>
</svg>
`;

```
  const panelBuffer = await sharp(Buffer.from(panelSVG))
    .png()
    .toBuffer();

  finalBuffer = await sharp({
    create: {
      width: 820 + panelWidth,
      height: 410,
      channels: 3,
      background: "#fff"
    }
  })
    .composite([
      { input: finalImage, top: 0, left: 0 },
      { input: panelBuffer, top: 0, left: 820 }
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

// ================= UPLOAD CLOUDINARY =================
cloudinary.uploader.upload_stream(
  {
    folder: "TW-eQSL",
    tags: [`indicatif_${indicatif}`]
  },
  (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    res.json({
      success: true,
      qsl: {
        public_id: result.public_id,
        url: result.secure_url,
        thumb: result.secure_url.replace("/upload/", "/upload/w_300/")
      }
    });
  }
).end(finalBuffer);
```

} catch (err) {
console.error("UPLOAD ERROR:", err);
res.status(500).json({ success: false, error: err.message });
}
});

// ================= DOWNLOAD FILE =================
app.get("/file", async (req, res) => {
try {
const pid = req.query.pid;
if (!pid) return res.status(400).send("missing pid");

```
const info = await cloudinary.api.resource(pid);
const file = await axios.get(info.secure_url, { responseType: "arraybuffer" });

res.setHeader("Content-Type", `image/${info.format}`);
res.send(Buffer.from(file.data));
```

} catch (err) {
console.error(err);
res.status(500).send("Erreur téléchargement");
}
});

// ================= SPA =================
app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public/index.html"));
});

// ================= START =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
console.log("TW-eQSL server running on port", PORT)
);
