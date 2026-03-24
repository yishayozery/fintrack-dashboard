/**
 * FinTrack File Parser
 * Reads Excel/XLS/CSV bank & credit card files and populates TRANSACTIONS.
 *
 * Supported formats:
 *  1. MaxCard (Leumi CC)  — header at row 10: תאריך רכישה | שם בית עסק | סכום עסקה ...
 *  2. Leumi CC export     — header at row 4:  תאריך עסקה | שם בית העסק | קטגוריה | 4 ספרות ...
 *  3. Diners/Mastercard   — header at row 4:  תאריך עסקה | שם בית עסק | סכום עסקה | סכום חיוב ...
 *  4. Fibi bank statement — various formats, detect by columns
 *
 * v1.10.0 · 2026-03-24
 */

(function(){
'use strict';

/* ══════════════════════════════════════════════
   PUBLIC: handleFolderPick — replaces original
══════════════════════════════════════════════ */
window.handleFolderPick = function(input){
  if(!input.files || input.files.length === 0) return;

  var files = Array.from(input.files);
  var folder = (files[0].webkitRelativePath || files[0].name).split('/')[0];

  // Save folder metadata
  _appSettings.folderPath  = folder;
  _appSettings.fileCount   = files.length;
  if(typeof _saveSettings === 'function') _saveSettings();

  var supported = files.filter(function(f){
    return /\.(xlsx|xls|csv)$/i.test(f.name);
  });

  if(supported.length === 0){
    if(typeof showToast === 'function') showToast('⚠️ לא נמצאו קבצי Excel בתיקייה');
    return;
  }

  showToast('⏳ טוען ' + supported.length + ' קבצים...');

  // Read all files, then merge & render
  var results = [];
  var done = 0;

  supported.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb   = XLSX.read(data, {type:'array', cellDates:true});
        var txns = _parseWorkbook(wb, file.name);
        results = results.concat(txns);
      }catch(err){
        console.warn('FinTrack: could not parse', file.name, err);
      }
      done++;
      if(done === supported.length) _finalizeLoad(results, supported.length, folder);
    };
    reader.readAsArrayBuffer(file);
  });
};

/* same for the wizard input */
window.handleWizFolderPick = window.handleFolderPick;

/* ══════════════════════════════════════════════
   FINALIZE: merge into TRANSACTIONS + render
══════════════════════════════════════════════ */
function _finalizeLoad(txns, fileCount, folder){
  if(txns.length === 0){
    showToast('⚠️ לא נמצאו עסקאות בקבצים שנבחרו. בדוק שהקבצים הם ייצוא מהבנק/אשראי.');
    return;
  }

  // Deduplicate by key = date+name+amount
  var seen = {};
  var unique = txns.filter(function(t){
    var key = t.date + '|' + t.name + '|' + t.amount;
    if(seen[key]) return false;
    seen[key] = true;
    return true;
  });

  // Sort by date desc
  unique.sort(function(a,b){ return b.date.localeCompare(a.date); });

  // Replace global TRANSACTIONS
  // eslint-disable-next-line no-undef
  TRANSACTIONS.length = 0;
  unique.forEach(function(t){ TRANSACTIONS.push(t); });

  // Save to localStorage for persistence (up to ~2MB)
  try{
    localStorage.setItem('loadedTransactions', JSON.stringify(unique.slice(0,2000)));
    localStorage.setItem('loadedTransactionsTS', Date.now().toString());
  }catch(e){}

  // Update months list
  _rebuildMonths();

  // Re-render everything
  if(typeof renderAll === 'function') renderAll();
  if(typeof renderManagementTab === 'function') renderManagementTab();

  showToast('✅ נטענו ' + unique.length + ' עסקאות מ-' + fileCount + ' קבצים');

  // Close any open overlays
  var ov = document.getElementById('setupWizard');
  if(ov) ov.style.display = 'none';
  var fov = document.getElementById('folderStepOverlay');
  if(fov) fov.style.display = 'none';

  // Advance flow state
  if(window._flowState){ window._flowState.filesDone = true; }
  if(typeof navSetStep === 'function') navSetStep('dashboard');

  // Hide empty state
  var es = document.getElementById('emptyState');
  if(es) es.style.display = 'none';
  var ma = document.getElementById('mainApp');
  if(ma) ma.style.display = 'block';
}

/* ══════════════════════════════════════════════
   LOAD SAVED TRANSACTIONS on startup
══════════════════════════════════════════════ */
window.loadSavedTransactions = function(){
  try{
    var saved = localStorage.getItem('loadedTransactions');
    if(!saved) return false;
    var txns = JSON.parse(saved);
    if(!txns || !txns.length) return false;
    TRANSACTIONS.length = 0;
    txns.forEach(function(t){ TRANSACTIONS.push(t); });
    _rebuildMonths();
    return true;
  }catch(e){ return false; }
};

/* ══════════════════════════════════════════════
   REBUILD MONTHS_ORDER from loaded data
══════════════════════════════════════════════ */
function _rebuildMonths(){
  var monthSet = {};
  var heMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  TRANSACTIONS.forEach(function(t){
    if(!t.date) return;
    var parts = t.date.split('-');
    if(parts.length < 2) return;
    var y = parts[0], m = parseInt(parts[1],10);
    if(!y || !m) return;
    var label = heMonths[m-1] + ' ' + y;
    monthSet[y+'-'+('0'+m).slice(-2)] = label;
  });
  var sorted = Object.keys(monthSet).sort();
  // eslint-disable-next-line no-undef
  MONTHS_ORDER.length = 0;
  sorted.forEach(function(k){ MONTHS_ORDER.push(monthSet[k]); });
}

/* ══════════════════════════════════════════════
   WORKBOOK PARSER — tries each format
══════════════════════════════════════════════ */
function _parseWorkbook(wb, filename){
  var all = [];
  wb.SheetNames.forEach(function(sname){
    var ws  = wb.Sheets[sname];
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false});
    var txns = _tryAllFormats(rows, filename, sname);
    all = all.concat(txns);
  });
  return all;
}

function _tryAllFormats(rows, filename, sheetName){
  // Detect format by searching for known header signatures
  for(var i = 0; i < Math.min(rows.length, 15); i++){
    var row = rows[i].map(function(c){ return String(c||'').trim(); });
    var joined = row.join('|');

    // Format 1: MaxCard — "תאריך רכישה"
    if(joined.includes('תאריך רכישה') && joined.includes('שם בית עסק')){
      return _parseMaxCard(rows, i, filename);
    }

    // Format 2: Leumi CC export — "שם בית העסק" + "קטגוריה" + "4 ספרות"
    if(joined.includes('שם בית העסק') && joined.includes('קטגוריה') && joined.includes('ספרות')){
      return _parseLeumiExport(rows, i, filename);
    }

    // Format 3: Diners/Max without category — "שם בית עסק" + "סכום חיוב" + "סוג עסקה"
    if(joined.includes('שם בית עסק') && joined.includes('סכום חיוב') && joined.includes('סוג עסקה')){
      return _parseDiners(rows, i, filename);
    }

    // Format 4: Fibi/bank statement — "תאריך" + "תיאור" + "חובה/זכות"
    if((joined.includes('תאריך') && (joined.includes('חובה') || joined.includes('זכות') || joined.includes('יתרה')))){
      return _parseBankStatement(rows, i, filename);
    }
  }
  console.warn('FinTrack: unknown format in', filename, sheetName);
  return [];
}

/* ── Format 1: MaxCard (כרטיסי מקס / לאומי קארד) ─────────────
   Row layout: תאריך רכישה | שם בית עסק | סכום עסקה | מטבע | סכום חיוב | מטבע | שובר | פירוט
   Card number comes from filename or from a row before headers.
   Date format: DD.MM.YY  or  DD/MM/YY
──────────────────────────────────────────────────────────────── */
function _parseMaxCard(rows, headerRow, filename){
  var card = _cardFromFilename(filename);
  // Also try to read from a description row above (e.g., "קורפוריט - זהב - 2039")
  for(var k = 0; k < headerRow; k++){
    var m = String(rows[k][0]||'').match(/[-–]\s*(\d{4})\s*$/);
    if(m) { card = '*' + m[1]; break; }
  }

  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row = rows[i];
    var dateRaw  = String(row[0]||'').trim();
    var name     = String(row[1]||'').trim();
    var amtRaw   = String(row[4]||row[2]||'').replace(/[₪,\s]/g,'');
    var chargeType = String(row[7]||'').trim(); // פירוט נוסף

    if(!dateRaw || !name || !amtRaw) continue;
    if(name.includes('סה"כ') || name.includes('תנאים')) continue; // skip totals

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = chargeType.includes('הוראת קבע') ? 'קבוע' : 'משתנה';

    txns.push({
      date: date, name: name, amount: amount,
      card: card, chargeType: type,
      category: '', source: 'MaxCard'
    });
  }
  return txns;
}

/* ── Format 2: Leumi CC Export ───────────────────────────────
   Row 4 header: תאריך עסקה | שם בית העסק | קטגוריה | 4 ספרות | סוג עסקה | סכום חיוב | מטבע
   Date format: DD-MM-YYYY
──────────────────────────────────────────────────────────────── */
function _parseLeumiExport(rows, headerRow, filename){
  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row = rows[i];
    var dateRaw = String(row[0]||'').trim();
    var name    = String(row[1]||'').trim();
    var cat     = String(row[2]||'').trim();
    var card4   = String(row[3]||'').trim().replace(/\D/g,'');
    var sog     = String(row[4]||'').trim();
    var amtRaw  = String(row[5]||'').replace(/[₪,\s]/g,'');

    if(!dateRaw || !name || !amtRaw) continue;
    if(name.includes('סה"כ')) continue;

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = sog.includes('הוראת קבע') ? 'קבוע' : 'משתנה';
    var card = card4 ? '*' + card4.slice(-4) : _cardFromFilename(filename);

    txns.push({
      date: date, name: name, amount: amount,
      card: card, chargeType: type,
      category: cat, source: 'LeumiExport'
    });
  }
  return txns;
}

/* ── Format 3: Diners / Mastercard ──────────────────────────
   Row 4 header: תאריך עסקה | שם בית עסק | סכום עסקה | סכום חיוב | סוג עסקה | ענף | הערות
   Date: YYYY-MM-DD HH:MM:SS  or  DD/MM/YYYY
──────────────────────────────────────────────────────────────── */
function _parseDiners(rows, headerRow, filename){
  var card = _cardFromFilename(filename);
  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row = rows[i];
    var dateRaw = String(row[0]||'').trim();
    var name    = String(row[1]||'').trim();
    var amtRaw  = String(row[3]||row[2]||'').replace(/[₪,\s]/g,'');
    var sog     = String(row[4]||'').trim();
    var cat     = String(row[5]||'').trim();

    if(!dateRaw || !name || !amtRaw) continue;
    if(name.includes('סה"כ') || name.includes('תנאים')) continue;

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = sog.includes('הוראת קבע') ? 'קבוע' : 'משתנה';

    txns.push({
      date: date, name: name, amount: amount,
      card: card, chargeType: type,
      category: cat, source: 'Diners'
    });
  }
  return txns;
}

/* ── Format 4: Bank Statement (Fibi / Leumi) ─────────────────
   Typical: תאריך | תיאור | אסמכתא | חובה | זכות | יתרה
──────────────────────────────────────────────────────────────── */
function _parseBankStatement(rows, headerRow, filename){
  var txns = [];
  var hdrs = rows[headerRow].map(function(c){ return String(c||'').trim(); });
  var iDate  = _colIdx(hdrs, ['תאריך','date']);
  var iDesc  = _colIdx(hdrs, ['תיאור','פרטים','description','בית עסק']);
  var iDebit = _colIdx(hdrs, ['חובה','הוצאה','debit']);
  var iCredit= _colIdx(hdrs, ['זכות','הכנסה','credit']);

  if(iDate < 0 || iDesc < 0) return [];

  for(var i = headerRow + 1; i < rows.length; i++){
    var row = rows[i];
    var dateRaw = String(row[iDate]||'').trim();
    var name    = String(row[iDesc]||'').trim();
    var debit   = iDebit >= 0 ? parseFloat(String(row[iDebit]||'').replace(/[₪,\s]/g,'')) : NaN;
    var credit  = iCredit >= 0? parseFloat(String(row[iCredit]||'').replace(/[₪,\s]/g,'')): NaN;

    if(!dateRaw || !name) continue;
    if(name.length < 2) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    // Debit = expense, Credit = income
    if(!isNaN(debit) && debit > 0){
      txns.push({ date:date, name:name, amount:debit, card:'בנק', chargeType:'משתנה', category:'', source:'Bank' });
    }
    if(!isNaN(credit) && credit > 0){
      txns.push({ date:date, name:name+'(הכנסה)', amount:credit, card:'בנק', chargeType:'משתנה', category:'הכנסה', source:'Bank' });
    }
  }
  return txns;
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function _cardFromFilename(filename){
  // e.g. "2039_01_2026.xlsx" → "*2039"
  // e.g. "1974 - 15.03.26.xlsx" → "*1974"
  var m = filename.match(/(\d{4})/);
  return m ? '*' + m[1] : 'כרטיס';
}

function _parseDate(raw){
  if(!raw) return null;
  raw = raw.trim();

  // YYYY-MM-DD HH:MM:SS
  var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1] + '-' + m[2] + '-' + m[3];

  // DD.MM.YY or DD.MM.YYYY
  m = raw.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if(m){
    var d=m[1], mo=m[2], y=m[3];
    if(y.length===2) y = (parseInt(y)<50 ? '20':'19') + y;
    return y + '-' + ('0'+mo).slice(-2) + '-' + ('0'+d).slice(-2);
  }

  // DD-MM-YYYY (Leumi export style)
  m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m) return m[3] + '-' + m[2] + '-' + m[1];

  // Excel serial number
  var num = parseInt(raw);
  if(!isNaN(num) && num > 40000 && num < 60000){
    var jsDate = new Date((num - 25569) * 86400 * 1000);
    var y2 = jsDate.getUTCFullYear();
    var mo2 = jsDate.getUTCMonth()+1;
    var d2  = jsDate.getUTCDate();
    return y2+'-'+('0'+mo2).slice(-2)+'-'+('0'+d2).slice(-2);
  }

  // JS Date string from XLSX cellDates:true
  if(raw.includes('T') || raw.includes('00:00')){
    var d3 = new Date(raw);
    if(!isNaN(d3)){
      return d3.getFullYear()+'-'+('0'+(d3.getMonth()+1)).slice(-2)+'-'+('0'+d3.getDate()).slice(-2);
    }
  }

  return null;
}

function _colIdx(headers, candidates){
  for(var ci = 0; ci < candidates.length; ci++){
    for(var hi = 0; hi < headers.length; hi++){
      if(headers[hi].includes(candidates[ci])) return hi;
    }
  }
  return -1;
}

/* ══════════════════════════════════════════════
   Also wire up the wizard folder input
══════════════════════════════════════════════ */
// Override openSetupWizard's inner handler to use our parser
document.addEventListener('DOMContentLoaded', function(){

  // Auto-load saved transactions if present
  setTimeout(function(){
    if(typeof loadSavedTransactions === 'function' && loadSavedTransactions()){
      if(typeof renderAll === 'function') renderAll();
      console.log('FinTrack: loaded', TRANSACTIONS.length, 'saved transactions');
    }
  }, 800);

  // Patch dynamic inputs created by openSetupWizard
  document.addEventListener('change', function(e){
    if(e.target && e.target.type === 'file' && e.target.getAttribute('webkitdirectory') !== null){
      window.handleFolderPick(e.target);
    }
  });
});

})();
