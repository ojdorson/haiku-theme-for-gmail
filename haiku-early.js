// Haiku (BeOS) Theme for Gmail: runs before Gmail draws anything.
//
// haiku.css is already in place at this point; this puts what the theme
// remembers (the folder panel's and From column's widths, the Deskbar's
// state, the trash picture) and the compose-window flag on <html>, so the
// first paint already has them instead of jumping into place once Gmail
// has loaded. haiku.js calls haikuRestore() again when it starts, and
// keeps everything up to date from then on.
globalThis.haikuRestore = () => {
  const root = document.documentElement;
  const get = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const px = (key) => parseInt(get(key), 10) || 0;

  const nav = px("haiku-nav-width");
  if (nav) root.style.setProperty("--haiku-nav-w", `${Math.max(140, Math.min(480, nav))}px`);
  const from = px("haiku-from-width");
  if (from) {
    root.style.setProperty("--haiku-from-w", `${Math.max(80, from)}px`);
    root.classList.add("haiku-from-sized");
  }
  root.classList.toggle("haiku-deskbar-off", get("haiku-deskbar") === "off");
  // The narrow app-window sidebar instead of the full Deskbar: the user's
  // choice, else only on Haiku itself (see deskbar() in haiku.js).
  const style = get("haiku-deskbar-style");
  const onHaiku = /\bHaiku\b/i.test(navigator.userAgent || "") || /\bHaiku\b/i.test(navigator.platform || "");
  root.classList.toggle("haiku-compact", style === "compact" || (style !== "full" && onHaiku));
  // The bin shows full unless this tab has seen the Trash empty (haiku.js).
  let trash = null;
  try { trash = sessionStorage.getItem("haiku-trash"); } catch (e) { /* storage unavailable */ }
  root.dataset.haikuTrash = trash === "empty" ? "empty" : "full";

  // Compose pages in their own window: Gmail's compose URL, or a window
  // Gmail itself opened (its pop-out button). Not a Gmail tab that some
  // other site opened - reading a cross-origin opener throws.
  let openedByGmail = false;
  try { openedByGmail = !!window.opener && window.opener.location.origin === location.origin; } catch (e) { /* another site's window */ }
  root.classList.toggle("haiku-popup", openedByGmail || window.name.startsWith("haiku-compose-") || /[?&](view|tf)=cm\b/.test(location.search));
};
globalThis.haikuRestore();
