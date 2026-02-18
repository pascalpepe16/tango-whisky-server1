import express from "express";
import session from "express-session";
import fileUpload from "express-fileupload";
import sharp from "sharp";
import fs from "fs";
import path from "path";

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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  abortOnLimit: true
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
// FAUSSE BASE UTILISATEURS
// ===============================
const users = [
  { indicatif: "F4ABC", password: "1234" },
  { indicatif: "F1XYZ", password: "1234" }
];

// ===============================
// BASE QSL EN MEMOIRE
// ===============================
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
      return res.status(401
