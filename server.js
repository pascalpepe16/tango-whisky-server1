// =============================================
//  TANGO WHISKY — SERVER.JS (FINAL AJUSTÉ)
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
const MAX_DOWNLOADS = 2; // ⬅️ téléchargements max
const MAX_DAYS = 30;      // ⬅️ durée de vie en jours

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  return lines; // ✅ TABLEAU
}

function parseContext(ctx) {
  if (!ctx || !ctx.custom || !ctx.custom.entry) return {};
  return ctx.custom.entry.split("|").reduce((acc, p) => {
    const [k, ...rest] = p.split("=");
    acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

// ================= GALERIE (PROTÉGÉE) =================
app.get("/qsl", requireAuth, async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:TW-eQSL")
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(200)
      .execute();

    res.json(result.resources.map(r => ({
      public_id: r.public_id,
      url: r.secure_url,
      thumb: r.secure_url.replace("/upload/", "/upload/w_300/")
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ================= RECHERCHE + INFOS RESTANTES =================
app.get("/download/:call", async (req, res) => {
  try {
    const call = req.params.call.toUpperCase();
    const downloads = readDownloads();

    const result = await cloudinary.search
      .expression(`folder:TW-eQSL AND tags=indicatif_${call}`)
      .max_results(100)
      .execute();

    const list = result.resources.map(r => {
      const entry = downloads[r.public_id];

      const remainingDownloads = entry
        ? Math.max(0, MAX_DOWNLOADS - entry.count)
        : MAX_DOWNLOADS;

      const remainingDays = entry
        ? Math.max(
            0,
            MAX_DAYS - Math.floor((Date.now() - entry.createdAt) / 86400000)
          )
        : MAX_DAYS;

      return {
        public_id: r.public_id,
        url: r.secure_url,
        thumb: r.secure_url.replace("/upload/", "/upload/w_300/"),
        remainingDownloads,
        remainingDays
      };
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ================= UPLOAD (PROTÉGÉ) =================
app.post("/upload", requireAuth, async (req, res) => {
  try {
    if (!req.files || !req.files.qsl) {
      return res.status(400).json({ success: false, error: "Aucune image reçue" });
    }

    const file = req.files.qsl;
    const indicatif = (req.body.indicatif || "").toUpperCase();
    const date = req.body.date || "";
    const time = req.body.time || "";
    const band = req.body.band || "";
    const mode = req.body.mode || "";
    const report = req.body.report || "";
    let noteLines = wrapText(req.body.note || "", 32);

    const input = sharp(file.tempFilePath);
    const meta = await input.metadata();
    const W = meta.width;
    const H = meta.height;
    const panelWidth = 350;

    const userBuffer = await sharp(file.tempFilePath).toBuffer();

    // ================= Hauteur et police dynamiques =================
    const headerHeight = 80;
    const infoHeight = 6 * 35; // 6 lignes d’infos
    const footerHeight = 40;
    const maxPanelHeight = 600; // hauteur max raisonnable
    let fontSize = 22; // taille initiale du texte note
    let noteHeight = noteLines.length * fontSize + 20;
    let panelHeight = Math.max(H, headerHeight + infoHeight + noteHeight + footerHeight);

    // Si trop grand, réduire la taille de la police
    while (panelHeight > maxPanelHeight && fontSize > 10) {
      fontSize -= 2;
      noteHeight = noteLines.length * fontSize + 20;
      panelHeight = Math.max(H, headerHeight + infoHeight + noteHeight + footerHeight);
    }

    // ================= Génération du SVG =================
    const startY = headerHeight + infoHeight + 10;
    const noteSVG = noteLines
      .map((line, i) =>
        `<tspan x="20" ${i === 0 ? `y="${startY}"` : `dy="${fontSize}"`}>${escapeXml(line)}</tspan>`
      )
      .join("");

    const panelSVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="${panelHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f9f9f9"/>
      <stop offset="100%" stop-color="#eeeeee"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="100%" height="${headerHeight}" fill="#1f2937"/>
  <text x="20" y="55" font-size="42" fill="white" font-weight="bold">
    ${escapeXml(indicatif)}
  </text>

  <line x1="20" y1="${headerHeight + 30}" x2="${panelWidth - 20}" y2="${headerHeight + 30}" stroke="#ccc"/>

  <text x="20" y="${headerHeight + 70}" font-size="24">Date : ${escapeXml(date)}</text>
  <text x="20" y="${headerHeight + 105}" font-size="24">UTC : ${escapeXml(time)}</text>
  <text x="20" y="${headerHeight + 140}" font-size="24">Bande : ${escapeXml(band)}</text>
  <text x="20" y="${headerHeight + 175}" font-size="24">Mode : ${escapeXml(mode)}</text>
  <text x="20" y="${headerHeight + 210}" font-size="24">Report : ${escapeXml(report)}</text>

  <line x1="20" y1="${headerHeight + 245}" x2="${panelWidth - 20}" y2="${headerHeight + 245}" stroke="#ccc"/>

  <text x="20" font-size="${fontSize}">
    ${noteSVG}
  </text>

  <text x="20" y="${panelHeight - 20}" font-size="14" fill="#555">
    TANGO WHISKY eQSL
  </text>
</svg>
`;

    // ================= Rasterisation et composition =================
    const panelBuffer = await sharp(Buffer.from(panelSVG)).png().toBuffer();

    const finalBuffer = await sharp({
      create: {
        width: W + panelWidth,
        height: Math.max(H, panelHeight),
        channels: 3,
        background: "#fff"
      }
    })
      .composite([
        { input: userBuffer, top: 0, left: 0 },
        { input: panelBuffer, top: 0, left: W }
      ])
      .jpeg({ quality: 92 })
      .toBuffer();

    // ================= Upload Cloudinary =================
    cloudinary.uploader.upload_stream(
      {
        folder: "TW-eQSL",
        tags: [`indicatif_${indicatif}`],
        context: { indicatif, date, time, band, mode, report, note: noteLines.join(" ") }
      },
      (err, result) => {
        if (err) {
          console.error("UPLOAD ERROR:", err);
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

  } catch (err) {
    console.error("UPLOAD FATAL:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ================= FILE DOWNLOAD + AUTO DELETE =================
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).send("missing pid");

    const downloads = readDownloads();

    if (!downloads[pid]) {
      downloads[pid] = { count: 0, createdAt: Date.now() };
    }

    const entry = downloads[pid];

    if (isExpired(entry) || entry.count >= MAX_DOWNLOADS) {
      await cloudinary.uploader.destroy(pid);
      delete downloads[pid];
      saveDownloads(downloads);
      return res.status(410).send("QSL expirée");
    }

    entry.count += 1;

    const info = await cloudinary.api.resource(pid);
    const ctx = parseContext(info.context);

    const file = await axios.get(info.secure_url, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", `image/${info.format}`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ctx.indicatif || "QSL"}_${ctx.date}.${info.format}"`
    );
    res.send(Buffer.from(file.data));

    if (entry.count >= MAX_DOWNLOADS) {
      await cloudinary.uploader.destroy(pid);
      delete downloads[pid];
    }

    saveDownloads(downloads);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur téléchargement");
  }
});

// ================= SPA FALLBACK =================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ================= START =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("TW-eQSL server running on port", PORT)
);
