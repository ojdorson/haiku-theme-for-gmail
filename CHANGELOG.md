# Changelog

Downloads for every version are on the
[Releases page](https://github.com/ojdorson/haiku-theme-for-gmail/releases).

## 1.1.4 (6 November 2026)

Every Gmail layout, and a resizable From column.

- **Resizable From column:** drag the line between the From and Subject
  headings, as in Tracker. The width is remembered; double-click the line
  for the default.
- **Reading pane** (right of or below the list) works: the list and the
  message share the window, the message wraps to fit, and the divider can
  still be dragged. In a narrow list each message shows on three lines:
  sender and date, then subject, then a grey preview.
- In a narrow reading pane, the labels drop below the subject, and the
  date is shortened so the star and Reply stay in view.
- Category tabs fit in Gmail's Default and Comfortable densities too: the
  sender line Gmail adds under each tab name no longer spills out.
- The column headings stay in line with the columns when a side panel
  (such as Quick settings) opens.
- The "Select tabs to enable" dialog no longer has white stripes.

## 1.1.3 (6 November 2026)

Label menu fix.

- The menu on a label in the folder list (⋮) fits again: "Label color"
  shows its colour swatch in the checkmark column and its arrow at the
  right, with no clipping and no horizontal scrollbar.

## 1.1.2 (5 November 2026)

Clearer default buttons and a tidier search-options panel.

- Default buttons (Search in the search options, Unsubscribe, confirmations)
  are BeOS desktop blue with white text, so the default stands out.
  Summary-card buttons stay grey.
- Search options: every field has the full Haiku frame (some showed only
  their top and left edges), and the panel is wide enough for the Size row,
  whose field and unit menu used to run off the edge.
- Firefox: the release includes a Mozilla-signed `.xpi` you can install
  directly.

## 1.1.1 (5 November 2026)

Firefox support, and polish for compose, labels and the action bar.

- **Firefox:** a Firefox version built from the same code, signed by
  Mozilla. It looks and works the same as in Chrome; only the scrollbars
  are Firefox's own.
- Compose: the To field is a single Haiku text field (no white strip beside
  it), and recipient chips are small framed labels that fit inside it.
- Labels beside the subject are right-aligned, ending in line with the
  message header, each as one framed label with its ×. They use the label's
  Gmail colour, or the BeOS desktop blue when it has none; "External" stays
  grey.
- The small action-bar buttons only highlight when the pointer is over
  them, not 10px away.

## 1.0.3 (4 November 2026)

Pictures, summary cards and a steadier message list.

- Senders' pictures are back in open threads, inside the grey header panel
  in a small sunken square frame: between "From:" / "To:" and the name when
  a message is open, at the panel's left edge when it's collapsed.
- Summary cards show their product or brand picture again, in a small
  grey sunken well so white logos stay visible.
- Cards with a status ("Shipped", "Expected by…") show it at the right end
  of the title line, with the details and buttons on the line below.
- Older order summaries ("2 items from Amazon") use the same compact grey
  card: title and price, then the details with a View order button.
- The column headers stay in place under the action bar while the list
  scrolls, so they never cover the yellow window tab.

## 1.0.2 (4 November 2026)

Settings fixes.

- Settings → General → Stars shows the star pictures again in the "In use"
  and "Not in use" lists.
- Gmail's footer (Program Policies, account activity) no longer sits on top
  of the Settings page; it's at the end, below the settings.
- Options Gmail has switched off (for example the IMAP expunge choices while
  Auto-Expunge is on) now look disabled: greyed out, with dimmed labels.

## 1.0.1 (4 November 2026)

Fixes for stars and nested labels.

- Starring now shows with Gmail's multiple star types turned on (Settings →
  General → Stars), in the message list and in open messages.
- Coloured stars use Haiku's star tinted to their colour (red, orange,
  yellow, green, blue, purple); a plain star is Haiku blue.
- The symbol types (! ? ✓ i ») show Gmail's own icons again.
- Unstarring displays correctly straight away; before, the next star showed
  until the pointer moved away.
- No round grey highlight is left around a star after clicking it.
- Nested labels are indented under their parent label in the folder list
  again (16px per level), like an outline in Tracker.

## 1.0.0 (3 November 2026)

First release.

- BeMail toolbar with Haiku's icons; each button presses Gmail's own control.
- Yellow window tabs over the message pane and the compose window, with
  working close boxes.
- Tracker-style message list: 22px rows, column headers, Haiku status icons.
- BeMail-style compose window: To and Subject labels, Send row and
  formatting strip at the top, minimise and zoom boxes. The pop-out compose
  window matches.
- Haiku controls throughout: push buttons, text fields, checkboxes, radio
  buttons, menus, scrollbars and tab views.
- Compact summaries for calendar invitations, bills and orders; resizable
  folder panel; status bar with the unread count and position.
- Narrow windows trim the toolbar to the most-used buttons.
- Gmail extras with no BeOS counterpart are hidden.
