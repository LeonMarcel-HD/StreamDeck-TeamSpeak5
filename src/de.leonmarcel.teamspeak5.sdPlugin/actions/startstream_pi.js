/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />
/// <reference path="../libs/js/stream-deck.js" />

let currentLanguage;
let globalsettings;
let settings;

$PI.onConnected((jsn) => {
  $PI.getGlobalSettings();
  settings = jsn.actionInfo.payload.settings;
  currentLanguage = jsn.appInfo.application.language;
});

$PI.onDidReceiveGlobalSettings(({ payload }) => {
  console.log("onDidReceiveGlobalSettings", payload);
  globalsettings = payload.settings;
  
  // Restoring previously setted settings
  document.getElementById("streampreset").value = settings.input ?? "";
  document.getElementById("port").value = globalsettings.port;

  var layout1 = document.getElementById("sdpi-layout1");
  var layout2 = document.getElementById("sdpi-layout2");

  if (!payload.settings.connectionStatus) {
    layout1.style.display = "block";
    layout2.style.display = "none";
  } else {
    layout1.style.display = "none";
    layout2.style.display = "block";
  }
});

// Streampreset
document.getElementById("streampreset").addEventListener("input", (event) => {
  settings = { ...settings, input: event.target.value };
  $PI.setSettings(settings);
});

// Port
document.getElementById("port").addEventListener("change", (event) => {
  const minPort = 1025;
  const maxPort = 65535;

  globalsettings = {
    ...globalsettings,
    port: Math.min(Math.max(event.target.value, minPort), maxPort),
  };

  document.getElementById("port").value = globalsettings.port;
  $PI.setGlobalSettings(globalsettings);
});

document.addEventListener("click", (event) => {
  const targetId = event.target.id;
  if (targetId === "open-setup" || targetId === "open-help") {
    switch (currentLanguage) {
      case "de":
        window.open("setupde.html");
        break;
      case "en":
      default:
        window.open("setupen.html");
        break;
    }
  }
});
