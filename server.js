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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ======= MIDDLEWARES =======
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "tw-session",
    secret: process.env.SESSION_SECRET || "tw-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" }
  })
);

// ======= USERS =======
const USERS = JSON.parse(fs.readFileSync(path.join(__dirname, "users.json"), "utf8"));

// ======= AUTH =======
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Non autorisé" });
}

// ======= LOGIN / LOGOUT =======
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

// ======= CLOUDINARY CONFIG =======
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ======= GENERATE QSL BUFFER (AUTO-ADAPT) =======
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {
  const metadata = await sharp(filePath).metadata();
  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  const panelWidth = Math.round(imgWidth * 0.35);
  const panelPadding = 20;

  // Fonction pour réduire la taille de police si nécessaire
  function fitText(text, maxWidth, maxFontSize) {
    let fontSize = maxFontSize;
    const avgCharWidth = 0.6;
    while (fontSize * text.length * avgCharWidth > maxWidth && fontSize > 8) fontSize -= 1;
    return fontSize;
  }

  const fontIndicatif = fitText(indicatif, panelWidth - panelPadding * 2, 28);
  const fontNormal = fitText(date, panelWidth - panelPadding * 2, 20);
  const fontNote = fitText(note || "", panelWidth - panelPadding * 2, 18);

  const base = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();

  const svg = `
  <svg width="${imgWidth + panelWidth}" height="${imgHeight}">
    <rect x="${imgWidth}" y="0" width="${panelWidth}" height="${imgHeight}" fill="white"/>
    <text x="${imgWidth + panelPadding}" y="60" font-size="${fontIndicatif}" fill="#333" font-weight="bold">${indicatif}</text>
    <line x1="${imgWidth + panelPadding}" y1="80" x2="${imgWidth + panelWidth - panelPadding}" y2="80" stroke="#ccc"/>
    <text x="${imgWidth + panelPadding}" y="120" font-size="${fontNormal}" fill="#333">Date: ${date}</text>
    <text x="${imgWidth + panelPadding}" y="160" font-size="${fontNormal}" fill="#333">UTC: ${time}</text>
    <text x="${imgWidth + panelPadding}" y="200" font-size="${fontNormal}" fill="#333">Bande: ${band}</text>
    <text x="${imgWidth + panelPadding}" y="240" font-size="${fontNormal}" fill="#333">Mode: ${mode}</text>
    <text x="${imgWidth + panelPadding}" y="280" font-size="${fontNormal}" fill="#333">Report: ${report}</text>
    <text x="${imgWidth + panelPadding}" y="340" font-size="${fontNote}" fill="#666">${note || ""}</text>
  </svg>`;

  return await sharp(base)
    .extend({ top: 0, bottom: 0, left: 0, right: panelWidth, background: "white" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ======= ROUTES =======

// Upload QSL (unitaire et bulk)
app.post("/upload", requireAuth, async (req, res) => {
  try {
    if (!req.files || !req.files.qsl)
      return res.status(400).json({ error: "Aucun fichier envoyé" });

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
        if (err) return res.status(500).json({ error: "Cloudinary upload failed" });
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
    res.status(500).json({ error: err.message });
  }
});

// QSL Gallery
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

// Download list by call
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

// File download
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).json({ error: "missing pid" });

    const info = await cloudinary.api.resource(pid);
    const file = await axios.get(info.secure_url, { responseType: "arraybuffer" });

    res.setHeader("Content-Type", `image/${info.format}`);
    res.setHeader("Content-Disposition", `attachment; filename="QSL.${info.format}"`);
    res.send(Buffer.from(file.data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur téléchargement" });
  }
});

// ======= 404 API Handler =======
app.use((req, res, next) => {
  if (
    req.path.startsWith("/upload") ||
    req.path.startsWith("/qsl") ||
    req.path.startsWith("/download") ||
    req.path.startsWith("/file") ||
    req.path.startsWith("/login")
  ) {
    return res.status(404).json({ error: "Route API non trouvée" });
  }
  next();
});

// ======= SPA Fallback =======
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ======= START SERVER =======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
