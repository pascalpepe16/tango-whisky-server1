const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// dossier images
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// stockage multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = Date.now() + ".png";
    cb(null, name);
  },
});

const upload = multer({ storage });

// servir fichiers statiques
app.use("/uploads", express.static(uploadDir));
app.use(express.static(__dirname));

/* ================================
   ✅ SAUVEGARDE IMAGE EXACTE
   ================================ */
app.post("/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucune image reçue" });
    }

    // 🔥 IMPORTANT : on ne touche PAS à l’image
    // pas de resize, pas de sharp, pas de recompression

    const fileUrl = "/uploads/" + req.file.filename;

    res.json({
      success: true,
      url: fileUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur upload" });
  }
});

/* ================================
   📂 LISTE GALERIE
   ================================ */
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

/* ================================
   🗑️ SUPPRESSION IMAGE
   ================================ */
app.delete("/delete/:name", (req, res) => {
  const filePath = path.join(uploadDir, req.params.name);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Erreur suppression" });
    }
    res.json({ success: true });
  });
});

/* ================================
   🚀 LANCEMENT SERVEUR
   ================================ */
app.listen(PORT, () => {
  console.log("Serveur lancé sur http://localhost:" + PORT);
});
