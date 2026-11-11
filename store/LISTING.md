# Chrome Web Store listing

Text and answers for the Web Store developer dashboard. The images in this
folder use sample data (no real mail).

## Store listing

**Name:** Haiku (BeOS) Theme for Gmail

**Summary** (132 characters max):

> Make Gmail look and work like Haiku's BeMail: a BeOS-style toolbar, Tracker message list, yellow window tabs and Haiku controls.

**Category:** Make Chrome Yours → Functionality & UI (the closest fit for a theme)

**Language:** English

**Description:**

> Turn Gmail into a native-looking Haiku (BeOS) mail client, modelled on
> Haiku's BeMail and Beam and on Haiku's interface guidelines.
>
> • Actions in the window they act on, as in BeMail and Tracker: an open
>   message has Reply, Reply All, Forward, Archive, Trash, Junk, Unread,
>   Print, Previous and Next; a message list has Archive, Trash, Junk and
>   Read/Unread for the selected messages. Each button presses Gmail's own
>   control, so Gmail still does the work.
> • Tracker-style queries: one click runs a saved search (Unread, Starred,
>   Attachments, or your own - save any Gmail search with a name and a
>   picture). Your queries sync through your browser's sync.
> • App toolbar with New, Check Mail and Google Drive, in Haiku's icons.
> • Yellow window tabs over the message pane and the compose window, with a
>   working close box.
> • Tracker-style message list: 22px rows, column headers, Haiku status
>   icons and stars.
> • BeMail compose window: To and Subject labels, the Send row and
>   formatting strip at the top, minimise and zoom boxes on the tab.
> • Haiku controls throughout: bevelled push buttons, sunken text fields,
>   radio buttons, checkboxes, scrollbars, menus and tab views.
> • Compact summaries for invitations, bills and orders; a resizable folder
>   panel; a status bar with the unread count and position.
> • Gmail extras with no BeOS counterpart are hidden: the apps grid, Gemini,
>   Chat and Meet, and the Material ripples.
>
> Everything happens in your browser. The extension collects no data and
> makes no network requests. Besides running on mail.google.com it uses the
> browser's extension storage, only to keep your saved queries.
>
> Works with Gmail's English interface and default inbox layout. Open source
> (MIT): https://github.com/ojdorson/haiku-theme-for-gmail
>
> Not
> affiliated with Google or Haiku, Inc. Gmail is a trademark of Google LLC.
> The icons are Haiku's, used under the MIT License.

## Graphics

| File | Use |
| --- | --- |
| `../icons/png/app-128.png` | Store icon (128×128) |
| `screenshot-1-inbox.png` | Screenshot 1 (1280×800) |
| `screenshot-2-message.png` | Screenshot 2 |
| `screenshot-3-queries.png` | Screenshot 3 (a query's results and its right-click menu) |
| `screenshot-4-query-dialog.png` | Screenshot 4 (the Edit Query dialog) |
| `screenshot-5-compose.png` | Screenshot 5 |
| `promo-440x280.png` | Small promo tile (440×280) |
| `marquee-1400x560.png` | Marquee promo tile (1400×560, optional) |

## Privacy practices

**Single purpose:** Restyles the Gmail web interface to look like the Haiku
(BeOS) operating system's mail client.

**Host permission justification (`https://mail.google.com/*`):** The
extension's stylesheet and script run only on Gmail to restyle its
interface. They read Gmail's page structure to place the toolbar, window tab
and column headers, and they never read, store or transmit message content.

**Storage permission justification (`storage`):** Keeps the user's saved
queries (a name, a Gmail search string and a picture name for each toolbar
button) in `chrome.storage.sync`, so they follow the user to their other
computers through Chrome's own sync. Nothing else is stored, and nothing is
sent anywhere by the extension.

**Remote code:** No. All code is in the package.

**Data usage:** The extension does not collect or use any user data. (Tick
none of the data categories: saved queries stay in the user's own browser
storage and are never sent to the developer or anyone else.) Certify all three disclosures:

- I do not sell or transfer user data to third parties.
- I do not use or transfer user data for purposes unrelated to the item's
  single purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.

**Privacy policy URL:** Not strictly required when no data is collected.
If the dashboard asks for one, link to the README's privacy paragraph in the
public repository.

## Submission checklist

1. `python3 tools/build.py` and upload `dist/haiku-theme-for-gmail-<version>.zip`.
2. Fill in the listing and privacy tabs from this file.
3. Upload the graphics above.
4. Visibility: Public. Expect a longer review because the extension runs on
   mail.google.com.
