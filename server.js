// ===============================
// CONFIG
// ===============================
const API_URL = location.origin;
let importedLogs = [];
window.isAuthenticated = false;
let lastQslCount = 0; // pour notification

// ===============================
// AUTH / SESSION
// ===============================
async function checkAuth() {
  try {
    const res = await fetch("/check-auth", { credentials: "same-origin" });
    const data = await res.json();

    window.isAuthenticated = data.authenticated === true;

    const loginBox = document.getElementById("loginBox");
    const logoutBtn = document.getElementById("logoutBtn");
    const btnGallery = document.getElementById("btnGallery");
    const btnCreate = document.getElementById("btnCreate");

    if (window.isAuthenticated) {
      loginBox.style.display = "none";
      logoutBtn.style.display = "inline-block";
      btnGallery.style.display = "inline-block";
      btnCreate.style.display = "inline-block";
    } else {
      loginBox.style.display = "block";
      logoutBtn.style.display = "none";
      btnGallery.style.display = "none";
      btnCreate.style.display = "none";
    }
  } catch (err) {
    console.error("checkAuth error", err);
  }
}

async function login() {
  const indicatif = document.getElementById("loginIndicatif").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");

  errBox.innerText = "";

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ indicatif, password })
    });

    if (!res.ok) {
      errBox.innerText = "Identifiants incorrects";
      return;
    }

    await checkAuth();
    showTab("home");
    checkNewQSL(); // vérifie nouvelles QSL
  } catch (err) {
    errBox.innerText = "Erreur réseau";
  }
}

function logout() {
  window.location.href = "/logout";
}

// ===============================
// NAVIGATION
// ===============================
function showTab(id) {
  const protectedTabs = ["gallery", "create"];

  if (protectedTabs.includes(id) && !window.isAuthenticated) {
    showTab("home");
    return;
  }

  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );

  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");

  if (id === "gallery") loadGallery();
}

// ===============================
// GALLERY
// ===============================
async function loadGallery() {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "Chargement…";

  try {
    const res = await fetch(API_URL + "/qsl", {
      credentials: "same-origin"
    });

    const list = await res.json();

    if (!Array.isArray(list) || !list.length) {
      box.innerHTML = "Aucune QSL";
      return;
    }

    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "thumbWrap";
      div.innerHTML = `<img src="${q.thumb}">`;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = "Erreur réseau";
  }
}

// ===============================
// NOTIFICATION NOUVELLE QSL
// ===============================
async function checkNewQSL() {
  try {
    const call = document.getElementById("loginIndicatif")?.value?.trim().toUpperCase();
    if (!call) return;

    const res = await fetch(API_URL + "/download/" + call);
    const list = await res.json();

    if (lastQslCount === 0) {
      lastQslCount = list.length;
      return;
    }

    if (list.length > lastQslCount) {
      alert("📩 Vous avez une nouvelle QSL !");
      lastQslCount = list.length;
    }
  } catch (err) {
    console.error("Notification QSL:", err);
  }
}

// vérifie toutes les 30 secondes
setInterval(() => {
  if (window.isAuthenticated) {
    checkNewQSL();
  }
}, 30000);

// ===============================
// DOWNLOAD SEARCH
// ===============================
document.getElementById("btnSearch").onclick = async () => {
  const call = document.getElementById("dlCall").value.trim().toUpperCase();
  const box = document.getElementById("dlPreview");

  if (!call) {
    alert("Entrer un indicatif");
    return;
  }

  box.innerHTML = "Recherche…";

  try {
    const res = await fetch(API_URL + "/download/" + call);
    const list = await res.json();

    if (!list.length) {
      box.innerHTML = "Aucune QSL trouvée";
      return;
    }

    box.innerHTML = "";
    list.forEach(q => {
      const div = document.createElement("div");
      div.className = "dlWrap";
      div.innerHTML = `
        <img src="${q.thumb}" class="dlThumb">
        <button onclick="downloadQSL('${q.public_id}')">Télécharger</button>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = "Erreur réseau";
  }
};

function downloadQSL(pid) {
  const a = document.createElement("a");
  a.href = API_URL + "/file?pid=" + encodeURIComponent(pid);
  a.click();
}

// ===============================
// INIT
// ===============================
checkAuth();
showTab("home");
