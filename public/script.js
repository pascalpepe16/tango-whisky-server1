console.log("script.js chargé");

// ---------------------
// SECTION SYSTEM
// ---------------------
function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

let sectionToOpen = null;

function showPassword(target) {
  sectionToOpen = target;
  document.getElementById("passwordBox").classList.remove("hidden");
}

function verifyPassword() {
  if (document.getElementById("pwd").value === "123456") {
    document.getElementById("passwordBox").classList.add("hidden");
    showSection(sectionToOpen);
  } else {
    alert("Mot de passe incorrect !");
  }
}

// ---------------------
// GALERIE
// ---------------------
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement…";

  try {
    const res = await fetch("/qsl");
    const list = await res.json();

    if (!list.length) return box.innerHTML = "Aucune QSL pour l'instant";

    box.innerHTML = "";
    list.forEach(q => {
      const img = document.createElement("img");
      img.src = q.thumb || q.url;
      img.title = q.indicatif;
      box.appendChild(img);
    });

  } catch (err) {
    box.innerHTML = "Erreur de chargement.";
  }
}

loadGallery();

// ---------------------
// CREATION + UPLOAD
// ---------------------
document.getElementById("genForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);

  document.getElementById("genPreview").innerHTML = "Génération…";

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!data.success) {
    return document.getElementById("genPreview").innerHTML =
      "Erreur : " + data.error;
  }

  document.getElementById("genPreview").innerHTML =
    `<img src="${data.qsl.url}">`;
});

// ---------------------
// DOWNLOAD
// ---------------------
document.getElementById("btnSearch").onclick = async () => {
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");

  if (!call) return alert("Entrez un indicatif.");

  box.innerHTML = "Recherche…";

  const res = await fetch("/download/" + call);
  const list = await res.json();

  if (!list.length) return box.innerHTML = "Aucune QSL trouvée.";

  box.innerHTML = "";

  list.forEach(q => {
    const img = document.createElement("img");
    img.src = q.thumb || q.url;

    const a = document.createElement("a");
    a.href = q.url;
    a.download = `${q.indicatif}_${q.date}.jpg`;
    a.textContent = "Télécharger";
    a.className = "primary";

    const div = document.createElement("div");
    div.appendChild(img);
    div.appendChild(a);

    box.appendChild(div);
  });
};
