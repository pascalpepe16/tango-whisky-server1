const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===== DOSSIER UPLOAD =====
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ===== CONFIG MULTER (PAS DE MODIF IMAGE) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".png");
  },
});

const upload = multer({ storage });

// ===== STATIC =====
app.use("/uploads", express.static(uploadDir));
app.use(express.static(__dirname));

// ===== ROUTE UPLOAD =====
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucune image reçue" });
  }

  res.json({
    success: true,
    url: "/uploads/" + req.file.filename,
  });
});

// ===== ROUTE GALERIE =====
app.get("/gallery", (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Erreur lecture dossier" });
    }

    const images = files
      .filter((f) => f.endsWith(".png"))
      .map((f) => "/uploads/" + f);

    res.json(images);
  });
});

// ===== ROUTE TEST =====
app.get("/test", (req, res) => {
  res.send("Serveur OK");
});

// ===== START =====
app.listen(PORT, () => {
  console.log("Serveur lancé sur http://localhost:" + PORT);
});
