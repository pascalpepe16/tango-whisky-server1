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

// ================= CONFIG =================
const META_FILE = path.join(__dirname, "meta.json");
const MAX_DOWNLOADS = 2;
const MAX_DAYS = 30;

// ================= MIDDLEWARE =================
app.use(cors());
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

// ================= META =================
function loadMeta() {
  if (!fs.existsSync(META_FILE)) return {};
  return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
}

function saveMeta(meta) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// ================= USERS =================
const USERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "users.json"), "utf8")
);

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

// ================= GALLERY =================
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
// ================= GENERATE QSL ULTRA-PRO =================
async function generateQSLBuffer({
  filePath,
  indicatif,
  date,
  time,
  band,
  mode,
  report,
  note
}) {
  const imageWidth = 1526;
  const imageHeight = 1024;

  const rectWidth = Math.round(imageWidth * 0.28);
  const rectHeight = imageHeight;
  const totalWidth = imageWidth + rectWidth;

  const marginX = 30;
  const marginTop = 80;

  const titleSize = Math.round(rectWidth * 0.11); // plus grand
  const textSize = Math.round(rectWidth * 0.08);
  const noteSize = Math.round(rectWidth * 0.065);

  // Fonction pour écrire texte avec retour à la ligne
  function addBlock(svgText, text, size, x, y, maxWidth, bold = false) {
    if (!text) return { svgText, y };
    const words = text.split(" ");
    let lines = [];
    let currentLine = "";

    const approxChars = Math.floor(maxWidth / (size * 0.6));
    words.forEach(word => {
      if ((currentLine + word).length > approxChars) {
        lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    lines.forEach(line => {
      // Texte avec légère ombre
      svgText += `<text x="${x+2}" y="${y+2}" font-size="${size}" fill="rgba(0,0,0,0.2)" ${bold ? 'font-weight="bold"' : ""}>${line}</text>`;
      svgText += `<text x="${x}" y="${y}" font-size="${size}" fill="#222" ${bold ? 'font-weight="bold"' : ""}>${line}</text>`;
      y += size * 1.4;
    });

    return { svgText, y };
  }

  // Charger image de base
  const base = await sharp(filePath)
    .resize({ width: imageWidth, height: imageHeight, fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  let svgText = "";
  let currentY = marginTop;

  // 🔹 Cadre avec dégradé léger derrière le texte
  const svgBackground = `
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="white" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#f0f0f0" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" rx="25" stroke="#aaa" stroke-width="2"/>
  `;

  // 🔹 Indicatif en haut
  let result = addBlock(svgText, indicatif, titleSize, marginX, currentY, rectWidth, true);
  svgText = result.svgText;
  currentY = result.y + 20;

  // 🔹 Ligne séparatrice
  svgText += `<line x1="${marginX}" y1="${currentY}" x2="${rectWidth - marginX}" y2="${currentY}" stroke="#aaa" stroke-width="2" stroke-dasharray="5,3"/>`;
  currentY += 30;

  // 🔹 Infos principales en une colonne
  const infoX = marginX;
  const infoMaxWidth = rectWidth - 2*marginX;

  const infoList = [
    `Date: ${date}`,
    `UTC: ${time}`,
    `Bande: ${band}`,
    `Mode: ${mode}`,
    `Report: ${report}`
  ];

  infoList.forEach(line => {
    result = addBlock(svgText, line, textSize, infoX, currentY, infoMaxWidth);
    svgText = result.svgText;
    currentY = result.y + 10;
  });

  // 🔹 Notes sur plusieurs lignes, largeur complète
  const noteX = marginX;
  result = addBlock(svgText, note || "", noteSize, noteX, currentY, infoMaxWidth);
  svgText = result.svgText;

  // 🔹 Créer SVG final
  const svg = `
    <svg width="${rectWidth}" height="${rectHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgBackground}
      ${svgText}
    </svg>
  `;

  // 🔹 Composer image finale
  return await sharp({
    create: {
      width: totalWidth,
      height: imageHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: Buffer.from(svg), left: imageWidth, top: 0 }
    ])
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
});

// ================= DOWNLOAD + LIMIT =================
// ================= FILE INFO =================
app.get("/file-info", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).json({ error: "missing pid" });

    let meta = loadMeta();

    if (!meta[pid]) {
      meta[pid] = {
        downloads: 0,
        createdAt: Date.now()
      };
    }

    const remaining = Math.max(0, MAX_DOWNLOADS - meta[pid].downloads);

    res.json({
      remaining,
      max: MAX_DOWNLOADS
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: true });
  }
});
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).json({ error: "missing pid" });

    let meta = loadMeta();

    if (!meta[pid]) {
      meta[pid] = {
        downloads: 0,
        createdAt: Date.now()
      };
    }

    if (meta[pid].downloads >= MAX_DOWNLOADS) {
      return res.status(403).json({
        error: "limit",
        remaining: 0
      });
    }

    const info = await cloudinary.api.resource(pid);

    const response = await axios.get(info.secure_url, {
      responseType: "stream"
    });

    const remaining = MAX_DOWNLOADS - meta[pid].downloads;

    res.setHeader("Content-Type", `image/${info.format}`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="QSL.${info.format}"`
    );
    res.setHeader("X-Remaining-Downloads", remaining);

    response.data.pipe(res);

    response.data.on("end", async () => {
      meta[pid].downloads++;
      saveMeta(meta);

      if (meta[pid].downloads >= MAX_DOWNLOADS) {
        await cloudinary.uploader.destroy(pid);
        delete meta[pid];
        saveMeta(meta);
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: true });
  }
});
// ================= AUTO CLEAN 30 JOURS =================
setInterval(async () => {
  try {
    let meta = loadMeta();

    for (const pid in meta) {
      const age = Date.now() - meta[pid].createdAt;
      if (age > MAX_DAYS * 86400000) {
        await cloudinary.uploader.destroy(pid);
        delete meta[pid];
      }
    }

    saveMeta(meta);
  } catch (err) {
    console.error("Erreur nettoyage:", err);
  }
}, 12 * 60 * 60 * 1000);

// ================= SPA =================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("TW-eQSL server running on port", PORT)
);
