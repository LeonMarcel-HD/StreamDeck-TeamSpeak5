/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />
/// <reference path="../libs/js/stream-deck.js" />

let actionUUID = "";
let actionContext;
let TeamSpeakWebSocketConnectionStatus = false;
let PushToTalk = true;

$PI.onConnected((jsn) => {
  $PI.getGlobalSettings();
  settings = jsn.actionInfo.payload.settings;
  console.log(jsn.actionInfo.payload.settings);

  PushToTalk = jsn.actionInfo.payload.settings.pushtotalk;
  if (!jsn.actionInfo.payload.settings.pushtotalk) {
    const input = "on";
    settings.pushtotalk = input;
    $PI.setSettings(settings);
  }

  actionContext = jsn.actionInfo.context;
  Object.entries(jsn.actionInfo.payload.settings).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (el) {
      el.value = value;
    }
  });
});

$PI.onDidReceiveGlobalSettings(({payload}) => {
  console.log('onDidReceiveGlobalSettings', payload);
  TeamSpeakWebSocketConnectionStatus = payload.settings.connectionStatus;

  var layout1 = document.getElementById("sdpi-layout1");
  var layout2 = document.getElementById("sdpi-layout2");
  
  if (!TeamSpeakWebSocketConnectionStatus) {
    layout1.style.display = "block";
    layout2.style.display = "none";
  } else {
    layout2.style.display = "block";
    layout1.style.display = "none";
    if (PushToTalk == "on") {
      const rdio1 = document.querySelector("#rdio1");
      rdio1.checked = true;
    } else {
      const rdio2 = document.querySelector("#rdio2");
      rdio2.checked = true;
    }
  }
})

const radio1 = document.getElementById("rdio1");
const radio2 = document.getElementById("rdio2");
let settings;

// Push To Talk
radio1.addEventListener("click", function () {
  const input = "on";
  settings.pushtotalk = input;
  $PI.setSettings(settings);
});

// Toggle To Talk
radio2.addEventListener("click", function () {
  const input = "off";
  settings.pushtotalk = input;
  $PI.setSettings(settings);
});

document.querySelector('#open-setup').addEventListener('click', () => {
  window.open('setup.html');
});