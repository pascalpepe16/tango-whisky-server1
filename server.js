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
  })
);

// ================= CONFIG =================
const MAX_DOWNLOADS = 2;
const MAX_DAYS = 30;
const DB_FILE = path.join(__dirname, "downloads.json");

// ================= DB =================
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ================= USERS =================
const USERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "users.json"))
);

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { indicatif, password } = req.body;

  if (USERS[indicatif] === password) {
    req.session.authenticated = true;
    req.session.indicatif = indicatif;
    return res.json({ success: true });
  }

  res.status(401).json({ success: false });
});

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ================= DOWNLOAD SECURE =================
app.get("/file", async (req, res) => {
  try {
    const pid = req.query.pid;
    const call = (req.query.call || "").toUpperCase();

    if (!pid || !call)
      return res.status(400).json({ error: "missing data" });

    let db = loadDB();

    if (!db[pid]) {
      db[pid] = {
        created: Date.now(),
        users: {}
      };
    }

    if (!db[pid].users[call]) {
      db[pid].users[call] = 0;
    }

    const created = db[pid].created;
    const now = Date.now();
    const days = (now - created) / (1000 * 60 * 60 * 24);

    // ⛔ expiration
    if (days > MAX_DAYS) {
      return res.json({ expired: true });
    }

    // ⛔ limite téléchargement
    if (db[pid].users[call] >= MAX_DOWNLOADS) {
      return res.json({ limit: true });
    }

    // incrément
    db[pid].users[call]++;
    saveDB(db);

    // récupérer image
    const info = await cloudinary.api.resource(pid);
    const file = await axios.get(info.secure_url, {
      responseType: "arraybuffer"
    });

    res.setHeader("Content-Type", `image/${info.format}`);
    res.send(Buffer.from(file.data));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "download error" });
  }
});

// ================= CLEAN AUTO =================
setInterval(() => {
  let db = loadDB();
  let changed = false;

  for (let pid in db) {
    const age =
      (Date.now() - db[pid].created) / (1000 * 60 * 60 * 24);

    if (age > MAX_DAYS) {
      delete db[pid];
      changed = true;
    }
  }

  if (changed) saveDB(db);

}, 1000 * 60 * 60); // toutes les heures

// ================= START =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("Server OK sur port", PORT)
);
