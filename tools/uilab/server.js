// UI lab: serves resources/web with a mocked WebView2 bridge so every tab can be
// rendered and screenshotted in headless Chrome without the native app.
// Usage: node server.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.resolve(__dirname, "../../resources");
const PORT = parseInt(process.argv[2] || "8732", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

// ---- mock state -----------------------------------------------------------
const SPECS = {
  cpuName: "AMD Ryzen 7 7800X3D 8-Core Processor",
  cpuCores: 8,
  cpuThreads: 16,
  cpuBaseMhz: 4200,
  cpuMaxMhz: 5000,
  primaryGPUName: "NVIDIA GeForce RTX 4070 Ti",
  gpuVramGb: 12,
  motherboardName: "ASUS ROG STRIX B650E-F GAMING WIFI",
  ramTotalGb: 32,
  ramSpeedMhz: 6000,
  osVersion: "Windows 11 Pro 23H2 (22631.4169)",
  systemUptimeSeconds: 98234,
  monitorRefreshHz: 240,
  diskModel: "Samsung SSD 990 PRO 2TB",
  isAdmin: true
};

const TWEAKS = {
  disableDynamicTick: true,
  usePlatformClockNo: true,
  ultimatePowerPlan: true,
  disableCoreParking: true,
  powerThrottling: true,
  bootuxDisabled: true,
  usePlatformTickNo: true,
  win32PrioritySeparation: true,
  disablePagingExecutive: true,
  largeSystemCacheDisabled: true,
  gpuMsiMode: true,
  audioMsiMode: false,
  hagsEnabled: true,
  disableGameDVR: true,
  disableFullscreenOptimizations: true,
  mmcssGamesPriority: true,
  disableNetworkThrottling: true,
  tcpNoDelay: true,
  tcpAckFrequency: true,
  tcpAutoTuning: true,
  defaultTTL64: true,
  flatMouseCurve: false,
  keyboardMaxSpeed: true,
  disableTelemetry: true,
  disableErrorReporting: true,
  timerResolution05ms: true
};

const SERVICES = [
  ["SysMain", "SysMain (Superfetch)", "Кэширование часто используемых приложений в память. На NVMe-накопителях даёт обратный эффект и грузит процессор.", false, true, "Выполняется", true, false],
  ["DiagTrack", "Подключенные пользовательские возможности и телеметрия", "Сбор диагностических данных и отправка их в Microsoft. Одна из самых горячих точек DPC и диска.", false, true, "Остановлена", false, true],
  ["WSearch", "Windows Search", "Индексация файлов для поиска. Постоянно пишет на диск и грузит процессор во время индексации.", false, true, "Выполняется", true, false],
  ["Spooler", "Диспетчер печати", "Обслуживает очереди печати. Если принтеров нет — можно отключить и убрать постоянный опрос устройств.", false, false, "Выполняется", true, false],
  ["XboxGipSvc", "Служба ввода Xbox Accessory Management", "Поддержка аксессуаров Xbox. Не нужна, если играете на клавиатуре и мыши.", false, true, "Остановлена", false, true],
  ["WpnService", "Служба push-уведомлений Windows", "Доставка уведомлений и плиток. Тянет сеть и держит фоновые задачи.", false, false, "Выполняется", true, false],
  ["Fax", "Факс", "Устаревшая служба факсов. Безопасно отключается на всех домашних системах.", false, true, "Остановлена", false, true],
  ["dmwappushservice", "Служба маршрутизации push-сообщений WAP", "Часть телеметрического стека Windows. Не нужна для обычной работы.", true, false, "Остановлена", false, true]
].map(([id, displayName, description, isDanger, recommendedDisable, status, isRunning, disabled]) => ({
  id, displayName, description, isDanger, recommendedDisable, status, isRunning, disabled
}));

const STARTUP = {
  items: [
    { id: "discord", name: "Discord", publisher: "Discord Inc.", location: "HKCU\\Run", command: "\"C:\\Users\\ecst4ssy\\AppData\\Local\\Discord\\Update.exe\" --processStart Discord.exe", enabled: true, exists: true },
    { id: "steam", name: "Steam", publisher: "Valve Corporation", location: "HKCU\\Run", command: "\"C:\\Program Files (x86)\\Steam\\steam.exe\" -silent", enabled: true, exists: true },
    { id: "onedrive", name: "OneDrive", publisher: "Microsoft Corporation", location: "HKCU\\Run", command: "\"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe\" /background", enabled: true, exists: true },
    { id: "rtkauduservice", name: "Realtek Audio Console", publisher: "Realtek Semiconductor", location: "HKLM\\Run", command: "\"C:\\Program Files\\Realtek\\Audio\\RtkAudUService64.exe\" -background", enabled: true, exists: true },
    { id: "oldapp", name: "Old Updater", publisher: "Не указан", location: "HKCU\\Run", command: "\"C:\\Program Files\\Legacy\\updater.exe\" /autostart", enabled: false, exists: false },
    { id: "nvidia", name: "NVIDIA App", publisher: "NVIDIA Corporation", location: "Task Scheduler", command: "\"C:\\Program Files\\NVIDIA Corporation\\NVIDIA app\\CEF\\NVIDIA app.exe\" --startup", enabled: true, exists: true }
  ],
  totalCount: 6,
  enabledCount: 5
};

const MSI = {
  devices: [
    { id: "PCI\\VEN_10DE&DEV_2782", name: "NVIDIA GeForce RTX 4070 Ti", category: "GPU", msiEnabled: true, canModify: true, hardwareId: "PCI\\VEN_10DE&DEV_2782", location: "PCI bus 1, device 0, function 0", limit: 1 },
    { id: "PCI\\VEN_1022&DEV_1483", name: "AMD High Definition Audio Device", category: "Audio", msiEnabled: true, canModify: true, hardwareId: "PCI\\VEN_1022&DEV_1483", location: "PCI bus 0, device 8, function 1", limit: 1 },
    { id: "PCI\\VEN_8086&DEV_125C", name: "Intel Ethernet Controller I226-V", category: "Network", msiEnabled: false, canModify: true, hardwareId: "PCI\\VEN_8086&DEV_125C", location: "PCI bus 4, device 0, function 0", limit: 1 },
    { id: "PCI\\VEN_1022&DEV_43F7", name: "AMD USB 3.1 xHCI Controller", category: "USB", msiEnabled: true, canModify: true, hardwareId: "PCI\\VEN_1022&DEV_43F7", location: "PCI bus 0, device 20, function 0", limit: 1 },
    { id: "PCI\\VEN_144D&DEV_A80A", name: "Samsung NVMe Controller", category: "Storage", msiEnabled: true, canModify: false, hardwareId: "PCI\\VEN_144D&DEV_A80A", location: "PCI bus 2, device 0, function 0", limit: 1 }
  ],
  total: 5,
  msiCount: 4
};

const MEMORY = {
  totalBytes: 34359738368,
  usedBytes: 12884901888,
  availableBytes: 21474836480,
  standbyBytes: 3865470566,
  freeBytes: 8589934592,
  cachedBytes: 4294967296,
  commitTotalBytes: 17179869184,
  pageFileTotalBytes: 4294967296,
  pageFileUsedBytes: 1073741824,
  percentUsed: 37.5,
  percentStandby: 11.2,
  percentFree: 25.0
};

const GAME_BOOST = {
  enabled: true,
  activeGame: null,
  activePid: 0,
  settings: { highPriority: true, standbyPurge: true, lockTimer: true },
  games: [
    { name: "Counter-Strike 2", exe: "cs2.exe", enabled: true, custom: false },
    { name: "Dota 2", exe: "dota2.exe", enabled: true, custom: false },
    { name: "Apex Legends", exe: "r5apex.exe", enabled: false, custom: true }
  ]
};

const UPDATE = {
  currentVersion: "3.5.0",
  latestVersion: "3.5.0",
  available: false,
  releaseUrl: "https://github.com/ext3ndedsoft/windows-config-studio/releases/latest",
  changelog: "Текущая сборка содержит актуальные оптимизации BCD, таймеров, прерываний MSI и анти-телеметрии.",
  publishedAt: "2026-10-25",
  lastCheck: "только что"
};

const CONFIG = {
  runInBackground: true, startMinimizedToTray: false, autostartWithWindows: false,
  autoRamCleanEnabled: true, ramThresholdPercent: 80, ramCleanIntervalMinutes: 30,
  trimWorkingSetOnThreshold: true, clearCacheOnThreshold: true,
  trimWorkingSetOnInterval: false, clearCacheOnInterval: false,
  themeAccent: "cyan", gameBoostEnabled: true, boostHighPriority: true,
  boostStandbyPurge: true, boostLockTimer: true, customBoostGames: [],
  autoCheckUpdates: true, updateChannel: "stable"
};

const CLEANUP = { temp: true, prefetch: true, thumbnail: true, dns: true, recycle: true, logs: false, delivery: true, wer: true };

const WIN11 = [
  { id: "restoreClassicContextMenu", name: "Классическое контекстное меню", description: "Возвращает меню «Показать дополнительные параметры» сразу, без лишнего клика.", applied: true, recommended: true },
  { id: "disableWidgets", name: "Отключить виджеты", description: "Убирает панель виджетов и связанные фоновые процессы.", applied: true, recommended: true },
  { id: "disableCopilot", name: "Отключить Copilot", description: "Скрывает кнопку Copilot и отключает интеграцию.", applied: false, recommended: true },
  { id: "disableChat", name: "Отключить Chat (Teams)", description: "Убирает значок чата из панели задач.", applied: true, recommended: false },
  { id: "disableBingSearch", name: "Отключить Bing в поиске", description: "Поиск работает только по локальным файлам и приложениям.", applied: false, recommended: true }
];

const APPX = [
  { name: "Xbox", packageFullName: "Microsoft.XboxApp_48.89.0601.0_x64__8wekyb3d8bbwe", selected: false, isSystem: false },
  { name: "Clipchamp", packageFullName: "Clipchamp.Clipchamp_2.9.9.0_x64__8wekyb3d8bbwe", selected: false, isSystem: false },
  { name: "Связь с телефоном", packageFullName: "Microsoft.YourPhone_1.24052.90.0_x64__8wekyb3d8bbwe", selected: false, isSystem: false },
  { name: "Карты", packageFullName: "Microsoft.WindowsMaps_11.2405.1.0_x64__8wekyb3d8bbwe", selected: false, isSystem: false }
];

const GAMES = [
  { name: "Counter-Strike 2", appId: "730", source: "Steam", installed: true, cover: "", path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive" },
  { name: "Dota 2", appId: "570", source: "Steam", installed: true, cover: "", path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\dota 2 beta" },
  { name: "Cyberpunk 2077", appId: "1091500", source: "Steam", installed: true, cover: "", path: "C:\\Games\\Cyberpunk 2077" },
  { name: "Apex Legends", appId: "1172470", source: "Steam", installed: true, cover: "", path: "C:\\Games\\Apex" }
];

function initialState() {
  return {
    specs: SPECS, tweaks: TWEAKS, systemSuite: {}, contextMenu: {},
    win11Tweaks: WIN11, services: SERVICES, appx: APPX, cleanup: CLEANUP,
    memory: MEMORY, timerLockActive: true, startup: STARTUP, msi: MSI,
    gameBoost: GAME_BOOST, currentVersion: "3.5.0", update: UPDATE, config: CONFIG
  };
}

function mockReply(action) {
  switch (action) {
    case "getInitialState": return initialState();
    case "getSystemSpecs": return SPECS;
    case "getTweaksState": return TWEAKS;
    case "getConfig": return CONFIG;
    case "getServices": return { services: SERVICES };
    case "getStartupItems": return STARTUP;
    case "getMsiDevices": return MSI;
    case "getMemoryStats": return MEMORY;
    case "getWin11Tweaks": return WIN11;
    case "getAppx": return { items: APPX };
    case "getGameBoostStatus": return GAME_BOOST;
    case "scanInstalledGames": return { games: GAMES };
    case "checkUpdates": return UPDATE;
    default: return { success: true };
  }
}

// ---- bridge shim + driver --------------------------------------------------
const MOCK_STATE = {
  specs: SPECS, tweaks: TWEAKS, systemSuite: {}, contextMenu: {},
  win11Tweaks: WIN11, services: SERVICES, appx: APPX, cleanup: CLEANUP,
  memory: MEMORY, timerLockActive: true, startup: STARTUP, msi: MSI,
  gameBoost: GAME_BOOST, currentVersion: "3.5.0", update: UPDATE, config: CONFIG
};

const SHIM = `<script>
(function () {
  var STATE = ${JSON.stringify(MOCK_STATE)};
  var handlers = [];
  window.__wcsMock = function (action) {
    switch (action) {
      case "getInitialState": return STATE;
      case "getSystemSpecs": return STATE.specs;
      case "getTweaksState": return STATE.tweaks;
      case "getConfig": return STATE.config;
      case "getServices": return { services: STATE.services };
      case "getStartupItems": return STATE.startup;
      case "getMsiDevices": return STATE.msi;
      case "getMemoryStats": return STATE.memory;
      case "getWin11Tweaks": return STATE.win11Tweaks;
      case "getAppx": return { items: STATE.appx };
      case "getGameBoostStatus": return STATE.gameBoost;
      case "scanInstalledGames": return { games: ${JSON.stringify(GAMES)} };
      case "checkUpdates": return STATE.update;
      default: return { success: true };
    }
  };
  window.chrome = window.chrome || {};
  window.chrome.webview = {
    postMessage: function (payload) {
      try {
        var p = typeof payload === "string" ? JSON.parse(payload) : payload;
        var reply = window.__wcsMock ? window.__wcsMock(p.action, p.params) : { success: true };
        setTimeout(function () {
          handlers.forEach(function (fn) {
            try { fn({ data: { id: p.id, data: reply } }); } catch (e) { console.error(e); }
          });
        }, 30);
      } catch (e) { console.error(e); }
    },
    addEventListener: function (t, fn) { if (t === "message") handlers.push(fn); },
    removeEventListener: function () {}
  };
})();
</script>`;

const DRIVER = `<script>
(function () {
  function boot() {
    var q = new URLSearchParams(location.search);
    var accent = q.get("accent") || "cyan";
    document.body.classList.add("theme-" + accent);
    if (q.get("clean") === "1") {
      // Stabilise decorative animations so headless captures are deterministic.
      var st = document.createElement("style");
      st.textContent =
        ".sakura-petal,.alpine-meteor,.alpine-mist,.alpine-aurora{display:none!important}" +
        ".tab-pane{opacity:1!important;transform:none!important;animation:none!important}" +
        ".app-content,.content-header{opacity:1!important;transform:none!important;animation:none!important}";
      document.head.appendChild(st);
      document.body.classList.add("app-loaded");
    }
    var tab = parseInt(q.get("tab") || "0", 10);
    try { if (typeof selectThemeBg === "function") selectThemeBg(q.get("bg") || "cosmos"); } catch (e) {}
    try { if (typeof switchTab === "function") switchTab(tab); } catch (e) {}
    document.title = "WCS " + tab;
  }
  if (document.readyState === "complete") setTimeout(boot, 350);
  else window.addEventListener("load", function () { setTimeout(boot, 350); });
})();
</script>`;

http.createServer((req, res) => {
  let p = url.parse(req.url).pathname;
  if (p === "/" || p === "/index.html") p = "/web/index.html";
  const file = path.join(ROOT, decodeURIComponent(p));
  if (!path.normalize(file).startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("not found: " + p); return; }
    const ext = path.extname(file).toLowerCase();
    let type = MIME[ext] || "application/octet-stream";
    if (ext === ".html") {
      let html = buf.toString("utf8");
      html = html.replace(/<head([^>]*)>/i, "<head$1>" + SHIM);
      html = html.replace(/<\/body>/i, DRIVER + "</body>");
      buf = Buffer.from(html, "utf8");
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", () => console.log("UI lab on http://127.0.0.1:" + PORT + "/index.html"));