// Sample data for the store screenshots (run in the test window's Gmail page
// via crdrive.py / ffdrive.py {"js": ...}; see store/LISTING.md).
//
// Rewrites what is on screen only - names, subjects, labels, the account
// picture - so no real mail shows in the pictures. Nothing is sent to Gmail;
// a page reload brings the real page back. Defines window.haikuSample with
// one function per scene part; each returns a short report.
(() => {
  const ME = { name: "Charles Babbage", email: "charles@example.com" };
  const INBOX = [
    ["Jean-Louis Gassée", "jlg@example.com", "BeBox launch at Agenda", "We'll show the BeBox on stage. Bring the GeekPort demo and plenty of blinkenlights.", "10:42 AM", 1, 1],
    ["Dominic Giampaolo", "dbg@example.com", "Attributes, indexes and live queries", "The query engine now updates results live as files change — Tracker just watches.", "9:15 AM", 1, 1],
    ["Ada Lovelace", "ada@example.com", "Notes on the Analytical Engine", "Here are my annotations on Menabrea's paper — Note G has the Bernoulli numbers.", "8:03 AM", 1, 1],
    ["Be Newsletter", "newsletter@example.com", "Be Newsletter, Volume II", "Developer conference recap, and a Tracker tip from Pavel.", "Nov 16", 0, 1],
    ["Pavel Cisler", "pavel@example.com", "Tracker: saved queries", "Queries now live in a folder of their own. Drag them anywhere you like.", "Nov 16", 0, 1],
    ["Steve Sakoman", "sakoman@example.com", "BeBox prototype boards", "The dual-603 boards are back from the fab, and the lights blink!", "Nov 15", 0, 1],
    ["Grace Hopper", "grace@example.com", "Compiler meeting moved to Thursday", "Same room as last time. Bring the nanoseconds.", "Nov 15", 0, 0],
    ["Haiku Weekly", "weekly@example.com", "What's new in R1/beta6", "Faster networking, new icons and a better Tracker.", "Nov 14", 0, 0],
    ["Alan Turing", "alan@example.com", "Chess puzzle for you", "White to move and mate in three. No machines allowed!", "Nov 13", 0, 0],
    ["Hedy Lamarr", "hedy@example.com", "Frequency hopping patent", "The paperwork came back. We should celebrate!", "Nov 12", 0, 0],
  ];
  // [name, depth]
  const LABELS = [["Family", 0], ["Projects", 1], ["Receipts", 1], ["Travel", 0], ["Work", 1], ["Haiku", 1], ["Photos", 1], ["Book Club", 0]];

  const vis = (sel, root = document) => [...root.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const iconBase = (() => {
    const img = document.querySelector(".haiku-toolbar img");
    return img ? img.src.replace(/[^/]+\.svg.*$/, "") : "";
  })();

  // The list on screen: `rows` sample rows, the rest hidden.
  function list(only) {
    const rows = only ? INBOX.filter((r) => r[6]) : INBOX;
    let trs = vis('[role="main"] tr.zA');
    // Fewer real rows than sample ones: copies of the last row fill the list.
    while (trs.length && trs.length < rows.length) {
      const copy = trs[trs.length - 1].cloneNode(true);
      copy.dataset.haikuSampleCopy = "";
      trs[trs.length - 1].after(copy);
      trs = vis('[role="main"] tr.zA');
    }
    trs.forEach((tr, i) => {
      const r = rows[i];
      if (!r) { tr.style.display = "none"; return; }
      const [name, email, subject, snippet, date, unread, starred] = r;
      tr.classList.toggle("zE", !!unread);
      tr.classList.toggle("yO", !unread);
      // The sender cell: one sample sender, whatever Gmail put there (a
      // search shows every person in the conversation).
      const yw = tr.querySelector("td.yX .yW");
      if (yw) {
        const who = document.createElement("span");
        who.className = unread ? "zF" : "yP";
        who.setAttribute("name", name); who.setAttribute("email", email);
        who.textContent = name;
        const wrap = document.createElement("span");
        wrap.className = "bA4";
        wrap.append(who);
        yw.replaceChildren(wrap);
      }
      tr.querySelectorAll("td.yX .bx0, td.yX .afn").forEach((e) => e.remove());
      const subj = tr.querySelector(".y6 .bog span") || tr.querySelector(".y6 .bog");
      setText(subj, subject);
      tr.querySelectorAll(".y6 .bog").forEach((b) => b.classList.toggle("bqe", !!unread));
      const snip = tr.querySelector("span.y2");
      if (snip) snip.textContent = ` - ${snippet}`;
      tr.querySelectorAll(".yi .ar, .xT .ar, .brd, .aKS").forEach((e) => e.remove());
      const d = tr.querySelector("td.xW span[title]");
      if (d) { d.setAttribute("title", date); d.setAttribute("aria-label", date); setText(d.querySelector("span") || d, date); }
      const star = tr.querySelector("td.apU span.T-KT");
      if (star) {
        star.className = starred ? "T-KT xn Uieduc" : "T-KT";
        const t = starred ? "Starred" : "Not starred";
        star.setAttribute("aria-label", t); star.setAttribute("data-tooltip", t);
      }
    });
    const n = Math.min(trs.length, rows.length);
    vis('[role="main"] .Dj, [gh="mtb"] .Dj').forEach((p) => { p.textContent = `1–${n} of ${n}`; });
    return `list: ${n} rows (of ${trs.length})`;
  }

  // The folder list's labels, the account and the counts.
  function chrome(unread = 3) {
    const nav = document.querySelector(".aqn.aIH");
    let done = 0;
    if (nav) {
      // Gmail's own folders keep their names; only the user's labels change.
      const rows = vis(".aim", nav).filter((r) => r.querySelector('a[href*="#label/"]'));
      rows.forEach((row, i) => {
        const l = LABELS[i];
        if (!l) { row.style.display = "none"; return; }
        const a = row.querySelector("a");
        if (a) { a.textContent = l[0]; a.setAttribute("aria-label", l[0]); a.title = l[0]; }
        row.querySelectorAll(".bsU").forEach((c) => { c.textContent = ""; });
        const tn = row.querySelector(".TN");
        if (tn) tn.setAttribute("style", `margin-left: ${12 * l[1]}px`);
        // An expand arrow only on a label with sublabels under it.
        const next = LABELS[i + 1];
        row.querySelectorAll(".TH").forEach((a) => { a.style.visibility = next && next[1] > l[1] ? "visible" : "hidden"; });
        row.querySelectorAll(".n0").forEach((b) => { b.style.fontWeight = "normal"; });
        done++;
      });
      vis(".aim", nav).forEach((row) => { const c = row.querySelector(".bsU"); if (c && /inbox/i.test(row.textContent)) c.textContent = String(unread); });
    }
    // The account picture and the Workspace logo the Deskbar copies.
    const face = document.querySelector('header a[aria-label^="Google Account"] img');
    if (face && iconBase) face.src = `${iconBase}person.svg`;
    const lockup = document.querySelector('header img[src*="logo_gmail"]');
    const logo = [...document.querySelectorAll("header img")].find((i) => /logo\.gif/.test(i.src));
    if (logo && lockup) {
      const pill = logo.closest('[role="button"]');
      if (pill) pill.style.display = "none";
      logo.src = lockup.src;
    }
    document.querySelectorAll("#haiku-deskbar .hd-top img").forEach((i, k) => { i.src = k === 0 ? (lockup ? lockup.src : "") : `${iconBase}person.svg`; });
    // Window title (status bar, Deskbar count) without the address.
    const folder = (document.title.split(" - ")[0] || "Inbox").replace(/\s*\(\d[\d,]*\)$/, "");
    document.title = `${folder}${unread && /^Inbox/.test(folder) ? ` (${unread})` : ""} - ${ME.email} - Gmail`;
    const count = document.querySelector("#haiku-deskbar .hd-count");
    if (count) count.textContent = String(unread);
    return `labels: ${done}`;
  }

  // The open message.
  function message(m) {
    const subj = vis("h2.hP")[0];
    setText(subj, m.subject);
    // The label chips beside the subject (External, Inbox, Updates...).
    document.querySelectorAll(".ha .aau, .ha .ahR").forEach((e) => e.style.setProperty("visibility", "hidden", "important"));
    const msg = vis(".adn")[0];
    if (!msg) return "no message";
    const from = msg.querySelector(".gD");
    if (from) { from.textContent = m.name; from.setAttribute("name", m.name); from.setAttribute("email", m.email); }
    const pic = msg.querySelector(".aju img.ajn");
    if (pic && iconBase) pic.src = `${iconBase}person.svg`;
    const go = msg.querySelector(".go");
    if (go) go.textContent = `<${m.email}>`;
    msg.querySelectorAll(".gE .g3").forEach((d) => { d.textContent = m.date; d.title = m.date; });
    msg.querySelectorAll(".gE .Ca, .gE .aVp, .gE [role=link][data-tooltip*=nsubscribe]").forEach((e) => (e.style.display = "none"));
    const to = msg.querySelector(".hb .g2, .hb span[email]");
    if (to) { to.textContent = "me"; to.setAttribute("email", ME.email); }
    const body = msg.querySelector(".a3s");
    if (body) {
      body.replaceChildren(...m.body.map((p) => { const d = document.createElement("div"); d.textContent = p; d.style.margin = "0 0 12px"; return d; }));
    }
    document.querySelectorAll(".haiku-status-folder").forEach((e) => (e.textContent = m.subject));
    document.title = `${m.subject} - ${ME.email} - Gmail`;
    const count = document.querySelector("#haiku-deskbar .hd-count");
    if (count) count.textContent = String(m.unread == null ? 3 : m.unread);
    return "message";
  }

  // The New Message window: From, To, Subject and the text, on screen only.
  function compose(c) {
    const w = vis(".nH.Hd")[0];
    if (!w) return "no compose";
    w.querySelectorAll(".aoD.az6 span, .J-J5-Ji.J-JN-M-I-Jm span, .az2 span").forEach((s) => { if (/@/.test(s.textContent)) s.textContent = `${ME.name} <${ME.email}>`; });
    [...w.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && /@thedorsons|<.*@.*>/.test(e.textContent) && !e.closest(".Am")).forEach((e) => (e.textContent = `${ME.name} <${ME.email}>`));
    const to = w.querySelector('input[aria-label^="To"], input[name="to"], input[peoplekit-id]');
    if (to) to.value = c.to;
    const subj = w.querySelector('input[name="subjectbox"]');
    if (subj) subj.value = c.subject;
    const body = w.querySelector(".Am.Al.editable");
    if (body) body.replaceChildren(...c.body.map((p) => { const d = document.createElement("div"); d.textContent = p || " "; return d; }));
    const title = w.querySelector(".aYF");
    if (title) title.textContent = c.subject;
    return "compose";
  }

  window.haikuSample = { list, chrome, message, compose, INBOX, ME };
  return "haikuSample ready";
})();
