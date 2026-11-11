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

  // Actions on the open message or the selected messages. They live in the
  // window they act on, as in BeMail and Tracker: haiku.js draws them as a
  // strip in the message window's and the list window's own toolbar. Each
  // presses Gmail's matching control: `labels` are tried in order against
  // Gmail's data-tooltip / aria-label (English UI), then `alt` selectors,
  // then `text` against the visible text of link-style buttons (Reply /
  // Reply all / Forward at the end of a thread).
  const ACTIONS = [
    { id: "reply", label: "Reply", icon: "reply", labels: ["Reply"], text: ["Reply"] },
    { id: "replyall", label: "Reply All", icon: "reply-all", labels: ["Reply all"], text: ["Reply all"] },
    { id: "forward", label: "Forward", icon: "forward", labels: ["Forward"], text: ["Forward"] },
    // Hidden (not greyed) where Gmail can't archive at all - Spam and Trash,
    // where Gmail shows its Archive permanently disabled; greyed is kept for
    // "not right now" (e.g. nothing selected).
    { id: "archive", label: "Archive", icon: "archive", labels: ["Archive"], alt: ".T-I.lR", hideIfAbsent: true },
    // In Spam and Trash Gmail offers "Delete forever" instead of Delete, and
    // "Not spam" instead of Report spam: the same buttons press those (a
    // `variant`, with its own name and an optional badge on the icon).
    { id: "trash", label: "Trash", icon: "trash", labels: ["Delete"], alt: ".T-I.nX",
      variants: [{ alt: ".T-I.aFi", text: ["Delete forever"], label: "Delete Forever", badge: "delete-forever" }] },
    { id: "spam", label: "Junk", icon: "spam", labels: ["Report spam"], alt: ".T-I.nN",
      variants: [{ alt: ".T-I.aFk", labels: ["Not spam"], label: "Not Junk", badge: "check" }] },
    { id: "unread", label: "Unread", icon: "unread", labels: ["Mark as unread", "Mark as read"], alt: ".T-I.bvt" },
    { id: "print", label: "Print", icon: "print", labels: ["Print all", "Print"] },
    { id: "prev", label: "Previous", icon: "prev", labels: ["Newer"] },
    { id: "next", label: "Next", icon: "next", labels: ["Older"] },
  ];

  // Saved searches, like Tracker's queries: one click runs a Gmail search,
  // shown in the list window with the query's name on its tab. The user's
  // own list - saved from any search, edited, reordered - lives in the
  // browser's synced extension storage (storage.sync), so it follows them
  // to their other computers; these are the defaults until they change it.
  // A query's button is Tracker's query icon with the query's own picture
  // (`badge`) over its lower right.
  const DEFAULT_QUERIES = [
    { id: "q-unread", label: "Unread", badge: "unread", query: "is:unread" },
    { id: "q-starred", label: "Starred", badge: "star-on", query: "is:starred" },
    { id: "q-attach", label: "Attachments", badge: "paperclip", query: "has:attachment" },
  ];
  // Pictures offered in the Save Query window ("" = none): Haiku's own
  // icons (and two drawn in its style), chosen for what people look for in
  // mail - not Gmail's folders, which already have their own places.
  const QUERY_BADGES = [
    ["heart", "Loved ones"], ["people", "People"], ["paperclip", "Attachments"], ["briefcase", "Work"],
    ["clock", "Time-sensitive"], ["stopwatch", "Snoozed or waiting"], ["todo", "To-do"],
    ["recipes", "Recipes"], ["box", "Orders and deliveries"], ["document", "Documents and notes"], ["megaphone", "Newsletters and announcements"],
    ["picture", "Photos"], ["rocket", "Projects"], ["chart", "Reports and statistics"], ["", "None"],
  ];
  // The built-in queries keep their own pictures even though the Save Query
  // window doesn't offer them (Unread, Starred: Gmail's own states), and
  // queries saved earlier with "important" keep theirs.
  const BADGE_IDS = new Set([...QUERY_BADGES.map(([id]) => id), ...DEFAULT_QUERIES.map((d) => d.badge), "important"]);
  const DEFAULT_BADGE = new Map(DEFAULT_QUERIES.map((d) => [d.id, d.badge]));
  const QUERY_KEY = "queries";
  const syncStore = (() => {
    try { return chrome.storage && chrome.storage.sync; } catch (e) { return null; }
  })();

  const cleanQuery = (q) => ({
    id: String(q.id || ""),
    label: String(q.label || "").trim().slice(0, 40),
    query: String(q.query || "").trim().slice(0, 500),
    badge: BADGE_IDS.has(q.badge) ? q.badge : (DEFAULT_BADGE.get(String(q.id)) || ""),
  });
  let QUERIES = DEFAULT_QUERIES.map(cleanQuery);
  let queriesVersion = 0;

  // Stored as { savedAt, list }. Each save also goes into the page's own
  // localStorage at once: Firefox commits storage.sync writes a second or
  // more later, and a reload in between lost the query. On load the newer
  // copy wins, and a newer local copy is pushed to sync again.
  const LOCAL_KEY = "haiku-queries";
  const readLocal = () => {
    try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY)); return v && Array.isArray(v.list) ? v : null; } catch (e) { return null; }
  };

  function setQueries(list, save, savedAt) {
    const seen = new Set();
    QUERIES = (Array.isArray(list) ? list : []).map(cleanQuery)
      .filter((q) => q.id && q.label && q.query && !seen.has(q.id) && seen.add(q.id));
    queriesVersion++;
    TOOLS = makeTools();
    if (save) {
      const value = { savedAt: savedAt || Date.now(), list: QUERIES };
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
      if (syncStore) {
        try { syncStore.set({ [QUERY_KEY]: value }); } catch (e) { /* storage unavailable */ }
      }
    }
    schedule();
  }
  try {
    if (syncStore) {
      syncStore.get(QUERY_KEY, (r) => {
        const synced = r && r[QUERY_KEY] && Array.isArray(r[QUERY_KEY].list) ? r[QUERY_KEY] : null;
        const local = readLocal();
        if (local && (!synced || local.savedAt > synced.savedAt)) setQueries(local.list, true, local.savedAt);
        else if (synced) setQueries(synced.list, false);
      });
      // Saved, edited or removed in another tab or on another computer.
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !changes[QUERY_KEY]) return;
        const v = changes[QUERY_KEY].newValue;
        const local = readLocal();
        if (v && Array.isArray(v.list) && (!local || v.savedAt >= local.savedAt)) {
          try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
          setQueries(v.list, false);
        } else if (!v) {
          setQueries(DEFAULT_QUERIES, false);
        }
      });
    } else {
      const local = readLocal();
      if (local) setQueries(local.list, false);
    }
  } catch (e) {
    /* storage unavailable: the defaults */
  }

  // The search the list window is showing ("#search/<query>", not an open
  // message), decoded; Gmail writes spaces as "+".
  const normQuery = (q) => (q || "").trim().replace(/\s+/g, " ");
  function hashQuery() {
    const m = (location.hash || "").split("?")[0].match(/^#search\/([^/]+)$/);
    if (!m) return null;
    try { return normQuery(decodeURIComponent(m[1].replace(/\+/g, " "))); } catch (e) { return null; }
  }
  const queryHash = (q) => `#search/${encodeURIComponent(normQuery(q.query))}`;
  const currentQuery = () => {
    const h = hashQuery();
    return h ? QUERIES.find((q) => normQuery(q.query) === h) : undefined;
  };
  // Clicking a query's button opens its results; clicking it again while
  // they show goes back to where you were before the first query (moving
  // from one query to another keeps that place), else the Inbox.
  let beforeQueries = null;
  function toggleQuery(q) {
    const active = currentQuery();
    if (active && active.id === q.id) {
      const back = beforeQueries || "#inbox";
      beforeQueries = null;
      location.hash = back;
      return;
    }
    if (!active) beforeQueries = location.hash || "#inbox";
    location.hash = queryHash(q);
  }

  // The app bar (the big toolbar under Gmail's top row): things for the
  // mail app as a whole, not for one message. `sep` draws a separator before
  // the button; `always` buttons are never greyed out. Rebuilt whenever the
  // saved queries change.
  function makeTools() {
    return [
      { id: "new", label: "New", icon: "compose", selector: '[gh="cm"]', always: true },
      { id: "checkmail", label: "Check Mail", icon: "check-mail", sep: true, always: true, action: () => checkMail() },
      // Boomerang's Pause Inbox, moved up here from its big sidebar button;
      // only shown while Boomerang is installed (see updateToolStates).
      { id: "pause", label: "Pause", icon: "unread", badge: "pause-badge", always: true, title: "Pause Inbox (Boomerang)",
        action: () => { const b = document.getElementById("ibp-main"); if (b) press(b); } },
      ...QUERIES.map((q, i) => ({ ...q, icon: "query", isQuery: true, sep: i === 0, always: true, action: () => toggleQuery(q) })),
      // Only while a search that isn't saved yet is showing.
      { id: "q-save", label: "Save Query", icon: "query", badge: "plus", sep: !QUERIES.length, always: true,
        title: "Save this search as a query", action: () => openQueryDialog(null) },
      // Only when the queries don't all fit.
      { id: "q-more", label: "Queries", icon: "query", always: true, title: "More queries",
        action: (btn) => openQueriesMenu(btn) },
      { id: "drive", label: "Drive", icon: "drive", sep: true, always: true, title: "Google Drive (new window)",
        action: () => window.open("https://drive.google.com/", "_blank", "noopener") },
    ];
  }
  let TOOLS = makeTools();
  const findTool = (id) => TOOLS.find((t) => t.id === id) || ACTIONS.find((t) => t.id === id);

  // Gmail's Refresh where the list shows one; anywhere else (an open
  // message, Settings), open the Inbox, which Gmail loads fresh.
  function checkMail() {
    const refresh = [...document.querySelectorAll('.G-atb [data-tooltip="Refresh"], .G-atb [aria-label="Refresh"]')].find(isVisible);
    if (refresh) return press(refresh);
    location.hash = "#inbox";
  }

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  const inOurChrome = (el) => !!el.closest("[data-haiku]");

  // Gmail's control for a tool, or for the first of its variants Gmail
  // offers instead. activeVariant() says which variant, if any.
  function findGmailControl(tool) {
    const own = findOwnControl(tool);
    if (own || !tool.variants) return own;
    for (const v of tool.variants) {
      const hit = findOwnControl(v);
      if (hit) return hit;
    }
    return null;
  }
  function activeVariant(tool) {
    if (!tool.variants || findOwnControl(tool)) return null;
    return tool.variants.find((v) => findOwnControl(v)) || null;
  }

  function findOwnControl(tool) {
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
  // One button: `cls` "haiku-tool" (icon over label, app bar) or
  // "haiku-msgtool" (icon only, a window's own toolbar).
  // An icon, or for queries Tracker's query icon with the query's own
  // picture (badge) over its lower right, like Tracker's combined icons.
  function makeIcon(name, badge) {
    const img = make("img");
    img.src = icon(name);
    img.alt = "";
    if (!badge) return img;
    const stack = make("span", "haiku-icon-stack");
    const b = make("img", "haiku-icon-badge");
    b.src = icon(badge);
    b.alt = "";
    stack.append(img, b);
    return stack;
  }

  function makeToolButton(tool, cls) {
    const btn = make("div", cls);
    btn.dataset.tool = tool.id;
    if (tool.isQuery) btn.dataset.query = "";
    btn.setAttribute("role", "button");
    btn.title = tool.title || tool.label;
    btn.append(makeIcon(tool.icon, tool.badge));
    if (cls === "haiku-tool") btn.append(make("span", null, tool.label));
    else btn.setAttribute("aria-label", tool.label);
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus where it is
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      runTool(tool, btn);
    });
    return btn;
  }

  function runTool(tool, btn) {
    if (tool.action) return tool.action(btn);
    if (SEPARATE_COMPOSE && tool.id === "new") return openCompose();
    const target = findGmailControl(tool);
    if (tool.id === "new" && !target) {
      // Gmail's Compose button is hidden by haiku.css; Gmail also opens a
      // compose window for "?compose=new" in the URL fragment.
      const hash = location.hash || "#inbox";
      location.hash = hash + (hash.includes("?") ? "&" : "?") + "compose=new";
      return;
    }
    if (target && target.getAttribute("aria-disabled") !== "true") press(target);
  }

  const toolDisabled = (tool) => {
    if (tool.always) return false;
    const target = findGmailControl(tool);
    return !target || target.getAttribute("aria-disabled") === "true";
  };

  // Enable/disable buttons by whether Gmail currently offers that action;
  // a query's button stays pressed while its search is open.
  function updateToolStates(container) {
    const active = currentQuery();
    for (const btn of container.querySelectorAll("[data-tool]")) {
      const tool = findTool(btn.dataset.tool);
      if (!tool) continue;
      if (tool.id === "pause") {
        const src = document.getElementById("ibp-main");
        if (btn.hidden === !!src) btn.hidden = !src;
        const t = src ? (src.textContent.trim() + " (Boomerang)") : "";
        if (t && btn.title !== t) btn.title = t;
      }
      const want = toolDisabled(tool) ? "true" : "false";
      if (btn.getAttribute("aria-disabled") !== want) btn.setAttribute("aria-disabled", want);
      if (tool.variants) {
        // Show what the button will actually do here (e.g. Not Junk in Spam).
        const v = activeVariant(tool);
        const key = v ? v.label : "";
        if ((btn.dataset.variant || "") !== key) {
          btn.dataset.variant = key;
          const label = v ? v.label : tool.label;
          btn.title = label;
          if (btn.hasAttribute("aria-label")) btn.setAttribute("aria-label", label);
          const span = btn.querySelector(":scope > span:not(.haiku-icon-stack)");
          if (span) span.textContent = label;
          btn.firstElementChild.replaceWith(makeIcon(tool.icon, v && v.badge));
        }
      }
      if (tool.isQuery) {
        const on = !!active && active.id === tool.id;
        const pressed = on ? "true" : "false";
        if (btn.getAttribute("aria-pressed") !== pressed) btn.setAttribute("aria-pressed", pressed);
        const title = on ? `Leave ${tool.label} (back to where you were)` : `${tool.label}: ${tool.query} (right-click to edit)`;
        if (btn.title !== title) btn.title = title;
      }
    }
  }

  function buildToolbar() {
    const bar = make("div", "haiku-toolbar");
    bar.setAttribute("role", "toolbar");
    bar.dataset.qv = String(queriesVersion);
    for (const tool of TOOLS) {
      if (tool.sep) bar.append(make("div", "haiku-toolbar-sep"));
      bar.append(makeToolButton(tool, "haiku-tool"));
    }
    // Right-click a query: edit, move or remove it.
    bar.addEventListener("contextmenu", (e) => {
      const btn = e.target.closest && e.target.closest(".haiku-tool[data-query]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      openQueryContextMenu(btn.dataset.tool, e.clientX, e.clientY);
    });
    return bar;
  }

  function ensureToolbar() {
    const header = document.querySelector('header[role="banner"]');
    if (!header) return;
    let bar = header.querySelector(":scope > .haiku-toolbar");
    if (bar && bar.dataset.qv !== String(queriesVersion)) {
      // The saved queries changed (here, in another tab or on another
      // computer): rebuild with the new list.
      bar.replaceWith(buildToolbar());
      bar = header.querySelector(":scope > .haiku-toolbar");
    }
    if (!bar) {
      // Its own row under Gmail's top-bar row, like BeMail's toolbar under
      // the menu bar. Appended to the header, never inside Gmail's widgets.
      bar = buildToolbar();
      header.append(bar);
    }
    // "Save Query" only while a search that isn't saved yet is showing.
    const save = bar.querySelector('[data-tool="q-save"]');
    const canSave = !!hashQuery() && !currentQuery();
    if (save.hidden === canSave) save.hidden = !canSave;
    updateToolStates(bar);
    fitQueries(bar);
  }

  // More queries than fit before the search field: the last ones move into
  // the "Queries" menu button. Recomputed only when something that changes
  // the widths changes.
  function fitQueries(bar) {
    const search = document.querySelector('header[role="banner"] form[role="search"]');
    const more = bar.querySelector('[data-tool="q-more"]');
    const save = bar.querySelector('[data-tool="q-save"]');
    const key = `${innerWidth}|${queriesVersion}|${save.hidden}`;
    if (!search || bar.dataset.fit === key) return;
    bar.dataset.fit = key;
    const queries = [...bar.querySelectorAll(".haiku-tool[data-query]")];
    for (const q of queries) q.hidden = false;
    more.hidden = true;
    // Keep the search field at least 240px wide: Gmail shrinks it to make
    // room, so measure against where a 240px field would start.
    const sr = search.getBoundingClientRect();
    const limit = Math.min(sr.left, sr.right - 240) - 12;
    const right = () => Math.max(...[...bar.children].filter((c) => !c.hidden && c.offsetWidth).map((c) => c.getBoundingClientRect().right));
    for (let i = queries.length - 1; i >= 0 && right() > limit; i--) {
      queries[i].hidden = true;
      more.hidden = false;
    }
  }

  // ------------------------------------------------- window action strips
  // The actions live in the window they act on, right after the first
  // button of that window's own toolbar: "Back to Inbox" in a message,
  // the Select checkbox in a list (Inbox, a label, a search). Icon-only at
  // that toolbar's size. An overlay like the window tab (never inside
  // Gmail's toolbar); haiku.css reserves its width after that first group.
  // "|" is a separator. `spare` buttons move into a "more" menu when the
  // window is too narrow for the whole strip next to Gmail's own buttons.
  const STRIPS = {
    thread: {
      anchor: ".G-atb .lS",
      label: "Message actions",
      tools: ["reply", "replyall", "forward", "|", "archive", "trash", "spam", "unread", "|", "print", "|", "prev", "next"],
      spare: ["replyall", "unread", "print", "prev", "next"],
    },
    list: {
      anchor: ".G-atb .T-I.T-Pm",
      label: "Actions on the selected messages",
      tools: ["archive", "trash", "spam", "unread"],
      spare: ["spam", "unread"],
    },
  };

  function buildStrip(el, ctx) {
    const spec = STRIPS[ctx];
    el.dataset.ctx = ctx;
    el.setAttribute("aria-label", spec.label);
    el.replaceChildren();
    for (const id of spec.tools) {
      if (id === "|") {
        el.append(make("div", "haiku-msgtools-sep"));
        continue;
      }
      const btn = makeToolButton(findTool(id), "haiku-msgtool");
      if (spec.spare.includes(id)) btn.dataset.spare = "";
      el.append(btn);
    }
    const more = make("div", "haiku-msgtool haiku-msgtools-more");
    more.setAttribute("role", "button");
    more.setAttribute("aria-haspopup", "menu");
    more.setAttribute("aria-label", "More actions");
    more.title = "More actions";
    more.textContent = "»";
    more.addEventListener("mousedown", (e) => e.preventDefault());
    more.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSpareMenu(more, spec);
    });
    el.append(more);
    // A separator whose buttons up to the next separator are all spare goes
    // with them in a narrow window.
    for (const sep of el.querySelectorAll(".haiku-msgtools-sep")) {
      let n = sep.nextElementSibling, all = true;
      for (; n && !n.classList.contains("haiku-msgtools-sep") && n !== more; n = n.nextElementSibling) {
        if (!("spare" in n.dataset)) all = false;
      }
      if (all) sep.dataset.spare = "";
    }
    delete el.dataset.wFull;
    delete el.dataset.wCompact;
  }

  // Natural widths of the strip with and without its spare buttons.
  function measureStrip(el) {
    if (!el.dataset.wFull) {
      const was = el.classList.contains("haiku-compact");
      el.classList.remove("haiku-compact");
      el.dataset.wFull = String(Math.ceil(el.getBoundingClientRect().width));
      el.classList.add("haiku-compact");
      el.dataset.wCompact = String(Math.ceil(el.getBoundingClientRect().width));
      el.classList.toggle("haiku-compact", was);
    }
    return [parseFloat(el.dataset.wFull), parseFloat(el.dataset.wCompact)];
  }

  // Buttons for actions Gmail doesn't offer in this view at all disappear;
  // the strip is re-measured when that changes.
  // Open message: gone when Gmail lacks the control or has it disabled (it
  // never disables Archive elsewhere). List: by folder, since with nothing
  // selected Gmail drops its selection buttons everywhere.
  const SPAM_TRASH = /^#(spam|trash)(\/|$)/;
  function hideAbsentTools(strip) {
    const ctx = strip.dataset.ctx;
    let key = "";
    for (const btn of strip.querySelectorAll("[data-tool]")) {
      const tool = findTool(btn.dataset.tool);
      if (!tool || !tool.hideIfAbsent) continue;
      let gone;
      if (ctx === "list") gone = SPAM_TRASH.test(location.hash || "");
      else {
        const target = findGmailControl(tool);
        gone = !target || target.getAttribute("aria-disabled") === "true" || target.classList.contains("T-I-JE");
      }
      if (btn.hidden !== gone) btn.hidden = gone;
      key += gone ? btn.dataset.tool : "";
    }
    if ((strip.dataset.absent || "") !== key) {
      strip.dataset.absent = key;
      delete strip.dataset.wFull;
      delete strip.dataset.wCompact;
    }
    // Gmail can still be building its toolbar: while something is hidden,
    // look again a few times for this view rather than wait for the next
    // page change (a hidden button gets no hover to trigger one).
    const view = location.hash;
    if (!key) absentRetries = { view, left: 4 };
    else {
      if (absentRetries.view !== view) absentRetries = { view, left: 4 };
      if (absentRetries.left > 0) {
        absentRetries.left--;
        setTimeout(schedule, 600);
      }
    }
  }
  let absentRetries = { view: "", left: 0 };

  function ensureMessageTools() {
    const thread = document.documentElement.classList.contains("haiku-thread");
    const ctx = thread ? "thread" : "list";
    const anchorBtn = [...document.querySelectorAll(STRIPS[ctx].anchor)].find((el) => isVisible(el) && !inOurChrome(el));
    const strip = overlay("haiku-msgtools", (el) => {
      el.setAttribute("role", "toolbar");
      buildStrip(el, ctx);
    });
    const root = document.documentElement;
    if (strip.dataset.ctx !== ctx) {
      closeSpareMenu();
      buildStrip(strip, ctx);
    }
    root.classList.toggle("haiku-has-msgtools", !!anchorBtn);
    strip.hidden = !anchorBtn;
    if (!anchorBtn) return closeSpareMenu();
    hideAbsentTools(strip);
    const [full, compact] = measureStrip(strip);
    // Room up to the visible edge (Gmail gives its bar a minimum width, so
    // in a narrow window it runs past the edge and is cut off there), less
    // Gmail's own buttons. Their widths don't depend on the gap we reserve,
    // so this can't flip back and forth.
    const bar = anchorBtn.closest(".G-atb");
    const br = bar.getBoundingClientRect();
    const room = Math.min(br.right, document.documentElement.clientWidth) - br.left;
    const need = [...bar.querySelectorAll(".G-Ni")].filter(isVisible)
      .reduce((sum, g) => sum + g.getBoundingClientRect().width, 0);
    const narrow = need + full + 16 > room;
    if (strip.classList.contains("haiku-compact") !== narrow) {
      strip.classList.toggle("haiku-compact", narrow);
      if (!narrow) closeSpareMenu();
    }
    const w = `${narrow ? compact : full}px`;
    if (root.style.getPropertyValue("--haiku-msgtools-w") !== w) root.style.setProperty("--haiku-msgtools-w", w);
    // The window's first toolbar group, then the reserved gap the strip fills.
    const r = (anchorBtn.closest(".G-Ni") || anchorBtn).getBoundingClientRect();
    const s = strip.style, l = `${Math.round(r.right)}px`, t = `${Math.round(r.top)}px`;
    if (s.left !== l) s.left = l;
    if (s.top !== t) s.top = t;
    updateToolStates(strip);
    // A list's actions apply to the selected messages: greyed until there
    // are some (Gmail keeps its own hidden buttons enabled regardless).
    if (ctx === "list" && !document.querySelector('[role="main"] tr.zA.x7')) {
      for (const btn of strip.querySelectorAll("[data-tool]")) {
        if (btn.getAttribute("aria-disabled") !== "true") btn.setAttribute("aria-disabled", "true");
      }
    }
  }

  // Haiku pop-up menus (BMenu): the strip's » menu, the Queries menu and a
  // query's right-click menu. Items: { label, icon, badge, disabled,
  // action } or "-" for a separator. `at` is the button the menu drops
  // from, or a { x, y } point.
  function closeMenu() {
    const menu = document.querySelector("body > .haiku-menu");
    if (menu) menu.remove();
    for (const b of document.querySelectorAll('[data-haiku][aria-expanded="true"]')) b.removeAttribute("aria-expanded");
  }
  const closeSpareMenu = closeMenu;

  function openMenu(at, items) {
    closeMenu();
    const menu = make("div", "haiku-menu");
    menu.setAttribute("role", "menu");
    for (const it of items) {
      if (it === "-") {
        menu.append(make("div", "haiku-menu-sep"));
        continue;
      }
      const item = make("div", "haiku-menu-item");
      item.setAttribute("role", "menuitem");
      const pic = it.icon ? makeIcon(it.icon, it.badge) : make("span", "haiku-menu-noicon");
      item.append(pic, make("span", null, it.label));
      if (it.disabled) item.setAttribute("aria-disabled", "true");
      item.addEventListener("mousedown", (e) => e.preventDefault());
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (it.disabled) return;
        closeMenu();
        it.action();
      });
      menu.append(item);
    }
    document.body.append(menu);
    const mw = menu.getBoundingClientRect().width, mh = menu.getBoundingClientRect().height;
    let x, y;
    if (at instanceof Element) {
      const r = at.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 2;
      at.setAttribute("aria-expanded", "true");
    } else {
      x = at.x;
      y = at.y;
    }
    x = Math.max(4, Math.min(x, document.documentElement.clientWidth - mw - 4));
    y = Math.max(4, Math.min(y, document.documentElement.clientHeight - mh - 4));
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
  }

  // The strip's » menu: its spare buttons with their names.
  function toggleSpareMenu(more, spec) {
    if (more.getAttribute("aria-expanded") === "true") return closeMenu();
    openMenu(more, spec.spare.map((id) => {
      const tool = findTool(id);
      const own = more.parentElement.querySelector(`[data-tool="${id}"]`);
      const v = activeVariant(tool);
      return {
        label: v ? v.label : tool.label, icon: tool.icon, badge: v && v.badge,
        disabled: (own && own.getAttribute("aria-disabled") === "true") || toolDisabled(tool),
        action: () => runTool(tool),
      };
    }));
  }

  // The app bar's Queries menu: the queries that didn't fit.
  function openQueriesMenu(btn) {
    if (btn.getAttribute("aria-expanded") === "true") return closeMenu();
    const bar = btn.closest(".haiku-toolbar");
    const hidden = [...bar.querySelectorAll(".haiku-tool[data-query][hidden]")].map((b) => findTool(b.dataset.tool));
    const active = currentQuery();
    openMenu(btn, hidden.map((q) => ({
      label: active && active.id === q.id ? `${q.label} ✓` : q.label,
      icon: "query", badge: q.badge,
      action: () => toggleQuery(q),
    })));
  }

  // Right-click a query: edit, move or remove it; bring back the defaults.
  function openQueryContextMenu(id, x, y) {
    const i = QUERIES.findIndex((q) => q.id === id);
    if (i < 0) return;
    const q = QUERIES[i];
    const move = (to) => {
      const list = QUERIES.slice();
      list.splice(to, 0, list.splice(i, 1)[0]);
      setQueries(list, true);
    };
    const missing = DEFAULT_QUERIES.filter((d) => !QUERIES.some((x2) => x2.id === d.id));
    openMenu({ x, y }, [
      { label: "Edit Query…", icon: "query", badge: q.badge, action: () => openQueryDialog(q) },
      { label: "Move Left", disabled: i === 0, action: () => move(i - 1) },
      { label: "Move Right", disabled: i === QUERIES.length - 1, action: () => move(i + 1) },
      "-",
      { label: `Remove “${q.label}”`, icon: "trash", action: () => setQueries(QUERIES.filter((x2) => x2.id !== id), true) },
      "-",
      {
        label: "Restore Default Queries", disabled: !missing.length,
        action: () => setQueries([...QUERIES, ...missing], true),
      },
    ]);
  }

  // Any click elsewhere, Escape or a view change closes a menu.
  window.addEventListener("mousedown", (e) => {
    if (!e.target.closest || !e.target.closest(".haiku-menu, [data-haiku][aria-expanded]")) closeMenu();
  }, true);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); }, true);
  window.addEventListener("hashchange", closeMenu);

  // ------------------------------------------------------ Save Query window
  // A small Haiku window: name, the Gmail search, a picture for the button,
  // and a live preview of the button. Saves to synced storage. `q` is the
  // query to edit, or null to save the search that's showing.
  function closeQueryDialog() {
    const d = document.querySelector("body > .haiku-dialog-backdrop");
    if (d) d.remove();
  }

  function openQueryDialog(q) {
    closeMenu();
    closeQueryDialog();
    const editing = !!q;
    const backdrop = make("div", "haiku-dialog-backdrop");
    const win = make("div", "haiku-dialog");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "true");
    const title = editing ? "Edit Query" : "Save Query";
    win.setAttribute("aria-label", title);
    const tab = make("div", "haiku-dialog-tab");
    tab.append(make("span", "haiku-dialog-title", title));
    const body = make("div", "haiku-dialog-body");

    const field = (labelText, value, placeholder) => {
      const row = make("label", "haiku-dialog-row");
      const input = make("input", "haiku-dialog-input");
      input.type = "text";
      input.value = value;
      input.placeholder = placeholder;
      input.spellcheck = false;
      row.append(make("span", "haiku-dialog-label", labelText), input);
      body.append(row);
      return input;
    };
    const current = hashQuery() || "";
    const name = field("Name:", editing ? q.label : "", "What the button says");
    const search = field("Search:", editing ? q.query : current, "A Gmail search, e.g. from:anna has:attachment");
    search.title = "Any Gmail search: from:, to:, subject:, has:attachment, label:, is:unread, after:2026/1/1...";

    // Picture picker: a row of toggle buttons, one per badge.
    let badge = editing ? q.badge : "";
    const pickRow = make("div", "haiku-dialog-row haiku-dialog-pickrow");
    pickRow.append(make("span", "haiku-dialog-label", "Picture:"));
    const picks = make("div", "haiku-dialog-picks");
    picks.setAttribute("role", "radiogroup");
    picks.setAttribute("aria-label", "Picture");
    for (const [id, label] of QUERY_BADGES) {
      const pick = make("div", "haiku-dialog-pick");
      pick.setAttribute("role", "radio");
      pick.tabIndex = -1;
      pick.title = label;
      pick.dataset.badge = id;
      if (id) {
        const img = make("img");
        img.src = icon(id);
        img.alt = "";
        pick.append(img);
      } else {
        pick.append(make("span", "haiku-dialog-none", "—"));
      }
      pick.addEventListener("mousedown", (e) => e.preventDefault());
      pick.addEventListener("click", () => { badge = id; refresh(); });
      picks.append(pick);
    }
    pickRow.append(picks);
    body.append(pickRow);

    // Preview: the button as it will look in the app bar.
    const prevRow = make("div", "haiku-dialog-row");
    prevRow.append(make("span", "haiku-dialog-label", "Preview:"));
    const preview = make("div", "haiku-dialog-preview");
    prevRow.append(preview);
    body.append(prevRow);

    const buttons = make("div", "haiku-dialog-buttons");
    const cancel = make("button", "haiku-dialog-button", "Cancel");
    const ok = make("button", "haiku-dialog-button haiku-dialog-default", editing ? "Save" : "Save Query");
    cancel.type = ok.type = "button";
    buttons.append(cancel, ok);
    body.append(buttons);
    win.append(tab, body);
    backdrop.append(win);
    document.body.append(backdrop);

    function refresh() {
      for (const p of picks.children) {
        const on = p.dataset.badge === badge;
        p.setAttribute("aria-checked", on ? "true" : "false");
        p.tabIndex = on ? 0 : -1;
      }
      preview.replaceChildren(makeToolButton({ id: "preview", label: name.value.trim() || "Query", icon: "query", badge, always: true, action: () => {} }, "haiku-tool"));
      ok.disabled = !name.value.trim() || !search.value.trim();
    }
    function save() {
      if (ok.disabled) return;
      const entry = { id: editing ? q.id : `q-${Date.now().toString(36)}`, label: name.value, query: search.value, badge };
      const list = editing ? QUERIES.map((x2) => (x2.id === q.id ? entry : x2)) : [...QUERIES, entry];
      setQueries(list, true);
      closeQueryDialog();
    }
    name.addEventListener("input", refresh);
    search.addEventListener("input", refresh);
    cancel.addEventListener("click", closeQueryDialog);
    ok.addEventListener("click", save);
    backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) e.preventDefault(); });
    // Keys typed here must not reach Gmail's keyboard shortcuts; Enter
    // saves, Escape cancels, arrows move through the pictures.
    for (const type of ["keydown", "keypress", "keyup"]) {
      win.addEventListener(type, (e) => {
        e.stopPropagation();
        if (type !== "keydown") return;
        if (e.key === "Escape") { e.preventDefault(); closeQueryDialog(); }
        else if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); save(); }
        else if (e.target.closest(".haiku-dialog-picks") && /^Arrow(Left|Right)$/.test(e.key)) {
          e.preventDefault();
          const ids = QUERY_BADGES.map(([id]) => id);
          const i = ids.indexOf(badge) + (e.key === "ArrowRight" ? 1 : -1);
          badge = ids[(i + ids.length) % ids.length];
          refresh();
          picks.querySelector('[aria-checked="true"]').focus();
        } else if (e.target.closest(".haiku-dialog-picks") && (e.key === " ")) e.preventDefault();
      });
    }
    refresh();
    (editing ? name : (current ? name : search)).focus();
  }
  window.addEventListener("hashchange", () => {
    // Gmail navigated away under the window (e.g. its own shortcut): close it.
    if (document.querySelector("body > .haiku-dialog-backdrop") && !document.activeElement.closest(".haiku-dialog")) closeQueryDialog();
  });

  // ----------------------------------------------------- window tab title
  function folderTitle() {
    // A query's results are titled with the query's name, like a Tracker
    // query window, not Gmail's "Search results".
    const query = currentQuery();
    if (query) return query.label;
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
      // Gmail's footer (storage, account activity) shows here instead; its
      // Details link presses Gmail's own.
      const activity = make("span", "haiku-status-activity");
      const details = make("a", "haiku-status-details", "Details");
      details.href = "#";
      details.title = "Gmail's account activity details";
      details.addEventListener("click", (e) => {
        e.preventDefault();
        const own = document.querySelector(".l6 .l8");
        if (own) own.click();
      });
      activity.append(document.createTextNode(""), details);
      // At the far right; the folder and its "1-2 of 2" count stay at the
      // left, where Tracker shows a window's item count.
      bar.append(activity);
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
    // Footer text: storage use (personal accounts) and account activity.
    const footText = (sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim());
      if (!el) return "";
      // Elements and bare text ("Open in 3 other locations ·") alike, minus
      // Gmail's Details link and its "·" separators.
      return [...el.childNodes]
        .filter((n) => !(n.classList && n.classList.contains("l8")))
        .map((n) => n.textContent.replace(/·/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" · ");
    };
    const storage = footText(".l2.pfiaof .aeV .md, .apb .md");
    const account = footText(".l2.pfiaof .l6, .apO .l6");
    const activity = bar.querySelector(".haiku-status-activity");
    const actText = [storage, account].filter(Boolean).join(" · ");
    if (actText || !activity.hidden) {
      const node = activity.firstChild;
      const want = actText ? `${actText} · ` : "";
      if (node.nodeValue !== want) node.nodeValue = want;
      activity.hidden = !actText;
      activity.querySelector(".haiku-status-details").hidden = !document.querySelector(".l6 .l8");
    }
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

  // The folder-list button shows and hides the sidebar, but Google's
  // tooltip for it says "Hide main menu" / "Show main menu". Rewrite it as
  // soon as Google sets the text: observer callbacks run before the next
  // paint, so the old wording never shows. Matched on the exact text, not
  // Google's class names; our own rewrite doesn't match, so no loop.
  const TIP_TEXT = { "Hide main menu": "Hide sidebar", "Show main menu": "Show sidebar" };
  const fixText = (t) => {
    const want = TIP_TEXT[t.nodeValue.trim()];
    if (want) t.nodeValue = want;
  };
  // A tooltip can arrive as a small element with its text already inside;
  // only small subtrees are scanned, so Gmail's big DOM updates stay cheap.
  const fixTip = (n) => {
    if (n.nodeType === 3) return fixText(n);
    if (n.nodeType !== 1 || n.childElementCount > 3) return;
    const walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) fixText(t);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") fixText(r.target);
      else for (const n of r.addedNodes) fixTip(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  // Tooltips Google built before this script ran (only shown/hidden later):
  // the Google bar's few [ng-non-bindable] nodes hold them.
  const fixTooltips = () => { for (const el of document.querySelectorAll("[ng-non-bindable]")) fixTip(el); };

  // ------------------------------------------------------------- driver
  function applyAll() {
    try {
      ensureToolbar();
      measureHeader();
      ensureSplitter();
      ensureListTab();
      ensureMessageTools();
      ensureColumns();
      ensureStatusBar();
      hideExtras();
      fixTooltips();
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
