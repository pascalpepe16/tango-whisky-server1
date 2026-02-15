// =============================================
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
