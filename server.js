import express from "express";
import session from "express-session";
import fileUpload from "express-fileupload";
import sharp from "sharp";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "tw-secret-key",
  resave: false,
  saveUninitialized: false
}));

app.use(fileUpload({
  limits: { fileSize: 20 * 1024 * 1024 }
}));

// ===============================
// DOSSIER UPLOAD
// ===============================
const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use("/uploads", express.static(uploadDir));
app.use(express.static("public"));

// ===============================
// FAUSSE BASE UTILISATEURS
// ===============================
const users = [
  { indicatif: "F4ABC", password: "1234" },
  { indicatif: "F1XYZ", password: "1234" }
];

let qslDB = [];

// ===============================
// AUTH
// ===============================
app.post("/login", (req, res) => {
  const { indicatif, password } = req.body;

  const user = users.find(
    u => u.indicatif === indicatif.toUpperCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false });
  }

  req.session.user = user.indicatif;
  res.json({ success: true });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/check-auth", (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      indicatif: req.session.user
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ===============================
// GENERATION QSL UNITAIRE
// ===============================
app.post("/upload-single-qsl", async (req, res) => {

  try {

    if (!req.session.user) {
      return res.status(401).json({ success: false });
    }

    if (!req.files || !req.files.qsl) {
      return res.status(400).json({ success: false });
    }

    const file = req.files.qsl;

    const filename = Date.now() + "-" + file.name;
    const filepath = uploadDir + "/" + filename;

    // Redimensionnement propre sans perte visible
    await sharp(file.data)
      .resize({
        width: 1600,
        withoutEnlargement: true
      })
      .jpeg({ quality: 100 }) // qualité max
      .toFile(filepath);

    const qsl = {
      owner: req.session.user,
      url: "/uploads/" + filename,
      date: Date.now()
    };

    qslDB.push(qsl);

    res.json({ success: true, qsl });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// ===============================
// TELECHARGEMENT
// ===============================
app.get("/download/:indicatif", (req, res) => {
  const list = qslDB.filter(q => q.owner === req.params.indicatif);
  res.json(list);
});

// ===============================
app.listen(PORT, () => {
  console.log("Serveur démarré sur port " + PORT);
});
