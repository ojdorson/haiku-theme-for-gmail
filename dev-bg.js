// DEV ONLY: bridge to the local tuning server (tools/devserver.py on
// 127.0.0.1:8765). Never shipped: tools/build.py leaves this file,
// dev-content.js and their manifest entries out of the release.
const SERVER = "http://127.0.0.1:8765";
let knownVersion = null;
let changedAt = 0;

chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({ url: "https://mail.google.com/*" })) chrome.tabs.reload(tab.id);
});

async function tick(msg, sender) {
  try {
    // Script/manifest changes: reload the extension, but only once edits
    // have settled for 4s (Chromium shuts off extensions that reload a lot).
    const v = await (await fetch(`${SERVER}/version`)).text();
    if (knownVersion === null) knownVersion = v;
    else if (v !== knownVersion) {
      if (!changedAt) changedAt = Date.now();
      if (Date.now() - changedAt > 4000) {
        const again = await (await fetch(`${SERVER}/version`)).text();
        if (again === v) return chrome.runtime.reload();
        changedAt = Date.now();
      }
    }
    // CSS: hot swap into the tab when it changes.
    const cssVersion = await (await fetch(`${SERVER}/cssversion`)).text();
    if (cssVersion !== msg.cssVersion && sender.tab) {
      const css = await (await fetch(`${SERVER}/file/haiku.css`)).text();
      chrome.tabs.sendMessage(sender.tab.id, { type: "css", css, cssVersion });
    }
    const q = await (await fetch(`${SERVER}/query`)).json();
    if (q && q.id && sender && sender.tab) {
      const result = await chrome.tabs.sendMessage(sender.tab.id, { type: "inspect", query: q });
      if (result) await fetch(`${SERVER}/result`, { method: "POST", body: JSON.stringify({ id: q.id, tab: sender.tab.url, result }) });
    }
  } catch (e) {
    /* server not running: stay quiet */
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "tick") tick(msg, sender);
});
