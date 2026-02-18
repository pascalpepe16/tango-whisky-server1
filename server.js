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

// ===== MIDDLEWARES =====
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  name: "tw-session",
  secret: process.env.SESSION_SECRET || "tw-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
}));

// ===== USERS =====
const USERS = JSON.parse(fs.readFileSync(path.join(__dirname, "users.json"), "utf8"));

// ===== AUTH =====
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Non autorisé" });
}

// ===== LOGIN / LOGOUT =====
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

// ===== CLOUDINARY =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== GENERATE QSL BUFFER FLEXIBLE =====
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {
  const baseImg = await sharp(filePath);
  const metadata = await baseImg.metadata();
  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  const texts = [
    { label: "", value: indicatif, fontSize: 28 },
    { label: "Date: ", value: date, fontSize: 20 },
    { label: "UTC: ", value: time, fontSize: 20 },
    { label: "Bande: ", value: band, fontSize: 20 },
    { label: "Mode: ", value: mode, fontSize: 20 },
    { label: "Report: ", value: report, fontSize: 20 },
    { label: "", value: note || "", fontSize: 18 }
  ];

  const panelWidth = 300; // largeur fixe
  const padding = 20;
  const lineHeight = 35; // espace entre lignes pour lisibilité

  // créer le SVG avec texte + retour à la ligne
  let textSvg = "";
  texts.forEach((t, i) => {
    const y = padding + i * lineHeight;
    const content = t.label + t.value;
    textSvg += `<text x="${imgWidth + padding}" y="${y}" font-size="${t.fontSize}" fill="#222">${content}</text>`;
  });

  const svg = `
  <svg width="${imgWidth + panelWidth}" height="${imgHeight}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f0f0f0"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
    </defs>
    <rect x="${imgWidth}" y="0" width="${panelWidth}" height="${imgHeight}" fill="url(#grad)" rx="10" ry="10"/>
    ${textSvg}
  </svg>`;

  return await baseImg
    .extend({ top: 0, bottom: 0, left: 0, right: panelWidth, background: "white" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ===== ROUTES =====

// Upload QSL unitaire
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
      { folder: "TW-eQSL", tags: [`indicatif_${indicatif}`] },
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

// Galerie QSL
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

// Download by call
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

// Téléchargement fichier
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

// ===== 404 API =====
app.use((req, res, next) => {
  if (
    req.path.startsWith("/upload") ||
    req.path.startsWith("/qsl") ||
    req.path.startsWith("/download") ||
    req.path.startsWith("/file") ||
    req.path.startsWith("/login")
  ) return res.status(404).json({ error: "Route API non trouvée" });
  next();
});

// ===== SPA fallback =====
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
