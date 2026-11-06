// Haiku (BeOS) Theme for Gmail: structural additions that CSS alone can't do.
//
//  - BeMail-style icon toolbar in the top bar; each button clicks Gmail's own
//    matching control, so Gmail does all the actual work.
//  - Yellow Haiku window tab over the message list, titled with the current
//    folder/label.
//  - Tracker-style column headers above the message list, positioned from the
//    real cell widths.
//  - A status bar along the bottom with the unread count and Gmail's pager.
//
// Gmail is a single-page app that rebuilds its DOM constantly, so everything
// here is idempotent: every injected node carries data-haiku and is only
// created when missing. Nodes are built with createElement/textContent only;
// Gmail enforces Trusted Types, so innerHTML would throw.
//
// Lookup tables for Gmail's controls are at the top. When a Gmail update
// breaks a toolbar button, fix its labels there.

(() => {
  "use strict";

  const icon = (name) => chrome.runtime.getURL(`icons/${name}.svg`);

  // Toolbar buttons. `labels` are tried in order against Gmail's
  // data-tooltip / aria-label (English UI), then `text` against the visible
  // text of link-style buttons (Reply / Reply all / Forward at the end of a
  // thread). `sep` draws a separator before the button.
  const TOOLS = [
    { id: "new", label: "New", icon: "compose", selector: '[gh="cm"]', always: true },
    { id: "reply", label: "Reply", icon: "reply", sep: true, labels: ["Reply"], text: ["Reply"] },
    { id: "replyall", label: "Reply All", icon: "reply", labels: ["Reply all"], text: ["Reply all"] },
    { id: "forward", label: "Forward", icon: "forward", labels: ["Forward"], text: ["Forward"] },
    { id: "archive", label: "Archive", icon: "archive", sep: true, labels: ["Archive"], alt: ".T-I.lR" },
    { id: "trash", label: "Trash", icon: "trash", labels: ["Delete"], alt: ".T-I.nX" },
    { id: "spam", label: "Junk", icon: "spam", labels: ["Report spam"], alt: ".T-I.nN" },
    { id: "unread", label: "Unread", icon: "unread", labels: ["Mark as unread", "Mark as read"], alt: ".T-I.bvt" },
    { id: "print", label: "Print", icon: "print", labels: ["Print all", "Print"] },
    { id: "prev", label: "Previous", icon: "prev", sep: true, labels: ["Newer"] },
    { id: "next", label: "Next", icon: "next", labels: ["Older"] },
  ];

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  const inOurChrome = (el) => !!el.closest("[data-haiku]");

  function findGmailControl(tool) {
    if (tool.selector) {
      return [...document.querySelectorAll(tool.selector)].find((el) => isVisible(el) && !inOurChrome(el)) || null;
    }
    for (const label of tool.labels || []) {
      const css = `[data-tooltip="${label}"],[aria-label="${label}"]`;
      const hit = [...document.querySelectorAll(css)].find((el) => isVisible(el) && !inOurChrome(el));
      if (hit) return hit;
    }
    if (tool.alt) {
      const hit = [...document.querySelectorAll(tool.alt)].find((el) => isVisible(el) && !inOurChrome(el));
      if (hit) return hit;
    }
    for (const text of tool.text || []) {
      const hit = [...document.querySelectorAll('span[role="link"], [role="button"]')].find(
        (el) => el.textContent.trim() === text && isVisible(el) && !inOurChrome(el),
      );
      if (hit) return hit;
    }
    return null;
  }

  // Gmail's controls listen for mousedown/mouseup rather than plain click.
  function press(el) {
    const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    el.dataset.haiku = "";
    return el;
  };

  // ------------------------------------------------------ compose windows
  // New messages use Gmail's in-window compose, styled as a BeMail window.
  // Set SEPARATE_COMPOSE to open them in their own browser window instead
  // (Gmail's pop-out compose page). Either way, Gmail's own pop-out button
  // opens that page, and haiku.css hides the main-window chrome there via
  // <html class="haiku-popup">.
  const SEPARATE_COMPOSE = false;
  // Compose pages in their own window: ours, Gmail's compose URL, or a
  // window Gmail itself opened (its pop-out button). Not a Gmail tab that
  // some other site opened - reading a cross-origin opener throws.
  const openedByGmail = (() => {
    try { return !!window.opener && window.opener.location.origin === location.origin; } catch (e) { return false; }
  })();
  const POPUP = openedByGmail || window.name.startsWith("haiku-compose-") || /[?&](view|tf)=cm\b/.test(location.search);
  document.documentElement.classList.toggle("haiku-popup", POPUP);
  // The pop-out window's tab has a close box (drawn by haiku.css at the
  // tab's left end): clicking it closes the window.
  if (POPUP) {
    const onBox = (e) => {
      const tab = e.target.closest && e.target.closest(".Io .aDk");
      return tab && e.clientX - tab.getBoundingClientRect().left < 18 ? tab : null;
    };
    window.addEventListener("mousedown", (e) => { const t = onBox(e); if (t) t.classList.add("haiku-pressing"); }, true);
    window.addEventListener("mouseup", () => { for (const t of document.querySelectorAll(".haiku-pressing")) t.classList.remove("haiku-pressing"); }, true);
    window.addEventListener("click", (e) => { if (onBox(e)) window.close(); }, true);
  }

  const THREAD_RE = /\/([A-Za-z0-9]{16,})$/;

  function openCompose() {
    const w = Math.min(820, screen.availWidth - 80);
    const h = Math.min(700, screen.availHeight - 80);
    window.open(`${location.origin}/mail/?view=cm&fs=1&tf=1`, `haiku-compose-${Date.now()}`, `popup,width=${w},height=${h}`);
  }

  // Gmail's own Compose button (if it is ever visible): a new window too.
  function onComposeEvent(e) {
    if (!SEPARATE_COMPOSE || POPUP) return;
    if (!e.isTrusted || e.button !== 0) return;
    const el = e.target.closest && e.target.closest('[gh="cm"]');
    if (!el || inOurChrome(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "click") openCompose();
  }
  for (const type of ["mousedown", "mouseup", "click"]) window.addEventListener(type, onComposeEvent, true);

  // ------------------------------------------------------------- toolbar
  function buildToolbar() {
    const bar = make("div", "haiku-toolbar");
    bar.setAttribute("role", "toolbar");
    for (const tool of TOOLS) {
      if (tool.sep) bar.append(make("div", "haiku-toolbar-sep"));
      const btn = make("div", "haiku-tool");
      btn.dataset.tool = tool.id;
      btn.setAttribute("role", "button");
      btn.title = tool.label;
      const img = make("img");
      img.src = icon(tool.icon);
      img.alt = "";
      btn.append(img, make("span", null, tool.label));
      btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus where it is
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = findGmailControl(tool);
        if (SEPARATE_COMPOSE && tool.id === "new") return openCompose();
        if (tool.id === "new" && !target) {
          // Gmail's Compose button is hidden by haiku.css; Gmail also opens a
          // compose window for "?compose=new" in the URL fragment.
          const hash = location.hash || "#inbox";
          location.hash = hash + (hash.includes("?") ? "&" : "?") + "compose=new";
          return;
        }
        if (target && target.getAttribute("aria-disabled") !== "true") press(target);
      });
      bar.append(btn);
    }
    return bar;
  }

  function ensureToolbar() {
    const header = document.querySelector('header[role="banner"]');
    if (!header) return;
    let bar = header.querySelector(":scope > .haiku-toolbar");
    if (!bar) {
      // Its own row under Gmail's top-bar row, like BeMail's toolbar under
      // the menu bar. Appended to the header, never inside Gmail's widgets.
      bar = buildToolbar();
      header.append(bar);
    }
    // Enable/disable buttons by whether Gmail currently offers that action.
    for (const btn of bar.querySelectorAll(".haiku-tool")) {
      const tool = TOOLS.find((t) => t.id === btn.dataset.tool);
      const target = tool.always ? true : findGmailControl(tool);
      const disabled = !target || (target !== true && target.getAttribute("aria-disabled") === "true");
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    }
  }

  // ----------------------------------------------------- window tab title
  function folderTitle() {
    // document.title is like "Inbox (3) - someone@example.com - Gmail"
    const parts = document.title.split(" - ");
    let title = parts.length >= 3 ? parts.slice(0, -2).join(" - ") : parts[0];
    if (!title || /^gmail$/i.test(title.trim())) title = "Mail";
    return title;
  }

  // Overlays live directly under <body> and are positioned over Gmail's
  // panes; Gmail's own DOM is never modified (its click handling depends on
  // its exact structure). haiku.css reserves the space they cover.
  function overlay(cls, build) {
    let el = document.querySelector(`body > .${cls}`);
    if (!el) {
      el = make("div", cls);
      if (build) build(el);
      document.body.append(el);
    }
    return el;
  }

  function place(el, left, top, width) {
    const s = el.style;
    const l = `${Math.round(left)}px`, t = `${Math.round(top)}px`, w = `${Math.round(width)}px`;
    if (s.left !== l) s.left = l;
    if (s.top !== t) s.top = t;
    if (s.width !== w) s.width = w;
  }

  // Open threads and Settings have Gmail's header bar outside [role="main"]
  // (in .aeH); the tab then sits over that bar so bar + pane read as one
  // window.
  function paneTop() {
    const thread = THREAD_RE.test(location.hash.split("?")[0]);
    document.documentElement.classList.toggle("haiku-thread", thread);
    // Open threads and Settings put their header bar in .aeH, above the pane;
    // searches can put their scope / filter bar (.biW) there too.
    const aeh = [...document.querySelectorAll(".aeH")].find(isVisible);
    const biw = !aeh && [...document.querySelectorAll(".biW")].find((el) => isVisible(el) && !el.closest('[role="main"]'));
    const bar = aeh || biw;
    const root = document.documentElement.classList;
    root.toggle("haiku-outer-bar", !!bar);
    root.toggle("haiku-outer-search", !!biw);
    return bar || [...document.querySelectorAll('[role="main"]')].find(isVisible);
  }

  // The tab's close box closes whatever is open, like closing a BeOS
  // window: an open message goes back to its list (Gmail's own Back
  // button), anything else (Settings, a search, a label) back to the Inbox.
  function viewHash() {
    return (location.hash || "#inbox").split("?")[0];
  }
  function canClose() {
    return !/^#inbox$/.test(viewHash());
  }
  function closeView() {
    if (!canClose()) return;
    if (THREAD_RE.test(viewHash())) {
      const back = [...document.querySelectorAll('.G-atb .lS, [data-tooltip^="Back to" i], [aria-label^="Back to" i]')].find(isVisible);
      if (back) return press(back);
      location.hash = viewHash().replace(THREAD_RE, "") || "#inbox";
      return;
    }
    location.hash = "#inbox";
  }

  function ensureListTab() {
    const main = paneTop();
    const row = overlay("haiku-tab-row", (el) => {
      const tab = make("div", "haiku-tab");
      const close = make("span", "haiku-closebox");
      close.setAttribute("role", "button");
      close.addEventListener("mousedown", (e) => e.preventDefault());
      close.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeView();
      });
      tab.append(close, make("span", "haiku-tab-title"));
      el.append(tab);
    });
    row.hidden = !main;
    if (!main) return;
    const r = main.getBoundingClientRect();
    place(row, r.left, r.top - 23, r.width);
    const close = row.querySelector(".haiku-closebox");
    const closable = canClose();
    if (close.getAttribute("aria-disabled") !== String(!closable)) {
      close.setAttribute("aria-disabled", String(!closable));
      close.title = closable ? "Close" : "";
      close.setAttribute("aria-label", "Close");
    }
    const title = row.querySelector(".haiku-tab-title");
    const want = folderTitle();
    if (title.textContent !== want) title.textContent = want;
  }

  // --------------------------------------------------- Tracker columns
  // The From column can be resized by dragging the line between the From and
  // Subject headings (double-click it for Gmail's default). Remembered in
  // localStorage, like the folder panel's width.
  const FROM_KEY = "haiku-from-width";
  const FROM_MIN = 80;
  const setFromWidth = (w) => {
    const root = document.documentElement;
    if (!w) {
      root.style.removeProperty("--haiku-from-w");
      root.classList.remove("haiku-from-sized");
      return 0;
    }
    w = Math.max(FROM_MIN, Math.round(w));
    root.style.setProperty("--haiku-from-w", `${w}px`);
    root.classList.add("haiku-from-sized");
    return w;
  };
  try {
    const saved = parseInt(localStorage.getItem(FROM_KEY), 10);
    if (saved) setFromWidth(saved);
  } catch (e) {
    /* storage unavailable: Gmail's width */
  }

  function startFromResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const table = [...document.querySelectorAll('[role="main"] table.F')].find(isVisible);
    const from = table && table.querySelector("tr.zA td.yX");
    if (!from) return;
    const startX = e.clientX, startW = from.getBoundingClientRect().width;
    // The setting and the cell's drawn width can differ (Gmail's From cell
    // spans an extra column in the single list), so measure the difference
    // once and work in drawn widths.
    const cur = parseFloat(document.documentElement.style.getPropertyValue("--haiku-from-w"));
    if (!cur) setFromWidth(startW);
    const offset = from.getBoundingClientRect().width - (cur || startW);
    // Leave room for the status icons, a usable Subject and the date.
    const maxW = Math.max(FROM_MIN, table.getBoundingClientRect().width - 320);
    document.body.classList.add("haiku-dragging");
    let w = cur || startW;
    const move = (ev) => {
      w = setFromWidth(Math.min(maxW, startW + ev.clientX - startX) - offset);
      ensureColumns();
    };
    const up = () => {
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", up, true);
      document.body.classList.remove("haiku-dragging");
      try { localStorage.setItem(FROM_KEY, String(w)); } catch (err) { /* ignore */ }
      window.dispatchEvent(new Event("resize")); // let Gmail re-measure
    };
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", up, true);
  }

  function resetFromWidth() {
    setFromWidth(0);
    try { localStorage.removeItem(FROM_KEY); } catch (err) { /* ignore */ }
    window.dispatchEvent(new Event("resize"));
    schedule();
  }

  const sized = new WeakSet();
  const listSize = new ResizeObserver(() => schedule());

  function ensureColumns() {
    const table = [...document.querySelectorAll('[role="main"] table.F')].find(isVisible);
    // Measure a row the mouse isn't over: hovering swaps the date cell for
    // Gmail's action buttons and changes the cell widths.
    const first = table && (table.querySelector("tr.zA:not(:hover):not(.aqw)") || table.querySelector("tr.zA"));
    const head = overlay("haiku-columns", (el) => {
      el.addEventListener("mousedown", (e) => { if (e.target.closest(".haiku-column-grip")) startFromResize(e); });
      el.addEventListener("dblclick", (e) => { if (e.target.closest(".haiku-column-grip")) resetFromWidth(); });
    });
    document.documentElement.classList.toggle("haiku-has-columns", !!first);
    head.hidden = !first;
    if (!first) return;
    // Sit just above the scrolling list, inside the main pane.
    const scroller = table.closest('[role="tabpanel"]') || table.parentElement;
    const sr = scroller.getBoundingClientRect();
    const tr = table.getBoundingClientRect();
    const main = table.closest('[role="main"]').getBoundingClientRect();
    const scroll = table.closest(".Nu") || scroller;
    // Re-measure whenever the list changes size, including when a side
    // panel (Quick settings) slides in, which fires no other event.
    if (!sized.has(scroll)) {
      sized.add(scroll);
      listSize.observe(scroll);
    }
    const right = Math.max(tr.right, scroll.getBoundingClientRect().right);
    // Pin the headers to the top of the scrolling list (.Nu), which stays
    // put under the action bar. Measuring from the pane instead made them
    // ride up over the window tab once the list scrolled.
    const listTop = table.closest(".Nu") ? scroll.getBoundingClientRect().top : Math.max(sr.top, main.top);
    place(head, tr.left, listTop - 19, right - tr.left);
    const base = tr.left;
    const cell = (sel) => first.querySelector(sel);
    const cols = [];
    const status = cell("td.oZ-x3") || cell("td.WA") || first.cells[0];
    const from = cell("td.yX");
    const subject = cell("td.xY.a4W") || cell("td.a4W");
    const date = cell("td.xW");
    // A narrow split-view list wraps the subject onto a second line; a
    // "Subject" heading over the sender would be wrong, so leave it out and
    // let "From" run to the date.
    const wrapped = !!(subject && from && subject.getBoundingClientRect().top > from.getBoundingClientRect().top + 4);
    document.documentElement.classList.toggle("haiku-wrapped-rows", wrapped);
    if (status && from) cols.push(["Status", status.getBoundingClientRect().left, from.getBoundingClientRect().left]);
    if (from) cols.push(["From", from.getBoundingClientRect().left, (wrapped && date ? date : from).getBoundingClientRect()[wrapped && date ? "left" : "right"]]);
    if (subject && !wrapped) cols.push(["Subject", subject.getBoundingClientRect().left, (date || subject).getBoundingClientRect().left]);
    if (date) cols.push(["Date", date.getBoundingClientRect().left, table.getBoundingClientRect().right]);
    const key = cols.map((c) => c.map((v) => (typeof v === "number" ? Math.round(v - base) : v)).join(":")).join("|");
    if (head.dataset.key === key) return;
    head.dataset.key = key;
    head.replaceChildren(
      ...cols.map(([name, l, r]) => {
        const col = make("div", "haiku-column", name);
        col.style.left = `${Math.round(l - base)}px`;
        col.style.width = `${Math.max(0, Math.round(r - l))}px`;
        if (name === "From" && !wrapped) {
          const grip = make("div", "haiku-column-grip");
          grip.title = "Drag to resize; double-click for the default width";
          col.append(grip);
        }
        return col;
      }),
    );
  }

  // ------------------------------------------------- folder panel splitter
  // A Haiku-style splitter between the folder panel and the message list.
  // Drag to resize; the width is remembered in localStorage.
  const NAV_KEY = "haiku-nav-width";
  const NAV_MIN = 140, NAV_MAX = 480;
  const setNavWidth = (w) => {
    w = Math.max(NAV_MIN, Math.min(NAV_MAX, Math.round(w)));
    document.documentElement.style.setProperty("--haiku-nav-w", `${w}px`);
    return w;
  };
  try {
    const saved = parseInt(localStorage.getItem(NAV_KEY), 10);
    if (saved) setNavWidth(saved);
  } catch (e) {
    /* storage unavailable: default width */
  }

  function ensureSplitter() {
    const panel = [...document.querySelectorAll(".aqn.aIH")].find(isVisible);
    const split = overlay("haiku-splitter", (el) => {
      el.title = "Drag to resize the folder list";
      el.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const p = [...document.querySelectorAll(".aqn.aIH")].find(isVisible);
        if (!p) return;
        const startX = e.clientX, startW = p.getBoundingClientRect().width;
        document.body.classList.add("haiku-dragging");
        let w = startW;
        const move = (ev) => {
          w = setNavWidth(startW + ev.clientX - startX);
          schedule();
        };
        const up = () => {
          window.removeEventListener("mousemove", move, true);
          window.removeEventListener("mouseup", up, true);
          document.body.classList.remove("haiku-dragging");
          try { localStorage.setItem(NAV_KEY, String(w)); } catch (err) { /* ignore */ }
          window.dispatchEvent(new Event("resize")); // let Gmail re-measure
        };
        window.addEventListener("mousemove", move, true);
        window.addEventListener("mouseup", up, true);
      });
    });
    split.hidden = !panel;
    if (!panel) return;
    // Sit in the gap between the folder panel (and its scrollbar) and the
    // message pane, never on top of either.
    const r = panel.getBoundingClientRect();
    const main = [...document.querySelectorAll('[role="main"]')].find(isVisible);
    const gapRight = main ? main.getBoundingClientRect().left : r.right + 7;
    const width = Math.max(5, Math.min(9, gapRight - r.right));
    place(split, r.right + Math.max(0, (gapRight - r.right - width) / 2), r.top, width);
    const h = `${Math.round(r.height)}px`;
    if (split.style.height !== h) split.style.height = h;
  }

  // Gmail sized its layout for its own header; tell the CSS how tall ours is.
  function measureHeader() {
    const header = document.querySelector('header[role="banner"]');
    if (!header) return;
    const bar = header.querySelector(":scope > .haiku-toolbar");
    if (bar) {
      const w = `${Math.ceil(bar.getBoundingClientRect().width)}px`;
      if (document.documentElement.style.getPropertyValue("--haiku-toolbar-w") !== w) {
        document.documentElement.style.setProperty("--haiku-toolbar-w", w);
      }
    }
    const h = `${Math.round(header.getBoundingClientRect().bottom)}px`;
    if (document.documentElement.style.getPropertyValue("--haiku-header-h") !== h) {
      document.documentElement.style.setProperty("--haiku-header-h", h);
    }
  }

  // ---------------------------------------------------------- status bar
  function ensureStatusBar() {
    let bar = document.querySelector("body > .haiku-statusbar");
    if (!bar) {
      bar = make("div", "haiku-statusbar");
      bar.append(make("span", "haiku-status-folder"), make("span", "haiku-status-pager"), make("span", "haiku-status-sel"));
      document.body.append(bar);
    }
    const m = document.title.match(/\((\d[\d,]*)\)/);
    const folder = folderTitle().replace(/\s*\(\d[\d,]*\)$/, "");
    const folderText = m ? `${folder}: ${m[1]} unread` : folder;
    const thread = document.documentElement.classList.contains("haiku-thread");
    const pager = [...document.querySelectorAll(thread ? ".G-atb .iG" : '[role="main"] .Dj, [gh="mtb"] .Dj')].find(isVisible);
    let pagerText = pager ? pager.textContent.trim().replace(/\s+/g, " ") : "";
    if (thread && pagerText) pagerText = `Message ${pagerText}`;
    const selected = document.querySelectorAll('[role="main"] tr.zA.x7').length;
    const selText = selected ? `${selected} selected` : "";
    const set = (cls, text) => {
      const el = bar.querySelector(cls);
      if (el.textContent !== text) el.textContent = text;
      el.hidden = !text;
    };
    set(".haiku-status-folder", folderText);
    set(".haiku-status-pager", pagerText);
    set(".haiku-status-sel", selText);
  }

  // Gmail-only extras that have no stable attribute to target from CSS.
  const HIDE_TEXT = ["Share in chat"];
  function hideExtras() {
    for (const el of document.querySelectorAll('span.ams, [role="button"]')) {
      if (el.style.display !== "none" && HIDE_TEXT.some((s) => el.textContent.trim().startsWith(s))) el.style.display = "none";
    }
  }

  // ------------------------------------------------------------- driver
  function applyAll() {
    try {
      ensureToolbar();
      measureHeader();
      ensureSplitter();
      ensureListTab();
      ensureColumns();
      ensureStatusBar();
      hideExtras();
    } catch (err) {
      console.debug("[gmail-haiku]", err);
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      setTimeout(() => {
        queued = false;
        applyAll();
      }, 250);
    });
  };

  // Ignore mutations we caused ourselves, or the observer would loop.
  const observer = new MutationObserver((records) => {
    if (records.every((r) => r.target.closest && r.target.closest("[data-haiku]"))) return;
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("click", schedule, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("hashchange", schedule);
  new MutationObserver(schedule).observe(document.querySelector("title") || document.head, { childList: true, subtree: true, characterData: true });
  applyAll();
})();
