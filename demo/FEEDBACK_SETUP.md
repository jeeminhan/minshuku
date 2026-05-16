# Feedback form → Google Sheet (one-time setup)

The `/feedback` form posts JSON to a Google Apps Script Web App, which
appends a row to a Sheet you own. ~10 minutes, no server, free.

## 1. Create the Sheet

1. Go to <https://sheets.new> — a blank sheet.
2. Name it something like `minshuku demo feedback`.
3. In row 1, optionally add headers:
   `timestamp | mode | guidance | wouldUse | wouldAuthor | level | open | ua`

## 2. Add the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever's there and paste this:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    d.mode || "",
    d.guidance || "",
    d.wouldUse || "",
    d.wouldAuthor || "",
    d.level || "",
    d.open || "",
    d.ua || ""
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. **Save** (disk icon).

## 3. Deploy as a Web App

1. **Deploy → New deployment**.
2. Gear icon → **Web app**.
3. Settings:
   - **Description**: anything
   - **Execute as**: **Me**
   - **Who has access**: **Anyone**
4. **Deploy**. Authorize when prompted (it's your own script — the
   "unsafe" warning is Google being cautious about your own code).
5. Copy the **Web app URL**. It ends in `/exec`.

## 4. Wire it in

1. Open `demo/lib/feedback.ts`.
2. Paste the URL into `FEEDBACK_ENDPOINT`:
   ```ts
   export const FEEDBACK_ENDPOINT = "https://script.google.com/macros/s/AKfy.../exec";
   ```
3. Redeploy the demo (`vercel --prod` from `demo/`, or ask Claude).

## 5. Test

Open `/feedback`, fill it out, submit. A row should appear in the Sheet
within a few seconds.

> Note: the form posts with `no-cors`, so the browser can't read the
> response — that's expected and fine. The data still lands. If rows
> aren't appearing, re-check that "Who has access" is **Anyone** and
> that you redeployed after pasting the URL.
