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

// USERS
const USERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "users.json"), "utf8")
);

// AUTH
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

// CLOUDINARY
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// GALLERY
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

// DOWNLOAD LIST
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

// GENERATE QSL
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
  // On agrandit l'image pour remplir complètement le cadre
  const base = await sharp(filePath)
    .resize({ width: 1000, height: 600, fit: "cover" }) // taille plus grande pour éviter les coupes
    .jpeg({ quality: 90 })
    .toBuffer();

  // SVG avec zone texte élargie
  const svg = `
    <svg width="1000" height="600">
      <rect x="650" y="0" width="350" height="600" fill="white"/>
      
      <text x="670" y="80" font-size="32" fill="#333" font-weight="bold">${indicatif}</text>
      <line x1="670" y1="100" x2="980" y2="100" stroke="#ccc"/>
      
      <text x="670" y="150" font-size="24" fill="#333">Date: ${date}</text>
      <text x="670" y="200" font-size="24" fill="#333">UTC: ${time}</text>
      <text x="670" y="250" font-size="24" fill="#333">Bande: ${band}</text>
      <text x="670" y="300" font-size="24" fill="#333">Mode: ${mode}</text>
      <text x="670" y="350" font-size="24" fill="#333">Report: ${report}</text>
      <text x="670" y="420" font-size="20" fill="#666">${note || ""}</text>
    </svg>
  `;

  return await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
// UPLOAD
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

// FILE DOWNLOAD
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    if (!pid) return res.status(400).send("missing pid");

    const info = await cloudinary.api.resource(pid);
    const file = await axios.get(info.secure_url, { responseType: "arraybuffer" });

    res.setHeader("Content-Type", `image/${info.format}`);
    res.setHeader("Content-Disposition", `attachment; filename="QSL.${info.format}"`);
    res.send(Buffer.from(file.data));

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur téléchargement");
  }
});

// SPA FALLBACK (TOUJOURS EN DERNIER)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
