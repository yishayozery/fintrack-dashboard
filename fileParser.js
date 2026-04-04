/**
 * FinTrack File Parser  v1.11.0
 * Reads Excel/XLS/CSV bank & credit card files → populates TRANSACTIONS.
 *
 * Supported:
 *  1. MaxCard / Isracard  — header: תאריך רכישה | שם בית עסק | סכום עסקה | סכום חיוב
 *  2. Leumi CC export     — header: תאריך עסקה | שם בית העסק | קטגוריה | 4 ספרות
 *  3. Diners / Max CC     — header: תאריך עסקה | שם בית עסק | סכום חיוב | סוג עסקה  (cells may have \n)
 *  4. Bank statement      — header: תאריך | תיאור | חובה / זכות / יתרה
 */

(function(){
'use strict';

/* ══════════════════════════════════════════════
   PUBLIC: handleFolderPick
══════════════════════════════════════════════ */
window.handleFolderPick = function(input){
  if(!input.files || input.files.length === 0) return;

  var files = Array.from(input.files);
  // folder name from webkitRelativePath (Windows: backslash or forward-slash)
  var firstPath = files[0].webkitRelativePath || files[0].name;
  var folder = firstPath.split(/[/\\]/)[0] || firstPath;

  // Save folder metadata
  try{
    _appSettings.folderPath = folder;
    _appSettings.fileCount  = files.length;
    if(typeof _saveSettings === 'function') _saveSettings();
  }catch(e){ console.warn('FinTrack: _appSettings not accessible', e); }

  // ── Filter: accept all spreadsheet formats SheetJS can read ──
  var supported = files.filter(function(f){
    return /\.(xlsx|xlsb|xlsm|xls|csv|ods)$/i.test(f.name);
  });

  // Diagnostic: log all files seen vs accepted (helps debug missing files)
  console.log('[FinTrack] כל הקבצים בתיקייה (' + files.length + '):', files.map(function(f){ return f.name; }));
  console.log('[FinTrack] קבצים מקובלים לפרסור (' + supported.length + '):', supported.map(function(f){ return f.name; }));

  if(supported.length === 0){
    var allExts = files.map(function(f){
      var m = f.name.match(/\.([^.]+)$/);
      return m ? m[1].toLowerCase() : '(ללא סיומת)';
    }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
    _showToast('⚠️ לא נמצאו קבצי Excel בתיקייה. סיומות שנמצאו: ' + (allExts || 'אין') + '. נדרש: xlsx/xls/csv');
    return;
  }

  // ── Show coin-loading animation overlay ──
  _showCoinLoader(supported.length);

  // Show loading progress bar in folder overlay
  var pb = document.getElementById('procBar');
  var ov = document.getElementById('processingOverlay');
  if(ov){ ov.style.display='flex'; }

  var results = [];
  var done    = 0;
  var report  = []; // per-file summary for diagnostics

  supported.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      var fileTxns = [];
      var detected = 'לא זוהה';
      try{
        var data = new Uint8Array(e.target.result);
        var wb   = XLSX.read(data, {type:'array', cellDates:true});
        var r    = _parseWorkbook(wb, file.name);
        fileTxns = r.txns;
        detected = r.format;
        results  = results.concat(fileTxns);
      }catch(err){
        detected = 'שגיאה: ' + (err.message||err);
        console.warn('FinTrack: parse error in', file.name, err);
      }
      report.push({ name: file.name, format: detected, count: fileTxns.length });
      done++;

      // Update progress bar + coin loader
      if(pb) pb.style.width = Math.round(done/supported.length*100) + '%';
      _updateCoinLoader(done, supported.length);

      if(done === supported.length){
        if(ov) ov.style.display='none';
        _hideCoinLoader();
        _finalizeLoad(results, supported.length, folder, report);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

window.handleWizFolderPick = window.handleFolderPick;

/* ══════════════════════════════════════════════
   FINALIZE
══════════════════════════════════════════════ */
function _finalizeLoad(txns, fileCount, folder, report){
  // Deduplicate
  var seen = {};
  var unique = txns.filter(function(t){
    var key = t.date + '|' + t.name + '|' + t.amount;
    if(seen[key]) return false;
    seen[key] = true;
    return true;
  });

  unique.sort(function(a,b){ return b.date.localeCompare(a.date); });

  // Push to global TRANSACTIONS
  TRANSACTIONS.length = 0;
  unique.forEach(function(t){ TRANSACTIONS.push(t); });

  // Persist to localStorage
  try{
    localStorage.setItem('loadedTransactions', JSON.stringify(unique.slice(0,2000)));
    localStorage.setItem('loadedTransactionsTS', Date.now().toString());
  }catch(e){}

  // Close overlays FIRST — before render, so they always close even if render fails
  ['setupWizard','folderStepOverlay','noDataOverlay'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });

  // Flow state
  if(window._flowState){ window._flowState.filesDone = true; }
  try{ localStorage.removeItem('onboardingFilesSkipped'); }catch(e){}
  if(typeof navSetStep === 'function') navSetStep('dashboard');

  // Rebuild month list & re-render (wrapped so overlay close always runs)
  _rebuildMonths();
  try{
    if(typeof renderAll === 'function') renderAll();
    if(typeof renderManagementTab === 'function') renderManagementTab();
  }catch(err){ console.error('FinTrack renderAll error:', err); }

  // Update header subtitle + updated badge
  _updateHeaderMeta();

  // Show result
  if(unique.length === 0){
    // Build diagnostic message
    var unknownFiles = report.filter(function(r){ return r.count === 0; }).map(function(r){ return r.name; });
    var msg = '⚠️ הקבצים נטענו אך לא נמצאו עסקאות.\n\n';
    if(unknownFiles.length){
      msg += 'קבצים שלא זוהו: ' + unknownFiles.join(', ') + '\n\n';
    }
    msg += 'פורמטים נתמכים: מקס/ישראכרט, לאומי אשראי, דיינרס, דפי בנק.';
    _showToast('⚠️ לא נמצאו עסקאות — ראה קונסול לפרטים');
    console.warn('FinTrack diagnostic report:', report);
    alert(msg);
    return;
  }

  // Success toast
  var successCount = report.filter(function(r){ return r.count > 0; }).length;
  _showToast('✅ ' + unique.length + ' עסקאות נטענו מ-' + successCount + '/' + fileCount + ' קבצים');
  console.log('FinTrack: loaded', unique.length, 'transactions. Report:', report);
}

/* ══════════════════════════════════════════════
   RESTORE SAVED TRANSACTIONS
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
   UPDATE HEADER META (subtitle + עודכן badge)
══════════════════════════════════════════════ */
window._updateHeaderMeta = function _updateHeaderMeta(){
  var sub   = document.getElementById('headerSubtitle');
  var badge = document.getElementById('headerUpdatedBadge');
  if(!sub && !badge) return;

  var footer = document.getElementById('appFooter');
  if(!TRANSACTIONS || TRANSACTIONS.length === 0){
    if(sub){ sub.textContent = 'אין נתונים — טען קבצים פיננסיים'; sub.style.color='#64748b'; }
    if(badge) badge.style.display = 'none';
    if(footer) footer.style.display = 'none';
    return;
  }

  // Date range
  var dates = TRANSACTIONS.map(function(t){ return t.date; }).filter(Boolean).sort();
  var first = dates[0], last = dates[dates.length-1];
  function _fmtDate(iso){
    if(!iso) return '';
    var p = iso.split('-');
    var heM = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    return p[2]+' '+heM[parseInt(p[1],10)-1]+' '+p[0];
  }
  var range = _fmtDate(first) + ' — ' + _fmtDate(last);

  // Count unique cards
  var cards = {};
  TRANSACTIONS.forEach(function(t){ if(t.card) cards[t.card]=1; });
  var cardCount = Object.keys(cards).length;

  if(sub){
    sub.textContent = range + ' · ' + TRANSACTIONS.length + ' עסקאות · ' + cardCount + ' מקורות';
    sub.style.color = '#94a3b8';
  }

  // Update footer sources line
  if(footer){
    var srcSet = {};
    TRANSACTIONS.forEach(function(t){ if(t.card) srcSet[t.card]=1; });
    var srcList = Object.keys(srcSet).sort().join(' | ');
    var footerSrc = document.getElementById('footerSources');
    if(footerSrc) footerSrc.textContent = 'מקורות: ' + srcList;
    footer.style.display = 'block';
  }

  // Updated badge with full date+time
  if(badge){
    var now = new Date();
    var heM = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    var pad = function(n){ return ('0'+n).slice(-2); };
    var ts = now.getDate()+' '+heM[now.getMonth()]+' '+now.getFullYear()+
             ' · '+pad(now.getHours())+':'+pad(now.getMinutes());
    badge.textContent = 'עודכן: ' + ts;
    badge.style.display = 'block';
  }
};

/* ══════════════════════════════════════════════
   REBUILD MONTHS_ORDER
══════════════════════════════════════════════ */
function _rebuildMonths(){
  var monthSet = {};
  var heM = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  TRANSACTIONS.forEach(function(t){
    if(!t.date) return;
    var p = t.date.split('-');
    if(p.length < 2) return;
    var y = p[0], m = parseInt(p[1],10);
    if(!y || !m) return;
    var label = heM[m-1]+' '+y;
    monthSet[y+'-'+('0'+m).slice(-2)] = label;
  });
  var sorted = Object.keys(monthSet).sort();
  MONTHS_ORDER.length = 0;
  sorted.forEach(function(k){ MONTHS_ORDER.push(monthSet[k]); });

  // Update filter dropdown with actual months
  var sel = document.getElementById('filterMonth');
  if(sel){
    var cur = sel.value;
    sel.innerHTML = '<option value="all">כל החודשים</option>';
    sorted.forEach(function(k){
      var label = monthSet[k];
      var opt = document.createElement('option');
      opt.value = label; opt.textContent = label;
      if(label === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

/* ══════════════════════════════════════════════
   WORKBOOK PARSER
══════════════════════════════════════════════ */
function _parseWorkbook(wb, filename){
  var all = [];
  var format = 'לא זוהה';
  wb.SheetNames.forEach(function(sname){
    var ws   = wb.Sheets[sname];
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false});
    var r    = _tryAllFormats(rows, filename, sname);
    if(r.format !== 'לא זוהה') format = r.format;
    all = all.concat(r.txns);
  });
  return { txns: all, format: format };
}

/* ── Normalize cell text: trim + collapse all whitespace/newlines to single space ── */
function _norm(v){ return String(v||'').replace(/\s+/g,' ').trim(); }

function _tryAllFormats(rows, filename, sheetName){
  for(var i = 0; i < Math.min(rows.length, 20); i++){
    // Normalize each cell — this fixes cells with \n inside (e.g. Diners)
    var row    = rows[i].map(_norm);
    var joined = row.join('|');

    // Format 1: MaxCard / Isracard — "תאריך רכישה" + "שם בית עסק"
    if(joined.includes('תאריך רכישה') && joined.includes('שם בית עסק')){
      return { txns: _parseMaxCard(rows, i, filename), format: 'MaxCard/Isracard' };
    }

    // Format 2: Leumi CC export — "שם בית העסק" + "קטגוריה" + "ספרות"
    if(joined.includes('שם בית העסק') && joined.includes('קטגוריה') && joined.includes('ספרות')){
      return { txns: _parseLeumiExport(rows, i, filename), format: 'LeumiExport' };
    }

    // Format 3: Diners/Max new — "שם בית עסק" + ("סכום חיוב" or "סכום ח") + ("סוג עסקה" or "ענף")
    if(joined.includes('שם בית עסק') && (joined.includes('סכום חיוב') || joined.includes('סכום ח')) &&
       (joined.includes('סוג עסקה') || joined.includes('ענף'))){
      return { txns: _parseDiners(rows, i, filename), format: 'Diners/Max' };
    }

    // Format 4: Bank statement — "תאריך" + ("חובה" or "זכות" or "יתרה")
    if(joined.includes('תאריך') && (joined.includes('חובה') || joined.includes('זכות') || joined.includes('יתרה'))){
      return { txns: _parseBankStatement(rows, i, filename), format: 'BankStatement' };
    }
  }
  console.warn('FinTrack: unknown format —', filename, sheetName,
    '| first rows:', rows.slice(0,5).map(function(r){ return r.map(_norm).join('|'); }));
  return { txns: [], format: 'לא זוהה' };
}

/* ── Format 1: MaxCard / Isracard ─────────────────────────────────────────
   Header: תאריך רכישה | שם בית עסק | סכום עסקה | מטבע עסקה | סכום חיוב | מטבע חיוב | מס' שובר | פירוט נוסף
   Date:   DD.MM.YY  or  DD.MM.YYYY
   Card:   from filename or from a description row above (e.g. "קורפוריט - זהב - 2039")
────────────────────────────────────────────────────────────────────────────── */
function _parseMaxCard(rows, headerRow, filename){
  var card = _cardFromFilename(filename);
  for(var k = 0; k < headerRow; k++){
    var desc = _norm(rows[k][0] || '');
    var m = desc.match(/[-–]\s*(\d{4})\s*$/);
    if(m){ card = '*' + m[1]; break; }
  }

  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row      = rows[i];
    var dateRaw  = _norm(row[0]);
    var name     = _norm(row[1]);
    // col[4] = סכום חיוב (actual charged), col[2] = סכום עסקה (original) — prefer col[4] if non-empty
    var chargeRaw = _norm(row[4]);
    var origRaw   = _norm(row[2]);
    var amtRaw    = (chargeRaw && chargeRaw !== '' && chargeRaw !== '0') ? chargeRaw : origRaw;
    amtRaw        = amtRaw.replace(/[₪,\s]/g,'');
    var detail    = _norm(row[7]);

    if(!dateRaw || !name) continue;
    if(name.includes('סה"כ') || name.includes('תנאים') || name.length < 2) continue;

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = (detail.includes('הוראת קבע') || name.includes('הוראת קבע')) ? 'קבוע' : 'משתנה';

    txns.push({ date:date, name:name, amount:Math.abs(amount),
      card:card, chargeType:type, category:'', source:'MaxCard' });
  }
  return txns;
}

/* ── Format 2: Leumi CC Export ─────────────────────────────────────────────
   Header: תאריך עסקה | שם בית העסק | קטגוריה | 4 ספרות אחרונות | סוג עסקה | סכום חיוב | מטבע חיוב
   Date:   DD-MM-YYYY
────────────────────────────────────────────────────────────────────────────── */
function _parseLeumiExport(rows, headerRow, filename){
  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row     = rows[i];
    var dateRaw = _norm(row[0]);
    var name    = _norm(row[1]);
    var cat     = _norm(row[2]);
    var card4   = _norm(row[3]).replace(/\D/g,'');
    var sog     = _norm(row[4]);
    var amtRaw  = _norm(row[5]).replace(/[₪,\s]/g,'');

    if(!dateRaw || !name || !amtRaw) continue;
    if(name.includes('סה"כ')) continue;

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = sog.includes('הוראת קבע') ? 'קבוע' : 'משתנה';
    var card = card4 ? '*' + card4.slice(-4) : _cardFromFilename(filename);

    txns.push({ date:date, name:name, amount:Math.abs(amount),
      card:card, chargeType:type, category:cat, source:'LeumiExport' });
  }
  return txns;
}

/* ── Format 3: Diners / Max ──────────────────────────────────────────────────
   Header: תאריך עסקה | שם בית עסק | סכום עסקה | סכום חיוב | סוג עסקה | ענף | הערות
   (cells may contain \n — handled by _norm in detection)
   Date:   YYYY-MM-DD HH:MM:SS
────────────────────────────────────────────────────────────────────────────── */
function _parseDiners(rows, headerRow, filename){
  var card = _cardFromFilename(filename);
  var txns = [];
  for(var i = headerRow + 1; i < rows.length; i++){
    var row     = rows[i];
    var dateRaw = _norm(row[0]);
    var name    = _norm(row[1]);
    var amtRaw  = _norm(row[3] || row[2]).replace(/[₪,\s]/g,'');
    var sog     = _norm(row[4]);
    var cat     = _norm(row[5]);

    if(!dateRaw || !name || !amtRaw) continue;
    if(name.includes('סה"כ') || name.includes('תנאים') || name.length < 2) continue;

    var amount = parseFloat(amtRaw);
    if(isNaN(amount) || amount === 0) continue;

    var date = _parseDate(dateRaw);
    if(!date) continue;

    var type = sog.includes('הוראת קבע') ? 'קבוע' : 'משתנה';

    txns.push({ date:date, name:name, amount:Math.abs(amount),
      card:card, chargeType:type, category:cat, source:'Diners' });
  }
  return txns;
}

/* ── Format 4: Bank Statement (Fibi / Leumi / etc.) ─────────────────────────
   Typical: תאריך | תיאור | אסמכתא | חובה | זכות | יתרה
────────────────────────────────────────────────────────────────────────────── */
function _parseBankStatement(rows, headerRow, filename){
  var txns = [];
  var hdrs   = rows[headerRow].map(_norm);
  var iDate  = _colIdx(hdrs, ['תאריך','תאריך ערך','date']);
  var iDesc  = _colIdx(hdrs, ['תיאור','פרטים','פרטי התנועה','תיאור התנועה','פירוט','תנועה','description','בית עסק','אסמכתא']);
  var iDebit = _colIdx(hdrs, ['חובה','הוצאה','debit']);
  var iCredit= _colIdx(hdrs, ['זכות','הכנסה','credit']);

  console.log('[FinTrack] BankStatement headers:', hdrs, '| iDate='+iDate+' iDesc='+iDesc+' iDebit='+iDebit+' iCredit='+iCredit);

  // Fallback: if description column not found by name, use first non-empty text column
  if(iDesc < 0){
    for(var ci = 0; ci < hdrs.length; ci++){
      if(ci !== iDate && ci !== iDebit && ci !== iCredit && hdrs[ci].length > 0){
        iDesc = ci;
        console.log('[FinTrack] BankStatement: desc fallback to column', ci, '("'+hdrs[ci]+'")');
        break;
      }
    }
  }

  if(iDate < 0 || iDesc < 0){
    console.warn('[FinTrack] BankStatement: חסרות עמודות חיוניות — תאריך או תיאור. headers:', hdrs);
    return [];
  }

  for(var i = headerRow + 1; i < rows.length; i++){
    var row     = rows[i];
    var dateRaw = _norm(row[iDate]);
    var name    = _norm(row[iDesc]);
    var debit   = iDebit  >= 0 ? parseFloat(_norm(row[iDebit]).replace(/[₪,\s]/g,''))  : NaN;
    var credit  = iCredit >= 0 ? parseFloat(_norm(row[iCredit]).replace(/[₪,\s]/g,'')) : NaN;

    if(!dateRaw || !name || name.length < 2){
      if(i < headerRow + 5) console.log('[FinTrack] BankStatement row', i, 'skipped — dateRaw:', dateRaw, 'name:', name);
      continue;
    }

    var date = _parseDate(dateRaw);
    if(!date){
      if(i < headerRow + 5) console.log('[FinTrack] BankStatement row', i, 'date parse failed for:', dateRaw);
      continue;
    }

    if(!isNaN(debit) && debit > 0)
      txns.push({ date:date, name:name, amount:debit, card:'בנק', chargeType:'משתנה', category:'', source:'Bank' });
    if(!isNaN(credit) && credit > 0)
      txns.push({ date:date, name:name+' (הכנסה)', amount:credit, card:'בנק', chargeType:'משתנה', category:'הכנסה', source:'Bank' });
  }
  console.log('[FinTrack] BankStatement', filename, '→', txns.length, 'עסקאות');
  return txns;
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function _cardFromFilename(filename){
  // "2039_01_2026.xlsx" → "*2039",  "פירוט ... 1974 - ..." → "*1974"
  var m = filename.match(/(\d{4})/);
  return m ? '*' + m[1] : 'כרטיס';
}

function _parseDate(raw){
  if(!raw) return null;
  raw = raw.trim();

  // YYYY-MM-DD HH:MM:SS  or  YYYY-MM-DD
  var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];

  // DD.MM.YYYY  or  DD/MM/YYYY  or  DD-MM-YYYY  (generic two-digit day/month)
  m = raw.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if(m){
    var d=m[1], mo=m[2], y=m[3];
    if(y.length===2) y = (parseInt(y,10)<50?'20':'19')+y;
    return y+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2);
  }

  // Excel serial number
  var num = parseInt(raw,10);
  if(!isNaN(num) && num > 40000 && num < 60000){
    var jsDate = new Date((num-25569)*86400*1000);
    return jsDate.getUTCFullYear()+'-'+('0'+(jsDate.getUTCMonth()+1)).slice(-2)+'-'+('0'+jsDate.getUTCDate()).slice(-2);
  }

  // JS Date string from XLSX cellDates:true  (e.g. "Fri Jan 01 2026 00:00:00")
  if(raw.length > 6){
    var d2 = new Date(raw);
    if(!isNaN(d2))
      return d2.getFullYear()+'-'+('0'+(d2.getMonth()+1)).slice(-2)+'-'+('0'+d2.getDate()).slice(-2);
  }

  return null;
}

function _colIdx(headers, candidates){
  for(var ci=0; ci<candidates.length; ci++)
    for(var hi=0; hi<headers.length; hi++)
      if(headers[hi].includes(candidates[ci])) return hi;
  return -1;
}

function _showToast(msg){
  if(typeof showToast === 'function') showToast(msg);
  else console.log('FinTrack toast:', msg);
}

/* ══════════════════════════════════════════════
   COIN LOADER ANIMATION
══════════════════════════════════════════════ */
var _coinLoaderEl = null;

function _showCoinLoader(fileCount){
  if(_coinLoaderEl) return; // already showing
  var el = document.createElement('div');
  el.id = '_coinLoader';
  el.innerHTML = [
    '<style>',
    '#_coinLoader{position:fixed;inset:0;z-index:999999;background:rgba(10,15,30,0.92);',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'gap:18px;direction:rtl;font-family:inherit;}',
    '._cl-hourglass{font-size:64px;animation:_cl-spin 1.8s ease-in-out infinite;}',
    '@keyframes _cl-spin{0%,100%{transform:rotate(0deg);}45%{transform:rotate(180deg);}50%{transform:rotate(180deg);}95%{transform:rotate(360deg);}}',
    '._cl-coins{display:flex;gap:6px;align-items:flex-end;height:40px;}',
    '._cl-coin{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);',
    'box-shadow:0 2px 8px rgba(245,158,11,0.4);animation:_cl-fall 1.2s ease-in infinite;}',
    '._cl-coin:nth-child(1){animation-delay:0s;}',
    '._cl-coin:nth-child(2){animation-delay:0.15s;}',
    '._cl-coin:nth-child(3){animation-delay:0.3s;}',
    '._cl-coin:nth-child(4){animation-delay:0.45s;}',
    '._cl-coin:nth-child(5){animation-delay:0.6s;}',
    '@keyframes _cl-fall{0%{transform:translateY(-30px);opacity:0;}',
    '30%{opacity:1;}80%{opacity:1;}100%{transform:translateY(30px);opacity:0;}}',
    '._cl-title{font-size:18px;font-weight:700;color:#f1f5f9;}',
    '._cl-sub{font-size:13px;color:#64748b;}',
    '._cl-bar-wrap{width:240px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;}',
    '._cl-bar{height:100%;width:0%;background:linear-gradient(90deg,#f59e0b,#3b82f6);',
    'border-radius:3px;transition:width .4s ease;}',
    '</style>',
    '<div class="_cl-hourglass">⏳</div>',
    '<div class="_cl-coins">',
    '  <div class="_cl-coin"></div><div class="_cl-coin"></div><div class="_cl-coin"></div>',
    '  <div class="_cl-coin"></div><div class="_cl-coin"></div>',
    '</div>',
    '<div class="_cl-title">מנתח את הנתונים הפיננסיים שלך...</div>',
    '<div class="_cl-sub">טוען ' + fileCount + ' קבצים — זה ייקח רגע</div>',
    '<div class="_cl-bar-wrap"><div id="_cl-bar" class="_cl-bar"></div></div>'
  ].join('');
  document.body.appendChild(el);
  _coinLoaderEl = el;
}

function _updateCoinLoader(done, total){
  var bar = document.getElementById('_cl-bar');
  if(bar) bar.style.width = Math.round(done/total*100) + '%';
}

function _hideCoinLoader(){
  if(_coinLoaderEl){
    _coinLoaderEl.style.opacity = '0';
    _coinLoaderEl.style.transition = 'opacity .4s';
    var el = _coinLoaderEl;
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 450);
    _coinLoaderEl = null;
  }
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function(){

  // Restore saved transactions — only if auth screen is hidden (user already logged in)
  // If auth screen is visible, data will be cleared anyway on login → don't restore
  setTimeout(function(){
    var authScreenVisible = (function(){
      var el = document.getElementById('authScreen');
      return el && el.style.display !== 'none';
    })();
    if(authScreenVisible){
      // Don't restore stale data — user hasn't logged in yet
      _updateHeaderMeta();
      return;
    }
    if(typeof loadSavedTransactions === 'function' && loadSavedTransactions()){
      if(typeof renderAll === 'function') renderAll();
      _updateHeaderMeta();
      // Hide noDataOverlay if transactions exist
      if(typeof _checkShowNoData === 'function') _checkShowNoData();
      console.log('FinTrack: restored', TRANSACTIONS.length, 'saved transactions');
    } else {
      // No data — show empty state
      _updateHeaderMeta();
      var nd = document.getElementById('noDataOverlay');
      // noDataOverlay is shown by _checkShowNoData — don't force it here,
      // it should only show after login
    }
  }, 800);

  // Intercept all webkitdirectory file inputs via event delegation
  document.addEventListener('change', function(e){
    if(e.target && e.target.type==='file' && e.target.getAttribute('webkitdirectory')!==null){
      window.handleFolderPick(e.target);
    }
  });
});

})();
