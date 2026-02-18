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

// ===== GENERATE QSL BUFFER 1024x683 =====
async function generateQSLBuffer({
  filePath, indicatif, date, time, band, mode, report, note
}) {
  const targetWidth = 1024;
  const targetHeight = 683;
  const panelWidth = 300; // texte à droite
  const padding = 20;
  const lineHeight = 35;

  const base = await sharp(filePath)
    .resize({ width: targetWidth, height: targetHeight, fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  const texts = [
    { label: "", value: indicatif, fontSize: 28 },
    { label: "Date: ", value: date, fontSize: 20 },
    { label: "UTC: ", value: time, fontSize: 20 },
    { label: "Bande: ", value: band, fontSize: 20 },
    { label: "Mode: ", value: mode, fontSize: 20 },
    { label: "Report: ", value: report, fontSize: 20 },
    { label: "", value: note || "", fontSize: 18 }
  ];

  let textSvg = "";
  texts.forEach((t, i) => {
    const y = padding + i * lineHeight;
    textSvg += `<text x="${padding}" y="${y}" font-size="${t.fontSize}" fill="#222" font-family="Arial">${t.label}${t.value}</text>`;
  });

  const svg = `
    <svg width="${targetWidth + panelWidth}" height="${targetHeight}">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f0f0f0"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect x="${targetWidth}" y="0" width="${panelWidth}" height="${targetHeight}" fill="url(#grad)" rx="10" ry="10"/>
      ${textSvg}
    </svg>
  `;

  return await sharp(base)
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

// ===== SPA fallback avec onglet Facebook =====
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public/index.html");
  let html = fs.readFileSync(indexPath, "utf8");

  // Injecter petit onglet FB en bas à droite
  const fbTab = `
  <div style="
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #1877f2;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    z-index: 9999;
  " onclick="window.open('https://www.facebook.com/groups/1114993245182627','_blank')">
    Facebook
  </div>
  `;

  html = html.replace("</body>", fbTab + "\n</body>");
  res.send(html);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
