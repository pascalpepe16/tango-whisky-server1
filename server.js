import express from "express";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "qsl-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ===============================
// DOSSIERS
// ===============================
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use("/uploads", express.static(uploadDir));
app.use(express.static("public"));

// ===============================
// MULTER
// ===============================
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  }
});
const upload = multer({ storage });

// ===============================
// FAUSSE BASE UTILISATEURS
// ===============================
const users = [
  { indicatif: "F4ABC", password: "1234" },
  { indicatif: "F1XYZ", password: "1234" }
];

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
  req.session.destroy(() => {
    res.redirect("/");
  });
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
// STOCKAGE QSL
// ===============================
let qslDB = [];

// ===============================
// UPLOAD QSL UNITAIRE
// ===============================
app.post("/upload-single-qsl", upload.single("qsl"), (req, res) => {

  if (!req.session.user) {
    return res.status(401).json({ success: false });
  }

  const qsl = {
    owner: req.session.user,
    url: "/uploads/" + req.file.filename,
    date: Date.now()
  };

  qslDB.push(qsl);

  res.json({ success: true, qsl });
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
