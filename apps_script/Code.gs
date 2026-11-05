/** XARO sync receiver. Paste into a Google Sheet's Extensions > Apps Script, then Deploy > New deployment >
 *  Web app (Execute as: Me, Who has access: Anyone). Paste the https .../exec URL in Admin > Settings. */
const TABS = { signup: ['time', 'name', 'email', 'phone', 'country', 'currency'],
  order: ['time', 'id', 'name', 'email', 'phone', 'country', 'total', 'currency', 'items', 'address'],
  lead: ['time', 'name', 'email', 'phone', 'country', 'note'], test: ['time', 'note', 'by'] };
const clean = v => { v = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 1000); return /^[=+\-@]/.test(v) ? "'" + v : v; };
function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (!e.postData || e.postData.length > 20000) return out('too large');
    const d = JSON.parse(e.postData.contents), cols = TABS[d.type]; if (!cols) return out('unknown type');
    const p = d.payload || {}, ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName(d.type);
    if (!sh) { sh = ss.insertSheet(d.type); sh.appendRow(cols); sh.setFrozenRows(1); }
    sh.appendRow(cols.map(c => c === 'time' ? new Date() : clean(c === 'currency' ? (p.currency || p.cur) : p[c] != null ? p[c] : (c === 'items' && p.items ? p.items : '')))); return out('ok');
  } catch (err) { return out('error'); } finally { lock.releaseLock(); }
}
const out = s => ContentService.createTextOutput(s);
