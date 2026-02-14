// ----------------------
// LOGIN
// ----------------------
function login() {
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    })
    .then(res => {
        if (res.ok) {
            document.getElementById("loginSection").style.display = "none";
            document.getElementById("mainMenu").style.display = "block";
        } else {
            alert("Identifiants incorrects");
        }
    });
}

// ----------------------
// NAVIGATION
// ----------------------
function showTab(tabId) {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => tab.style.display = "none");

    const active = document.getElementById(tabId);
    if (active) active.style.display = "block";
}

// ----------------------
// CREATION QSL CLASSIQUE
// ----------------------
function createClassicQSL() {
    const callsign = document.getElementById("callsign").value;
    const date = document.getElementById("date").value;
    const mode = document.getElementById("mode").value;
    const rst = document.getElementById("rst").value;

    fetch("/create-qsl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type: "classic",
            callsign,
            date,
            mode,
            rst
        })
    })
    .then(res => res.json())
    .then(() => {
        alert("QSL classique créée !");
        loadGallery();
    });
}

// ----------------------
// CREATION QSL PREMIUM
// ----------------------
function createPremiumQSL() {
    const callsign = document.getElementById("callsignPremium").value;
    const date = document.getElementById("datePremium").value;
    const mode = document.getElementById("modePremium").value;
    const rst = document.getElementById("rstPremium").value;
    const background = document.getElementById("backgroundSelect").value;

    fetch("/create-qsl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type: "premium",
            callsign,
            date,
            mode,
            rst,
            background
        })
    })
    .then(res => res.json())
    .then(() => {
        alert("QSL premium créée !");
        loadGallery();
    });
}

// ----------------------
// PREVIEW LIVE PREMIUM
// ----------------------
function updatePreview() {
    const callsign = document.getElementById("callsignPremium").value;
    const date = document.getElementById("datePremium").value;
    const mode = document.getElementById("modePremium").value;
    const rst = document.getElementById("rstPremium").value;
    const background = document.getElementById("backgroundSelect").value;

    const preview = document.getElementById("previewCard");
    if (!preview) return;

    preview.style.backgroundImage = `url(${background})`;
    preview.querySelector(".p_callsign").textContent = callsign;
    preview.querySelector(".p_date").textContent = date;
    preview.querySelector(".p_mode").textContent = mode;
    preview.querySelector(".p_rst").textContent = rst;
}

// ----------------------
// GALERIE
// ----------------------
function loadGallery() {
    fetch("/qsl-list")
    .then(res => res.json())
    .then(data => {
        const gallery = document.getElementById("gallery");
        if (!gallery) return;

        gallery.innerHTML = "";

        data.forEach(qsl => {
            const img = document.createElement("img");
            img.src = qsl.image;
            img.style.width = "200px";
            img.style.margin = "10px";
            gallery.appendChild(img);
        });
    });
}

// ----------------------
// IMPORT CSV AVEC BARRE DE PROGRESSION
// ----------------------
function importCSV() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    if (!file) {
        alert("Sélectionne un fichier CSV");
        return;
    }

    const formData = new FormData();
    formData.append("csv", file);

    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    progressBar.style.width = "0%";
    progressText.textContent = "0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/import-csv", true);

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + "%";
            progressText.textContent = percent + "%";
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            progressBar.style.width = "100%";
            progressText.textContent = "Import terminé";

            const data = JSON.parse(xhr.responseText);
            displayImportedLines(data);
            loadGallery();
        } else {
            alert("Erreur lors de l’import");
        }
    };

    xhr.send(formData);
}

// ----------------------
// AFFICHAGE DES LIGNES IMPORTEES
// ----------------------
function displayImportedLines(lines) {
    const table = document.getElementById("importTable");
    if (!table) return;

    table.innerHTML = "";

    lines.forEach((line, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${line.callsign || ""}</td>
            <td>${line.date || ""}</td>
            <td>${line.mode || ""}</td>
            <td>${line.rst || ""}</td>
        `;

        table.appendChild(tr);
    });
}
