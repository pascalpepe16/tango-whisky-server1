// -----------------------------
//  TW eQSL – FRONTEND
// -----------------------------
const API_URL = "https://tw-eqsl-server.onrender.com";

// -----------------------------
// SECTIONS
// -----------------------------
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
    } else alert("Mot de passe incorrect !");
}

// -----------------------------
// GALERIE
// -----------------------------
async function loadGallery() {
    const box = document.getElementById("galleryContent");
    box.innerHTML = "Chargement…";

    try {
        const res = await fetch(API_URL + "/qsl");
        const list = await res.json();

        if (!list.length) return box.innerHTML = "Aucune QSL pour l'instant";

        box.innerHTML = "";
        list.forEach(q => {
            const img = document.createElement("img");
            img.src = q.thumb || q.url;
            img.title = q.indicatif;
            box.appendChild(img);
        });
    } catch (e) {
        box.innerHTML = "Erreur de chargement.";
    }
}
loadGallery();

// -----------------------------
// UPLOAD + GENERATION
// -----------------------------
document.getElementById("genForm").onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const preview = document.getElementById("genPreview");

    preview.innerHTML = "Génération…";

    try {
        const res = await fetch(API_URL + "/upload", {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            preview.innerHTML = "Erreur : " + data.error;
            return;
        }

        preview.innerHTML = `<img src="${data.qsl.url}">`;
        loadGallery();
    } catch (err) {
        preview.innerHTML = "Erreur réseau";
    }
};

// -----------------------------
// DOWNLOAD
// -----------------------------
document.getElementById("btnSearch").onclick = async () => {
    const call = document.getElementById("dlCall").value.trim().toUpperCase();
    const box = document.getElementById("dlPreview");

    if (!call) return alert("Entrez un indicatif");

    box.innerHTML = "Recherche…";

    try {
        const res = await fetch(API_URL + "/download/" + call);
        const list = await res.json();

        if (!list.length) {
            box.innerHTML = "Aucune QSL trouvée.";
            return;
        }

        box.innerHTML = "";
        list.forEach(q => {
            const wrap = document.createElement("div");

            const img = document.createElement("img");
            img.src = q.thumb || q.url;

            const a = document.createElement("a");
            a.href = q.url;
            a.download = `${q.indicatif}_${q.date}.jpg`;
            a.textContent = "Télécharger";
            a.className = "primary";

            wrap.appendChild(img);
            wrap.appendChild(a);

            box.appendChild(wrap);
        });
    } catch (e) {
        box.innerHTML = "Erreur réseau";
    }
};
