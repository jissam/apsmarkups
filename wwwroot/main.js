import { initViewer, loadModel } from "./viewer.js";

initViewer(document.getElementById("preview")).then((viewer) => {
  const urn = window.location.hash?.substring(1);
  console.log("00000000000000000000000000000000000000000000000000000");
  setupModelSelection(viewer, urn);
  setupModelUpload(viewer);
  console.log("111111111111111111111111111111111111111111111111111111111");
  viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
    console.log("2222222222222222222222222222222222222222222222");
    setupMarkups(viewer);
  });
  // setupMarkups(viewer);
});

async function setupModelSelection(viewer, selectedUrn) {
  const dropdown = document.getElementById("models");
  dropdown.innerHTML = "";
  try {
    const resp = await fetch("/api/models");
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    const models = await resp.json();
    dropdown.innerHTML = models
      .map(
        (model) =>
          `<option value=${model.urn} ${
            model.urn === selectedUrn ? "selected" : ""
          }>${model.name}</option>`
      )
      .join("\n");
    dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
    if (dropdown.value) {
      onModelSelected(viewer, dropdown.value);
    }
  } catch (err) {
    alert("Could not list models. See the console for more details.");
    console.error(err);
  }
}

async function setupMarkups(viewer) {
  let markupext = viewer.getExtension("Autodesk.Viewing.MarkupsCore");
  let urn = viewer.model.getSeedUrn();
  console.log(
    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  );
  async function saveMarkups() {
    let markupsPdata = markupext.generateData();
    const resp = await fetch("/api/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urn: urn, data: markupsPdata }),
    });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
  }
  async function loadMarkups() {
    const resp = await fetch(`/api/markups?urn=${urn}`, { method: "GET" });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    const data = await resp.json();
    if (data.markups) {
      markupext.leaveEditMode();
      markupext.show();
      markupext.loadMarkups(data.markups, "my-custom-layer");
      markupext.enterEditMode("my-custom-layer");
    }
  }
  viewer.addEventListener(
    Autodesk.Viewing.EXTENSION_ACTIVATED_EVENT,
    function (ev) {
      console.log("EXTENSION_ACTIVATED_EVENT", ev);
      if (ev.extensionId === "Autodesk.Viewing.MarkupsGui") {
        loadMarkups();
      }
    }
  );
  markupext.addEventListener("EVENT_EDITMODE_CHANGED", function (ev) {
    const editTool = ev.target;
    if (editTool) {
      editTool.addEventListener("EVENT_EDITMODE_CREATION_END", function (ev) {
        console.log("EVENT_EDITMODE_CREATION_END", ev);
        saveMarkups();
      });
      editTool.addEventListener("EVENT_MARKUP_DESELECT", function (ev) {
        console.log("EVENT_MARKUP_DESELECT", ev);
        saveMarkups();
      });
    }
  });
  markupext.editFrame.addEventListener(
    "EVENT_EDITFRAME_EDITION_END",
    function (ev) {
      console.log("EVENT_EDITFRAME_EDITION_END", ev);
      saveMarkups();
    }
  );
}

async function setupModelUpload(viewer) {
  const upload = document.getElementById("upload");

  const input = document.getElementById("input");
  const models = document.getElementById("models");
  upload.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files[0];
    let data = new FormData();
    data.append("model-file", file);
    if (file.name.endsWith(".zip")) {
      // When uploading a zip file, ask for the main design file in the archive
      const entrypoint = window.prompt(
        "Please enter the filename of the main design inside the archive."
      );
      data.append("model-zip-entrypoint", entrypoint);
    }
    upload.setAttribute("disabled", "true");
    models.setAttribute("disabled", "true");
    showNotification(
      `Uploading model <em>${file.name}</em>. Do not reload the page.`
    );
    try {
      const resp = await fetch("/api/models", { method: "POST", body: data });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const model = await resp.json();
      setupModelSelection(viewer, model.urn);
    } catch (err) {
      alert(
        `Could not upload model ${file.name}. See the console for more details.`
      );
      console.error(err);
    } finally {
      clearNotification();
      upload.removeAttribute("disabled");
      models.removeAttribute("disabled");
      input.value = "";
    }
  };
}

async function onModelSelected(viewer, urn) {
  if (window.onModelSelectedTimeout) {
    clearTimeout(window.onModelSelectedTimeout);
    delete window.onModelSelectedTimeout;
  }
  window.location.hash = urn;
  try {
    const resp = await fetch(`/api/models/${urn}/status`);
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    const status = await resp.json();
    switch (status.status) {
      case "n/a":
        showNotification(`Model has not been translated.`);
        break;
      case "inprogress":
        showNotification(`Model is being translated (${status.progress})...`);
        window.onModelSelectedTimeout = setTimeout(
          onModelSelected,
          5000,
          viewer,
          urn
        );
        break;
      case "failed":
        showNotification(
          `Translation failed. <ul>${status.messages
            .map((msg) => `<li>${JSON.stringify(msg)}</li>`)
            .join("")}</ul>`
        );
        break;
      default:
        clearNotification();
        loadModel(viewer, urn);
        break;
    }
  } catch (err) {
    alert("Could not load model. See the console for more details.");
    console.error(err);
  }
}

function showNotification(message) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `<div class="notification">${message}</div>`;
  overlay.style.display = "flex";
}

function clearNotification() {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = "";
  overlay.style.display = "none";
}

let markupext = viewer.getExtension("Autodesk.Viewing.MarkupsCore");
let urn = viewer.model.getSeedUrn();

// Fired whenever the drawing tool changes. For example, when the Arrow drawing tool changes into the Rectangle drawing tool.
markupext.addEventListener("EVENT_EDITMODE_CHANGED", function (ev) {
  const editTool = ev.target;
  console.log("mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm");
  if (editTool) {
    //Fired when a markup has been created. For example, as soon as the user stops dragging and releases the mouse button to finish drawing an arrow on the screen
    editTool.addEventListener("EVENT_EDITMODE_CREATION_END", function (ev) {
      saveMarkups();
    });
    // Fired when a markup is no longer selected.
    editTool.addEventListener("EVENT_MARKUP_DESELECT", function (ev) {
      saveMarkups();
    });
  }
});

// The selected markup is no longer being modified
markupext.editFrame.addEventListener(
  "EVENT_EDITFRAME_EDITION_END",
  function (ev) {
    console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    saveMarkups();
  }
);

async function saveMarkups() {
  try {
    console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    let markupsPdata = markupext.generateData();
    const resp = await fetch("/api/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urn: urn, data: markupsPdata }),
    });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
  } catch (error) {
    console.log(error);
    console.log(
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    );
  }
}

// Make sure you load the extensions 'Autodesk.Viewing.MarkupsCore', 'Autodesk.Viewing.MarkupsGui'
//let urn = viewer.model.getSeedUrn();
async function loadMarkups() {
  try {
    const resp = await fetch(`/api/markups?urn=${urn}`, { method: "GET" });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    const data = await resp.json();
    if (data.markups) {
      markupext.leaveEditMode();
      markupext.show();
      markupext.loadMarkups(data.markups, "my-custom-layer");
      markupext.enterEditMode("my-custom-layer");
    }
  } catch (error) {
    console.log(error);
  }
}
