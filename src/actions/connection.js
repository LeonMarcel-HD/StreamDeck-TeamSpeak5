/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />
/// <reference path="../libs/js/stream-deck.js" />

let actionUUID = "";
let actionContext;
let TeamSpeakWebSocketConnectionStatus = false;

$PI.onConnected((jsn) => {
  $PI.getGlobalSettings();
});

$PI.onDidReceiveGlobalSettings(({ payload }) => {
  TeamSpeakWebSocketConnectionStatus = payload.settings.connectionStatus;

  var layout1 = document.getElementById("sdpi-layout1");
  var layout2 = document.getElementById("sdpi-layout2");

  if (!TeamSpeakWebSocketConnectionStatus) {
    layout1.style.display = "block";
    layout2.style.display = "none";
  } else {
    layout2.style.display = "block";
    layout1.style.display = "none";
  }
});

document.querySelector('#open-setup').addEventListener('click', () => {
    window.open('setup.html');
  });