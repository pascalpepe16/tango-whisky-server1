// =============================================
//  TANGO WHISKY — SERVER.JS (VERSION STABLE)
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
    secret: process.env.SESSION_SECRET || "tw-secret",
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
  return Date.now() - entry.createdAt >= MAX_DAYS * 86400000;
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

// ================= DOWNLOAD LIST =================
app.get("/download/:call", async (req, res) => {
  try {
    const call = req.params.call.toUpperCase();

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
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ================= GENERATE QSL =================
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {

  const base = await sharp(filePath)
    .resize({ width: 800, height: 450, fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  const svg = `
  <svg width="800" height="450">
    <rect x="0" y="0" width="800" height="450" fill="rgba(0,0,0,0.4)"/>
    <text x="30" y="60" font-size="42" fill="white" font-weight="bold">${escapeXml(indicatif)}</text>
    <text x="30" y="120" font-size="26" fill="white">Date: ${escapeXml(date)}</text>
    <text x="30" y="160" font-size="26" fill="white">UTC: ${escapeXml(time)}</text>
    <text x="30" y="200" font-size="26" fill="white">Bande: ${escapeXml(band)}</text>
    <text x="30" y="240" font-size="26" fill="white">Mode: ${escapeXml(mode)}</text>
    <text x="30" y="280" font-size="26" fill="white">Report: ${escapeXml(report)}</text>
    <text x="30" y="340" font-size="28" fill="white">${escapeXml(note)}</text>
  </svg>`;

  return await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ================= UPLOAD =================
app.post("/upload", requireAuth, async (req, res) => {
  try {
    if (!req.files || !req.files.qsl)
      return res.status(400).json({ success: false });

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
        tags: [`indicatif_${indicatif}`]
      },
      (err, result) => {
        if (err) return res
