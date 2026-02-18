   import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import sharp from "sharp";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));
app.use(express.static(path.join(__dirname, "public")));

app.set("trust proxy", 1);

app.use(
  session({
    name: "tw-session",
    secret: process.env.SESSION_SECRET || "tw-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    }
  })
);

// ================= USERS EN MEMOIRE =================
const USERS = {
  "14tw670": "123456",
 "14tw207": "radio",
  "14tw101": "qsl"
};

// ================= AUTH =================
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Non autorisé" });
}

app.post("/login", (req, res) => {
  const { indicatif, password } = req.body || {};
  const call = (indicatif || "").toUpperCase();

  if (USERS[call] && USERS[call] === password) {
    req.session.authenticated = true;
    req.session.indicatif = call;
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

// ================= GENERATE QSL =================
async function generateQSLBuffer({ filePath, indicatif, date, time, band, mode, report, note }) {

  const base = await sharp(filePath)
    .resize({ width: 800, height: 450, fit: "cover" })
    .jpeg({ quality: 100 })
    .toBuffer();

  const svg = `
  <svg width="800" height="450">
    <rect x="520" y="0" width="280" height="450" fill="white"/>
    <text x="540" y="60" font-size="28" fill="#333" font-weight="bold">
      ${indicatif}
    </text>
    <line x1="540" y1="80" x2="780" y2="80" stroke="#ccc"/>
    <text x="540" y="120" font-size="20" fill="#333">Date: ${date}</text>
    <text x="540" y="160" font-size="20" fill="#333">UTC: ${time}</text>
    <text x="540" y="200" font-size="20" fill="#333">Bande: ${band}</text>
    <text x="540" y="240" font-size="20" fill="#333">Mode: ${mode}</text>
    <text x="540" y="280" font-size="20" fill="#333">Report: ${report}</text>
    <text x="540" y="340" font-size="18" fill="#666">${note || ""}</text>
  </svg>`;

  return await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 100 })
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

// ================= FILE DOWNLOAD =================
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

// ================= SPA FALLBACK =================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("TW-eQSL server running on port", PORT));
