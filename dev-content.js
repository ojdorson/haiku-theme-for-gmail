// DEV ONLY: answers structure queries from dev-bg.js. Returns tags, classes,
// key attributes, geometry and selected computed styles; never message bodies.
(() => {
  const ATTRS = ["id", "role", "aria-label", "data-tooltip", "gh", "jscontroller", "style", "href"];
  const describe = (el, depth, maxDepth, styles) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const d = { tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 120) : "" };
    for (const a of ATTRS) if (el.hasAttribute(a)) d[a] = el.getAttribute(a).slice(0, 120);
    d.rect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    if (styles) d.css = Object.fromEntries(styles.map((p) => [p, cs.getPropertyValue(p)]));
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (own) d.text = own.slice(0, 40);
    if (depth < maxDepth && el.children.length) {
      d.kids = [...el.children].slice(0, 25).map((c) => describe(c, depth + 1, maxDepth, styles));
      if (el.children.length > 25) d.more = el.children.length - 25;
    }
    return d;
  };
  // Hot-swapped stylesheet (dev mode replaces the manifest's haiku.css).
  let cssVersion = "";
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const applyCss = (css) => sheet.replaceSync(css.replaceAll("__MSG_@@extension_id__", chrome.runtime.id));
  fetch(chrome.runtime.getURL("haiku.css")).then((r) => r.text()).then((css) => { if (!cssVersion) applyCss(css); });

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg && msg.type === "css") {
      applyCss(msg.css);
      cssVersion = msg.cssVersion;
      setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
      return;
    }
    if (!msg || msg.type !== "inspect") return;
    const q = msg.query;
    // A tab can be tagged (kept in sessionStorage across reloads) so that
    // queries reach only that tab: settag with vw (its viewport width) once,
    // then match on the tag.
    if (q.settag && innerWidth === q.vw) sessionStorage.haikuTag = q.settag;
    if (q.vw && innerWidth !== q.vw) return reply(null);
    if (q.match && !(location.href + " " + window.name + " " + (sessionStorage.haikuTag || "")).includes(q.match)) return reply(null);
    const out = { viewport: [innerWidth, innerHeight], title: document.title, name: window.name, url: location.href, htmlClass: document.documentElement.className, results: {} };
    for (const sel of q.selectors || []) {
      try {
        out.results[sel] = [...document.querySelectorAll(sel)].slice(0, q.limit || 5).map((el) => describe(el, 0, q.depth || 0, q.styles));
      } catch (e) {
        out.results[sel] = String(e);
      }
    }
    // Dev actions: navigate, or press an element (Gmail wants mouse events).
    if (q.hash) location.hash = q.hash;
    if (q.press) {
      const el = [...document.querySelectorAll(q.press)][q.index || 0];
      out.pressed = !!el;
      if (el) for (const t of ["mouseover", "mousedown", "mouseup", "click"]) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }
    if (q.focus) {
      const el = document.querySelector(q.focus);
      out.focused = !!el;
      if (el) { el.focus(); el.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); }
    }
    if (q.type !== undefined) {
      const el = document.activeElement;
      out.typed = !!el && "value" in el;
      if (out.typed) { el.value = q.type; el.dispatchEvent(new InputEvent("input", { bubbles: true, data: q.type })); el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "y" })); }
    }
    if (q.hover) {
      const el = [...document.querySelectorAll(q.hover)][q.index || 0];
      out.hovered = !!el;
      if (el) for (const t of ["mouseover", "mouseenter", "mousemove"]) el.dispatchEvent(new MouseEvent(t, { bubbles: t !== "mouseenter", view: window }));
    }
    // Stylesheet rules that set q.prop on the first match of q.rules.
    if (q.rules) {
      const el = document.querySelector(q.rules) || document.body, hits = [];
      const walk = (rules, ctx) => {
        for (const r of rules) {
          if (r.cssRules && !r.selectorText) walk(r.cssRules, ctx + (r.conditionText || r.name || r.constructor.name) + " ");
          if (r.selectorText && (q.grep || r.style.getPropertyValue(q.prop))) {
            if (q.grep) { if (r.selectorText.includes(q.grep)) hits.push(ctx + r.selectorText.slice(0, 200) + " { " + r.style.cssText.slice(0, 300) + " }"); continue; }
            try { if (el.matches(r.selectorText)) hits.push(ctx + r.selectorText.slice(0, 160) + " { " + r.style.getPropertyValue(q.prop) + " " + r.style.getPropertyPriority(q.prop) + " }"); } catch (e) {}
          }
        }
      };
      for (const s of [...document.styleSheets, ...document.adoptedStyleSheets]) { try { walk(s.cssRules, ""); } catch (e) {} }
      out.results.rules = hits;
    }
    // Pseudo-elements under a selector that actually render something.
    if (q.pseudo) {
      const list = [];
      for (const root of document.querySelectorAll(q.pseudo)) {
        for (const el of [root, ...root.querySelectorAll("*")]) {
          for (const p of ["::before", "::after"]) {
            const cs = getComputedStyle(el, p);
            if (cs.content === "none" || cs.display === "none") continue;
            list.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 80), p, w: cs.width, h: cs.height, bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 60), radius: cs.borderRadius, pos: cs.position, opacity: cs.opacity });
          }
        }
      }
      out.results.pseudo = list.slice(0, 40);
    }
    for (const [x, y] of q.points || []) {
      const chain = [];
      for (let el = document.elementFromPoint(x, y); el && chain.length < 20; el = el.parentElement) chain.push(describe(el, 0, 0, q.styles || ["pointer-events", "z-index", "position"]));
      out.results[`point ${x},${y}`] = chain;
    }
    reply(out);
  });
  // After the extension reloads, this copy is orphaned: reload the page so
  // the fresh content scripts take over.
  setInterval(() => {
    if (!chrome.runtime || !chrome.runtime.id) return location.reload();
    try {
      chrome.runtime.sendMessage({ type: "tick", cssVersion }).catch(() => {});
    } catch (e) {
      location.reload();
    }
  }, 700);
})();
