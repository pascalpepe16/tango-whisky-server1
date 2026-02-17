// =============================================
//  TANGO WHISKY — SERVER.JS (MULTI UTILISATEUR)
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

// ================= GALERIE =================
app.get("/qsl", requireAuth, async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:TW-eQSL")
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

// ================= DOWNLOAD PAR INDICATIF =================
app.get("/download/:call", async (req, res) => {
  try {
    const call = req.params.call.toUpperCase();
    const downloads = readDownloads();

    const result = await cloudinary.search
      .expression(`folder:TW-eQSL AND tags=to_${call}`)
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

// ================= GENERATE QSL =================
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {
  const PANEL_WIDTH = 350;
  const IMG_WIDTH = 470;
  const IMG_HEIGHT = 410;
  const TOTAL_WIDTH = IMG_WIDTH + PANEL_WIDTH;
  const TOTAL_HEIGHT = IMG_HEIGHT;

  const userBuffer = await sharp(filePath)
    .resize({ width: IMG_WIDTH, height: IMG_HEIGHT, fit: "cover" })
    .toBuffer();

  const svg = `
<svg width="${PANEL_WIDTH}" height="${TOTAL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  <text x="20" y="60" font-size="40" fill="#111">${escapeXml(indicatif)}</text>
  <text x="20" y="120" font-size="20">Date: ${escapeXml(date)}</text>
  <text x="20" y="150" font-size="20">UTC: ${escapeXml(time)}</text>
  <text x="20" y="180" font-size="20">Bande: ${escapeXml(band)}</text>
  <text x="20" y="210" font-size="20">Mode: ${escapeXml(mode)}</text>
  <text x="20" y="240" font-size="20">Report: ${escapeXml(report)}</text>
  <text x="20" y="300" font-size="18">${escapeXml(note)}</text>
</svg>`;

  const panelBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

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

// ================= UPLOAD =================
async function handleUpload(req, res) {
  try {
    if (!req.files || !req.files.qsl)
      return res.status(400).json({ success: false });

    const file = req.files.qsl;

    const toCall = (req.body.indicatif || "").toUpperCase();
    const fromCall = (req.session.indicatif || "").toUpperCase();

    const buffer = await generateQSLBuffer({
      filePath: file.tempFilePath,
      indicatif: toCall,
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
        tags: [`to_${toCall}`, `from_${fromCall}`]
      },
      (err, result) => {
        if (err) return res.status(500).json({ success: false });
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
    console.error(err);
    res.status(500).json({ success: false });
  }
}

app.post("/upload", requireAuth, handleUpload);
app.post("/upload-single-qsl", requireAuth, handleUpload);

// ================= START =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
