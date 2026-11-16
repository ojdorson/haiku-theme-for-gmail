# Run Gmail as an application window

Gmail with this theme looks like BeMail, so it should behave like an app too: a
window of its own, with a title bar and nothing else, started from a shortcut,
separate from your normal browsing.

This works best on Haiku (or BeOS-minded Linux desktops), where a window of its
own is exactly how an application looks. The recipe differs a little by browser.

## Firefox (Haiku, Linux, Windows, macOS)

Firefox has no "install as app" feature on Haiku, so you make one with a
dedicated profile whose toolbars are hidden. The steps were worked out on a
Haiku nightly (hrev60413) with the Firefox package from HaikuDepot. The same
flags exist on every platform; only the path to Firefox changes.

### 1. Create a dedicated profile

A separate profile gives the window its own login, its own extensions, and none
of your normal tabs.

```sh
firefox -CreateProfile gmail
```

(Or run `firefox -ProfileManager` and create it there.)

### 2. Start it as its own instance and set it up

```sh
firefox -P gmail --new-instance https://mail.google.com
```

`--new-instance` keeps the window from joining your main Firefox. In this window:

1. Sign in to Gmail.
2. Install the theme (see the [README](../README.md#install)) and reload Gmail.
3. Open `about:support` and note the **Profile Folder** path.
4. Open `about:config` and set
   `toolkit.legacyUserProfileCustomizations.stylesheets` to `true`.

Do this before hiding the toolbars. Once they're hidden you can't easily open
`about:config` or the add-ons page.

### 3. Hide the toolbars

Quit the window. In the profile folder, create a `chrome` folder, and inside it
a file named `userChrome.css`:

```css
#TabsToolbar, #nav-bar, #PersonalToolbar, #toolbar-menubar {
  visibility: collapse !important;
}
```

Start it again with the command from step 2. You get Gmail in a bare window: a
title bar, and no tabs, address bar or toolbars.

## Chrome, Chromium, Edge, Brave (Linux, Windows, macOS)

These browsers have an app mode, so no profile editing is needed:

```sh
chromium --app=https://mail.google.com --user-data-dir="$HOME/.config/gmail-app"
```

`--app` gives a window with no tabs or address bar. `--user-data-dir` keeps its
login and extensions apart from your normal browser; install the theme from the
[Chrome Web Store](https://chromewebstore.google.com/detail/hbklabmgaphaoikehjpkkocdijbjnkco)
in that window the first time, then it stays. Replace `chromium` with
`google-chrome`, `microsoft-edge` or `brave`.

If you'd rather share your normal profile, leave out `--user-data-dir`; the
window then has your usual extensions and logins.

## Starting it

### With a keyboard shortcut (Haiku)

This is how it was done on the Haiku machine this guide came from. Open the
**Shortcuts** preferences, add a new shortcut, paste the whole command into it,
and choose a key combination:

```
/system/apps/Firefox/Firefox -P gmail --new-instance https://mail.google.com
```

On the author's machine this is **Ctrl + the Windows (Option) key + E**. Press
it and Gmail opens in its own window, wherever you are.

### From the desktop (untested)

A clickable desktop item is closer still to how BeOS applications work. The
idea is a small launcher script containing the same command:

```sh
#!/bin/sh
exec /system/apps/Firefox/Firefox -P gmail --new-instance https://mail.google.com
```

Save it somewhere handy, run `chmod +x` on it, and give it an icon from
Tracker's file information window. It isn't tested here, so check that Tracker
runs it when you open it. Drag it into Haiku's Deskbar and it becomes a
one-click launch.

## On Haiku, the theme adapts (from version 1.3.0)

When the extension runs on Haiku it recognises it and shows a narrower, calmer
**app-window sidebar** instead of the full Deskbar: the mail count at the top,
the Google apps listed down the side, and the mini calendar at the bottom.
Haiku's own Deskbar already gives you the clock, the other running
programs and the account, so the theme doesn't repeat them. On other systems the
full Deskbar appears; right-click the **Hide Deskbar** button to choose either
style.

## Changing things later

With the address bar hidden, you can't type a URL, and the add-ons page is hard
to reach. To get the toolbars back for a moment (Firefox):

1. Quit the Gmail window.
2. Rename `chrome/userChrome.css` to `userChrome.css.off`.
3. Start `firefox -P gmail --new-instance`. The toolbars are back, so you can add
   or update extensions or change settings.
4. Quit, rename the file back, and relaunch.

With Chromium's `--app` mode, just start the same browser without `--app` and
with the same `--user-data-dir`.

## Other sites

The same recipe works for any site you use a lot, such as Calendar or Drive:
make a profile (or a `--user-data-dir`) per site and point a shortcut at it.
Each one runs as its own browser, which costs some memory. Sites that share a
login can share a profile; if you hide the address bar, you'll have no way to
reach the second site, so keep the toolbars on in that profile.

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
