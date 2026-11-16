# Run Gmail in its own app window on Haiku

How to get Gmail, with this theme, into a window of its own on Haiku: no tabs,
no address bar, no toolbars, and your normal browsing kept separate.

Haiku's Firefox has no "install as app" (PWA) feature. This guide gets the same
result with a dedicated Firefox profile whose toolbars are hidden. It was worked
out on a Haiku nightly (hrev60413) with the Firefox package from HaikuDepot.

## What you need

- Firefox from HaikuDepot, with the theme installed (see the
  [README](../README.md#install)).
- A few minutes in Terminal.

## 1. Create a dedicated profile

A separate profile gives the window its own login, its own extensions and no
pinned tabs from your main Firefox.

```sh
firefox -CreateProfile gmail
```

You can also run `firefox -ProfileManager` and create it there.

## 2. Start it as its own instance and set it up

```sh
firefox -P gmail --new-instance https://mail.google.com
```

`--new-instance` keeps the window from joining your main Firefox. In this window:

1. Sign in to Gmail.
2. Install the theme (see the [README](../README.md#install)) and reload Gmail.
3. Open `about:support` and note the **Profile Folder** path. You'll need it in
   the next step.
4. Open `about:config` and set
   `toolkit.legacyUserProfileCustomizations.stylesheets` to `true`.

Do this before hiding the toolbars. Once they're hidden you can't easily open
`about:config` or the add-ons page.

## 3. Hide the toolbars

Quit the window. In the profile folder, create a `chrome` folder, and inside it
a file named `userChrome.css`:

```css
#TabsToolbar, #nav-bar, #PersonalToolbar, #toolbar-menubar {
  visibility: collapse !important;
}
```

Start it again with the command from step 2. You get Gmail in a bare window,
with a title bar but no tabs, address bar or toolbars.

## 4. Make a launcher (optional)

Put the command in a script so it's one double-click. Find the Firefox path
with `which firefox` first.

```sh
#!/bin/sh
exec /path/to/firefox -P gmail --new-instance https://mail.google.com
```

Save it as `~/Desktop/Gmail`, run `chmod +x ~/Desktop/Gmail`, and you can drag
it into the Deskbar and give it an icon from Tracker's file info.

## Changing things later

The address bar is hidden, so you can't type a URL, and the add-ons page is hard
to reach. To get the toolbars back temporarily:

1. Quit the Gmail window.
2. Rename `chrome/userChrome.css` to `userChrome.css.off`.
3. Start `firefox -P gmail --new-instance`. The toolbars are back, so you can
   add or update extensions or change settings.
4. Quit, rename the file back to `userChrome.css`, and relaunch.

## Other sites

The same recipe works for any site you use a lot: make a profile per site
(`calendar`, `drive`, ...), give it the same `userChrome.css` and pref, and
point a launcher at it. Each profile runs as its own Firefox, which costs some
RAM. Sites that share a login can share a profile, but if you hide the address
bar you'll have no way to navigate to the second site, so leave the toolbars on
in that profile.

## What doesn't work

- **`--kiosk`** makes the window fullscreen with no obvious way out. If you hit
  it, use Ctrl+Alt+Delete to open Team Monitor and kill Firefox. Don't use it
  for this.
- **Firefox's own web apps ("Taskbar Tabs")** can be turned on in `about:config`
  with `browser.taskbartabs.enabled`, but on Haiku nothing appeared in the
  address bar. Firefox builds these on `.desktop` files, which Haiku doesn't
  use. The profile approach above doesn't depend on it.
- **`--new-window`** alone opens a normal window with your pinned tabs and
  toolbars, so it isn't enough.
