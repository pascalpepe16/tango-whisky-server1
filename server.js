// =============================================
//  TANGO WHISKY — SERVER.JS (VERSION FINALE PRO)
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
    cookie: { httpOnly: true, sameSite: "lax" }
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
  return Date.now() - entry.createdAt >= MAX_DAYS * 24 * 60 * 60 * 1000;
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

// ================= DOWNLOAD INFO =================
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
      const remainingDownloads = entry ? Math.max(0, MAX_DOWNLOADS - entry.count) : MAX_DOWNLOADS;
      const remainingDays = entry ? Math.max(0, MAX_DAYS - Math.floor((Date.now() - entry.createdAt) / 86400000)) : MAX_DAYS;
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

// ================= GENERATE QSL BUFFER =================
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {
  const PANEL_WIDTH = 350;
  const IMG_WIDTH = 470;
  const IMG_HEIGHT = 410;
  const TOTAL_WIDTH = IMG_WIDTH + PANEL_WIDTH;
  const TOTAL_HEIGHT = IMG_HEIGHT;
  const headerHeight = 100;
  const infoFontSize = 22;
  const noteFontSize = 28;

  const noteLines = wrapText(note || "", 32);
  const infoLines = [
    `Date : ${escapeXml(date)}`,
    `UTC : ${escapeXml(time)}`,
    `Bande : ${escapeXml(band)}`,
    `Mode : ${escapeXml(mode)}`,
    `Report : ${escapeXml(report)}`
  ];

  const userBuffer = await sharp(filePath)
    .resize({ width: IMG_WIDTH, height: IMG_HEIGHT, fit: "cover", position: "center" })
    .toBuffer();

  let infoSVG = "";
  infoLines.forEach((line, i) => {
    const y = headerHeight + 30 + i * infoFontSize;
    infoSVG += `<text x="20" y="${y}" font-size="${infoFontSize}">${line}</text>`;
  });

  const startNoteY = headerHeight + infoLines.length * infoFontSize + 60;
  const noteSVG = noteLines
    .map((line, i) => `<tspan x="20" ${i === 0 ? `y="${startNoteY}"` : `dy="${noteFontSize}"`}>${escapeXml(line)}</tspan>`)
    .join("");

  const panelSVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${TOTAL_HEIGHT}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f9f9f9"/>
    <stop offset="100%" stop-color="#eeeeee"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="100%" height="${headerHeight}" fill="#1f2937"/>
  <text x="20" y="60" font-size="40" fill="white" font-weight="bold">${escapeXml(indicatif)}</text>
  <line x1="20" y1="${headerHeight + 20}" x2="${PANEL_WIDTH - 20}" y2="${headerHeight + 20}" stroke="#ccc"/>
  ${infoSVG}
  <line x1="20" y1="${headerHeight + infoLines.length * infoFontSize + 40}" x2="${PANEL_WIDTH - 20}" y2="${headerHeight + infoLines.length * infoFontSize + 40}" stroke="#ccc"/>
  <text x="0" y="0" font-size="${noteFontSize}" fill="#000" xml:space="preserve">${noteSVG}</text>
  <text x="20" y="${TOTAL_HEIGHT - 20}" font-size="14" fill="#555">TANGO WHISKY eQSL</text>
</svg>`;

  const panelBuffer = await sharp(Buffer.from(panelSVG)).png().toBuffer();

  return await sharp({
    create: { width: TOTAL_WIDTH, height: TOTAL_HEIGHT, channels: 3, background: "#fff" }
  })
    .composite([
      { input: userBuffer, top: 0, left: 0 },
      { input: panelBuffer, top: 0, left: IMG_WIDTH }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ================= UPLOAD (GENERIC) =================
async function handleUpload(req, res) {
  try {
    if (!req.files || !req.files.qsl)
      return res.status(400).json({ success: false, error: "Aucune image reçue" });

    const file = req.files.qsl;
    const indicatif = (req.body.indicatif || "").toUpperCase();

    const buffer = await generateQSLBuffer({
      filePath: file.tempFilePath,
      indicatif,
      date: req.body.date,
      time: req.body.time,
      band: req.body.band,
      mode: req.body.mode,
      report: req.body.report,
      note: req.body.note
    });

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "TW-eQSL",
        tags: [`indicatif_${indicatif}`],
        context: {
          indicatif: indicatif,
          date: req.body.date,
          time: req.body.time,
          band: req.body.band,
          mode: req.body.mode,
          report: req.body.report,
          note: req.body.note
        }
      },
      (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({
          success: true,
          qsl: {
            public_id: result.public_id,
            url: result.secure_url,
            thumb: result.secure_url.replace("/upload/", "/upload/w_300/")
          }
        });
      }
    );

    stream.end(buffer);

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post("/upload", requireAuth, handleUpload);
app.post("/upload-single-qsl", requireAuth, handleUpload);

// ================= FILE DOWNLOAD =================
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).send("missing pid");

    const downloads = readDownloads();
    if (!downloads[pid]) downloads[pid] = { count: 0, createdAt: Date.now() };
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
    res.setHeader("Content-Disposition", `attachment; filename="${ctx.indicatif || "QSL"}_${ctx.date}.${info.format}"`);
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
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
 
