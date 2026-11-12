# Haiku (BeOS) Theme for Gmail

A browser extension for Chrome and Firefox that makes Gmail look and behave like a native
[Haiku](https://www.haiku-os.org/) (BeOS-lineage) mail client, modelled on
Haiku Mail (BeMail), Beam and Haiku's interface guidelines.

![Inbox with the Haiku theme (sample data)](store/screenshot-1-inbox.png)

**Current version: 1.2.2.** See the [changelog](CHANGELOG.md) for what's new.

- **Actions in the window they act on**, as in BeMail and Tracker: an open
  message has Reply, Reply All, Forward, Archive, Trash, Junk, Unread, Print,
  Previous and Next in its own toolbar; a message list has Archive, Trash,
  Junk and Read/Unread for the selected messages. Each button presses
  Gmail's own control, so Gmail still does the work.
- **App toolbar**: New, Check Mail, Drive (new window), and Tracker-style
  **queries**: one click runs a saved Gmail search and shows the results in
  the list window under the query's name; click it again to go back. Unread,
  Starred and Attachments come built in.
- **Your own queries**: run any Gmail search, then **Save Query** - give it a
  name and a picture. Right-click a query to edit, reorder or remove it.
  Saved queries sync to your other computers through your browser's sync;
  those that don't fit go into a Queries menu.
- **Yellow window tab** over the message pane, titled with the folder or the
  open message's subject.
- **Tracker-style message list**: 22px rows, column headers, Haiku status
  icons and stars. Drag the line between From and Subject to resize the
  From column (double-click it for the default width).
- **Haiku controls** throughout: bevelled push buttons, sunken text fields,
  Haiku radio buttons, checkboxes, scrollbars, menus and tab views.
- **Beam-style message header**, a framed calendar-invitation box, and a
  BeMail compose window with "To:" and "Subject:" labels.
- **Resizable folder panel** and a status bar showing the unread count and
  position, with Gmail's account activity (and its Details link) at the
  right in place of Gmail's footer.
- **New messages open in a BeMail-style compose window** inside Gmail. Replies and
  forwards stay in the thread; Gmail's pop-out button still works on them.
- **The tab's close box closes the current view**: an open message goes back
  to its list, Settings or a search back to the Inbox.
- **Narrow windows** keep the most-used actions in view; the rest move into
  a » menu.
- Gmail extras with no BeOS counterpart are hidden: the Google apps grid,
  Gemini, Chat/Meet, emoji reactions and the Material ripples.

Everything happens locally in your browser. The extension runs only on
`mail.google.com` and has one other permission, `storage`: your saved
queries are kept in the browser's own extension storage, which your browser
syncs to your other computers if you use its sync. The extension collects no
data and makes no network requests.

## Install

Downloads are on the
[latest release](https://github.com/ojdorson/haiku-theme-for-gmail/releases/latest).

### Firefox

**[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/haiku-theme-for-gmail/)**
(one click; updates itself). Reload Gmail afterwards. Firefox 121 or later;
it should also work in Haiku's Firefox.

Add-ons can be a version behind the
[latest release](https://github.com/ojdorson/haiku-theme-for-gmail/releases/latest)
while Mozilla reviews updates. To use the newest one now, download
`haiku-theme-for-gmail-<version>.xpi` (signed by Mozilla) and open it in
Firefox, or drag it onto a Firefox window, then confirm **Add**.

### Chrome, Chromium, Brave, Edge, Vivaldi

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/hbklabmgaphaoikehjpkkocdijbjnkco)**
(one click; updates itself). Reload Gmail afterwards.

The store can be a version or two behind the
[latest release](https://github.com/ojdorson/haiku-theme-for-gmail/releases/latest)
while Google reviews updates. To use the newest one now:

1. Download `haiku-theme-for-gmail-<version>-chrome.zip` and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click
   **Load unpacked** and choose the unzipped folder.
3. Reload Gmail.

A manual install doesn't update itself. Use either the store version or a
manual copy, not both.

## Notes and limitations

- **English Gmail interface only.** The toolbar finds Gmail's buttons by
  their English labels.
- **Works with every density, inbox type and reading pane layout.**
  Tested with all three densities (rows stay compact), Default, Important /
  Unread / Starred first, Priority Inbox and Multiple Inboxes, and the
  reading pane off, right of or below the list. In a narrow split view,
  messages show on three lines: sender and date, subject, preview.
- **Message bodies keep the sender's own formatting.** Only Gmail's interface
  is restyled.
- **Gmail updates may break parts of the look.** Gmail changes its
  obfuscated class names from time to time. Those selectors are collected
  in the `BRITTLE` section of `haiku.css`, which is the first place to look.

## Development

The working folder is the development build. It also loads `dev-bg.js` and
`dev-content.js`, which connect to a local tuning server:

```sh
python3 tools/devserver.py            # hot-swaps haiku.css into open Gmail tabs,
                                      # reloads the extension on other changes
python3 tools/ask.py '{"selectors": ["tr.zA"], "limit": 2}'   # inspect Gmail's DOM
python3 tools/build.py                # Chrome and Firefox builds in dist/ (no dev files)
```

`tools/ask.py` returns tags, classes, geometry and computed styles, never
message contents. See its docstring for the query keys.

## Credits

The icons are Haiku's own, distributed under the MIT License. See
[CREDITS.md](CREDITS.md). Gmail is a trademark of Google LLC. This project
is not affiliated with Google or with Haiku, Inc. BeOS is a trademark of its
respective owner; the name describes the look this theme recreates.
