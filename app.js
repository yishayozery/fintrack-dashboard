// FinTrack — Application Logic

function updateStatementBalance(bankName, newBalance, newDate){
  const entry = STATEMENT_BALANCES.find(b=>b.name===bankName);
  if(entry){ entry.balance = newBalance; entry.statementDate = newDate; }
  renderStatementBalances();
}
  // Dec 2025 folded into ינואר billing

const CAT_COLORS = {
  "מזון וצריכה":"#3b82f6","תחבורה ורכבים":"#f59e0b","פנאי, בידור וספורט":"#8b5cf6",
  "תרומות והתנדבות":"#10b981","דלק, חשמל וגז":"#ef4444","עירייה וממשלה":"#6366f1",
  "קוסמטיקה וטיפוח":"#ec4899","נסיעות לחו\"ל":"#f97316","קניות אונליין":"#14b8a6",
  "חשמל ומחשבים":"#64748b","מסעדות, קפה וברים":"#d97706","שונות":"#9ca3af",
  "עמלות בנק":"#dc2626","מנויים דיגיטליים":"#7c3aed","העברת כספים":"#0891b2",
  "משכנתא והלוואות":"#b45309","חיסכון ופקדונות":"#0891b2","מטח ונסיעות":"#ea580c",
  "השקעות ונייר ערך":"#7c3aed","תשלום כרטיס אשראי":"#9ca3af","תנועת מסגרת/הלוואה":"#d1d5db",
  "ביטוח ובריאות":"#0e7490","חינוך":"#7c3aed","הלוואות":"#b91c1c","העברות בין חשבונות":"#6b7280",
  "הכנסה מביטוח לאומי":"#16a34a",
};
// ─── Category type classification ─────────────────────────────
// "expense" = counts in expenses | "income" = counts in income
// "investment" = savings/investment | "ignore" = internal transfers, skip
const CAT_TYPE_DEFAULTS = {
  "מזון וצריכה":"expense","תחבורה ורכבים":"expense","פנאי, בידור וספורט":"expense",
  "תרומות והתנדבות":"expense","דלק, חשמל וגז":"expense","עירייה וממשלה":"expense",
  "קוסמטיקה וטיפוח":"expense","נסיעות לחו\"ל":"expense","קניות אונליין":"expense",
  "חשמל ומחשבים":"expense","מסעדות, קפה וברים":"expense","שונות":"expense",
  "עמלות בנק":"expense","מנויים דיגיטליים":"expense","משכנתא והלוואות":"expense",
  "מטח ונסיעות":"expense","ביטוח ובריאות":"expense","חינוך":"expense","הלוואות":"expense",
  "חיסכון ופקדונות":"investment","השקעות ונייר ערך":"investment",
  "תשלום כרטיס אשראי":"ignore","העברות בין חשבונות":"ignore",
  "העברת כספים":"ignore","תנועת מסגרת/הלוואה":"ignore",
  "הכנסה מביטוח לאומי":"income",
};
// User can override per-category; saved in localStorage
let catTypeOverrides = JSON.parse(localStorage.getItem('catTypeOverrides')||'{}');
function getCatType(cat){ return catTypeOverrides[cat] || CAT_TYPE_DEFAULTS[cat] || 'expense'; }
function setCatType(cat, type){ catTypeOverrides[cat]=type; localStorage.setItem('catTypeOverrides',JSON.stringify(catTypeOverrides)); renderAll(); }

const CAT_BADGE = {
  "מזון וצריכה":"badge-blue","תחבורה ורכבים":"badge-yellow","פנאי, בידור וספורט":"badge-purple",
  "תרומות והתנדבות":"badge-green","דלק, חשמל וגז":"badge-red","עירייה וממשלה":"badge-purple",
  "קוסמטיקה וטיפוח":"badge-pink","נסיעות לחו\"ל":"badge-orange","קניות אונליין":"badge-teal",
  "חשמל ומחשבים":"badge-gray","מסעדות, קפה וברים":"badge-yellow","שונות":"badge-gray",
  "עמלות בנק":"badge-red","מנויים דיגיטליים":"badge-purple","העברת כספים":"badge-teal",
  "משכנתא והלוואות":"badge-orange","חיסכון ופקדונות":"badge-teal","מטח ונסיעות":"badge-orange",
  "השקעות ונייר ערך":"badge-purple","תשלום כרטיס אשראי":"badge-gray","תנועת מסגרת/הלוואה":"badge-gray",
  "ביטוח ובריאות":"badge-teal","חינוך":"badge-purple","הלוואות":"badge-red","העברות בין חשבונות":"badge-gray",
  "הכנסה מביטוח לאומי":"badge-green",
};
const ALL_CATS = Object.keys(CAT_COLORS).sort();

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════

// ─── Projects ───────────────────────────────────────────────
let approvedTxs = new Set(); // Set of approved txIds
let PROJECTS = [];          // [{id, name, icon, color}]
let txProjectMap = {};      // txId → projectId
let _nextProjectId = 1;

let catOverrides = {};    // id → new category
let incCatOverrides = {}; // BANK_INCOME id → new category
let dismissedIssues = new Set(); // issue keys dismissed
let allCharts = {};
let txPage = 1;
let _txApprovalFilter = 'all';
const _selectedTxIds = new Set();

function onTxCheck(){
  _selectedTxIds.clear();
  document.querySelectorAll('.tx-select-cb:checked').forEach(function(cb){
    _selectedTxIds.add(parseInt(cb.getAttribute('data-id')));
  });
  const bar = document.getElementById('txBulkBar');
  const cnt = document.getElementById('txBulkCount');
  if(bar){ bar.style.display = _selectedTxIds.size > 0 ? 'flex' : 'none'; }
  if(cnt){ cnt.textContent = _selectedTxIds.size + ' עסקאות נבחרו'; }
}

function toggleSelectAll(cb){
  const cbs = document.querySelectorAll('.tx-select-cb');
  cbs.forEach(function(el){ el.checked = cb.checked; });
  onTxCheck();
}

function clearTxSelection(){
  _selectedTxIds.clear();
  document.querySelectorAll('.tx-select-cb').forEach(function(cb){ cb.checked=false; });
  const sal = document.getElementById('txSelectAll'); if(sal) sal.checked=false;
  const bar = document.getElementById('txBulkBar'); if(bar) bar.style.display='none';
}

function bulkApprove(){
  _selectedTxIds.forEach(function(id){ approvedTxs.add(id); });
  clearTxSelection();
  renderTxTable();
}

function bulkUnapprove(){
  _selectedTxIds.forEach(function(id){ approvedTxs.delete(id); });
  clearTxSelection();
  renderTxTable();
}

function bulkEscalate(){
  _selectedTxIds.forEach(function(id){
    const tx = TRANSACTIONS.find(function(t){ return t.id===id; });
    if(tx) escalateDisputeFromTx(id);
  });
  clearTxSelection();
  renderTxTable();
}
const TX_PAGE = 15;
let disputeItems = [];  // [{issueKey, issue, message, merchantEmail, thread:[{role,text,ts}], status}]
// Review items — populated dynamically when files are loaded (empty until then)
const MANUAL_REVIEW_ITEMS = [
  // Items are added here when bank/CC files are uploaded and parsed
  // {key, icon, title, severity, reason, tx}
  /* PLACEHOLDER — cleared for fresh install
  {key:'unclear-standing',icon:'❓',title:'הוראת קבע ₪2,266 — ינואר',severity:'warning',
   reason:'בנק לאומי: "הוראת קבע" ₪2,266 בינואר (ובדצמבר 2025). לא ברור למי ועבור מה. בדוק בפירוט החשבון.',
   tx:{id:201,date:'11-01-2026',name:'הוראת קבע — ינואר',cat:'שונות',card:'בנק לאומי',amount:2266,month:'ינואר 2026',src:'בנק לאומי'}},
  {key:'unclear-phoenix-jump',icon:'📈',title:'הפניקס: קפיצת מחיר +49%',severity:'danger',
   reason:'כרטיס *2039: הפניקס חיים ובריאות — ינואר ₪452.13 → פברואר ₪675.66 (עלייה של +49.4%). מה השתנה בפוליסה? בדוק מול הפניקס.',
   tx:{id:89,date:'28-01-2026',name:'הפניקס חיים ובריאות',cat:'ביטוח ובריאות',card:'*2039',amount:675.66,month:'פברואר 2026',src:'*2039 מסטרקארד'}},
  {key:'unclear-emirates',icon:'✈️',title:'EMIRATES ₪21,830 — חיוב ענק',severity:'warning',
   END PLACEHOLDER */
];

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function fmt(n){return '₪'+Number(n).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtShort(n){if(n>=1000)return '₪'+(n/1000).toFixed(1)+'K';return '₪'+Math.round(n);}
function pct(a,b){if(!b)return '—';return ((a-b)/b*100).toFixed(0)+'%';}
function pctNum(a,b){if(!b)return 0;return (a-b)/b*100;}

function getEffectiveCat(tx){return catOverrides[tx.id]||tx.cat;}

function getFiltered(){
  const m=document.getElementById('filterMonth')?.value||'all';
  const c=document.getElementById('filterCard')?.value||'all';
  const cat=document.getElementById('filterCat')?.value||'all';
  const ct=document.getElementById('filterChargeType')?.value||'all';
  const proj=document.getElementById('filterProject')?.value||'all';
  const merchant=(document.getElementById('filterMerchant')?.value||'').trim().toLowerCase();
  const ftVal=(document.getElementById('filterType')?.value||'regular');
  const showAll = ftVal==='all';
  const showAssets = ftVal==='assets';
  return TRANSACTIONS.filter(t=>{
    if(showAssets){ if(t.type!=='השקעה') return false; }
    else if(!showAll){ if(t.type==='השקעה'||t.type==='פנימי') return false; }
    if(m!=='all'){
      const txMonth = _monthMode==='exec' ? _dateToMonth(t.date) : t.month;
      if(txMonth!==m) return false;
    }
    if(c!=='all'&&t.card!==c)return false;
    if(cat!=='all'&&getEffectiveCat(t)!==cat)return false;
    if(ct!=='all'&&(t.chargeType||'משתנה')!==ct)return false;
    if(merchant&&!t.name.toLowerCase().includes(merchant))return false;
    if(proj==='assigned'&&txProjectMap[t.id]===undefined)return false;
    if(proj==='unassigned'&&txProjectMap[t.id]!==undefined)return false;
    if(proj!=='all'&&proj!=='assigned'&&proj!=='unassigned'){
      const pid=parseInt(proj);
      if(txProjectMap[t.id]!==pid)return false;
    }
    return true;
  });
}

function groupBy(arr,keyFn){
  return arr.reduce((acc,item)=>{
    const k=keyFn(item);acc[k]=(acc[k]||0)+item.amount;return acc;
  },{});
}

function destroyChart(id){if(allCharts[id]){allCharts[id].destroy();delete allCharts[id];}}

// ═══════════════════════════════════════
// TABS
// ═══════════════════════════════════════
function switchTab(name){
  window._activeTab = name;
  // Mark insights tabs as completed
  if(['overview','categories','merchants','recommendations'].includes(name)){
    _wfState.completed['insights'] = 1; _wfSave(_wfState);
  }
  setTimeout(function(){ _wfRenderBar(name); _wfShowHint(name); }, 50);
  if(name==='savings') { renderSavingsTab(); }
  if(name==='insurance') { renderInsuranceTab(); }
  if(name==='mortgage') { renderMortgageTab(); }
  if(name==='investments') { renderInvestmentsTab(); }
  if(name==='management') { renderManagementTab(); }
  if(name==='statement') { renderStatementTab(); }
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  const tabEl=document.querySelector(`.tab[onclick="switchTab('${name}')"]`);
  if(tabEl)tabEl.classList.add('active');
  const contentEl=document.getElementById(`tab-${name}`);
  if(contentEl)contentEl.classList.add('active');
}

// ═══════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════
function initCatFilter(){
  const cats=[...new Set(TRANSACTIONS.map(t=>getEffectiveCat(t)))].sort();
  const sel=document.getElementById('filterCat');
  cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);});
}
let _monthMode = 'charge'; // 'charge' = billing month (t.month) | 'exec' = transaction date month

function _setMonthMode(mode){
  _monthMode = mode;
  const btnCharge = document.getElementById('filterMonthModeCharge');
  const btnExec   = document.getElementById('filterMonthModeExec');
  if(btnCharge){ btnCharge.style.background = mode==='charge'?'#1a56db':'transparent'; btnCharge.style.color = mode==='charge'?'white':'#64748b'; }
  if(btnExec)  { btnExec.style.background   = mode==='exec'  ?'#1a56db':'transparent'; btnExec.style.color   = mode==='exec'  ?'white':'#64748b'; }
  const hdr = document.getElementById('txDateHeader');
  if(hdr) hdr.textContent = mode==='exec' ? 'תאריך ביצוע' : 'תאריך חיוב';
  applyFilters();
}

// Extract "חודש שנה" from a date string "DD-MM-YYYY"
function _dateToMonth(dateStr){
  if(!dateStr) return '';
  const parts = dateStr.split('-');
  if(parts.length < 3) return '';
  const mm = parseInt(parts[1]);
  const yyyy = parts[2];
  const heMonths = {1:'ינואר',2:'פברואר',3:'מרץ',4:'אפריל',5:'מאי',6:'יוני',
                    7:'יולי',8:'אוגוסט',9:'ספטמבר',10:'אוקטובר',11:'נובמבר',12:'דצמבר'};
  return (heMonths[mm]||'') + ' ' + yyyy;
}

function applyFilters(){txPage=1;renderAll();}
function resetFilters(){
  const ctEl=document.getElementById('filterChargeType');
  if(ctEl)ctEl.value='all';
  const fpEl=document.getElementById('filterProject');
  if(fpEl)fpEl.value='all';
  document.getElementById('filterMonth').value='all';
  document.getElementById('filterCard').value='all';
  document.getElementById('filterCat').value='all';
  if(document.getElementById('filterType'))document.getElementById('filterType').value='regular';
  const mEl=document.getElementById('filterMerchant'); if(mEl) mEl.value='';
  _setMonthMode('charge');
}

// ═══════════════════════════════════════
// INCOME / SAVINGS
// ═══════════════════════════════════════
function getIncome(){
  const inc={"ינואר 2026":0,"פברואר 2026":0,"מרץ 2026":0};
  BANK_INCOME.forEach(bi=>{if(inc[bi.month]!==undefined)inc[bi.month]+=bi.amount;});
  return inc;
}
function renderIncomeDisplay(){
  const inc=getIncome();
  const el=document.getElementById('incomeDisplay');
  if(!el)return;
  const items=Object.entries(inc).filter(([m,v])=>v>0).map(([m,v])=>`
    <div class="income-month-group">
      <label style="color:#93c5fd;">${m}:</label>
      <span style="color:white;font-weight:700;font-size:14px;">₪${v.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      <span style="font-size:10px;color:#fbbf24;margin-right:4px;">${BANK_INCOME.filter(bi=>bi.month===m).map(bi=>'('+bi.name+')').join(', ')}</span>
    </div>`).join('');
  el.innerHTML=items||'<span style="color:#fca5a5;">לא זוהו הכנסות בקבצים — הוסף קבצי בנק נוספים</span>';
}


// Show banner for CC lines that are lump-sum payments with no transaction breakdown
function updateUndetailedCCBanner(){
  const banner = document.getElementById('undetailed-cc-banner');
  const listEl = document.getElementById('undetailed-cc-list');
  if(!banner || !listEl) return;

  // Find transactions that are CC bill payments without detail (name contains card keywords)
  const UNDETAILED_KEYWORDS = ['דיינרס','ישראכרט כולל','כרטיס לאומי כולל','ויזה כולל'];
  const undetailed = TRANSACTIONS.filter(t =>
    t.type !== 'פנימי' &&
    UNDETAILED_KEYWORDS.some(kw => t.name.includes(kw))
  );

  // Also add items flagged in MANUAL_REVIEW_ITEMS that mention missing detail
  const manualMissing = MANUAL_REVIEW_ITEMS.filter(i =>
    i.reason && i.reason.includes('לא קיבלת פירוט') && !dismissedIssues.has(i.key)
  );

  const items = [...undetailed.map(t=>({ name: t.name, amount: t.amount, month: t.month, card: t.card }))];
  // Add Diners from manual if not already covered
  if(manualMissing.length > 0 && !items.find(i=>i.name.includes('דיינרס'))){
    manualMissing.forEach(m => {
      items.push({ name: m.title, amount: m.tx ? m.tx.amount : 0, month: '', card: 'דיינרס קלוב' });
    });
  }

  if(items.length === 0){
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'block';
  listEl.innerHTML = items.map(i =>
    '<div style="margin-bottom:4px;">⚠️ <strong>' + i.name + '</strong>' +
    (i.amount ? ' — ' + fmt(i.amount) : '') +
    (i.month ? ' (' + i.month + ')' : '') +
    ' — <span style="color:#b45309;">הבא קובץ פירוט</span></div>'
  ).join('');
}

function updateSavings(){
  const inc=getIncome();
  const totalInc=Object.values(inc).reduce((s,v)=>s+v,0);
  // Exclude investment/internal transactions from household budget
  const householdTx=TRANSACTIONS.filter(t=>t.type!=='השקעה'&&t.type!=='פנימי');
  const byMonth=groupBy(householdTx,t=>t.month);
  const expJan=byMonth['ינואר 2026']||0;
  const expFeb=byMonth['פברואר 2026']||0;
  const expMar=byMonth['מרץ 2026']||0;
  const totalExp=expJan+expFeb+expMar;

  // always render with auto-detected income

  const savings=totalInc-totalExp;
  const savPct=totalInc>0?((savings/totalInc)*100).toFixed(1):0;
  const monthData=MONTHS_ORDER.map(m=>({
    m,inc:inc[m]||0,exp:byMonth[m]||0,sav:(inc[m]||0)-(byMonth[m]||0)
  }));

  const _sb=document.getElementById('savingsBar');
  if(!_sb) { renderSavingsTab(); return; }
  _sb.innerHTML=monthData.map(d=>{
    const s=d.inc-d.exp;
    const cls=d.inc===0?'na-m':s>=0?'savings-m':'deficit-m';
    const expPct=d.inc>0?(d.exp/d.inc*100).toFixed(0):100;
    const savPctM=d.inc>0?Math.max(0,100-expPct):0;
    return `<div class="savings-metric ${cls}">
      <div class="sm-label">${d.m}</div>
      <div class="sm-val" style="color:${d.inc===0?'var(--gray-500)':s>=0?'var(--success)':'var(--danger)'}">
        ${d.inc===0?'—':(s>=0?'חיסכון '+fmt(s):'גירעון '+fmt(Math.abs(s)))}
      </div>
      <div class="sm-sub">${d.inc===0?'הכנסה לא הוזנה':'הוצ: '+fmt(d.exp)+(d.inc?' / הכנ: '+fmt(d.inc):'')}</div>
      ${d.inc>0?`<div class="sm-bar-row"><div class="sm-bar-exp" style="width:${expPct}%"></div><div class="sm-bar-sav" style="width:${savPctM}%"></div></div>`:''}
    </div>`;
  }).join('') + `<div class="savings-metric ${savings>=0?'savings-m':'deficit-m'}">
    <div class="sm-label">סיכום כולל</div>
    <div class="sm-val" style="color:${savings>=0?'var(--success)':'var(--danger)'}">
      ${savings>=0?'✅ חיסכון':'⚠️ גירעון'} ${fmt(Math.abs(savings))}
    </div>
    <div class="sm-sub">${savings>=0?`${savPct}% מסה"כ הכנסות`:`${Math.abs(savPct)}% חריגה`}</div>
  </div>`;

  renderSavingsTab({inc,monthData,totalInc,totalExp,savings,savPct});
  if(document.getElementById('tab-savings')?.classList.contains('active')) renderSavingsCharts({inc,monthData});
}


function renderSavingsCharts({inc,monthData}){
  destroyChart('savingsMonthChart');
  const ctx=document.getElementById('savingsMonthChart');
  if(!ctx)return;
  allCharts['savingsMonthChart']=new Chart(ctx.getContext('2d'),{
    type:'bar',
    data:{
      labels:monthData.map(d=>d.m),
      datasets:[
        {label:'הכנסה',data:monthData.map(d=>d.inc),backgroundColor:'rgba(16,185,129,.7)',borderRadius:6,borderSkipped:false},
        {label:'הוצאה',data:monthData.map(d=>d.exp),backgroundColor:'rgba(239,68,68,.7)',borderRadius:6,borderSkipped:false},
        {label:'חיסכון/גירעון',data:monthData.map(d=>d.inc>0?d.inc-d.exp:null),type:'line',
         borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.1)',pointRadius:5,fill:true,tension:.3}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmt(c.raw||0)}}},
      scales:{y:{ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}
    }
  });
}

function renderCatVsIncome(totalInc){
  const el=document.getElementById('catVsIncomeList');
  if(!el)return;
  const byCat=groupBy(TRANSACTIONS,t=>getEffectiveCat(t));
  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const maxVal=totalInc||sorted[0]?.[1]||1;
  el.innerHTML=sorted.map(([cat,val])=>{
    const p=totalInc>0?(val/totalInc*100).toFixed(1):'-';
    const barW=Math.min(100,(val/maxVal)*100).toFixed(0);
    const alarm=totalInc>0&&val/totalInc>0.25;
    return `<div class="cat-item" style="margin-bottom:9px;">
      <div class="cat-dot" style="background:${CAT_COLORS[cat]||'#9ca3af'}"></div>
      <div class="cat-name" style="min-width:150px;">${cat}</div>
      <div class="cat-bar-wrap" style="flex:3;">
        <div class="cat-bar" style="width:${barW}%;background:${alarm?'#ef4444':CAT_COLORS[cat]||'#9ca3af'}"></div>
      </div>
      <div class="cat-amount">${fmt(val)}</div>
      <div class="cat-pct" style="min-width:50px;${alarm?'color:var(--danger);font-weight:700;':''}">${p!=='-'?p+'%':''}</div>
      ${alarm&&totalInc>0?'<span class="badge badge-red">⚠️ גבוה</span>':''}
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════
// NEEDS REVIEW — detection engine
// ═══════════════════════════════════════
function detectIssues(){
  const issues=[];

  // 1. Unclear categories
  TRANSACTIONS.forEach(tx=>{
    const cat=getEffectiveCat(tx);
    if(['שונות','העברת כספים'].includes(cat)){
      issues.push({key:`unclear-${tx.id}`,tx,severity:'warning',
        icon:'❓',title:'קטגוריה לא ברורה',
        reason:`"${tx.name}" מסווג כ-"${cat}" — מומלץ לבדוק ולסווג לקטגוריה מתאימה`});
    }
  });

  // 2. Large one-time charges (>800₪, not recurring)
  const nameCounts={};
  TRANSACTIONS.forEach(tx=>{nameCounts[tx.name]=(nameCounts[tx.name]||0)+1;});
  TRANSACTIONS.filter(tx=>tx.amount>=800&&nameCounts[tx.name]===1).forEach(tx=>{
    issues.push({key:`large-${tx.id}`,tx,severity:'danger',
      icon:'💸',title:'חיוב גדול חד-פעמי',
      reason:`${fmt(tx.amount)} — חיוב גדול שאינו מופיע בחודשים אחרים. ודא שהעסקה מוכרת לך`});
  });

  // 3. Foreign charge price spike (same merchant, different amount >15%)
  const foreignByMerch={};
  TRANSACTIONS.filter(tx=>tx.src==="חו\"ל").forEach(tx=>{
    if(!foreignByMerch[tx.name])foreignByMerch[tx.name]=[];
    foreignByMerch[tx.name].push(tx);
  });
  Object.entries(foreignByMerch).forEach(([name,txs])=>{
    if(txs.length<2)return;
    const sorted=[...txs].sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<sorted.length;i++){
      const change=(sorted[i].amount-sorted[i-1].amount)/sorted[i-1].amount;
      if(change>0.15){
        issues.push({key:`spike-${sorted[i].id}`,tx:sorted[i],severity:'danger',
          icon:'📈',title:'קפיצת מחיר בחו"ל',
          reason:`${name}: עלה מ-${fmt(sorted[i-1].amount)} ל-${fmt(sorted[i].amount)} (+${(change*100).toFixed(0)}%). בדוק אם מדובר בחידוש מנוי, עמלה חדשה או שגיאת חיוב`});
      }
    }
  });

  // 4. New foreign merchant not seen before (appeared only once)
  const foreignMerchMonths={};
  TRANSACTIONS.filter(tx=>tx.src==="חו\"ל").forEach(tx=>{
    if(!foreignMerchMonths[tx.name])foreignMerchMonths[tx.name]=new Set();
    foreignMerchMonths[tx.name].add(tx.month);
  });
  TRANSACTIONS.filter(tx=>tx.src==="חו\"ל").forEach(tx=>{
    if(foreignMerchMonths[tx.name]?.size===1&&!issues.find(i=>i.tx?.id===tx.id)){
      issues.push({key:`new-foreign-${tx.id}`,tx,severity:'info',
        icon:'🌍',title:'חיוב חו"ל חדש',
        reason:`${tx.name}: הופיע לראשונה ב-${tx.month}. ודא שהרכישה מוכרת לך ושאין מנוי נסתר`});
    }
  });

  // 5. Duplicate charge same merchant same week
  const byName={};
  TRANSACTIONS.forEach(tx=>{
    if(!byName[tx.name])byName[tx.name]=[];
    byName[tx.name].push(tx);
  });
  Object.entries(byName).forEach(([name,txs])=>{
    if(txs.length<2)return;
    const sorted=[...txs].sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<sorted.length;i++){
      const d1=new Date(sorted[i-1].date.split('-').reverse().join('-'));
      const d2=new Date(sorted[i].date.split('-').reverse().join('-'));
      const diff=Math.abs(d2-d1)/(1000*60*60*24);
      if(diff<=7&&Math.abs(sorted[i].amount-sorted[i-1].amount)<1&&sorted[i].card===sorted[i-1].card){
        issues.push({key:`dup-${sorted[i].id}`,tx:sorted[i],severity:'warning',
          icon:'🔁',title:'חיוב כפול חשוד',
          reason:`${name}: שני חיובים זהים (${fmt(sorted[i].amount)}) באותו כרטיס תוך ${Math.round(diff)} ימים. ייתכן חיוב כפול`});
      }
    }
  });

  // 6. High expense in single transaction relative to category average
  const catTotals={};const catCounts={};
  TRANSACTIONS.forEach(tx=>{
    const c=getEffectiveCat(tx);
    catTotals[c]=(catTotals[c]||0)+tx.amount;
    catCounts[c]=(catCounts[c]||0)+1;
  });
  TRANSACTIONS.forEach(tx=>{
    const c=getEffectiveCat(tx);
    const avg=catTotals[c]/catCounts[c];
    if(tx.amount>avg*3&&tx.amount>200&&!issues.find(i=>i.tx?.id===tx.id)){
      issues.push({key:`outlier-${tx.id}`,tx,severity:'warning',
        icon:'📊',title:'חיוב חריג בקטגוריה',
        reason:`${fmt(tx.amount)} בקטגוריית "${c}" — פי ${(tx.amount/avg).toFixed(1)} מממוצע הקטגוריה (${fmt(avg)})`});
    }
  });

  // 7. Large bank transfers — potential mortgage/loan payments
  const mortgageTxs = TRANSACTIONS.filter(t=>t.cat==='משכנתא והלוואות');
  mortgageTxs.forEach(tx=>{
    if(!issues.find(i=>i.tx?.id===tx.id)){
      issues.push({key:`mortgage-${tx.id}`,tx,severity:'info',
        icon:'🏠',title:'העברה בנקאית גדולה',
        reason:`${tx.name}: ${fmt(tx.amount)} — נראה כמשכנתא / הלוואה. ודא שהסיווג נכון ועדכן אם מדובר בתשלום שונה`});
    }
  });

  // 8. Investment transactions visible only in "כולל השקעות"
  const investTxs = TRANSACTIONS.filter(t=>t.type==='השקעה');
  if(investTxs.length>0&&(document.getElementById('filterType')?.value||'regular')==='regular'){
    const totalInv = investTxs.reduce((s,t)=>s+t.amount,0);
    issues.push({key:'investments-hidden',tx:investTxs[0],severity:'info',
      icon:'📈',title:`${investTxs.length} עסקאות השקעה מוסתרות`,
      reason:`${fmt(totalInv)} בניירות ערך מוסתר בתצוגה הרגילה. לצפייה — שנה מסנן "הצג" ל"כולל השקעות ופנימי"`});
  }


  // 9. Bank fees — detect jumps and flag recurring fees as negotiable
  const feesByCardMonth = {};
  TRANSACTIONS.filter(t => t.type!=='פנימי' && (
    getEffectiveCat(t)==='עמלות בנק' || t.name.includes('עמלה') || t.name.includes('דמי כרטיס')
  )).forEach(t=>{
    const key = t.card;
    if(!feesByCardMonth[key]) feesByCardMonth[key] = {};
    feesByCardMonth[key][t.month] = (feesByCardMonth[key][t.month]||0) + t.amount;
  });

  Object.entries(feesByCardMonth).forEach(([card, byMonth])=>{
    const sortedMonths = Object.keys(byMonth).sort();

    // Flag month-over-month jump > 30%
    for(let i=1; i<sortedMonths.length; i++){
      const prev = byMonth[sortedMonths[i-1]];
      const curr = byMonth[sortedMonths[i]];
      const change = (curr-prev)/prev;
      if(change > 0.30){
        const fakeTx = TRANSACTIONS.find(t=>t.card===card&&t.month===sortedMonths[i]&&
          (getEffectiveCat(t)==='עמלות בנק'||t.name.includes('עמלה'))) ||
          {id:-99,date:'',name:'עמלות '+card,cat:'עמלות בנק',card,amount:curr,month:sortedMonths[i]};
        issues.push({key:`fee-jump-${card.replace(/[^a-z0-9]/gi,'_')}-${i}`,
          tx: fakeTx, severity:'danger', icon:'📈',
          title:`קפיצת עמלות — ${card}`,
          reason:`עמלות קפצו מ-${fmt(prev)} (${sortedMonths[i-1].replace(' 2026','')}) ` +
                 `ל-${fmt(curr)} (${sortedMonths[i].replace(' 2026','')}) — +${(change*100).toFixed(0)}%. ` +
                 `שנתי משוער: ${fmt(curr*12)}. ניתן לנהל מו"מ עם הבנק.`
        });
      }
    }

    // Flag high recurring fees (any card with >100₪/month average)
    const avg = Object.values(byMonth).reduce((s,v)=>s+v,0) / sortedMonths.length;
    if(avg > 100 && !issues.find(i=>i.key===`fee-high-${card.replace(/[^a-z0-9]/gi,'_')}`)){
      const fakeTx2 = TRANSACTIONS.find(t=>t.card===card&&
        (getEffectiveCat(t)==='עמלות בנק'||t.name.includes('עמלה'))) ||
        {id:-98,date:'',name:'עמלות '+card,cat:'עמלות בנק',card,amount:avg,month:sortedMonths[0]};
      issues.push({key:`fee-high-${card.replace(/[^a-z0-9]/gi,'_')}`,
        tx: fakeTx2, severity:'warning', icon:'🏦',
        title:`עמלות גבוהות — ${card}`,
        reason:`ממוצע ${fmt(avg)}/חודש (${fmt(avg*12)} בשנה). מומלץ לפנות לבנק לבחינת מסלול ` +
               `עמלות מופחת או ניהול מו"מ.`
      });
    }
  });

  return issues.filter(i=>!dismissedIssues.has(i.key));
}


// ═══════════════════════════════════════
// FEES SUMMARY PANEL
// ═══════════════════════════════════════
function renderFeesSummary(){
  const el = document.getElementById('feesSummaryPanel');
  if(!el) return;

  // All fee transactions: cat="עמלות בנק" OR name contains עמלה/דמי כרטיס
  const feeTxs = TRANSACTIONS.filter(t =>
    t.type !== 'פנימי' && (
      getEffectiveCat(t) === 'עמלות בנק' ||
      t.name.includes('עמלה') ||
      t.name.includes('דמי כרטיס') ||
      t.name.includes('דמי ניהול')
    )
  );

  if(feeTxs.length === 0){ el.innerHTML=''; return; }

  const totalFees = feeTxs.reduce((s,t)=>s+t.amount,0);
  const months = [...new Set(feeTxs.map(t=>t.month))].sort();
  const numMonths = months.length || 1;
  const avgMonthly = totalFees / numMonths;
  const annualEst = avgMonthly * 12;

  // Group by card/bank
  const byCard = {};
  feeTxs.forEach(t=>{
    if(!byCard[t.card]) byCard[t.card] = { txs:[], total:0, byMonth:{} };
    byCard[t.card].txs.push(t);
    byCard[t.card].total += t.amount;
    byCard[t.card].byMonth[t.month] = (byCard[t.card].byMonth[t.month]||0) + t.amount;
  });

  // Build rows
  let rows = '';
  Object.entries(byCard).sort((a,b)=>b[1].total-a[1].total).forEach(([card, data])=>{
    const cardMonths = Object.entries(data.byMonth).sort((a,b)=>a[0].localeCompare(b[0]));
    let trendHtml = '';
    let alertClass = '';
    if(cardMonths.length >= 2){
      const last = cardMonths[cardMonths.length-1][1];
      const prev = cardMonths[cardMonths.length-2][1];
      const change = ((last-prev)/prev*100).toFixed(0);
      if(last > prev*1.1){
        trendHtml = `<span class="fee-trend-up">▲ ${change}%</span>`;
        alertClass = 'alert';
      } else {
        trendHtml = `<span class="fee-trend-ok">▼ ${Math.abs(change)}%</span>`;
      }
    }
    const cardAnnual = (data.total/numMonths)*12;

    // Dispute button key
    const disputeKey = 'fees-'+card.replace(/[^a-z0-9]/gi,'_');

    rows += `<div class="fee-row ${alertClass}">
      <div>
        <div class="fee-row-name">🏦 ${card}</div>
        <div class="fee-row-sub">${data.txs.length} חיובים · ${trendHtml} · שנתי משוער: ${fmt(cardAnnual)}</div>
        <div style="margin-top:4px;font-size:11px;color:#64748b;">
          ${cardMonths.map(([m,v])=>`<span style="margin-left:10px;">${m.replace(' 2026','')}: ${fmt(v)}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="fee-row-amount">${fmt(data.total)}</div>
        ${alertClass?`<button class="fee-dispute-btn" onclick="escalateFeeDispute('${card}','${disputeKey}')">❌ לריב עם הבנק</button>`:''}
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fees-panel">
    <div class="fees-header">
      <div class="fees-title">🏦 סיכום עמלות בנק ודמי כרטיס</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="fees-total-badge">סה"כ: ${fmt(totalFees)}</div>
        <div style="font-size:12px;color:#6b7280;">שנתי משוער: <strong style="color:#dc2626;">${fmt(annualEst)}</strong></div>
        <button onclick="openDrillDown('עמלות בנק','cat','עמלות בנק','all')"
          style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">
          🔍 ראה הכל
        </button>
      </div>
    </div>
    <div style="font-size:12px;color:#92400e;background:#fff7ed;border-radius:7px;padding:8px 12px;margin-bottom:12px;">
      💡 <strong>טיפ:</strong> עמלות בנק ניתנות לניהול! בבנקים רבים אפשר לנהל מו"מ או לשנות מסלול ולחסוך ${fmt(annualEst*0.4)}-${fmt(annualEst*0.7)} לשנה.
    </div>
    ${rows}
    <div style="margin-top:10px;font-size:12px;color:#6b7280;border-top:1px solid var(--gray-200);padding-top:8px;">
      ממוצע חודשי: <strong>${fmt(avgMonthly)}</strong> · 
      ${numMonths} חודשים נבדקו · 
      <a href="#" onclick="switchTab('disputes');return false;" style="color:var(--primary);">עבור לטאב בדיקה לפירוט מלא ←</a>
    </div>
  </div>`;
}

// Escalate a fee dispute against a specific bank/card
function escalateFeeDispute(cardName, issueKey){
  if(disputeItems.find(d=>d.issueKey===issueKey)){
    switchTab('disputes'); return;
  }
  const feeTxs = TRANSACTIONS.filter(t=>
    t.card === cardName && t.type !== 'פנימי' && (
      getEffectiveCat(t)==='עמלות בנק'||t.name.includes('עמלה')||t.name.includes('דמי כרטיס')
    )
  );
  const total = feeTxs.reduce((s,t)=>s+t.amount,0);
  const months = [...new Set(feeTxs.map(t=>t.month))];
  const fakeTx = { id:-1, date: new Date().toLocaleDateString('he-IL'),
    name:'עמלות — '+cardName, cat:'עמלות בנק', card:cardName, amount:total,
    month: months.join(' + '), src:cardName };
  const issue = {
    key: issueKey, icon:'🏦',
    title:'עמלות גבוהות — '+cardName,
    severity:'warning',
    reason:`סה"כ עמלות: ${fmt(total)} ב-${months.length} חודשים. פירוט: `+
      feeTxs.map(t=>t.name+' '+fmt(t.amount)).join(' | '),
    tx: fakeTx
  };
  const message = `שלום,

אני לקוח/ה של ${cardName} ומעוניין/ת לבחון את מבנה העמלות בחשבוני.

לפי הנתונים שלי, שילמתי ${fmt(total)} עמלות ב-${months.length} החודשים האחרונים:
${feeTxs.map(t=>`• ${t.name}: ${fmt(t.amount)} (${t.month})`).join('\n')}

אבקש:
1. פירוט מלא של העמלות ובסיסן החוזי
2. בחינת מעבר למסלול עמלות נוח יותר
3. החזר חלקי/מלא על עמלות שאינן במסגרת ההסכם המקורי

אשמח לקבל תגובה תוך 5 ימי עסקים.

בכבוד,`;

  const ts = new Date().toLocaleString('he-IL');
  // Pre-fill known bank email
  const bankEntry = STATEMENT_BALANCES.find(b=>b.name===cardName);
  const preEmail = bankEntry ? (bankEntry.contactEmail||'') : '';
  disputeItems.push({ issueKey, issue, message, merchantEmail: preEmail,
    thread:[{role:'draft',text:message,ts}], status:'פתוח' });
  renderDisputeTab();
  renderAll();
  switchTab('disputes');
}

// ═══════════════════════════════════════
// DISPUTE MESSAGE GENERATOR
// ═══════════════════════════════════════
function generateDisputeMessage(issue){
  const tx=issue.tx;
  const d=tx.date;
  const amt=fmt(tx.amount);
  const name=tx.name;
  const today=new Date().toLocaleDateString('he-IL');

  const templates={
    'חיוב כפול חשוד':`שלום רב,

אני לקוח/ה המחזיק/ה בכרטיס אשראי ${tx.card}.

בבדיקת החשבון שלי זוהה חיוב כפול חשוד מבית העסק שלכם:
• תאריך: ${d}
• סכום: ${amt}
• מקור: ${tx.src}

אבקשכם לבדוק את הנושא ולאשר אם מדובר בחיוב כפול בטעות.
במידה וכן — אבקש זיכוי מלא של ${amt}.

תודה על טיפולכם המהיר,
ישי עוזרי`,

    'קפיצת מחיר בחו"ל':`שלום רב,

אני לקוח/ה המנוי/ה לשירות ${name}.

שמתי לב שבתאריך ${d} חויבתי ${amt}, סכום גבוה משמעותית מהחיוב הקודם.

אבקשכם להסביר:
1. מה הסיבה לעלייה במחיר?
2. האם מדובר בשינוי תנאי מנוי?
3. האם ניתן לבטל / לחזור למחיר הקודם?

אציין כי אם לא אקבל הסבר מניח את הדעת — אשקול ביטול המנוי.

בכבוד רב,
ישי עוזרי`,

    'חיוב גדול חד-פעמי':`שלום רב,

ביום ${d} חויב חשבוני על ידי ${name} בסכום של ${amt}.

ברצוני לוודא שעסקה זו אכן מוכרת ותקינה.
אנא אשרו שהחיוב נכון, או פרטו מה כלול בסכום זה.

אם מדובר בטעות — אבקש טיפול בהחזר.

תודה,
ישי עוזרי`,

    'חיוב חו"ל חדש':`שלום רב,

לאחרונה התקבל חיוב חדש מ-${name} בכרטיס ${tx.card}:
• תאריך: ${d}
• סכום: ${amt}

אינני מזהה עסקה זו. אבקשכם לאשר את פרטי העסקה, ואם מדובר בטעות — אבקש ביטול החיוב.

תודה,
ישי עוזרי`,

    'קטגוריה לא ברורה':`שלום רב,

חויבתי ב-${d} על ידי ${name} בסכום ${amt}.
ברצוני לדעת יותר פרטים על שירות/מוצר זה שנרכש.

תודה,
ישי עוזרי`,

    'חיוב חריג בקטגוריה':`שלום רב,

בתאריך ${d} חויבתי ${amt} מ-${name} — סכום חריג לעומת רכישות קודמות.

אנא פרטו מה כלול בחיוב זה.
אם מדובר בשגיאה — אבקש טיפול בזיכוי.

תודה,
ישי עוזרי`,

    'העברה בנקאית גדולה':`שלום בנק,

ביום ${d} יצאה מחשבוני העברה של ${amt}.
ברצוני לוודא פרטי ההעברה ולמה בדיוק היא ייעדה.

אנא עדכנו.

תודה,
ישי עוזרי`,
  };

  // Match by key prefix for fee issues, then by title
  if(issue.key && issue.key.startsWith('fee-jump') && templates['fee-jump']) return templates['fee-jump'];
  if(issue.key && (issue.key.startsWith('fee-high') || issue.key.startsWith('fees-')) && templates['fee-high']) return templates['fee-high'];
  const msg=templates[issue.title];
  if(msg)return msg;
  // Fallback generic
  return `שלום רב,

בתאריך ${d} חויבתי ${amt} מ-${name}.
אנא בדקו ועדכנו בהקדם.

תודה,
ישי עוזרי`;
}

// ═══════════════════════════════════════
// DISPUTE ACTIONS
// ═══════════════════════════════════════
function confirmValid(issueKey){
  dismissedIssues.add(issueKey);
  const el=document.getElementById(`issue-${issueKey}`);
  if(el){
    el.style.transition='all .3s';
    el.style.opacity='0';
    el.style.transform='translateX(-20px)';
    setTimeout(()=>{el.remove();renderReviewTab();renderAll();},300);
  } else {
    renderReviewTab();renderAll();
  }
}

function escalateDispute(issueKey){
  // Search both auto-detected issues AND manual review items
  const autoIssues=detectIssues();
  const allIssues=[...autoIssues, ...MANUAL_REVIEW_ITEMS];
  const issue=allIssues.find(i=>i.key===issueKey);
  if(!issue)return;
  if(disputeItems.find(d=>d.issueKey===issueKey))return; // already there
  const message=generateDisputeMessage(issue);
  const ts=new Date().toLocaleString('he-IL');
  disputeItems.push({
    issueKey,
    issue,
    message,
    merchantEmail:'',
    thread:[{role:'draft',text:message,ts}],
    status:'פתוח'
  });
  dismissedIssues.add(issueKey); // remove from review tab
  renderReviewTab();
  renderDisputeTab();
  renderAll();
  // Show disputes tab
  switchTab('disputes');
}

function sendDispute(issueKey){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(!d)return;
  d.status='נשלח';
  const ts=new Date().toLocaleString('he-IL');
  d.thread.push({role:'sent',text:'📤 הודעה נשלחה ב-'+ts,ts});
  renderDisputeTab();
}

function closeDispute(issueKey){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(!d)return;
  d.status='נסגר';
  const ts=new Date().toLocaleString('he-IL');
  d.thread.push({role:'note',text:'✅ חריגה סומנה כנסגרה ב-'+ts,ts});
  renderDisputeTab();
}

function addThreadReply(issueKey){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(!d)return;
  const inp=document.getElementById(`reply-${issueKey}`);
  if(!inp||!inp.value.trim())return;
  const ts=new Date().toLocaleString('he-IL');
  d.thread.push({role:'note',text:inp.value.trim(),ts});
  inp.value='';
  renderDisputeTab();
}

function updateMerchantEmail(issueKey,val){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(d)d.merchantEmail=val;
}

function copyMsg(issueKey){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(!d)return;
  navigator.clipboard.writeText(d.message).then(()=>{
    const btn=document.getElementById(`copybtn-${issueKey}`);
    if(btn){btn.textContent='✅ הועתק!';setTimeout(()=>btn.textContent='📋 העתק הודעה',1500);}
  });
}

// ═══════════════════════════════════════
// RENDER DISPUTES TAB
// ═══════════════════════════════════════
function renderDisputeTab(){
  const el=document.getElementById('disputeContent');
  if(!el)return;

  const badge=document.getElementById('disputeBadge');
  const open=disputeItems.filter(d=>d.status!=='נסגר').length;
  if(badge){badge.textContent=open;badge.style.display=open>0?'inline-block':'none';}

  if(disputeItems.length===0){
    el.innerHTML=`<div class="empty-state"><div class="icon">✅</div><div style="font-size:14px;font-weight:600;">אין חריגים פעילים</div><div style="margin-top:6px;font-size:12px;color:var(--gray-500);">חריגים שסומנו "לא תקין" בטאב הבדיקה יופיעו כאן</div></div>`;
    return;
  }

  const open_disputes=disputeItems.filter(d=>d.status!=='נסגר');
  const closed_disputes=disputeItems.filter(d=>d.status==='נסגר');

  let out=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div style="font-size:14px;color:var(--gray-700);">
      <strong>${open_disputes.length}</strong> חריגים פתוחים · ${closed_disputes.length} נסגרו
    </div>
    <div style="font-size:12px;color:var(--gray-500);">⚙️ לשליחה אוטומטית — <a href="#" onclick="alert('לחיבור חשבון Gmail, עדכן את המשתמש בצ'אט')" style="color:var(--primary);">חבר חשבון מייל</a></div>
  </div>`;

  [...open_disputes,...closed_disputes].forEach(d=>{
    const issue=d.issue;
    const tx=issue.tx;
    const statusCls=`ds-${d.status}`;
    out+=`<div class="dispute-card status-${d.status}" id="dcard-${d.issueKey}">
      <div class="dispute-header">
        <div class="dispute-title">
          <span style="font-size:20px;">${issue.icon}</span>
          <div>
            <div>${issue.title}</div>
            <div style="font-size:12px;font-weight:400;color:var(--gray-500);">${tx.date} · ${tx.name} · ${fmt(tx.amount)}</div>
          </div>
        </div>
        <span class="dispute-status ${statusCls}">${d.status==='פתוח'?'⏳ פתוח':d.status==='נשלח'?'📤 נשלח':'✅ נסגר'}</span>
      </div>

      <div class="dispute-tx-info">
        <strong>כרטיס:</strong> ${tx.card} &nbsp;|&nbsp; <strong>קטגוריה:</strong> ${issue.tx.cat} &nbsp;|&nbsp; <strong>חודש:</strong> ${tx.month}<br>
        <strong>סיבת חריג:</strong> ${issue.reason}
      </div>

      <div class="dispute-msg-label">✉️ טיוטת הודעה לעסק:</div>
      <div class="dispute-msg-box" id="msgbox-${d.issueKey}">${d.message}</div>

      <div class="merchant-email-row">
        <label style="font-size:12px;font-weight:600;white-space:nowrap;">📧 מייל העסק:</label>
        <input class="merchant-email-input" type="email" placeholder="business@example.com" value="${d.merchantEmail}"
          oninput="updateMerchantEmail('${d.issueKey}',this.value)" id="email-${d.issueKey}">
        <div class="email-note">לשליחה אוטומטית — הזן מייל העסק</div>
      </div>
      ${(()=>{ const c=d.contactInfo||getVendorContact(d.issue.tx.name);
        if(!c) return '';
        return '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;font-size:12px;margin-bottom:10px;">' +
          '<strong>📋 פרטי קשר ידועים:</strong> ' +
          (c.phone?`📞 <strong>${c.phone}</strong>  `:'') +
          (c.email?`📧 <a href="mailto:${c.email}" style="color:#1d4ed8;">${c.email}</a>  `:'') +
          (c.web?`🌐 <a href="https://${c.web}" target="_blank" style="color:#1d4ed8;">${c.web}</a>`:'') +
          '</div>';
      })()}

      ${d.status!=='נסגר'?`<div class="dispute-actions-row">
        <button class="btn-send-email" onclick="doSendEmail('${d.issueKey}')">📤 שלח לעסק</button>
        <button class="btn-copy-msg" id="copybtn-${d.issueKey}" onclick="copyMsg('${d.issueKey}')">📋 העתק הודעה</button>
        <button class="btn-close-dispute" onclick="closeDispute('${d.issueKey}')">✅ סגור חריג</button>
      </div>`:''}

      <div class="thread-wrap">
        <div class="thread-label">💬 התכתבות</div>
        ${d.thread.map(m=>`<div class="thread-msg ${m.role==='sent'?'outgoing':m.role==='incoming'?'incoming':'note'}">
          ${m.text}<div class="thread-meta">${m.ts}</div>
        </div>`).join('')}
        ${d.status!=='נסגר'?`<div class="thread-reply">
          <textarea class="thread-input" id="reply-${d.issueKey}" placeholder="הוסף הערה או תגובה..."></textarea>
          <button class="btn btn-primary" style="align-self:flex-end;padding:8px 14px;" onclick="addThreadReply('${d.issueKey}')">➕</button>
        </div>`:''}
      </div>
    </div>`;
  });

  el.innerHTML=out;
}


// ── Known vendor contact lookup ──────────────────────────────
const KNOWN_CONTACTS = {
  "בנק לאומי":   { email:"pniot@bll.co.il",      phone:"*5522",  web:"leumi.co.il" },
  "בנק פיבי":    { email:"support@fibi.co.il",   phone:"*3009",  web:"fibi.co.il" },
  "דיינרס קלוב": { email:"",  phone:"*2345",  web:"dinersclub.co.il" },
  "ביטוח לאומי": { email:"",  phone:"*6050",  web:"btl.gov.il" },
  "Apple":       { email:"",  phone:"1-800-800-227", web:"apple.com/contact" },
  "אמזון":       { email:"cs-reply@amazon.com",  phone:"", web:"amazon.com/help" },
};
function getVendorContact(txName){
  if(!txName) return null;
  if(KNOWN_CONTACTS[txName]) return KNOWN_CONTACTS[txName];
  for(const [key,val] of Object.entries(KNOWN_CONTACTS)){
    if(txName.includes(key)||key.includes(txName)) return val;
  }
  return null;
}

function doSendEmail(issueKey){
  const d=disputeItems.find(x=>x.issueKey===issueKey);
  if(!d)return;
  const email=d.merchantEmail;
  const subject=encodeURIComponent('פניה בנושא חיוב — '+d.issue.tx.name);
  const body=encodeURIComponent(d.message);
  if(email&&email.includes('@')){
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    sendDispute(issueKey);
  } else {
    // No email — copy and mark
    navigator.clipboard.writeText(d.message).then(()=>{
      alert('הודעה הועתקה ללוח — הזן כתובת מייל של העסק לשליחה ישירה, או הדבק בכל תוכנת מייל.');
    });
    sendDispute(issueKey);
  }
}

function renderReviewTab(){
  // Merge auto-detected issues with manual review items
  const autoIssues=detectIssues();
  const manualActive=MANUAL_REVIEW_ITEMS.filter(i=>!dismissedIssues.has(i.key)&&!disputeItems.find(d=>d.issueKey===i.key));
  const issues=[...autoIssues,...manualActive];
  const count=issues.length;

  // Update badge
  const badge=document.getElementById('reviewBadge')||document.getElementById('disputeBadge');
  if(badge){badge.textContent=count;badge.style.display=count>0?'inline-block':'none';}
  const ab=document.getElementById('alertBanner'); if(ab) ab.style.display=count>0?'flex':'none';
  const ac=document.getElementById('alertCount'); if(ac) ac.textContent=count;

  const el=document.getElementById('reviewContent');
  if(!el) return;
  if(count===0){
    el.innerHTML=`<div class="empty-state"><div class="icon">✅</div><div>אין פריטים הדורשים בדיקה</div></div>`;
    return;
  }

  const dangerItems=issues.filter(i=>i.severity==='danger');
  const warningItems=issues.filter(i=>i.severity==='warning');
  const infoItems=issues.filter(i=>i.severity==='info');

  el.innerHTML=`
    <div style="margin-bottom:14px;font-size:13px;color:var(--gray-700);">
      נמצאו <strong>${count}</strong> פריטים:
      ${dangerItems.length>0?`<span class="badge badge-red">${dangerItems.length} דחוף</span>`:''}
      ${warningItems.length>0?`<span class="badge badge-yellow" style="margin-right:6px;">${warningItems.length} לבדיקה</span>`:''}
      ${infoItems.length>0?`<span class="badge badge-blue" style="margin-right:6px;">${infoItems.length} מידע</span>`:''}
    </div>
    ${[...dangerItems,...warningItems,...infoItems].map(issue=>renderIssueCard(issue)).join('')}
  `;
}

function renderIssueCard(issue){
  const tx=issue.tx;
  const effCat=getEffectiveCat(tx);
  const isOverridden=catOverrides[tx.id]!==undefined;
  const optionsHtml=ALL_CATS.map(c=>`<option value="${c}" ${c===effCat?'selected':''}>${c}</option>`).join('');
  return `<div class="review-item severity-${issue.severity}" id="issue-${issue.key}">
    <div class="review-icon">${issue.icon}</div>
    <div class="review-body">
      <div class="review-title">
        <span class="badge ${issue.severity==='danger'?'badge-red':issue.severity==='warning'?'badge-yellow':'badge-blue'}">${issue.severity==='danger'?'⚡ דחוף':issue.severity==='warning'?'⚠️ לבדיקה':'ℹ️ מידע'}</span>
        &nbsp;${issue.title}
      </div>
      <div class="review-reason">${issue.reason}</div>
      <div class="review-tx">
        <strong>${tx.date}</strong> · ${tx.name} · <span class="card-tag">${tx.card}</span> · 
        ${isOverridden?`<span class="reclassified-badge">✏️ סווג מחדש</span>`:''}
        <span class="badge ${CAT_BADGE[effCat]||'badge-gray'}">${effCat}</span> · 
        <strong style="font-size:14px;">${fmt(tx.amount)}</strong>
      </div>
      <div class="review-actions-row">
        <button class="btn-valid" onclick="confirmValid('${issue.key}')">✅ תקין — סגור</button>
        <button class="btn-dispute" onclick="escalateDispute('${issue.key}')">❌ לא תקין — שלח לעסק</button>
        <button class="btn-dismiss" onclick="dismissIssue('${issue.key}')">✖ בטל בדיקה</button>
      </div>
      <div class="review-actions" style="margin-top:6px;">
        <label style="font-size:11px;color:var(--gray-500);">שנה קטגוריה:</label>
        <select class="review-select" id="recat-${issue.key}" onchange="">${optionsHtml}</select>
        <button class="btn-save-cat" onclick="applyReclassify(${tx.id},'${issue.key}')">💾 עדכן</button>
      </div>
    </div>
  </div>`;
}

function applyReclassify(txId,issueKey){
  const sel=document.getElementById(`recat-${issueKey}`);
  if(!sel)return;
  catOverrides[txId]=sel.value;
  renderAll();
}

function dismissIssue(key){
  dismissedIssues.add(key);
  document.getElementById(`issue-${key}`)?.remove();
  renderReviewTab();
  renderAll();
}

// ═══════════════════════════════════════
// TREND TABLE
// ═══════════════════════════════════════
function renderTrendTable(data){
  const activeMonths=MONTHS_ORDER.filter(m=>data.some(t=>t.month===m));
  const byCatMonth={};
  const allCatsInData=[...new Set(data.map(t=>getEffectiveCat(t)))];
  allCatsInData.forEach(cat=>{
    byCatMonth[cat]={};
    activeMonths.forEach(m=>{
      byCatMonth[cat][m]=data.filter(t=>t.month===m&&getEffectiveCat(t)===cat).reduce((s,t)=>s+t.amount,0);
    });
  });

  const rowsSorted=Object.entries(byCatMonth).sort((a,b)=>{
    const totA=Object.values(a[1]).reduce((s,v)=>s+v,0);
    const totB=Object.values(b[1]).reduce((s,v)=>s+v,0);
    return totB-totA;
  });

  const maxVal=Math.max(...rowsSorted.map(([,vals])=>Math.max(...Object.values(vals))));

  let html=`<thead><tr>
    <th>קטגוריה</th>
    ${activeMonths.map(m=>`<th>${m}</th>`).join('')}
    <th>מגמה</th>
    <th>שינוי %</th>
    <th>סה"כ</th>
  </tr></thead><tbody>`;

  rowsSorted.forEach(([cat,vals])=>{
    const monthVals=activeMonths.map(m=>vals[m]||0);
    const total=monthVals.reduce((s,v)=>s+v,0);
    // trend: compare last 2 available months
    const nonZero=monthVals.filter(v=>v>0);
    let trendHtml='<span class="trend-neutral">—</span>';
    let changePct='';
    if(nonZero.length>=2){
      const last=monthVals[monthVals.length-1];
      const prev=monthVals.slice(0,-1).reverse().find(v=>v>0)||0;
      if(prev>0){
        const ch=(last-prev)/prev*100;
        if(Math.abs(ch)<5){
          trendHtml='<span class="trend-neutral">↔</span>';
          changePct='<span class="trend-pct trend-neutral">יציב</span>';
        } else if(ch>0){
          trendHtml='<span class="trend-arrow trend-up">↑</span>';
          changePct=`<span class="trend-pct trend-up">+${ch.toFixed(0)}%</span>`;
        } else {
          trendHtml='<span class="trend-arrow trend-down">↓</span>';
          changePct=`<span class="trend-pct trend-down">${ch.toFixed(0)}%</span>`;
        }
      }
    }

    html+=`<tr style="cursor:pointer;" onclick="openDrillDown('${cat}','cat','${cat}','all')" title="לחץ לפירוט">
      <td><span class="cat-circle" style="background:${CAT_COLORS[cat]||'#9ca3af'}"></span><span class="badge ${CAT_BADGE[cat]||'badge-gray'}">${cat}</span> <span style="font-size:10px;color:var(--primary);">🔍</span></td>
      ${monthVals.map((v,i)=>{
        const intensity=maxVal>0?v/maxVal:0;
        const cls=intensity>0.7?'heat-high':intensity>0.4?'heat-med':'';
        return `<td class="td-num ${cls} ${v===0?'td-num-zero':''}">${v>0?fmt(v):'—'}</td>`;
      }).join('')}
      <td style="text-align:center;">${trendHtml}</td>
      <td>${changePct}</td>
      <td class="td-num"><strong>${fmt(total)}</strong></td>
    </tr>`;
  });

  // Total row
  const totals=activeMonths.map(m=>data.filter(t=>t.month===m).reduce((s,t)=>s+t.amount,0));
  const grandTotal=totals.reduce((s,v)=>s+v,0);
  html+=`<tr style="background:var(--gray-50);font-weight:700;">
    <td>סה"כ</td>
    ${totals.map(v=>`<td class="td-num">${fmt(v)}</td>`).join('')}
    <td></td><td></td>
    <td class="td-num">${fmt(grandTotal)}</td>
  </tr>`;

  html+='</tbody>';
  document.getElementById('trendTable').innerHTML=html;
}


// ═══════════════════════════════════════
// KPIs
// ═══════════════════════════════════════
function renderKPIs(data){
  const total=data.reduce((s,t)=>s+t.amount,0);
  const byMonth=groupBy(data,t=>t.month);
  const jan=byMonth['ינואר 2026']||0,feb=byMonth['פברואר 2026']||0,mar=byMonth['מרץ 2026']||0;
  const txCount=data.length;
  const avg=txCount?total/txCount:0;
  const donations=data.filter(t=>getEffectiveCat(t)==='תרומות והתנדבות').reduce((s,t)=>s+t.amount,0);
  const topTx=[...data].sort((a,b)=>b.amount-a.amount)[0];
  const febJanChg=jan>0?pctNum(feb,jan):null;

  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">סה"כ הוצאות</div><div class="kpi-value">${fmt(total)}</div><div class="kpi-sub">${txCount} עסקאות</div></div>
    <div class="kpi-card red" style="cursor:pointer;" onclick="openDrillDown('ינואר 2026','month','ינואר 2026','all')" title="לחץ לפירוט חודש"><div class="kpi-label">ינואר 2026 🔍</div><div class="kpi-value">${fmt(jan)}</div><div class="kpi-sub">${data.filter(t=>t.month==='ינואר 2026').length} עסקאות</div></div>
    <div class="kpi-card orange" style="cursor:pointer;" onclick="openDrillDown('פברואר 2026','month','פברואר 2026','all')" title="לחץ לפירוט חודש"><div class="kpi-label">פברואר 2026 🔍</div><div class="kpi-value">${fmt(feb)}</div>
      ${febJanChg!==null?`<div class="kpi-trend ${febJanChg>0?'up':'down'}">${febJanChg>0?'↑':'↓'} ${Math.abs(febJanChg).toFixed(0)}% לעומת ינואר</div>`:''}</div>
    <div class="kpi-card green" style="cursor:pointer;" onclick="openDrillDown('מרץ 2026 (חלקי)','month','מרץ 2026','all')" title="לחץ לפירוט חודש"><div class="kpi-label">מרץ 2026 (חלקי) 🔍</div><div class="kpi-value">${fmt(mar)}</div><div class="kpi-sub">${data.filter(t=>t.month==='מרץ 2026').length} עסקאות</div></div>
    <div class="kpi-card purple"><div class="kpi-label">ממוצע לעסקה</div><div class="kpi-value">${fmt(avg)}</div></div>
    <div class="kpi-card teal"><div class="kpi-label">תרומות</div><div class="kpi-value">${fmt(donations)}</div><div class="kpi-sub">${total>0?(donations/total*100).toFixed(1):'0'}% מסה"כ</div></div>
    <div class="kpi-card green"><div class="kpi-label">הכנסה שזוהה</div><div class="kpi-value">${fmt(Object.values(getIncome()).reduce((s,v)=>s+v,0))}</div><div class="kpi-sub">מבנק פיבי</div></div>
  `;
}

// ═══════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════
function renderMonthChart(data){
  destroyChart('monthChart');
  const bm=groupBy(data,t=>t.month);
  const months=MONTHS_ORDER.filter(m=>bm[m]!==undefined);
  allCharts['monthChart']=new Chart(document.getElementById('monthChart').getContext('2d'),{
    type:'bar',
    data:{labels:months,datasets:[{label:'הוצאות (₪)',data:months.map(m=>bm[m]||0),
      backgroundColor:['#ef4444','#f59e0b','#10b981'],borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw)}}},
      scales:{y:{ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}
  });
}

function renderCardChart(data){
  destroyChart('cardChart');
  const bc=groupBy(data,t=>t.card);
  const cards=Object.keys(bc);
  allCharts['cardChart']=new Chart(document.getElementById('cardChart').getContext('2d'),{
    type:'doughnut',
    data:{labels:cards.map(c=>'כרטיס '+c),datasets:[{data:cards.map(c=>bc[c]),
      backgroundColor:['#3b82f6','#f59e0b','#10b981'],borderWidth:3,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
      plugins:{legend:{position:'bottom',labels:{font:{size:12}}},
        tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw)} (${(c.raw/c.dataset.data.reduce((a,b)=>a+b,0)*100).toFixed(1)}%)`}}}}
  });
}

function renderCatPieChart(data){
  destroyChart('catPieChart');
  const bc=groupBy(data,t=>getEffectiveCat(t));
  const cats=Object.keys(bc).sort((a,b)=>bc[b]-bc[a]);
  allCharts['catPieChart']=new Chart(document.getElementById('catPieChart').getContext('2d'),{
    type:'pie',
    data:{labels:cats,datasets:[{data:cats.map(c=>bc[c]),
      backgroundColor:cats.map(c=>CAT_COLORS[c]||'#9ca3af'),borderWidth:3,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'right',labels:{font:{size:10},boxWidth:10,padding:6}},
        tooltip:{callbacks:{label:c=>{const t=c.dataset.data.reduce((a,b)=>a+b,0);return `${c.label}: ${fmt(c.raw)} (${(c.raw/t*100).toFixed(1)}%)`;}}}}
    }
  });
}

function renderMonthCatCompare(data){
  const months=MONTHS_ORDER.filter(m=>data.some(t=>t.month===m));
  const colors={'ינואר 2026':'#ef4444','פברואר 2026':'#f59e0b','מרץ 2026':'#10b981'};
  const bm=groupBy(data,t=>t.month);
  const maxV=Math.max(...months.map(m=>bm[m]||0));
  const el=document.getElementById('monthCatCompare');
  if(!el)return;
  const febJanChg=bm['ינואר 2026']&&bm['פברואר 2026']?pctNum(bm['פברואר 2026'],bm['ינואר 2026']):null;
  el.innerHTML=`
    <div style="margin-bottom:10px;font-size:12px;color:var(--gray-500);">הוצאות כוללות לפי חודש</div>
    ${months.map(m=>`
      <div class="month-compare-row">
        <div class="mcr-label">${m}</div>
        <div class="mcr-bar-wrap"><div class="mcr-bar" style="width:${((bm[m]||0)/maxV*100).toFixed(0)}%;background:${colors[m]}">${(bm[m]||0)>800?fmtShort(bm[m]||0):''}</div></div>
        <div class="mcr-amount">${fmt(bm[m]||0)}</div>
      </div>`).join('')}
    ${febJanChg!==null?`<div style="margin-top:14px;font-size:12px;padding:10px;background:var(--gray-50);border-radius:8px;">
      שינוי ינואר→פברואר: <strong style="color:${febJanChg<0?'var(--success)':'var(--danger)'}">${febJanChg<0?'↓ ירידה של':'↑ עלייה של'} ${Math.abs(febJanChg).toFixed(1)}%</strong>
      ${bm['מרץ 2026']?` · מרץ עד כה: ${fmt(bm['מרץ 2026'])} (חלקי)`:''}
    </div>`:''}`;
}

function renderCatBarChart(data){
  destroyChart('catBarChart');
  const bc=groupBy(data,t=>getEffectiveCat(t));
  const cats=Object.keys(bc).sort((a,b)=>bc[b]-bc[a]);
  allCharts['catBarChart']=new Chart(document.getElementById('catBarChart').getContext('2d'),{
    type:'bar',
    data:{labels:cats,datasets:[{label:'₪',data:cats.map(c=>bc[c]),
      backgroundColor:cats.map(c=>CAT_COLORS[c]||'#9ca3af'),borderRadius:6,borderSkipped:false}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw)}}},
      scales:{x:{ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
}

function renderCatList(data){
  const bc=groupBy(data,t=>getEffectiveCat(t));
  const total=Object.values(bc).reduce((s,v)=>s+v,0);
  const cats=Object.entries(bc).sort((a,b)=>b[1]-a[1]);
  const maxV=cats[0]?.[1]||1;
  const curMonth=document.getElementById('filterMonth')?.value||'all';
  document.getElementById('catList').innerHTML=cats.map(([cat,val])=>`
    <div class="cat-item" style="cursor:pointer;" onclick="openDrillDown('${cat}','cat','${cat}','${curMonth}')" title="לחץ לפירוט עסקאות">
      <div class="cat-dot" style="background:${CAT_COLORS[cat]||'#9ca3af'}"></div>
      <div class="cat-name">${cat} <span style="font-size:10px;color:var(--primary);">🔍</span></div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${(val/maxV*100).toFixed(0)}%;background:${CAT_COLORS[cat]||'#9ca3af'}"></div></div>
      <div class="cat-amount">${fmt(val)}</div>
      <div class="cat-pct">${(val/total*100).toFixed(1)}%</div>
    </div>`).join('');
}

function renderCatMonthBarChart(data){
  destroyChart('catMonthBarChart');
  const cats=[...new Set(data.map(t=>getEffectiveCat(t)))].sort();
  const months=MONTHS_ORDER.filter(m=>data.some(t=>t.month===m));
  const datasets=months.map((m,i)=>({
    label:m,borderRadius:4,
    data:cats.map(c=>data.filter(t=>t.month===m&&getEffectiveCat(t)===c).reduce((s,t)=>s+t.amount,0)),
    backgroundColor:['rgba(59,130,246,.8)','rgba(245,158,11,.8)','rgba(16,185,129,.8)'][i]
  }));
  allCharts['catMonthBarChart']=new Chart(document.getElementById('catMonthBarChart').getContext('2d'),{
    type:'bar',data:{labels:cats,datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{y:{ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
}

function renderTopMerchChart(data){
  destroyChart('topMerchChart');
  const nm={};data.forEach(t=>{nm[t.name]=(nm[t.name]||0)+t.amount;});
  const top=Object.entries(nm).sort((a,b)=>b[1]-a[1]).slice(0,10);
  allCharts['topMerchChart']=new Chart(document.getElementById('topMerchChart').getContext('2d'),{
    type:'bar',
    data:{labels:top.map(([n])=>n.length>20?n.slice(0,20)+'…':n),
      datasets:[{label:'₪',data:top.map(([,v])=>v),backgroundColor:'#3b82f6',borderRadius:6,borderSkipped:false}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw)}}},
      scales:{x:{ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
}

function renderRecurTable(data){
  const nm={};
  data.forEach(t=>{
    if(!nm[t.name])nm[t.name]={cat:getEffectiveCat(t),total:0,count:0};
    nm[t.name].total+=t.amount;nm[t.name].count++;
  });
  const recur=Object.entries(nm).filter(([,v])=>v.count>=2).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  document.getElementById('recurTable').innerHTML=`
    <thead><tr><th>בית עסק</th><th>קטגוריה</th><th>פעמים</th><th>סה"כ</th></tr></thead>
    <tbody>${recur.map(([n,v])=>`<tr>
      <td>${n}</td>
      <td><span class="badge ${CAT_BADGE[v.cat]||'badge-gray'}">${v.cat}</span></td>
      <td style="color:var(--gray-500);">${v.count}×</td>
      <td style="font-weight:700;">${fmt(v.total)}</td>
    </tr>`).join('')}</tbody>`;
}

function renderMerchantTable(){
  const data=getFiltered();
  const search=(document.getElementById('merchantSearch')?.value||'').toLowerCase();
  const nm={};
  data.forEach(t=>{
    if(!nm[t.name])nm[t.name]={cat:getEffectiveCat(t),total:0,count:0,months:new Set()};
    nm[t.name].total+=t.amount;nm[t.name].count++;nm[t.name].months.add(t.month);
  });
  let entries=Object.entries(nm);
  if(search)entries=entries.filter(([n])=>n.toLowerCase().includes(search));
  entries.sort((a,b)=>b[1].total-a[1].total);

  // ── Summary bar ──────────────────────────────────────────────
  const sb = document.getElementById('merchantSummaryBar');
  if(sb){
    const totalAmt = entries.reduce((s,[,v])=>s+v.total,0);
    const totalTx  = entries.reduce((s,[,v])=>s+v.count,0);
    const topMerch = entries[0];
    // group by category
    const byCat={};
    entries.forEach(([,v])=>{ byCat[v.cat]=(byCat[v.cat]||0)+v.total; });
    const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    const activeFilters=[];
    const fMonth=document.getElementById('filterMonth')?.value;
    const fCard=document.getElementById('filterCard')?.value;
    const fCat=document.getElementById('filterCat')?.value;
    const fSearch=(document.getElementById('merchantSearch')?.value||'').trim();
    if(fMonth&&fMonth!=='all') activeFilters.push('📅 '+fMonth);
    if(fCard&&fCard!=='all') activeFilters.push('💳 '+fCard);
    if(fCat&&fCat!=='all') activeFilters.push('🏷 '+fCat);
    if(fSearch) activeFilters.push('🔍 "'+fSearch+'"');
    const filterLabel = activeFilters.length ? activeFilters.join(' · ') : 'כל הנתונים';
    sb.innerHTML =
      '<span style="color:#64748b;font-size:11px;">'+filterLabel+'</span>'
      +'<span style="width:1px;background:#e2e8f0;align-self:stretch;margin:0 4px;"></span>'
      +'<div style="display:flex;flex-direction:column;"><span style="font-size:10px;color:#94a3b8;">סה"כ הוצאה</span>'
      +'<span style="font-weight:800;font-size:15px;color:#dc2626;">'+fmt(totalAmt)+'</span></div>'
      +'<div style="display:flex;flex-direction:column;"><span style="font-size:10px;color:#94a3b8;">עסקאות</span>'
      +'<span style="font-weight:700;font-size:14px;color:#1e293b;">'+totalTx+'</span></div>'
      +'<div style="display:flex;flex-direction:column;"><span style="font-size:10px;color:#94a3b8;">בתי עסק</span>'
      +'<span style="font-weight:700;font-size:14px;color:#1e293b;">'+entries.length+'</span></div>'
      +(topCat ? '<div style="display:flex;flex-direction:column;"><span style="font-size:10px;color:#94a3b8;">קטגוריה מובילה</span>'
        +'<span style="font-weight:600;font-size:12px;color:#1d4ed8;">'+topCat[0]+' — '+fmt(topCat[1])+'</span></div>' : '')
      +(topMerch ? '<div style="display:flex;flex-direction:column;"><span style="font-size:10px;color:#94a3b8;">עסק מוביל</span>'
        +'<span style="font-weight:600;font-size:12px;color:#7c3aed;">'+topMerch[0]+' — '+fmt(topMerch[1].total)+'</span></div>' : '');
  }

  document.getElementById('merchantTable').innerHTML=`
    <thead><tr><th>בית עסק</th><th>קטגוריה</th><th>חודשים</th><th>פעמים</th><th>סה"כ</th></tr></thead>
    <tbody>${entries.map(([n,v])=>`<tr>
      <td style="font-weight:600;">${n}</td>
      <td><span class="badge ${CAT_BADGE[v.cat]||'badge-gray'}">${v.cat}</span></td>
      <td style="font-size:11px;color:var(--gray-500);">${[...v.months].join(' · ')}</td>
      <td style="color:var(--gray-500);">${v.count}×</td>
      <td style="font-weight:700;">${fmt(v.total)}</td>
    </tr>`).join('')}</tbody>`;
}

function escalateDisputeFromTx(txId){
  const tx = TRANSACTIONS.find(t=>t.id===txId);
  if(!tx) return;
  const issueKey = 'tx-dispute-'+txId;
  if(disputeItems.find(d=>d.issueKey===issueKey)){
    switchTab('disputes'); return;
  }
  const ts = new Date().toLocaleString('he-IL');
  const amt = fmt(tx.amount);
  const message = 'שלום רב,\n\nאני לקוח/ה המחזיק/ה בכרטיס '+tx.card+'.\n\nזוהתה עסקה שמעוררת שאלה בחשבוני:\n• שם העסק: '+tx.name+'\n• תאריך: '+tx.date+'\n• סכום: '+amt+'\n• קטגוריה: '+getEffectiveCat(tx)+'\n\nאבקשכם לבחון את הנושא.\nבמידה ומדובר בשגיאה — אבקש זיכוי מלא.\n\nתודה,';
  const issue = {
    key: issueKey, icon: '❓',
    title: tx.name+' — '+amt,
    severity: 'warning',
    reason: 'עסקה שנשלחה לבדיקה ידנית: '+tx.name+', '+tx.date+', '+amt,
    tx: tx
  };
  disputeItems.push({ issueKey, issue, message, merchantEmail:'',
    thread:[{role:'draft', text:message, ts}], status:'פתוח' });
  renderDisputeTab();
  renderAll();
  switchTab('disputes');
}

// ═══════════════════════════════════════
// TRANSACTIONS TABLE
// ═══════════════════════════════════════
function renderTxTable(){
  updateUndetailedCCBanner();
  const data=getFiltered();
  const search=(document.getElementById('txSearch')?.value||'').toLowerCase();
  const sf=document.getElementById('txSortField')?.value||'date';
  const sd=document.getElementById('txSortDir')?.value||'desc';
  let filtered=search?data.filter(t=>t.name.toLowerCase().includes(search)||getEffectiveCat(t).toLowerCase().includes(search)||t.card.includes(search)):[...data];
  // Approval filter
  if(_txApprovalFilter==='approved') filtered=filtered.filter(t=>approvedTxs.has(t.id));
  else if(_txApprovalFilter==='pending') filtered=filtered.filter(t=>!approvedTxs.has(t.id));
  filtered.sort((a,b)=>{
    let va,vb;
    if(sf==='amount'){va=a.amount;vb=b.amount;}
    else if(sf==='name'){va=a.name;vb=b.name;}
    else{va=a.date;vb=b.date;}
    return sd==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);
  });
  document.getElementById('txCount').textContent=`(${filtered.length} עסקאות)`;
  const totalPages=Math.max(1,Math.ceil(filtered.length/TX_PAGE));
  txPage=Math.min(txPage,totalPages);
  const page=filtered.slice((txPage-1)*TX_PAGE,txPage*TX_PAGE);
  if(!page.length){
    document.getElementById('txTable').innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="icon">🔍</div>לא נמצאו עסקאות</div></td></tr>';
    document.getElementById('txPagination').innerHTML='';return;
  }
  const ctBadgeMap={'קבוע':'badge-fixed','חד פעמי':'badge-onetime','משתנה':'badge-variable'};
  const ctIconMap={'קבוע':'🔄','חד פעמי':'⚡','משתנה':'📊'};
  // Build issue map for inline warnings
  const _issueMap = buildTxIssueMap();
  const _warnTotal = Object.keys(_issueMap).length;
  const wc=document.getElementById('warnCount'); if(wc) wc.textContent=_warnTotal;
  const wBtn=document.getElementById('warnFilterBtn'); if(wBtn) wBtn.style.opacity=_warnTotal>0?'1':'0.5';
  document.getElementById('txTable').innerHTML=`
    <thead><tr><th style="width:28px;"><input type="checkbox" id="txSelectAll" onclick="toggleSelectAll(this)" style="width:15px;height:15px;cursor:pointer;" title="בחר הכל"></th><th></th><th>✓</th><th id="txDateHeader" title="חיוב = תאריך ביצוע (חויב בחודש שבחרת) | ביצוע = תאריך עסקה בפועל">תאריך ביצוע</th><th>שם בית עסק</th><th>קטגוריה</th><th>סוג</th><th>פרוייקט</th><th>כרטיס</th><th>סכום</th></tr></thead>
    <tbody>${page.map(t=>{
      const effCat=getEffectiveCat(t);
      const isChanged=catOverrides[t.id]!==undefined;
      const ct=t.chargeType||'משתנה';
      const rowId='tx-row-'+t.id;
      const detailId='tx-detail-'+t.id;
      const txIssues=_issueMap[t.id]||[];
      const hasDanger=txIssues.some(i=>i.severity==='danger');
      const hasWarn=txIssues.length>0;
      const rowBg=hasDanger?'background:#fff5f5;':hasWarn?'background:#fffbeb;':'';
      const warnBadge=txIssues.length>0
        ?'<span class="tx-warn-badge'+(hasDanger?' danger':'')+'" onclick="toggleTxDetail('+t.id+')" title="'+txIssues[0].title.replace(/"/g,'&quot;')+'">'
          +(hasDanger?'🔴':'⚠️')+' '+txIssues[0].title.substring(0,22)+(txIssues[0].title.length>22?'…':'')
          +(txIssues.length>1?' (+'+(txIssues.length-1)+')':'')+'</span>'
        :'';
      const warnPanels=txIssues.map(iss=>'<div class="warn-panel'+(iss.severity==='danger'?' danger':'')+'"><div class="warn-panel-title">'+(iss.severity==='danger'?'🔴':'⚠️')+' '+iss.title+'</div><div class="warn-panel-desc">'+iss.reason+'</div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-dispute" style="font-size:11px;" onclick="escalateDispute(\''+iss.key+'\')">📨 שלח לעסק</button><button style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;" onclick="dismissIssue(\''+iss.key+'\');renderTxTable();">✓ סגור</button></div></div>').join('');
      return `<tr id="${rowId}" style="${rowBg}${approvedTxs.has(t.id)?'opacity:.78;':''}">
        <td style="width:28px;padding:4px 6px;"><input type="checkbox" class="tx-select-cb" data-id="${t.id}" onclick="onTxCheck()" style="width:15px;height:15px;cursor:pointer;accent-color:#1a56db;"></td>
        <td style="width:28px;"><button class="tx-expand-btn" onclick="toggleTxDetail(${t.id})" title="הצג פירוט">${hasWarn?(hasDanger?'🔴':'⚠️'):'▶'}</button></td>
        <td style="width:26px;"><button class="tx-approve-btn ${approvedTxs.has(t.id)?'approved':''}" onclick="toggleApprove(${t.id})" title="${approvedTxs.has(t.id)?'מאושר — לחץ לביטול':'סמן כמאושר'}">${approvedTxs.has(t.id)?'✓':''}</button></td>
        <td style="font-family:monospace;font-size:11px;color:var(--gray-500);">
          ${t.date}
          ${_monthMode==='exec'&&_dateToMonth(t.date)!==t.month
            ? '<span style="display:block;font-size:9px;color:#f59e0b;margin-top:1px;" title="חויב ב-'+t.month+'">חיוב: '+t.month.replace(' 2026','')+'</span>'
            : ''}
        </td>
        <td style="font-weight:600;">${t.name}${warnBadge?'<br><span style="display:inline-block;margin-top:2px;">'+warnBadge+'</span>':''}</td>
        <td class="cat-cell" id="cat-cell-${t.id}"><div class="inline-edit-wrap">${isChanged?'<span class="reclassified-badge">✏️</span>':''}<span class="badge ${CAT_BADGE[effCat]||'badge-gray'} drillable" onclick="openDrillDown('${effCat.replace(/'/g,'&#39;')}','cat','${effCat.replace(/'/g,'&#39;')}','${(document.getElementById('filterMonth')?.value||'all')}')}" style="cursor:pointer;">${effCat}</span><button class="inline-edit-btn" onclick="toggleInlineEdit(${t.id})" title="עריכה מהירה">✎</button></div></td>
        <td><div style="display:inline-flex;align-items:center;gap:4px;"><span class="${ctBadgeMap[ct]||'badge-gray'}" style="cursor:pointer;" title="לחץ לשינוי סוג" onclick="cycleChargeType(${t.id})">${ctIconMap[ct]} ${ct}</span><button class="inline-edit-btn" onclick="toggleInlineEdit(${t.id})" title="עריכת קטגוריה וסוג חיוב" style="font-size:11px;padding:1px 4px;">✎</button></div></td>
        <td style="position:relative;" id="proj-cell-${t.id}">${renderProjectCell(t.id)}</td>
        <td><span class="card-tag">${t.card}</span></td>
        <td style="font-weight:700;text-align:left;">${fmt(t.amount)}</td>
      </tr>
      <tr id="${detailId}" class="tx-detail-row" style="display:none;">
        <td colspan="10">
          ${warnPanels}
          <div class="tx-raw-grid" style="margin-top:${txIssues.length?'10px':'0'}">
            <div class="tx-raw-item"><div class="tx-raw-label">שם מקורי בקובץ</div><div class="tx-raw-value">${t.name}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">מקור / קובץ</div><div class="tx-raw-value">${t.src||t.card}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">תאריך עסקה</div><div class="tx-raw-value">${t.date}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">כרטיס/בנק</div><div class="tx-raw-value">${t.card}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">קטגוריה מסווגת</div><div class="tx-raw-value">${effCat}${isChanged?' ✏️ (שונה ידנית)':''}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">סוג חיוב</div><div class="tx-raw-value">${ctIconMap[ct]} ${ct}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">סכום מקורי</div><div class="tx-raw-value" style="font-size:16px;color:var(--danger);">₪${t.amount.toFixed(2)}</div></div>
            <div class="tx-raw-item"><div class="tx-raw-label">מזהה פנימי</div><div class="tx-raw-value" style="color:var(--gray-400);font-size:10px;">#${t.id}</div></div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-dispute" style="font-size:12px;" onclick="escalateDisputeFromTx(${t.id})">❌ לא תקין — שלח לעסק</button>
            <button style="background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:7px;padding:5px 12px;font-size:12px;cursor:pointer;" onclick="toggleInlineEdit(${t.id})">✏️ עריכת קטגוריה</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>`;
  let pg='';
  if(totalPages>1){
    pg+=`<button onclick="txPage--;renderTxTable()" ${txPage===1?'disabled':''}>→</button>`;
    for(let i=Math.max(1,txPage-2);i<=Math.min(totalPages,txPage+2);i++)
      pg+=`<button onclick="txPage=${i};renderTxTable()" class="${i===txPage?'active':''}">${i}</button>`;
    pg+=`<button onclick="txPage++;renderTxTable()" ${txPage===totalPages?'disabled':''}>←</button>`;
  }
  document.getElementById('txPagination').innerHTML=pg;
}

// ═══════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════
function renderRecommendations(data){
  const total=data.reduce((s,t)=>s+t.amount,0);
  const bc=groupBy(data,t=>getEffectiveCat(t));
  const bm=groupBy(data,t=>t.month);
  const jan=bm['ינואר 2026']||0,feb=bm['פברואר 2026']||0;
  const food=bc['מזון וצריכה']||0;
  const travel=bc['נסיעות לחו"ל']||0;
  const donations=bc['תרומות והתנדבות']||0;
  const entertain=(bc['פנאי, בידור וספורט']||0)+(bc['מסעדות, קפה וברים']||0);
  const gas=bc['דלק, חשמל וגז']||0;
  const subs=bc['מנויים דיגיטליים']||0;

  const recs=[
    {type:travel>3000?'danger':'info',icon:'✈️',title:'הוצאות נסיעה גבוהות',
     text:`${fmt(travel)} נרכש מט"ח בינואר (${(travel/total*100).toFixed(0)}% מסה"כ). בדוק האם זו הוצאה חד-פעמית לחופשה וסמן בתקציב בהתאם.`},
    {type:food/total>0.25?'warning':'success',icon:'🛒',title:'הוצאות מזון',
     text:`${fmt(food)} (${(food/total*100).toFixed(1)}%). רשת סופר זול מופיעה ב-${data.filter(t=>t.name.includes('סופר זול')).length} עסקאות. ריכוז קניות עשוי להשיג הנחות נאמנות.`},
    {type:'success',icon:'❤️',title:'תרומות ונתינה',
     text:`${fmt(donations)} (${(donations/total*100).toFixed(1)}%) — הוצאה קבועה לטובת הקהילה. ישיבת שבי חברון, קרן יחד, חסד בלוד ומאורות. זכאי לזיכוי מס — שמור קבלות!`},
    {type:entertain>600?'warning':'info',icon:'🎭',title:'בידור ופנאי',
     text:`${fmt(entertain)} — כולל CodeMonkey (חינוך ילדים), Apple, בהצדעה ומסעדות. בדוק מנויים ישנים שאינם בשימוש.`},
    {type:'danger',icon:'⚡',title:'קפיצת מחיר CodeMonkey',
     text:`חויבת $30 (₪97) ואז $54 (₪172) תוך שבוע ("TRIAL OVER"). הפרש של 76%. ודא שהמנוי הנכון פעיל וביטל ניסיון אם אינך צריך.`},
    {type:gas>400?'warning':'info',icon:'🔥',title:'גז וחשמל',
     text:`${fmt(gas)} על גז (מעוז הגז, ינואר). עלות חודשית גבוהה. בדוק מחירי ספקים אלטרנטיביים ביש"ע.`},
    {type:feb<jan?'success':'warning',icon:'📉',title:`${feb<jan?'ירידה':'עלייה'} בפברואר`,
     text:`ינואר: ${fmt(jan)} | פברואר: ${fmt(feb)} (${feb<jan?'ירידה':'עלייה'} של ${Math.abs(((feb-jan)/jan)*100).toFixed(0)}%). ${feb<jan?'המשך כך! ירידה בעיקר עקב העדר הוצאות נסיעה.':'עיקר הגידול: מוסך ₪348 + בהצדעה ₪470.'}`},
    {type:'info',icon:'🏦',title:'עמלות כרטיס',
     text:`₪19.89/חודש דמי כרטיס דיסקונט *2621. כרטיס מסטרקארד *7959 מקבל הנחה מלאה (₪0 בפועל). ודא הנחה זו נשמרת.`},
  ];

  document.getElementById('recGrid').innerHTML=recs.map(r=>`
    <div class="rec-card ${r.type}">
      <div class="rec-icon">${r.icon}</div>
      <div><div class="rec-title">${r.title}</div><div class="rec-text">${r.text}</div></div>
    </div>`).join('');

  const nm={};TRANSACTIONS.forEach(t=>{nm[t.name]=(nm[t.name]||0)+t.amount;});
  const top5=Object.entries(nm).sort((a,b)=>b[1]-a[1]).slice(0,5);

  document.getElementById('insightsList').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="background:var(--gray-50);border-radius:10px;padding:16px;">
        <div style="font-weight:700;margin-bottom:10px;">🏆 Top 5 הוצאות:</div>
        ${top5.map(([n,v],i)=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-200);font-size:13px;"><span>${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${n}</span><strong>${fmt(v)}</strong></div>`).join('')}
      </div>
      <div style="background:var(--gray-50);border-radius:10px;padding:16px;">
        <div style="font-weight:700;margin-bottom:8px;">📌 הוראות קבע שזוהו:</div>
        <div style="font-size:13px;line-height:2;color:var(--gray-700);">
          🏦 <strong>מהבנק:</strong><br>
          • העברה מהחשבון (פברואר) — ₪25,126.42 + ₪2,292.16 = ₪27,418.58 (משכנתא?)<br>
          • העברה מהחשבון (ינואר) — ₪452.13<br>
          • פקדון חיסכון 301-00019 — ₪3,068–₪350/חודש<br>
          • עמלות בנק — ₪172.20 (ינואר) | ₪405.00 (פברואר)<br>
          💳 <strong>מהכרטיסים:</strong><br>
          • ישיבת שבי חברון — ₪120×2/חודש (₪240)<br>
          • קרן יחד — ₪74/חודש<br>
          • חסד בלוד — ₪52/חודש<br>
          • מאורות ותן חלקנו — ₪39/חודש<br>
          • פנגו מוביט — ₪80/חודש (תחבורה)<br>
          • דמי כרטיס דיסקונט *2621 — ₪19.89/חודש<br>
          • Apple (iTunes/iCloud) — ₪39.90/חודש
        </div>
      </div>
      <div style="background:var(--primary-light);border-radius:10px;padding:16px;">
        <div style="font-weight:700;margin-bottom:8px;color:var(--primary);">✅ פעולות מומלצות:</div>
        <div style="font-size:13px;line-height:2;color:var(--gray-700);">
          ✅ בדוק מנוי CodeMonkey — שולם פעמיים (סה"כ ₪268.70)<br>
          ✅ הכנסת פברואר: ₪50,000 — נמצאה בבנק פיבי. הוסף קבצי חודשים נוספים<br>
          ✅ שמור קבלות תרומות לזיכוי מס (סה"כ ${fmt(donations)})<br>
          ✅ סווג "שונות" ו"בהצדעה" לקטגוריה מתאימה<br>
          ✅ תקצב ${fmt(400)}/חודש למזון ועקוב בזמן אמת
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════
function renderAll(){
  const data=getFiltered();
  populateFilterDropdowns();
  renderOverviewProfileCard();
  renderKPIs(data);
  renderChargeTypeBreakdown(data);
  renderFixedVarChart(data);
  // Auto-refresh savings tab if it's active
  if(document.getElementById('tab-savings')?.classList.contains('active')) renderSavingsTab();
  renderMonthChart(data);
  renderCardChart(data);
  renderCatPieChart(data);
  renderMonthCatCompare(data);
  renderTrendTable(data);
  renderCatBarChart(data);
  renderCatList(data);
  renderCatMonthBarChart(data);
  renderTopMerchChart(data);
  renderRecurTable(data);
  renderMerchantTable();
  renderTxTable();
  renderReviewTab();
  renderRecommendations(data);
  updateSavings();
  renderDisputeTab();
  renderFeesSummary();
  if(document.getElementById('tab-insurance')?.classList.contains('active')) renderInsuranceTab();
  if(document.getElementById('tab-management')?.classList.contains('active')) renderManagementTab();
  if(document.getElementById('tab-statement')?.classList.contains('active')) renderStatementTab();
  // Virtual advisor — runs after all data is processed
  if(typeof window.initVirtualAdvisor === 'function') window.initVirtualAdvisor(data);
}

// ═══════════════════════════════════════════════════════════════
// Populate filter dropdowns dynamically from loaded transactions
// ═══════════════════════════════════════════════════════════════
function populateFilterDropdowns(){
  // --- Month filter ---
  const mSel = document.getElementById('filterMonth');
  if(mSel){
    const prevM = mSel.value;
    // Collect unique months from MONTHS_ORDER or from transactions
    const months = MONTHS_ORDER && MONTHS_ORDER.length ? MONTHS_ORDER.slice() :
      [...new Set((TRANSACTIONS||[]).map(t=>t.month))].filter(Boolean).sort();
    let html = '<option value="all">כל החודשים</option>';
    months.forEach(m=>{ html += `<option value="${m}"${m===prevM?' selected':''}>${m}</option>`; });
    mSel.innerHTML = html;
  }

  // --- Card/Source filter ---
  const cSel = document.getElementById('filterCard');
  if(cSel){
    const prevC = cSel.value;
    const sources = [...new Set((TRANSACTIONS||[]).map(t=>t.source).filter(Boolean))].sort();
    let html = '<option value="all">כל המקורות</option>';
    // Group by type: banks vs cards
    const banks = sources.filter(s=>s.includes('בנק'));
    const cards = sources.filter(s=>!s.includes('בנק'));
    if(cards.length){
      html += '<optgroup label="── כרטיסי אשראי ──">';
      cards.forEach(s=>{ html += `<option value="${s}"${s===prevC?' selected':''}>${s}</option>`; });
      html += '</optgroup>';
    }
    if(banks.length){
      html += '<optgroup label="── חשבונות בנק ──">';
      banks.forEach(s=>{ html += `<option value="${s}"${s===prevC?' selected':''}>${s}</option>`; });
      html += '</optgroup>';
    }
    cSel.innerHTML = html;
  }
}

// ═══════════════════════════════════════════════════════════════
// Profile summary card in overview tab
// ═══════════════════════════════════════════════════════════════
function renderOverviewProfileCard(){
  const el = document.getElementById('overviewProfileCard');
  if(!el) return;
  const p = typeof userProfile !== 'undefined' ? userProfile : {};
  const auth = (function(){ try{ return JSON.parse(localStorage.getItem('authUser')||'{}'); }catch(e){ return {}; } })();
  const name = p.name || auth.name || '';
  const email = p.email || auth.email || '';
  if(!name && !email){ el.innerHTML=''; return; }
  const FAMILY_LABELS_LOCAL = {'single':'רווק/ה','married':'נשוי/אה','cohabiting':'ידועים בציבור','divorced':'גרוש/ה','widowed':'אלמן/ה'};
  const fs = FAMILY_LABELS_LOCAL[p.familyStatus] || '';
  const kids = parseInt(p.childrenCount)||0;
  const region = p.region||'';
  let tags = [];
  if(fs) tags.push(fs);
  if(kids>0) tags.push(kids+' ילדים');
  if(region) tags.push(region);
  const tagsHtml = tags.map(t=>`<span style="background:rgba(59,130,246,0.12);color:#93c5fd;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;">${t}</span>`).join(' ');
  el.innerHTML = `<div style="background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;border-radius:14px;padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">👤</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:800;font-size:16px;color:#f1f5f9;">${name}</div>
      ${email?`<div style="font-size:12px;color:#64748b;margin-top:1px;">${email}</div>`:''}
      ${tagsHtml?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${tagsHtml}</div>`:''}
    </div>
    <button onclick="openProfileModal()" style="background:rgba(59,130,246,0.12);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);border-radius:9px;padding:7px 16px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;">✏️ ערוך פרופיל</button>
  </div>`;
}


// ═══════════════════════════════════════════════════════════════
// renderStatementBalances — editable bank balance widget
// ═══════════════════════════════════════════════════════════════
function renderStatementBalances(){
  const el = document.getElementById('statementBalancesWidget');
  if(!el) return;
  if(!STATEMENT_BALANCES || !STATEMENT_BALANCES.length){ el.innerHTML=''; return; }

  let html = '<div class="stmt-bal-card"><div class="stmt-bal-header">🏦 יתרות חשבון בנק — עדכון ידני'
    + '<span style="font-size:11px;color:#94a3b8;font-weight:400;margin-right:8px;">לחץ 💾 לשמירה</span></div>'
    + '<div class="stmt-bal-grid">';

  STATEMENT_BALANCES.forEach(function(b, idx){
    const hasBalance = b.balance && b.balance > 0;
    html += '<div class="stmt-bal-item">'
      + '<div class="stmt-bal-name">' + b.name + '</div>'
      + '<div class="stmt-bal-amount' + (hasBalance?'':' zero') + '">'
      + (hasBalance ? '₪' + b.balance.toLocaleString('he-IL') : '— לא הוזן —') + '</div>'
      + '<div class="stmt-bal-date">נכון ל: ' + (b.statementDate||'—') + '</div>'
      + '<div class="stmt-bal-edit">'
      + '<input id="bal-inp-' + idx + '" class="stmt-bal-input" type="number" placeholder="יתרה ₪" value="' + (b.balance||'') + '" style="width:110px;">'
      + '<input id="bal-date-' + idx + '" class="stmt-bal-input" type="text" placeholder="DD-MM-YYYY" value="' + (b.statementDate||'') + '" style="width:100px;">'
      + '<button class="stmt-bal-save" onclick="saveStatementBalance(' + idx + ')">💾</button>'
      + '</div>'
      + (hasBalance ? '' : '<div class="stmt-bal-warning">⚠️ הזן יתרה לחישוב מדויק</div>')
      + '</div>';
  });

  html += '</div></div>';
  el.innerHTML = html;
  _wfUpdateProgress();
}

// ═══════════════════════════════════════════════════════════════
// GUIDED WORKFLOW SYSTEM
// ═══════════════════════════════════════════════════════════════
const WF_STEPS = [
  { id:'statement',     label:'דף חשבון',  icon:'📄', tab:'statement',
    desc:'סקור את תנועות הבנק לפי סדר כרונולוגי וסמן הכנסות' },
  { id:'transactions',  label:'עסקאות',    icon:'📋', tab:'transactions',
    desc:'טייב קטגוריות, סוגי חיוב ופרוייקטים ואשר עסקאות' },
  { id:'disputes',      label:'חריגים',    icon:'⚠️', tab:'disputes',
    desc:'טפל בחריגים שזוהו ושלח בירורים לספקים' },
  { id:'savings',       label:'מאזן',      icon:'💰', tab:'savings',
    desc:'עדכן יתרות בנק ואשר את תמונת המאזן החודשית' },
  { id:'insights',      label:'תובנות',    icon:'💡', tab:'overview',
    desc:'צפה בניתוחים, מגמות והמלצות' },
];

// Persistent state (localStorage with graceful fallback)
function _wfLoad(){
  try {
    const raw = localStorage.getItem('_wfState');
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
function _wfSave(state){
  try { localStorage.setItem('_wfState', JSON.stringify(state)); } catch(e){}
}

let _wfState = _wfLoad();
// Ensure defaults
if(!_wfState.completed)  _wfState.completed  = {};
if(!_wfState.skipCount)  _wfState.skipCount  = {};
if(!_wfState.hintDismissed) _wfState.hintDismissed = {};

// Calculate real-time progress for each step
function _wfCalcProgress(stepId){
  if(stepId==='statement'){
    // Done if user has visited; more done if bank balances entered
    const balsDone = STATEMENT_BALANCES.filter(b=>b.balance>0).length;
    return Math.min(100, Math.round((balsDone / Math.max(1,STATEMENT_BALANCES.length)) * 100));
  }
  if(stepId==='transactions'){
    const all = TRANSACTIONS.filter(t=>t.type!=='פנימי');
    if(!all.length) return 0;
    const approved = all.filter(t=>approvedTxs.has(t.id)).length;
    return Math.round((approved/all.length)*100);
  }
  if(stepId==='disputes'){
    if(typeof detectIssues!=='function') return 100;
    const open = [...detectIssues(),...(MANUAL_REVIEW_ITEMS||[])].filter(i=>!dismissedIssues||!dismissedIssues.has(i.key));
    return open.length===0 ? 100 : Math.max(0, 100 - Math.min(100, open.length*20));
  }
  if(stepId==='savings'){
    const balsDone = STATEMENT_BALANCES.filter(b=>b.balance>0).length;
    return balsDone===STATEMENT_BALANCES.length ? 100 : 50;
  }
  if(stepId==='insights'){
    return (_wfState.completed['insights']||0) ? 100 : 0;
  }
  return 0;
}

function _wfGetStatus(stepId){
  const pct = _wfCalcProgress(stepId);
  if(pct>=100) return 'done';
  if(pct>0)    return 'partial';
  return 'pending';
}

function _wfActiveStep(){
  // Return the first step that's not done
  for(let i=0;i<WF_STEPS.length;i++){
    if(_wfGetStatus(WF_STEPS[i].id)!=='done') return i;
  }
  return WF_STEPS.length-1;
}

function _wfRenderBar(activeTab){
  const bar = document.getElementById('wfBar');
  if(!bar) return;
  const activeIdx = _wfActiveStep();
  let html = '';
  WF_STEPS.forEach(function(step, i){
    const status = _wfGetStatus(step.id);
    const pct    = _wfCalcProgress(step.id);
    const isActiveTab = (step.tab === activeTab || (step.id==='insights' && ['overview','categories','merchants','recommendations','savings'].includes(activeTab)));
    const numClass = status==='done' ? 'done' : (isActiveTab ? 'active' : status==='partial' ? 'partial' : 'pending');
    const lblClass = status==='done' ? 'done' : (isActiveTab ? 'active' : 'pending');

    html += '<div class="wf-step" onclick="switchTab(\'' + step.tab + '\')" title="' + step.desc + '">'
      + '<div class="wf-step-num ' + numClass + '">' + (status==='done' ? '✓' : (i+1)) + '</div>'
      + '<div class="wf-step-label ' + lblClass + '">' + step.icon + ' ' + step.label + '</div>'
      + (pct>0 && pct<100 ? '<span class="wf-step-pct">' + pct + '%</span>' : '')
      + '</div>';
    if(i < WF_STEPS.length-1) html += '<div class="wf-arrow">›</div>';
  });
  bar.innerHTML = html;
}

function _wfShowHint(activeTab){
  const hint    = document.getElementById('wfHint');
  const hintTxt = document.getElementById('wfHintText');
  if(!hint||!hintTxt) return;

  // Find which step this tab belongs to
  const curStep = WF_STEPS.find(s=>s.tab===activeTab);
  if(!curStep){ hint.style.display='none'; return; }

  const curIdx  = WF_STEPS.indexOf(curStep);
  const activeExpected = _wfActiveStep();

  // If user is on the expected step, no hint needed
  if(curIdx === activeExpected){ hint.style.display='none'; return; }

  // Check if user has dismissed this hint too many times (learned preference)
  const skipKey = 'hint_' + activeTab;
  if((_wfState.hintDismissed[skipKey]||0) >= 2){ hint.style.display='none'; return; }

  // Build hint message
  let msg = '';
  if(curIdx > activeExpected){
    const prevStep = WF_STEPS[activeExpected];
    msg = 'לתוצאות מדויקות, מומלץ לסיים קודם: <a onclick="switchTab(\'' + prevStep.tab + '\')">'
        + prevStep.icon + ' ' + prevStep.label + '</a> '
        + '(' + _wfCalcProgress(prevStep.id) + '% הושלם)';
  }

  if(!msg){ hint.style.display='none'; return; }

  hintTxt.innerHTML = msg;
  hint.style.display = 'flex';
}

function _wfDismissHint(){
  const hint = document.getElementById('wfHint');
  if(hint) hint.style.display='none';
  // Learn: increment dismiss count for current active tab
  const activeTab = document.querySelector('.tabs-grouped .tab.active')?.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
  if(activeTab){
    const skipKey = 'hint_' + activeTab;
    _wfState.hintDismissed[skipKey] = (_wfState.hintDismissed[skipKey]||0) + 1;
    _wfSave(_wfState);
  }
}

function _wfUpdateProgress(){
  // Mark insights as visited if on an insights tab
  const bar = document.getElementById('wfBar');
  _wfRenderBar(window._activeTab||'');
}

// Hook into switchTab
const _origSwitchTab = typeof switchTab==='function' ? switchTab : null;


// ═══════════════════════════════════════════════════════════════
// SETTINGS SECTION + SETUP WIZARD
// ═══════════════════════════════════════════════════════════════

// Persistent settings
let _appSettings = (function(){
  try{ return JSON.parse(localStorage.getItem('_appSettings')||'{}'); } catch(e){ return {}; }
})();
function _saveSettings(){ try{ localStorage.setItem('_appSettings', JSON.stringify(_appSettings)); } catch(e){} }

// Bank/CC provider data
const BANK_PROVIDERS = [
  { id:'leumi', name:'בנק לאומי', icon:'🏦', color:'#003f7f',
    url:'https://hb.leumi.co.il', app:'לאומי',
    format:'PDF',
    steps:[
      'כנסו לאינטרנט בנקאי בכתובת hb.leumi.co.il',
      'תפריט עליון ← "שירותים" ← "הגדרות"',
      'בחרו "דוחות ומסמכים" ← "קבלת דפי חשבון למייל"',
      'הזינו את כתובת המייל הייעודית ← לחצו "שמור"',
      'הדוח יישלח בכל 1 לחודש בפורמט PDF',
    ],
    email:'pniot@bll.co.il', phone:'*5522'
  },
  { id:'hapoalim', name:'בנק הפועלים', icon:'🏦', color:'#e6001e',
    url:'https://www.bankhapoalim.co.il', app:'הפועלים ONE',
    format:'PDF',
    steps:[
      'כנסו לאינטרנט בנקאי בבנק הפועלים',
      '"שירותים" ← "הגדרת עדפות" ← "התראות ומסמכים"',
      'בחרו "דף חשבון חודשי" ← הפעילו שליחה למייל',
      'הזינו את כתובת המייל הייעודית ולחצו "אישור"',
      'לחלופין: אפליקציית הפועלים ONE ← הגדרות ← התראות',
    ],
    email:'', phone:'*2407'
  },
  { id:'mizrahi', name:'בנק מזרחי-טפחות', icon:'🏦', color:'#f7941d',
    url:'https://www.mizrahi-tefahot.co.il', app:'מזרחי-טפחות',
    format:'PDF',
    steps:[
      'כנסו לאינטרנט בנקאי של מזרחי-טפחות',
      '"שירותים נוספים" ← "מסמכים ומכתבים"',
      'בחרו "שליחת דף חשבון למייל"',
      'הגדירו את המייל הייעודי ← שמרו',
    ],
    email:'customer@mizrahitefahot.co.il', phone:'*2424'
  },
  { id:'discount', name:'בנק דיסקונט', icon:'🏦', color:'#0072c6',
    url:'https://www.discountbank.co.il', app:'דיסקונט',
    format:'PDF',
    steps:[
      'כנסו לאינטרנט בנקאי של דיסקונט',
      '"הגדרות" ← "דואר אלקטרוני ו-SMS"',
      'בחרו "סוגי הודעות" ← "דף חשבון חודשי" ← הפעילו',
      'הזינו מייל ייעודי ולחצו "שמור הגדרות"',
    ],
    email:'', phone:'*2971'
  },
  { id:'fibi', name:'בנק פיבי (הבינלאומי)', icon:'🏦', color:'#1a5276',
    url:'https://www.fibi.co.il', app:'פיבי',
    format:'PDF',
    steps:[
      'כנסו לאינטרנט בנקאי של פיבי',
      '"הגדרות" ← "העדפות והתראות"',
      'בחרו "דוח חודשי" ← הזינו מייל ייעודי',
      'לחצו "שמור"',
    ],
    email:'support@fibi.co.il', phone:'*3009'
  },
  { id:'cal', name:'כאל (CAL)', icon:'💳', color:'#00529b',
    url:'https://www.cal.co.il', app:'כאל',
    format:'PDF / Excel',
    steps:[
      'כנסו לאתר cal.co.il ← "כניסה לחשבוני"',
      '"הגדרות" ← "ניהול חשבון" ← "דוח חודשי"',
      'בחרו "שליחה למייל" ← הזינו מייל ייעודי',
      'ניתן לבחור פורמט PDF או Excel (מומלץ Excel לייבוא)',
      'לחצו "שמור"',
    ],
    email:'service@cal.co.il', phone:'*5050'
  },
  { id:'max', name:'מקס (MAX)', icon:'💳', color:'#8b2fc9',
    url:'https://www.max.co.il', app:'MAX',
    format:'PDF / Excel',
    steps:[
      'כנסו לאתר max.co.il ← "הכניסה שלי"',
      '"הגדרות" ← "דיוור ועדכונים"',
      'הפעילו "קבלת דוח חודשי למייל"',
      'הזינו מייל ייעודי ← בחרו פורמט (Excel מומלץ)',
      'לחצו "שמור"',
    ],
    email:'service@max.co.il', phone:'*6262'
  },
  { id:'isracard', name:'ישראכרט / אמריקן אקספרס', icon:'💳', color:'#006fcf',
    url:'https://www.isracard.co.il', app:'ישראכרט',
    format:'PDF / Excel',
    steps:[
      'כנסו לאתר isracard.co.il ← "הכניסה שלי"',
      '"ניהול חשבון" ← "הגדרות" ← "העדפות"',
      'בחרו "דוח חודשי" ← "שליחה לדואר אלקטרוני"',
      'הזינו מייל ייעודי ← לחצו "שמור"',
    ],
    email:'customer@isracard.co.il', phone:'*2727'
  },
];

function renderSettingsSection(){
  const s = _appSettings;
  const folderPath = s.folderPath || '';
  const watchEmail = s.watchEmail || '';
  const enabledProviders = s.enabledProviders || {};

  let h = '';

  // ── Block 1: Setup wizard CTA ────────────────────────────────
  const isFirstTime = !s.setupDone;
  if(isFirstTime){
    h += '<div style="background:linear-gradient(135deg,#1a56db,#3b82f6);color:white;border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">'
      + '<div style="font-size:36px;">🚀</div>'
      + '<div style="flex:1;">'
      + '<div style="font-weight:800;font-size:16px;margin-bottom:4px;">ברוך הבא — הגדרה ראשונית</div>'
      + '<div style="font-size:13px;opacity:.9;">הגדר תיקייה ומייל פעם אחת, והמערכת תטען נתונים אוטומטית</div>'
      + '</div>'
      + '<button onclick="openSetupWizard()" style="background:white;color:#1a56db;border:none;border-radius:10px;padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap;">▶ פתח אשף הגדרה</button>'
      + '</div>';
  }

  // ── Block 2: Folder setup ────────────────────────────────────
  h += '<div class="card" style="margin-bottom:16px;">'
    + '<h3>📂 תיקיית הקבצים</h3>'
    + '<p style="font-size:13px;color:#64748b;margin:6px 0 14px;">בחר את התיקייה שבה שומרים קבצי Excel/PDF מהבנקים. המערכת תסרוק אותה בכל טעינה.</p>'
    + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
    + '<input id="settings-folder-path" type="text" value="' + folderPath + '" placeholder="C:\\Users\\...\\Downloads\\כספים" '
    + 'style="flex:1;min-width:240px;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;font-family:monospace;">'
    + '<label style="background:#1a56db;color:white;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">'
    + '📁 בחר תיקייה'
    + '<input type="file" webkitdirectory style="display:none;" onchange="handleFolderPick(this)">'
    + '</label>'
    + '<button onclick="saveFolderPath()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">💾 שמור</button>'
    + '</div>'
    + (folderPath ? '<div style="margin-top:8px;font-size:12px;color:#059669;">✅ נשמרה: ' + folderPath + '</div>' : '')
    + '</div>';

  // ── Block 3: Email setup ──────────────────────────────────────
  h += '<div class="card" style="margin-bottom:16px;">'
    + '<h3>📧 מייל ייעודי לדוחות</h3>'
    + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#1e40af;">'
    + '<strong>💡 טיפ:</strong> מומלץ לפתוח מייל Gmail ייעודי (לדוגמא: <em>yishay.finance@gmail.com</em>) ולא להשתמש במייל הראשי שלך. '
    + 'כך הדוחות לא מתערבבים עם מייל יומיומי ולמערכת יש גישה מבודדת.'
    + '</div>'
    + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
    + '<input id="settings-email" type="email" value="' + watchEmail + '" placeholder="finance@gmail.com" '
    + 'style="flex:1;min-width:240px;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;">'
    + '<button onclick="saveWatchEmail()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">💾 שמור</button>'
    + '</div>'
    + (watchEmail ? '<div style="margin-top:8px;font-size:12px;color:#059669;">✅ מייל נשמר: ' + watchEmail + '</div>' : '')
    + '<div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;">'
    + '🔒 <strong>אבטחה:</strong> המייל משמש רק לקריאת דוחות — לא נשלח ממנו כלום. '
    + 'בשלב הבא (גרסת web) תחבר אותו דרך OAuth בלבד ללא שמירת סיסמה.'
    + '</div>'
    + '</div>';

  // ── Block 4: Per-provider instructions (accordion) ────────────
  h += '<div class="card">'
    + '<h3>🏦 הגדרת שליחה אוטומטית מהבנקים</h3>'
    + '<p style="font-size:13px;color:#64748b;margin:4px 0 16px;">לכל בנק/חברת אשראי — הגדר פעם אחת שליחת דוח חודשי למייל הייעודי. ⬇️ לחץ על שם הגוף לפירוט.</p>';

  BANK_PROVIDERS.forEach(function(provider){
    const isEnabled = enabledProviders[provider.id];
    const accId = 'prov-acc-' + provider.id;
    const isOpen = window['_provOpen_'+provider.id] || false;

    h += '<div style="border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;">';

    // Header row
    h += '<div onclick="toggleProviderAcc(\'' + provider.id + '\')" '
      + 'style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;background:' + (isOpen?'#f0f9ff':'white') + ';user-select:none;">'
      + '<span style="font-size:20px;">' + provider.icon + '</span>'
      + '<div style="flex:1;">'
      + '<div style="font-weight:700;font-size:14px;color:' + provider.color + ';">' + provider.name + '</div>'
      + '<div style="font-size:11px;color:#94a3b8;">פורמט: ' + provider.format + ' · ' + provider.url + '</div>'
      + '</div>'
      + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#64748b;" onclick="event.stopPropagation()">'
      + '<input type="checkbox" ' + (isEnabled?'checked':'') + ' onchange="_appSettings.enabledProviders=_appSettings.enabledProviders||{};_appSettings.enabledProviders[\'' + provider.id + '\']=this.checked;_saveSettings();" style="width:15px;height:15px;accent-color:#10b981;">'
      + 'הוגדר ✓'
      + '</label>'
      + '<span style="color:#94a3b8;font-size:12px;transition:.2s;transform:' + (isOpen?'rotate(90deg)':'') + ';display:inline-block;">▶</span>'
      + '</div>';

    // Accordion body
    h += '<div id="' + accId + '" style="display:' + (isOpen?'block':'none') + ';padding:14px 18px;border-top:1px solid #e2e8f0;background:#fafafa;">';

    // Steps
    h += '<ol style="margin:0 0 12px 0;padding-right:18px;font-size:13px;color:#374151;line-height:1.9;">';
    provider.steps.forEach(function(step){
      h += '<li>' + step + '</li>';
    });
    h += '</ol>';

    // Quick links
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<a href="' + provider.url + '" target="_blank" style="background:#1a56db;color:white;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;text-decoration:none;">🌐 כניסה לאתר</a>';
    if(provider.phone){
      h += '<span style="background:#f1f5f9;color:#374151;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;">📞 ' + provider.phone + '</span>';
    }
    if(provider.email){
      h += '<a href="mailto:' + provider.email + '" style="background:#f1f5f9;color:#374151;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;text-decoration:none;">✉️ ' + provider.email + '</a>';
    }
    // Copy email template button
    h += '<button onclick="copyProviderEmail(\'' + provider.id + '\')" style="background:#f1f5f9;color:#374151;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">📋 העתק בקשה למייל</button>';
    h += '</div></div></div>';
  });

  h += '</div>';

  return h;
}

function toggleProviderAcc(id){
  window['_provOpen_'+id] = !window['_provOpen_'+id];
  window._mgmtSection = 'settings';
  renderManagementTab();
}

function handleFolderPick(input){
  if(input.files && input.files.length > 0){
    // Extract folder path from first file
    const fullPath = input.files[0].webkitRelativePath || '';
    const folder = fullPath.split('/')[0];
    const inp = document.getElementById('settings-folder-path');
    if(inp) inp.value = folder;
    _appSettings.folderPath = folder;
    _appSettings.fileCount = input.files.length;
    _saveSettings();
    renderManagementTab();
    showToast('✅ נמצאו ' + input.files.length + ' קבצים בתיקייה: ' + folder);
  }
}

function saveFolderPath(){
  const inp = document.getElementById('settings-folder-path');
  if(inp){ _appSettings.folderPath = inp.value.trim(); _saveSettings(); }
  showToast('✅ תיקייה נשמרה');
  renderManagementTab();
}

function saveWatchEmail(){
  const inp = document.getElementById('settings-email');
  if(inp){ _appSettings.watchEmail = inp.value.trim(); _saveSettings(); }
  showToast('✅ מייל נשמר');
  renderManagementTab();
}

function copyProviderEmail(providerId){
  const p = BANK_PROVIDERS.find(function(x){ return x.id===providerId; });
  if(!p) return;
  const email = _appSettings.watchEmail || 'your-finance@gmail.com';
  const msg = 'שלום,\n\nאבקש להפעיל שליחה אוטומטית של דף חשבון חודשי לכתובת המייל: ' + email + '\n\nבברכה';
  navigator.clipboard.writeText(msg).then(function(){
    showToast('📋 הועתק! הדבק במייל ל-' + p.name);
  }).catch(function(){
    prompt('העתק את הטקסט הבא:', msg);
  });
}

function showToast(msg){
  let t = document.getElementById('_toast');
  if(!t){
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;transition:opacity .3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.style.opacity='0'; }, 2500);
}

// ── Setup Wizard ───────────────────────────────────────────────
let _wizardStep = 1;

function openSetupWizard(){
  _wizardStep = 1;
  let modal = document.getElementById('setupWizard');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'setupWizard';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(modal);
  }
  renderWizardStep();
  modal.style.display = 'flex';
}

function closeSetupWizard(){
  const modal = document.getElementById('setupWizard');
  if(modal) modal.style.display = 'none';
  _appSettings.setupDone = true;
  _saveSettings();
  renderManagementTab();
}

function renderWizardStep(){
  const modal = document.getElementById('setupWizard');
  if(!modal) return;

  const steps = [
    { num:1, icon:'📂', title:'בחירת תיקייה' },
    { num:2, icon:'📧', title:'מייל ייעודי' },
    { num:3, icon:'🏦', title:'חיבור בנקים' },
  ];

  let content = '<div style="background:white;border-radius:18px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:28px;">';

  // Header + close
  content += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">'
    + '<div><div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;">אשף הגדרה ראשונית</div>'
    + '<div style="font-size:20px;font-weight:900;color:#111827;margin-top:4px;">' + steps[_wizardStep-1].icon + ' ' + steps[_wizardStep-1].title + '</div></div>'
    + '<button onclick="closeSetupWizard()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#9ca3af;" title="סגור">✕</button>'
    + '</div>';

  // Step dots
  content += '<div style="display:flex;gap:6px;margin-bottom:24px;">';
  steps.forEach(function(s){
    content += '<div style="flex:1;height:4px;border-radius:4px;background:' + (s.num<=_wizardStep?'#1a56db':'#e2e8f0') + ';"></div>';
  });
  content += '</div>';

  // Step content
  if(_wizardStep === 1){
    content += '<p style="font-size:14px;color:#374151;margin-bottom:20px;">בחר את התיקייה שבה שמורים (או יישמרו) קבצי Excel/PDF מהבנקים וחברות האשראי.</p>'
      + '<div style="border:2px dashed #d1d5db;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px;cursor:pointer;" onclick="document.getElementById(\'wizFolderInput\').click()">'
      + '<div style="font-size:36px;margin-bottom:8px;">📁</div>'
      + '<div style="font-weight:700;color:#374151;">לחץ לבחירת תיקייה</div>'
      + '<div style="font-size:12px;color:#9ca3af;margin-top:4px;">או גרור קבצים לכאן</div>'
      + '<input id="wizFolderInput" type="file" webkitdirectory style="display:none;" onchange="handleFolderPick(this)">'
      + '</div>'
      + '<div style="font-size:12px;color:#94a3b8;background:#f8fafc;border-radius:8px;padding:10px 12px;">'
      + '💡 מומלץ: צור תיקייה ייעודית כגון <strong>C:\\כספים\\דוחות</strong> ושמור שם את כל הדוחות. ניתן גם לדלג על שלב זה ולהגדיר מאוחר יותר.'
      + '</div>';
  }

  if(_wizardStep === 2){
    const savedEmail = _appSettings.watchEmail || '';
    content += '<p style="font-size:14px;color:#374151;margin-bottom:8px;">הזן כתובת מייל ייעודית שאליה ישלחו הבנקים את הדוחות החודשיים.</p>'
      + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#1e40af;">'
      + '🔒 <strong>מומלץ מאוד:</strong> פתח מייל Gmail חדש ייעודי (לא המייל הראשי שלך). '
      + 'לדוגמא: <strong>yishay.finance@gmail.com</strong> — כך הדוחות מבודדים ולא נערבבים עם מיילים אחרים.'
      + '</div>'
      + '<input id="wiz-email-input" type="email" value="' + savedEmail + '" placeholder="finance@gmail.com" '
      + 'style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:12px 14px;font-size:15px;margin-bottom:12px;">'
      + '<div style="font-size:12px;color:#94a3b8;background:#f8fafc;border-radius:8px;padding:10px 12px;">'
      + 'בשלב הבא (גרסת web) תחבר את המייל דרך Google OAuth בלבד — <strong>אין שמירה של סיסמה</strong>.'
      + '</div>';
  }

  if(_wizardStep === 3){
    content += '<p style="font-size:14px;color:#374151;margin-bottom:16px;">סמן את הגופים שיש לך אצלהם חשבון. לחץ על כל אחד לקבלת הוראות הפעלה.</p>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    BANK_PROVIDERS.forEach(function(p){
      const checked = (_appSettings.enabledProviders||{})[p.id];
      content += '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid ' + (checked?p.color:'#e2e8f0') + ';border-radius:10px;cursor:pointer;background:' + (checked?p.color+'18':'white') + ';">'
        + '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="_appSettings.enabledProviders=_appSettings.enabledProviders||{};_appSettings.enabledProviders[\'' + p.id + '\']=this.checked;_saveSettings();" style="width:16px;height:16px;accent-color:' + p.color + ';">'
        + '<span style="font-size:16px;">' + p.icon + '</span>'
        + '<span style="font-size:13px;font-weight:600;color:#374151;">' + p.name + '</span>'
        + '</label>';
    });
    content += '</div>'
      + '<div style="margin-top:14px;font-size:12px;color:#94a3b8;background:#f8fafc;border-radius:8px;padding:10px 12px;">'
      + 'לאחר סימון, עבור להגדרות ← לחץ על כל גוף לקבלת הוראות מפורטות לשליחת הדוח למייל.'
      + '</div>';
  }

  // Footer buttons
  content += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;">';
  content += '<button onclick="' + (_wizardStep>1 ? 'wizardPrev()' : 'closeSetupWizard()') + '" style="background:#f1f5f9;color:#374151;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">'
    + (_wizardStep>1 ? '← חזור' : 'דלג') + '</button>';
  content += '<div style="font-size:12px;color:#94a3b8;">שלב ' + _wizardStep + ' מתוך 3</div>';
  content += '<button onclick="wizardNext()" style="background:#1a56db;color:white;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;">'
    + (_wizardStep<3 ? 'הבא ←' : '✅ סיים') + '</button>';
  content += '</div></div>';

  modal.innerHTML = content;
}

function wizardNext(){
  if(_wizardStep === 2){
    const inp = document.getElementById('wiz-email-input');
    if(inp && inp.value) { _appSettings.watchEmail = inp.value.trim(); _saveSettings(); }
  }
  if(_wizardStep < 3){ _wizardStep++; renderWizardStep(); }
  else { closeSetupWizard(); showToast('✅ הגדרות נשמרו בהצלחה!'); }
}
function wizardPrev(){
  if(_wizardStep > 1){ _wizardStep--; renderWizardStep(); }
}

// Auto-open wizard on first visit
document.addEventListener('DOMContentLoaded', function(){
  if(!_appSettings.setupDone){
    setTimeout(openSetupWizard, 1200);
  }
});

document.addEventListener('DOMContentLoaded',()=>{
  initCatFilter();
  renderIncomeDisplay();
  renderAll();
  window._activeTab = 'transactions';
  _wfRenderBar('transactions');
  // Show empty state if no transactions loaded
  _checkShowNoData();
});

// ═══════════════════════════════════════
// EMPTY STATE + PROCESSING OVERLAY
// ═══════════════════════════════════════
function _checkShowNoData(){
  var hasData = TRANSACTIONS && TRANSACTIONS.length > 0;
  var overlay = document.getElementById('noDataOverlay');
  if(!overlay) return;
  // Only show if user is logged in and mainApp is visible
  var mainApp = document.getElementById('mainApp');
  var isLoggedIn = !!localStorage.getItem('authUser');
  if(!hasData && isLoggedIn && mainApp && mainApp.style.display !== 'none'){
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}
window._checkShowNoData = _checkShowNoData;

// Processing animation after folder is chosen
window.showProcessingScreen = function(onDone){
  var ov = document.getElementById('processingOverlay');
  if(!ov) { if(onDone) onDone(); return; }

  var steps = [
    {icon:'🔍', label:'סורק קבצים בתיקייה...'},
    {icon:'📄', label:'מאחד דפי בנק וכרטיסי אשראי...'},
    {icon:'🏷️', label:'מסווג עסקאות לפי קטגוריה...'},
    {icon:'📊', label:'מחשב תזרים חודשי...'},
    {icon:'💡', label:'מזהה חריגים ותובנות...'},
    {icon:'✅', label:'הדשבורד מוכן!'}
  ];

  var stepsEl = document.getElementById('procSteps');
  var barEl = document.getElementById('procBar');
  var titleEl = document.getElementById('procTitle');
  var subEl = document.getElementById('procSub');
  var iconEl = document.getElementById('procIcon');

  stepsEl.innerHTML = '';
  barEl.style.width = '0%';
  ov.style.display = 'flex';

  var i = 0;
  function nextStep(){
    if(i >= steps.length){
      setTimeout(function(){
        ov.style.display = 'none';
        var noData = document.getElementById('noDataOverlay');
        if(noData) noData.style.display = 'none';
        if(onDone) onDone();
      }, 600);
      return;
    }
    var s = steps[i];
    if(iconEl) iconEl.textContent = s.icon;
    if(titleEl) titleEl.textContent = s.label;

    // Add step row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b;opacity:0;transition:opacity 0.3s;';
    row.innerHTML = '<span style="color:#22c55e;font-size:14px;">✓</span>'
      + '<span style="color:#e2e8f0;font-size:13px;">'+s.label+'</span>';
    stepsEl.appendChild(row);
    setTimeout(function(){ row.style.opacity='1'; }, 50);

    var pct = Math.round(((i+1)/steps.length)*100);
    barEl.style.width = pct+'%';
    i++;
    setTimeout(nextStep, 700);
  }
  nextStep();
};

// Hook into folder save to show processing screen
;(function(){
  var _origSaveFolder = window.saveFolderPath;
  if(typeof _origSaveFolder === 'function'){
    window.saveFolderPath = function(){
      _origSaveFolder.apply(this, arguments);
      window.showProcessingScreen(function(){
        window._checkShowNoData && window._checkShowNoData();
      });
    };
  }
})();

// ═══════════════════════════════════════
// DRILL-DOWN MODAL
// ═══════════════════════════════════════
function _openDrillDown_orig(label, filterKey, filterVal, monthFilter){
  const data = TRANSACTIONS.filter(t => {
    if(t.type==='פנימי'||t.type==='השקעה') return false;
    if(filterKey==='cat' && getEffectiveCat(t)!==filterVal) return false;
    if(filterKey==='month' && t.month!==filterVal) return false;
    if(filterKey==='chargeType' && (t.chargeType||'משתנה')!==filterVal) return false;
    if(monthFilter && monthFilter!=='all' && filterKey!=='month' && t.month!==monthFilter) return false;
    return true;
  });
  data.sort((a,b)=>b.amount-a.amount);
  const total = data.reduce((s,t)=>s+t.amount,0);
  const avg   = data.length ? total/data.length : 0;

  const ctBadgeMap={'קבוע':'badge-fixed','חד פעמי':'badge-onetime','משתנה':'badge-variable'};
  const ctIconMap={'קבוע':'🔄','חד פעמי':'⚡','משתנה':'📊'};

  document.getElementById('ddTitle').innerHTML = `🔍 ${label}`;
  document.getElementById('ddSummary').innerHTML =
    `<strong>${data.length}</strong> עסקאות · סה"כ <strong>${fmt(total)}</strong> · ממוצע <strong>${fmt(avg)}</strong>`;

  const rows = data.map(t=>{
    const effCat = getEffectiveCat(t);
    const ct = t.chargeType||'משתנה';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--gray-500);white-space:nowrap;">${t.date}</td>
      <td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis;">${t.name}</td>
      <td><span class="badge ${CAT_BADGE[effCat]||'badge-gray'}">${effCat}</span></td>
      <td><span class="badge ${ctBadgeMap[ct]||'badge-gray'}">${ctIconMap[ct]} ${ct}</span></td>
      <td><span class="card-tag">${t.card}</span></td>
      <td style="font-weight:700;text-align:left;white-space:nowrap;">${fmt(t.amount)}</td>
    </tr>`;
  }).join('');

  document.getElementById('ddBody').innerHTML = `
    <div class="scroll-x">
      <table class="tbl">
        <thead><tr><th id="txDateHeader" title="חיוב = תאריך ביצוע (חויב בחודש שבחרת) | ביצוע = תאריך עסקה בפועל">תאריך ביצוע</th><th>שם בית עסק</th><th>קטגוריה</th><th>סוג</th><th>כרטיס</th><th>סכום</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.getElementById('drillDownModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeDrillDown(){
  document.getElementById('drillDownModal').classList.add('hidden');
  document.body.style.overflow='';
}

// Close on Escape key
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrillDown(); });

// ═══════════════════════════════════════
// EXPAND RAW TRANSACTION ROW
// ═══════════════════════════════════════
function toggleTxDetail(txId){
  const detailRow = document.getElementById('tx-detail-'+txId);
  const btn = document.querySelector('#tx-row-'+txId+' .tx-expand-btn');
  if(!detailRow) return;
  const isOpen = detailRow.style.display !== 'none';
  detailRow.style.display = isOpen ? 'none' : 'table-row';
  if(btn) btn.textContent = isOpen ? '▶' : '▼';
}

// ═══════════════════════════════════════
// CHARGE TYPE BREAKDOWN (overview panel)
// ═══════════════════════════════════════
function renderChargeTypeBreakdown(data){
  const ctMap = {'קבוע':0,'חד פעמי':0,'משתנה':0};
  data.forEach(t=>{ const ct=t.chargeType||'משתנה'; ctMap[ct]=(ctMap[ct]||0)+t.amount; });
  const total = Object.values(ctMap).reduce((s,v)=>s+v,0);
  const colors = {'קבוע':'#7c3aed','חד פעמי':'#ea580c','משתנה':'#16a34a'};
  const icons  = {'קבוע':'🔄','חד פעמי':'⚡','משתנה':'📊'};
  const maxV   = Math.max(...Object.values(ctMap));
  const el = document.getElementById('chargeTypeBreakdown');
  if(!el) return;
  el.innerHTML = Object.entries(ctMap).map(([ct,val])=>`
    <div class="ct-row" style="cursor:pointer;" onclick="openDrillDown('${icons[ct]} ${ct}','chargeType','${ct}','all')" title="לחץ לפירוט">
      <div class="ct-label">${icons[ct]} ${ct}</div>
      <div class="ct-bar-wrap"><div class="ct-bar" style="width:${maxV>0?(val/maxV*100).toFixed(0):0}%;background:${colors[ct]}">${val>3000?fmtShort(val):''}</div></div>
      <div class="ct-amount">${fmt(val)}</div>
      <div class="ct-pct">${total>0?(val/total*100).toFixed(0):0}%</div>
    </div>`).join('') +
    `<div style="margin-top:8px;font-size:11px;color:var(--gray-500);text-align:center;">לחץ על סוג לפירוט עסקאות</div>`;
}

function renderFixedVarChart(data){
  destroyChart('fixedVarChart');
  const months = MONTHS_ORDER.filter(m=>data.some(t=>t.month===m));
  const ctTypes = ['קבוע','חד פעמי','משתנה'];
  const colors  = {'קבוע':'rgba(124,58,237,.8)','חד פעמי':'rgba(234,88,12,.8)','משתנה':'rgba(22,163,74,.8)'};
  const datasets = ctTypes.map(ct=>({
    label: ct,
    data: months.map(m=>data.filter(t=>t.month===m&&(t.chargeType||'משתנה')===ct).reduce((s,t)=>s+t.amount,0)),
    backgroundColor: colors[ct],
    borderRadius: 4,
  }));
  allCharts['fixedVarChart'] = new Chart(document.getElementById('fixedVarChart').getContext('2d'),{
    type:'bar',
    data:{labels:months, datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:11}}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>'₪'+v.toLocaleString('he-IL')},grid:{color:'#f3f4f6'}}}}
  });
}


// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE MONTHLY P&L SAVINGS TAB
// ═══════════════════════════════════════════════════════════════
const CARD_LABELS = {
  '*0328':'דיסקונט *0328',
  '*2621':'דיסקונט *2621',
  '*7959':'מסטרקארד *7959',
  '*2039':'קורפוריט *2039 (שלומית)',
  '*5232':'גולד מסטרקארד *5232 (שלומית)',
  '*9781':'לאומי ביזנס *9781 (שלומית)',
};
const CARD_COLORS = {
  '*0328':'#3b82f6','*2621':'#6366f1','*7959':'#8b5cf6',
  '*2039':'#f59e0b','*5232':'#f97316','*9781':'#ef4444',
};
const CC_CARDS = ['*0328','*2621','*7959','*2039','*5232','*9781','*1974'];
const BANK_CARDS = ['בנק לאומי','בנק פיבי'];
const MONTH_COLORS = {'ינואר 2026':'#ef4444','פברואר 2026':'#f59e0b','מרץ 2026':'#10b981'};

function renderSavingsTab(){
  renderStatementBalances();
  const el = document.getElementById('savingsContent');
  if(!el) return;

  // ── Compute per-month P&L using CAT_TYPE classification ──────
  const months = typeof MONTHS_ORDER!=='undefined' ? MONTHS_ORDER : [];
  const rows = [];

  months.forEach(function(m){
    // Income: BANK_INCOME entries + any tx classified as income
    const incomeEntries = (typeof BANK_INCOME!=='undefined' ? BANK_INCOME : []).filter(function(bi){ return bi.month===m; });
    const incFromTx = TRANSACTIONS.filter(function(t){ return t.month===m && getCatType(getEffectiveCat(t))==='income'; });
    const totalIncome = incomeEntries.reduce(function(s,bi){ return s+bi.amount; },0)
                       + incFromTx.reduce(function(s,t){ return s+t.amount; },0);

    // Expenses: transactions where CAT_TYPE = 'expense'
    const expTx = TRANSACTIONS.filter(function(t){ return t.month===m && getCatType(getEffectiveCat(t))==='expense'; });
    const totalExp = expTx.reduce(function(s,t){ return s+t.amount; },0);

    // Investments: transactions where CAT_TYPE = 'investment'
    const invTx = TRANSACTIONS.filter(function(t){ return t.month===m && getCatType(getEffectiveCat(t))==='investment'; });
    const totalInv = invTx.reduce(function(s,t){ return s+t.amount; },0);

    rows.push({ month:m, income:totalIncome, expenses:totalExp, investments:totalInv,
      net: totalIncome - totalExp, netAfterInv: totalIncome - totalExp - totalInv });
  });

  // Total current balance from STATEMENT_BALANCES
  const balances = typeof STATEMENT_BALANCES!=='undefined' ? STATEMENT_BALANCES : [];
  const totalBalance = balances.reduce(function(s,b){ return s+( b.balance||0); },0);

  // Upcoming CC charges (next billing cycle estimate = current month CC spend)
  const latestMonth = months[months.length-1] || '';
  const upcomingCC = TRANSACTIONS.filter(function(t){
    return (typeof CC_CARDS!=='undefined'?CC_CARDS:[]).includes(t.card)
        && t.month===latestMonth && getCatType(getEffectiveCat(t))==='expense';
  }).reduce(function(s,t){ return s+t.amount; },0);

  // Average monthly expense (last 2 known months)
  const knownRows = rows.filter(function(r){ return r.expenses>0; });
  const avgMonthlyExp = knownRows.length>0 ? knownRows.reduce(function(s,r){ return s+r.expenses; },0)/knownRows.length : 0;

  el.innerHTML = _renderSavingsHTML(rows, totalBalance, upcomingCC, avgMonthlyExp, balances);
}

function _renderSavingsHTML(rows, totalBalance, upcomingCC, avgMonthlyExp, balances){
  let h = '';

  // ── 1. Bank accounts summary ─────────────────────────────────
  h += '<div style="margin-bottom:20px;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">';
  h += '<h2 style="font-size:17px;font-weight:800;margin:0;">🏦 יתרות עו"ש נוכחיות</h2>';
  h += '<span style="font-size:11px;color:#94a3b8;">ניתן לעדכן יתרה ישירות מדף החשבון</span>';
  h += '</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
  if(balances.length===0){
    h += '<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:20px 24px;color:#94a3b8;font-size:13px;">הגדר יתרות בנק בדף חשבון</div>';
  } else {
    balances.forEach(function(b){
      const bal = b.balance || 0;
      h += '<div style="background:'+(bal>0?'#f0fdf4':'#fef2f2')+';border:1.5px solid '+(bal>0?'#86efac':'#fca5a5')+';border-radius:14px;padding:16px 20px;min-width:180px;flex:1;">';
      h += '<div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">'+b.name+'</div>';
      h += '<div style="font-size:22px;font-weight:900;color:'+(bal>0?'#15803d':'#dc2626')+';">'+fmt(bal)+'</div>';
      if(b.statementDate) h += '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">נכון ל-'+b.statementDate+'</div>';
      h += '</div>';
    });
    // Total
    h += '<div style="background:linear-gradient(135deg,#1a56db,#3b82f6);border-radius:14px;padding:16px 20px;min-width:180px;flex:1;color:white;">';
    h += '<div style="font-size:12px;font-weight:700;opacity:.8;margin-bottom:6px;">סה"כ בחשבונות</div>';
    h += '<div style="font-size:22px;font-weight:900;">'+fmt(totalBalance)+'</div>';
    h += '</div>';
  }
  h += '</div></div>';

  // ── 2. Monthly P&L cards ──────────────────────────────────────
  h += '<div style="margin-bottom:20px;">';
  h += '<h2 style="font-size:17px;font-weight:800;margin-bottom:12px;">📊 הכנסות מול הוצאות — לפי חודש</h2>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">';

  rows.forEach(function(r){
    const surplus = r.income - r.expenses;
    const pct = r.income>0 ? Math.min(100, Math.round(r.expenses/r.income*100)) : 0;
    const barColor = pct>90?'#ef4444':pct>70?'#f59e0b':'#10b981';
    h += '<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,.06);">';
    h += '<div style="font-size:13px;font-weight:800;color:#1e293b;margin-bottom:12px;">📅 '+r.month+'</div>';
    // Bar: expenses / income
    h += '<div style="margin-bottom:10px;">';
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">';
    h += '<span>הוצאות <strong style="color:#dc2626;">'+fmt(r.expenses)+'</strong></span>';
    h += '<span><strong style="color:#15803d;">'+fmt(r.income)+'</strong> הכנסות</span>';
    h += '</div>';
    h += '<div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;">';
    h += '<div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:5px;transition:.3s;"></div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:#94a3b8;margin-top:3px;text-align:left;">'+pct+'% מההכנסה</div>';
    h += '</div>';
    // Stats row
    h += '<div style="display:flex;gap:8px;font-size:12px;">';
    h += '<div style="flex:1;background:'+(surplus>=0?'#f0fdf4':'#fef2f2')+';border-radius:8px;padding:6px 10px;">';
    h += '<div style="color:#64748b;font-size:10px;">מאזן</div>';
    h += '<div style="font-weight:800;color:'+(surplus>=0?'#15803d':'#dc2626')+'">'+(surplus>=0?'+':'')+fmt(surplus)+'</div>';
    h += '</div>';
    if(r.investments>0){
      h += '<div style="flex:1;background:#ede9fe;border-radius:8px;padding:6px 10px;">';
      h += '<div style="color:#64748b;font-size:10px;">השקעות</div>';
      h += '<div style="font-weight:800;color:#7c3aed;">'+fmt(r.investments)+'</div>';
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';
  });

  h += '</div></div>';

  // ── 3. Smart cash recommendation ─────────────────────────────
  if(totalBalance > 0 && avgMonthlyExp > 0){
    // CC billing in ~10-12 days (10th of month typical)
    const today = new Date();
    const nextBillingDay = 10;
    const daysUntilBilling = ((nextBillingDay - today.getDate()) + 30) % 30 || 30;
    const isAfterBilling = today.getDate() > nextBillingDay;

    // Safety buffer: 2 months expenses + upcoming CC (if pre-billing)
    const bufferNeeded = Math.round(avgMonthlyExp * 2 + (isAfterBilling ? 0 : upcomingCC));
    const availableToTransfer = Math.max(0, totalBalance - bufferNeeded);
    const depositSuggestion = Math.floor(availableToTransfer / 5000) * 5000; // round to 5K

    h += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:16px;padding:20px 24px;color:white;margin-bottom:20px;">';
    h += '<div style="font-size:15px;font-weight:800;margin-bottom:4px;">💡 המלצה — מה לעשות עם הכסף בעו"ש</div>';
    h += '<div style="font-size:12px;opacity:.7;margin-bottom:16px;">';
    h += isAfterBilling
      ? '✅ אחרי מועד חיוב האשראי (' + nextBillingDay + ' לחודש) — מועד טוב להעברה'
      : '⚠️ ' + daysUntilBilling + ' ימים לפני חיוב האשראי (' + nextBillingDay + ' לחודש) — שמור חיץ';
    h += '</div>';

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px;">';
    h += '<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:12px;">';
    h += '<div style="font-size:10px;opacity:.7;">יתרה נוכחית</div>';
    h += '<div style="font-size:18px;font-weight:800;">'+fmt(totalBalance)+'</div>';
    h += '</div>';
    h += '<div style="background:rgba(239,68,68,.25);border-radius:10px;padding:12px;">';
    h += '<div style="font-size:10px;opacity:.7;">חיץ בטחון (השאר בעו"ש)</div>';
    h += '<div style="font-size:18px;font-weight:800;color:#fca5a5;">'+fmt(bufferNeeded)+'</div>';
    h += '<div style="font-size:10px;opacity:.6;">הוצאות x2 חודשים'+(isAfterBilling?'':'+ אשראי קרוב')+'</div>';
    h += '</div>';
    h += '<div style="background:rgba(16,185,129,.25);border-radius:10px;padding:12px;">';
    h += '<div style="font-size:10px;opacity:.7;">זמין להעברה</div>';
    h += '<div style="font-size:18px;font-weight:800;color:#6ee7b7;">'+fmt(availableToTransfer)+'</div>';
    h += '</div>';
    if(depositSuggestion>0){
      h += '<div style="background:rgba(99,102,241,.35);border-radius:10px;padding:12px;">';
      h += '<div style="font-size:10px;opacity:.7;">הצעה — העבר לפיקדון</div>';
      h += '<div style="font-size:18px;font-weight:800;color:#c7d2fe;">'+fmt(depositSuggestion)+'</div>';
      h += '<div style="font-size:10px;opacity:.6;">מעוגל ל-5,000</div>';
      h += '</div>';
    }
    h += '</div>';

    if(depositSuggestion>0){
      h += '<div style="background:rgba(255,255,255,.08);border-radius:10px;padding:12px 16px;font-size:12px;line-height:1.7;">';
      h += '📌 <strong>פעולה מומלצת:</strong> העבר <strong style="color:#c7d2fe;">'+fmt(depositSuggestion)+'</strong> ';
      h += isAfterBilling
        ? 'לפיקדון קצר (1-3 חודשים) — מצב אידיאלי, האשראי כבר חויב.'
        : 'לפיקדון רק <strong>לאחר</strong> חיוב האשראי ב-'+nextBillingDay+' לחודש.';
      h += ' יתרת <strong>'+fmt(bufferNeeded)+'</strong> נשארת בעו"ש כחיץ בטחון ל-2 חודשי הוצאות.';
      h += '</div>';
    } else {
      h += '<div style="background:rgba(239,68,68,.15);border-radius:10px;padding:12px 16px;font-size:12px;">';
      h += '⚠️ היתרה הנוכחית קרובה לחיץ הבטחון המומלץ — לא מומלץ להעביר כרגע. ';
      h += 'כדאי לוודא שיש לפחות <strong>'+fmt(bufferNeeded)+'</strong> בעו"ש לפני כל השקעה.';
      h += '</div>';
    }

    h += '</div>';
  } else {
    h += '<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:20px 24px;text-align:center;color:#94a3b8;font-size:13px;margin-bottom:20px;">';
    h += '💡 לקבל המלצת השקעה חכמה — עדכן יתרות עו"ש בדף החשבון';
    h += '</div>';
  }

  // ── 4. Totals summary ─────────────────────────────────────────
  const totInc = rows.reduce(function(s,r){ return s+r.income; },0);
  const totExp = rows.reduce(function(s,r){ return s+r.expenses; },0);
  const totInv = rows.reduce(function(s,r){ return s+r.investments; },0);
  const totNet = totInc - totExp;

  h += '<div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:18px 20px;box-shadow:0 1px 4px rgba(0,0,0,.06);">';
  h += '<h3 style="font-size:14px;font-weight:800;margin-bottom:12px;">📋 סיכום כולל — כל התקופה</h3>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
  const sumItems = [
    {label:'סה"כ הכנסות',val:totInc,color:'#15803d',bg:'#f0fdf4'},
    {label:'סה"כ הוצאות',val:totExp,color:'#dc2626',bg:'#fef2f2'},
    {label:'סה"כ השקעות',val:totInv,color:'#7c3aed',bg:'#ede9fe'},
    {label:'מאזן תקופה',val:totNet,color:totNet>=0?'#15803d':'#dc2626',bg:totNet>=0?'#f0fdf4':'#fef2f2'},
  ];
  sumItems.forEach(function(s){
    h += '<div style="flex:1;min-width:140px;background:'+s.bg+';border-radius:10px;padding:12px 16px;">';
    h += '<div style="font-size:11px;color:#64748b;margin-bottom:4px;">'+s.label+'</div>';
    h += '<div style="font-size:16px;font-weight:800;color:'+s.color+';">'+(s.val>=0&&s.label.includes('מאזן')?'+':'')+fmt(s.val)+'</div>';
    h += '</div>';
  });
  h += '</div></div>';

  return h;
}



// ═══════════════════════════════════════
// MISSING FUNCTIONS — RESTORED
// ═══════════════════════════════════════

// ── State vars ───────────────────────────────────────────────
let _pendingBulkEdit = null;
let _warnFilterActive = false;
let insRenewalDates = JSON.parse(localStorage.getItem('insRenewalDates')||'{}');
const PROJECT_COLORS = ['#1a56db','#10b981','#f59e0b','#8b5cf6','#ef4444','#0891b2','#ec4899','#64748b'];

function showBulkToast(msg){
  document.getElementById('bulkToastMsg').innerHTML = msg;
  document.getElementById('bulkToast').classList.remove('hidden');
}

// ── toggleApprove: shared between tx-table and statement tab ──────────────────
function toggleApprove(txId){
  if(approvedTxs.has(txId)) approvedTxs.delete(txId);
  else approvedTxs.add(txId);
  // Refresh all approve buttons for this txId (both tabs)
  document.querySelectorAll('.tx-approve-btn').forEach(function(btn){
    const oc = btn.getAttribute('onclick')||'';
    if(oc.includes('('+txId+')')||oc.includes('('+txId+',')){
      const approved = approvedTxs.has(txId);
      btn.className = 'tx-approve-btn'+(approved?' approved':'');
      btn.title = approved?'מאושר — לחץ לביטול':'סמן כמאושר';
      btn.textContent = approved?'✓':'';
      const row = btn.closest('tr')||btn.closest('.stmt-row');
      if(row){ row.style.opacity = approved?'0.78':''; }
    }
  });
  _wfUpdateProgress();
}

// ── Inline edit for transactions ─────────────────────────────────────────────
function toggleInlineEdit(txId, evt){
  if(evt) evt.stopPropagation();
  // Build panel if not yet in DOM
  const existingPanel = document.getElementById('inline-edit-'+txId);
  const cell = document.getElementById('cat-cell-'+txId);
  if(!existingPanel && cell){
    const tx = TRANSACTIONS.find(t=>t.id===txId);
    if(!tx) return;
    const effCat = getEffectiveCat(tx);
    const ct = tx.chargeType||'משתנה';
    const catOpts = ALL_CATS.map(function(c){ return '<option value="'+c+'"'+(c===effCat?' selected':'')+'>'+c+'</option>'; }).join('');
    const ctOpts = ['קבוע','חד פעמי','משתנה'].map(function(v){ return '<option value="'+v+'"'+(v===ct?' selected':'')+'>'+v+'</option>'; }).join('');
    const panel = document.createElement('div');
    panel.id = 'inline-edit-'+txId;
    panel.className = 'inline-edit-panel';
    panel.style.display = 'flex';
    panel.innerHTML = '<select id="ie-cat-'+txId+'" style="flex:1;min-width:140px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;">'+catOpts+'</select>'
      +'<select id="ie-ct-'+txId+'" style="font-size:12px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;">'+ctOpts+'</select>'
      +'<button onclick="applyInlineEditTx('+txId+')" style="background:#1a56db;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">✓</button>'
      +'<button onclick="this.closest(\'.inline-edit-panel\').style.display=\'none\'" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">✕</button>';
    // Append to the cat-cell's wrap
    const wrap = cell.querySelector('.inline-edit-wrap');
    if(wrap) wrap.appendChild(panel);
    else cell.appendChild(panel);
    return;
  }
  if(existingPanel){
    const isVisible = existingPanel.style.display !== 'none';
    document.querySelectorAll('.inline-edit-panel').forEach(p=>{ if(p.id!=='inline-edit-'+txId) p.style.display='none'; });
    existingPanel.style.display = isVisible?'none':'flex';
  }
}

function applyInlineEditTx(txId){
  const catSel = document.getElementById('ie-cat-'+txId);
  const ctSel  = document.getElementById('ie-ct-'+txId);
  if(!catSel||!ctSel) return;
  const newCat = catSel.value;
  const newCT  = ctSel.value;
  const tx = TRANSACTIONS.find(t=>t.id===txId);
  if(!tx) return;
  const oldCat = getEffectiveCat(tx);
  const catChanged = newCat!==oldCat;
  const ctChanged  = newCT!==(tx.chargeType||'משתנה');
  if(catChanged) catOverrides[txId]=newCat;
  if(ctChanged)  tx.chargeType=newCT;
  const panel=document.getElementById('inline-edit-'+txId);
  if(panel) panel.style.display='none';
  // Offer bulk edit
  const sameNameTxs=TRANSACTIONS.filter(t=>t.id!==txId&&t.name===tx.name);
  if(sameNameTxs.length>0){
    if(catChanged){
      _pendingBulkEdit={type:'cat',txId,merchantName:tx.name,newVal:newCat,targets:sameNameTxs};
      showBulkToast('יש <strong>'+sameNameTxs.length+'</strong> חיובים נוספים מ "<strong>'+tx.name+'</strong>". לשנות את כולם ל <strong>'+newCat+'</strong>?');
    } else if(ctChanged){
      _pendingBulkEdit={type:'chargeType',txId,merchantName:tx.name,newVal:newCT,targets:sameNameTxs};
      showBulkToast('יש <strong>'+sameNameTxs.length+'</strong> חיובים נוספים מ "<strong>'+tx.name+'</strong>". לשנות סוג ל <strong>'+newCT+'</strong>?');
    }
  }
  renderAll();
}

function confirmBulkEdit(){
  if(!_pendingBulkEdit) return;
  const {type,targets,newVal}=_pendingBulkEdit;
  targets.forEach(t=>{
    if(type==='cat') catOverrides[t.id]=newVal;
    else if(type==='chargeType') t.chargeType=newVal;
  });
  _pendingBulkEdit=null; dismissBulkToast(); renderAll();
}
function dismissBulkToast(){
  _pendingBulkEdit=null;
  document.getElementById('bulkToast').classList.add('hidden');
}

function cycleChargeType(txId){
  const tx=TRANSACTIONS.find(t=>t.id===txId);
  if(!tx) return;
  const types=['קבוע','חד פעמי','משתנה'];
  tx.chargeType=types[(types.indexOf(tx.chargeType||'משתנה')+1)%types.length];
  renderAll();
}

// ── Warn filter ───────────────────────────────────────────────────────────────
function toggleWarnFilter(){
  _warnFilterActive=!_warnFilterActive;
  const btn=document.getElementById('warnFilterBtn');
  if(btn){ btn.style.background=_warnFilterActive?'#f59e0b':'#fff7ed'; btn.style.color=_warnFilterActive?'#fff':'#92400e'; }
  txPage=1; renderTxTable();
}

// ── Projects ──────────────────────────────────────────────────────────────────
function renderProjectCell(txId){
  const pid=txProjectMap[txId];
  const proj=pid!==undefined?PROJECTS.find(p=>p.id===pid):null;
  if(proj) return '<span class="proj-badge" style="background:'+proj.color+'22;color:'+proj.color+';border-color:'+proj.color+'44;" onclick="openProjectPicker('+txId+',event)" title="לחץ לשינוי">'+proj.icon+' '+proj.name+'</span>';
  if(!PROJECTS.length) return '';
  return '<button class="proj-assign-btn" onclick="openProjectPicker('+txId+',event)">+ פרוייקט</button>';
}

function openProjectPicker(txId,evt){
  if(evt) evt.stopPropagation();
  document.querySelectorAll('.proj-picker').forEach(p=>p.remove());
  const picker=document.createElement('div');
  picker.className='proj-picker';
  let inner='';
  PROJECTS.forEach(function(p){
    inner+='<div class="proj-picker-item" onclick="assignTxProject('+txId+','+p.id+')"><span style="width:10px;height:10px;border-radius:50%;background:'+p.color+';display:inline-block;margin-left:6px;"></span>'+p.icon+' '+p.name+'</div>';
  });
  inner+='<div class="proj-picker-none" onclick="assignTxProject('+txId+',null)">✕ הסר שיוך</div>';
  picker.innerHTML=inner;
  const cell=document.getElementById('proj-cell-'+txId);
  if(cell) cell.appendChild(picker);
  setTimeout(function(){ document.addEventListener('click',function h(){ picker.remove(); document.removeEventListener('click',h); }); },10);
}

function assignTxProject(txId,projectId){
  document.querySelectorAll('.proj-picker').forEach(p=>p.remove());
  if(projectId===null||projectId==='null') delete txProjectMap[txId];
  else txProjectMap[txId]=parseInt(projectId);
  const cell=document.getElementById('proj-cell-'+txId);
  if(cell){ cell.innerHTML=renderProjectCell(txId); cell.style.position='relative'; }
  const mgmt=document.getElementById('tab-management');
  if(mgmt&&mgmt.classList.contains('active')) renderManagementTab();
}

// ── Project CRUD ──────────────────────────────────────────────────────────────
let _selectedNewProjColor = PROJECT_COLORS[0];
function selectNewProjColor(c){
  _selectedNewProjColor=c;
  document.querySelectorAll('.proj-color-btn').forEach(btn=>btn.classList.remove('selected'));
  document.querySelectorAll('.proj-color-btn[title="'+c+'"]').forEach(btn=>btn.classList.add('selected'));
}
function addProjectFromForm(){
  const nameEl=document.getElementById('new-proj-name');
  const iconEl=document.getElementById('new-proj-icon');
  const name=(nameEl?.value||'').trim();
  if(!name){ nameEl?.focus(); return; }
  const icon=(iconEl?.value||'').trim()||'📁';
  const color=_selectedNewProjColor||PROJECT_COLORS[PROJECTS.length%PROJECT_COLORS.length];
  PROJECTS.push({id:_nextProjectId++,name,icon,color});
  if(nameEl) nameEl.value='';
  if(iconEl) iconEl.value='';
  renderManagementTab();
}
function deleteProject(pid){
  if(!confirm('למחוק את הפרוייקט?')) return;
  PROJECTS=PROJECTS.filter(p=>p.id!==pid);
  Object.keys(txProjectMap).forEach(k=>{ if(txProjectMap[k]===pid) delete txProjectMap[k]; });
  renderManagementTab(); renderTxTable();
}
function viewProjectTransactions(pid){
  const proj=PROJECTS.find(p=>p.id===pid);
  if(!proj) return;
  const txIds=Object.keys(txProjectMap).filter(k=>txProjectMap[k]===pid);
  const txs=txIds.map(k=>TRANSACTIONS.find(t=>String(t.id)===k)).filter(Boolean);
  const total=txs.reduce((s,t)=>s+t.amount,0);
  const rows=txs.sort((a,b)=>b.amount-a.amount).map(t=>'<tr><td style="font-size:11px;color:#64748b;">'+t.date+'</td><td>'+t.name+'</td><td><span class="badge '+(CAT_BADGE[getEffectiveCat(t)]||'badge-gray')+'">'+getEffectiveCat(t)+'</span></td><td style="font-weight:700;text-align:left;">'+fmt(t.amount)+'</td></tr>').join('');
  document.getElementById('ddTitle').innerHTML=proj.icon+' '+proj.name;
  document.getElementById('ddSummary').innerHTML='<strong>'+txs.length+'</strong> עסקאות · סה"כ <strong>'+fmt(total)+'</strong>';
  document.getElementById('ddBody').innerHTML='<div class="scroll-x"><table class="tbl"><thead><tr><th>תאריך</th><th>שם</th><th>קטגוריה</th><th>סכום</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  document.getElementById('drillDownModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

// ── Drill-down modal ──────────────────────────────────────────────────────────
function openDrillDown(label,filterKey,filterVal,monthFilter){
  const data=TRANSACTIONS.filter(t=>{
    if(t.type==='פנימי'||t.type==='השקעה') return false;
    if(filterKey==='cat'&&getEffectiveCat(t)!==filterVal) return false;
    if(filterKey==='month'&&t.month!==filterVal) return false;
    if(monthFilter&&monthFilter!=='all'&&filterKey!=='month'&&t.month!==monthFilter) return false;
    return true;
  });
  data.sort((a,b)=>b.amount-a.amount);
  const total=data.reduce((s,t)=>s+t.amount,0);
  const avg=data.length?total/data.length:0;
  const ctB={'קבוע':'badge-fixed','חד פעמי':'badge-onetime','משתנה':'badge-variable'};
  const ctI={'קבוע':'🔄','חד פעמי':'⚡','משתנה':'📊'};
  document.getElementById('ddTitle').innerHTML='🔍 '+label;
  document.getElementById('ddSummary').innerHTML='<strong>'+data.length+'</strong> עסקאות · סה"כ <strong>'+fmt(total)+'</strong> · ממוצע <strong>'+fmt(avg)+'</strong>';
  const rows=data.map(t=>{
    const ec=getEffectiveCat(t);const ct=t.chargeType||'משתנה';
    return '<tr><td style="font-family:monospace;font-size:11px;white-space:nowrap;">'+t.date+'</td><td style="font-weight:600;">'+t.name+'</td><td><span class="badge '+(CAT_BADGE[ec]||'badge-gray')+'">'+ec+'</span></td><td><span class="badge '+(ctB[ct]||'badge-gray')+'">'+ctI[ct]+' '+ct+'</span></td><td><span class="card-tag">'+t.card+'</span></td><td style="font-weight:700;text-align:left;white-space:nowrap;">'+fmt(t.amount)+'</td></tr>';
  }).join('');
  document.getElementById('ddBody').innerHTML='<div class="scroll-x"><table class="tbl"><thead><tr><th>תאריך</th><th>שם</th><th>קטגוריה</th><th>סוג</th><th>כרטיס</th><th>סכום</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  document.getElementById('drillDownModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

// ── Build issue map ───────────────────────────────────────────────────────────
function buildTxIssueMap(){
  const map={};
  const allIssues=(typeof detectIssues==='function'?detectIssues():[]).concat(typeof MANUAL_REVIEW_ITEMS!=='undefined'?MANUAL_REVIEW_ITEMS:[]);
  allIssues.forEach(function(iss){
    if(dismissedIssues&&dismissedIssues.has(iss.key)) return;
    const txRef=iss.tx;
    if(txRef&&txRef.id!==undefined){
      if(!map[txRef.id]) map[txRef.id]=[];
      map[txRef.id].push({key:iss.key,title:iss.title||iss.key,reason:iss.reason||'',severity:iss.severity||'warning'});
    }
    if(iss.txs&&Array.isArray(iss.txs)) iss.txs.forEach(function(tx){
      if(!map[tx.id]) map[tx.id]=[];
      map[tx.id].push({key:iss.key,title:iss.title||iss.key,reason:iss.reason||'',severity:iss.severity||'warning'});
    });
  });
  return map;
}

// ── Export functions ──────────────────────────────────────────────────────────
function exportCSV(){
  const header=['ID','תאריך','שם מקורי','קטגוריה','סוג חיוב','כרטיס/בנק','חודש','סכום'];
  const rows=TRANSACTIONS.map(t=>[t.id,t.date,'"'+(t.name||'').replace(/"/g,'""')+'"','"'+(getEffectiveCat(t)||'').replace(/"/g,'""')+'"',t.chargeType||'משתנה',t.card||'',t.month||'',t.amount].join(','));
  const csv='\uFEFF'+header.join(',')+'\n'+rows.join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download='עסקאות.csv'; a.click();
}
function exportJSON(){
  const data={exportDate:new Date().toISOString().slice(0,10),transactions:TRANSACTIONS.map(t=>({...t,cat:getEffectiveCat(t)})),income:BANK_INCOME};
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); a.download='נתונים.json'; a.click();
}

function exportXLSX_transactions(){
  if(typeof XLSX==='undefined'){alert('XLSX library not loaded');return;}
  const data=TRANSACTIONS.map(t=>({'תאריך':t.date,'שם':t.name,'קטגוריה':getEffectiveCat(t),'סוג חיוב':t.chargeType||'משתנה','כרטיס':t.card,'חודש':t.month,'סכום':t.amount,'מאושר':approvedTxs.has(t.id)?'כן':'לא'}));
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'עסקאות');
  XLSX.writeFile(wb,'עסקאות.xlsx');
}
function exportXLSX_merchants(){
  if(typeof XLSX==='undefined'){alert('XLSX library not loaded');return;}
  const byMerch={};
  TRANSACTIONS.filter(t=>t.type!=='פנימי').forEach(t=>{
    const k=t.name; if(!byMerch[k]) byMerch[k]={שם:k,קטגוריה:getEffectiveCat(t),עסקאות:0,סכום:0};
    byMerch[k].עסקאות++; byMerch[k].סכום+=t.amount;
  });
  const data=Object.values(byMerch).sort((a,b)=>b.סכום-a.סכום);
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'בתי עסק');
  XLSX.writeFile(wb,'בתי_עסק.xlsx');
}
function exportXLSX_categories(){
  if(typeof XLSX==='undefined'){alert('XLSX library not loaded');return;}
  const byCat={};
  TRANSACTIONS.filter(t=>t.type!=='פנימי').forEach(t=>{
    const c=getEffectiveCat(t); if(!byCat[c]) byCat[c]={קטגוריה:c,סוג:getCatType(c),עסקאות:0,סכום:0};
    byCat[c].עסקאות++; byCat[c].סכום+=t.amount;
  });
  const data=Object.values(byCat).sort((a,b)=>b.סכום-a.סכום);
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'קטגוריות');
  XLSX.writeFile(wb,'קטגוריות.xlsx');
}
function exportXLSX_statement(){
  if(typeof XLSX==='undefined'){alert('XLSX library not loaded');return;}
  const data=TRANSACTIONS.map(t=>({'תאריך':t.date,'שם':t.name,'קטגוריה':getEffectiveCat(t),'כרטיס':t.card,'חודש':t.month,'סכום':t.amount}));
  const incData=BANK_INCOME.map(b=>({'תאריך':b.date,'שם':b.name,'קטגוריה':incCatOverrides[b.id]||b.cat||'הכנסה','חשבון':b.src,'חודש':b.month,'סכום':b.amount}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'חיובים');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(incData),'הכנסות');
  XLSX.writeFile(wb,'דף_חשבון.xlsx');
}

// ── Statement balance save ────────────────────────────────────────────────────
function saveStatementBalance(idx){
  const balEl=document.getElementById('bal-inp-'+idx);
  const dateEl=document.getElementById('bal-date-'+idx);
  if(!balEl) return;
  const newBal=parseFloat(balEl.value)||0;
  const newDate=dateEl?dateEl.value:'';
  if(STATEMENT_BALANCES[idx]){
    STATEMENT_BALANCES[idx].balance=newBal;
    if(newDate) STATEMENT_BALANCES[idx].statementDate=newDate;
  }
  renderStatementBalances();
  if(document.getElementById('tab-savings')?.classList.contains('active')) renderSavingsTab();
}

// ── System reset ──────────────────────────────────────────────────────────────
function confirmSystemReset(){
  if(!confirm('⚠️ איפוס מלא של כל ההתאמות האישיות (קטגוריות, פרוייקטים, אישורים)?\n\nהנתונים המקוריים לא יושפעו.')) return;
  catOverrides={}; incCatOverrides={}; txProjectMap={}; PROJECTS=[]; _nextProjectId=1;
  approvedTxs=new Set(); disputeItems=[]; dismissedIssues=new Set();
  localStorage.removeItem('catTypeOverrides'); catTypeOverrides={};
  localStorage.removeItem('insRenewalDates'); insRenewalDates={};
  renderAll();
  alert('✅ איפוס הושלם');
}

// ── Insurance helpers ─────────────────────────────────────────────────────────
function insType(name){
  const n=(name||'').toLowerCase();
  if(n.includes('חיים')||n.includes('ריסק')) return {label:'חיים',icon:'❤️'};
  if(n.includes('בריאות')||n.includes('רפואי')||n.includes('מחלה')) return {label:'בריאות',icon:'🏥'};
  if(n.includes('רכב')||n.includes('מכונית')) return {label:'רכב',icon:'🚗'};
  if(n.includes('דירה')||n.includes('בית')||n.includes('מבנה')) return {label:'דירה/בית',icon:'🏠'};
  if(n.includes('נסיעות')||n.includes('טיול')) return {label:'נסיעות',icon:'✈️'};
  return {label:'אחר',icon:'🛡️'};
}
function updateInsRenewal(key,val){
  insRenewalDates[key]=val;
  localStorage.setItem('insRenewalDates',JSON.stringify(insRenewalDates));
}
function escalateInsuranceDispute(name, avgAmt){
  const issueKey='ins-price-'+name.replace(/\s/g,'-');
  if(disputeItems.find(d=>d.issueKey===issueKey)){ switchTab('disputes'); return; }
  const bankEntry=STATEMENT_BALANCES[0]||{};
  disputeItems.push({issueKey,issue:{icon:'🛡️',title:'בדיקת מחיר ביטוח: '+name,reason:'ממוצע ₪'+avgAmt+'/חודש. כדאי לבדוק הצעות מחיר חלופיות.',severity:'warning',tx:null},message:'בקשה לבדיקת תנאי הביטוח ומחיר חלופי עבור: '+name,merchantEmail:'',thread:[],status:'פתוח'});
  switchTab('disputes');
}

// ── Statement tab ─────────────────────────────────────────────────────────────
function clearStmtFilter(){
  const f=document.getElementById('stmt-from'); if(f) f.value='';
  const t=document.getElementById('stmt-to'); if(t) t.value='';
  const c=document.getElementById('stmt-card'); if(c) c.value='all';
  renderStatementTab();
}
function toggleStmtAcc(id){
  const body=document.getElementById(id);
  const toggle=document.getElementById(id+'-toggle');
  if(!body) return;
  const isOpen=body.style.display!=='none'&&body.style.display!=='';
  body.style.display=isOpen?'none':'block';
  if(toggle) toggle.textContent=isOpen?'▶':'▼';
}

// ── Income category editing ───────────────────────────────────────────────────
function toggleIncomeEdit(incId){
  document.querySelectorAll('.inline-edit-panel').forEach(p=>p.remove());
  const cell=document.getElementById('cat-cell-inc-'+incId);
  if(!cell) return;
  const bi=BANK_INCOME.find(b=>b.id===incId);
  const curCat=bi?(incCatOverrides[incId]||bi.cat||'הכנסה'):'הכנסה';
  const incCats=['הכנסה','הכנסה מביטוח לאומי','הכנסה מפיקדון','הכנסה מהשקעות','הכנסה אחרת'];
  const allCatsForInc=[...new Set([...incCats,...ALL_CATS])];
  const opts=allCatsForInc.map(c=>'<option value="'+c+'"'+(c===curCat?' selected':'')+'>'+c+'</option>').join('');
  const panel=document.createElement('div');
  panel.className='inline-edit-panel';
  panel.style.cssText='display:flex;gap:4px;padding:4px;flex-wrap:wrap;';
  panel.innerHTML='<select id="ie-incat-'+incId+'" style="flex:1;min-width:140px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;">'+opts+'</select>'
    +'<button onclick="applyIncomeEdit(\''+incId+'\')" style="background:#1a56db;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">✓</button>'
    +'<button onclick="this.closest(\'.inline-edit-panel\').remove()" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">✕</button>';
  cell.style.position='relative'; cell.appendChild(panel);
}
function applyIncomeEdit(incId){
  const sel=document.getElementById('ie-incat-'+incId);
  if(!sel) return;
  incCatOverrides[incId]=sel.value;
  renderStatementTab();
}

// ── Full statement tab render ─────────────────────────────────────────────────
function renderStatementTab(){
  const el=document.getElementById('statementContent');
  if(!el) return;

  const fromVal=(document.getElementById('stmt-from')||{}).value||'';
  const toVal=(document.getElementById('stmt-to')||{}).value||'';
  const cardVal=(document.getElementById('stmt-card')||{}).value||'all';

  function inRange(dateStr){
    if(!fromVal&&!toVal) return true;
    const p=dateStr.split('-'); if(p.length!==3) return true;
    const d=new Date(p[2],parseInt(p[1])-1,parseInt(p[0]));
    if(fromVal&&d<new Date(fromVal)) return false;
    if(toVal&&d>new Date(toVal)) return false;
    return true;
  }

  const allTxs=TRANSACTIONS.filter(t=>t.type!=='פנימי'&&(cardVal==='all'||t.card===cardVal)&&inRange(t.date));
  const allBankInc=BANK_INCOME.filter(bi=>(cardVal==='all'||bi.src===cardVal)&&inRange(bi.date));
  const allCards=[...new Set(TRANSACTIONS.map(t=>t.card))].sort();

  // KPIs
  const totalExp=allTxs.reduce((s,t)=>s+t.amount,0);
  const totalInc=allBankInc.reduce((s,b)=>s+b.amount,0);
  const approvedCount=allTxs.filter(t=>approvedTxs.has(t.id)).length;
  const escalatedCount=allTxs.filter(t=>disputeItems.find(d=>d.issue&&d.issue.tx&&d.issue.tx.id===t.id)).length;

  let html='';

  // Filter bar
  html+='<div class="stmt-date-filter">'
    +'<label style="font-size:13px;font-weight:600;">📅 מ:</label>'
    +'<input type="date" id="stmt-from" value="'+fromVal+'" onchange="renderStatementTab()" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;font-size:13px;">'
    +'<label style="font-size:13px;font-weight:600;">עד:</label>'
    +'<input type="date" id="stmt-to" value="'+toVal+'" onchange="renderStatementTab()" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;font-size:13px;">'
    +'<select id="stmt-card" onchange="renderStatementTab()" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;font-size:13px;">'
    +'<option value="all">כל הכרטיסים / חשבונות</option>'
    +allCards.map(c=>'<option value="'+c+'"'+(c===cardVal?' selected':'')+'>'+c+'</option>').join('')
    +'</select>'
    +'<button onclick="clearStmtFilter()" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">🔄 איפוס</button>'
    +'<button onclick="exportXLSX_statement()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">📊 Excel</button>'
    +'</div>';

  // KPI row
  html+='<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">'
    +'<div class="kpi-card" style="flex:1;min-width:110px;"><div class="kpi-label">⬇ הוצאות</div><div class="kpi-value" style="color:var(--danger);">'+fmtShort(totalExp)+'</div></div>'
    +'<div class="kpi-card" style="flex:1;min-width:110px;"><div class="kpi-label">⬆ הכנסות</div><div class="kpi-value" style="color:#10b981;">'+fmtShort(totalInc)+'</div></div>'
    +'<div class="kpi-card" style="flex:1;min-width:110px;"><div class="kpi-label">✓ אושרו</div><div class="kpi-value">'+approvedCount+'/'+allTxs.length+'</div></div>'
    +'<div class="kpi-card" style="flex:1;min-width:110px;"><div class="kpi-label">⚑ חריגים</div><div class="kpi-value" style="color:'+(escalatedCount>0?'#f59e0b':'#94a3b8')+';">'+escalatedCount+'</div></div>'
    +'</div>';

  // ── Income section (Bank income) ─────────────────────────────────────────
  if(allBankInc.length>0){
    const byMonth={};
    allBankInc.forEach(bi=>{ if(!byMonth[bi.month]) byMonth[bi.month]=[]; byMonth[bi.month].push(bi); });
    const accId='stmt-inc-acc';
    html+='<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;border:1.5px solid #86efac;">';
    html+='<div class="stmt-acc-header" onclick="toggleStmtAcc(\''+accId+'\')" style="background:#f0fdf4;">'
      +'<span class="stmt-acc-toggle" id="'+accId+'-toggle">▶</span>'
      +'<span style="font-size:20px;">💰</span>'
      +'<div class="stmt-acc-title" style="color:#166534;">הכנסות בנק</div>'
      +'<div class="stmt-acc-meta">'+allBankInc.length+' פריטים</div>'
      +'<div class="stmt-acc-amount" style="color:#16a34a;">+₪'+Math.round(totalInc).toLocaleString('he-IL')+'</div>'
      +'</div>';
    html+='<div class="stmt-acc-body" id="'+accId+'" style="display:none;">';
    Object.entries(byMonth).forEach(([month,items])=>{
      const mTotal=items.reduce((s,b)=>s+b.amount,0);
      html+='<div style="padding:6px 16px 2px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">'
        +'<span style="font-weight:700;font-size:12px;color:#475569;">📅 '+month+'</span>'
        +'<span style="font-size:12px;color:#16a34a;font-weight:700;">+₪'+Math.round(mTotal).toLocaleString('he-IL')+'</span>'
        +'</div>';
      items.forEach(bi=>{
        const incId=bi.id;
        const cat=incCatOverrides[incId]||bi.cat||'הכנסה';
        html+='<div class="stmt-row" style="background:#f7fef9;">'
          +'<div style="width:26px;flex-shrink:0;"></div>'
          +'<div class="stmt-date">'+bi.date+'</div>'
          +'<div class="stmt-name">'+bi.name+'<br><span style="font-size:10px;color:#94a3b8;">'+bi.src+'</span></div>'
          +'<div class="stmt-cat" id="cat-cell-inc-'+incId+'">'
            +'<span class="badge badge-green" style="font-size:10px;cursor:pointer;" onclick="toggleIncomeEdit(\''+incId+'\')" title="לחץ לעריכה">'+cat+' ✎</span>'
          +'</div>'
          +'<div class="stmt-amount" style="color:#16a34a;font-weight:700;">+₪'+bi.amount.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
          +'</div>';
      });
    });
    html+='</div></div>';
  }

  // ── Expense sections per card ─────────────────────────────────────────────
  const cards=cardVal!=='all'?[cardVal]:[...new Set(TRANSACTIONS.map(t=>t.card))].sort();
  const issueMap=buildTxIssueMap();

  cards.forEach(function(card){
    const cardTxs=allTxs.filter(t=>t.card===card);
    if(!cardTxs.length) return;
    cardTxs.sort((a,b)=>{
      const pa=a.date.split('-'),pb=b.date.split('-');
      return new Date(pa[2],+pa[1]-1,+pa[0])-new Date(pb[2],+pb[1]-1,+pb[0]);
    });
    const cardTotal=cardTxs.reduce((s,t)=>s+t.amount,0);
    const months=[...new Set(cardTxs.map(t=>t.month))];
    const accId='stmt-acc-'+card.replace(/[^a-z0-9]/gi,'');
    const isBankCard=(typeof BANK_CARDS!=='undefined')&&BANK_CARDS.includes(card);
    const cardIcon=isBankCard?'🏦':'💳';

    html+='<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;">';
    html+='<div class="stmt-acc-header" onclick="toggleStmtAcc(\''+accId+'\')">'
      +'<span class="stmt-acc-toggle" id="'+accId+'-toggle">▶</span>'
      +'<span style="font-size:20px;">'+cardIcon+'</span>'
      +'<div class="stmt-acc-title">'+card+'</div>'
      +'<div class="stmt-acc-meta">'+cardTxs.length+' עסקאות · '+months.join(', ')+'</div>'
      +'<div class="stmt-acc-amount">₪'+Math.round(cardTotal).toLocaleString('he-IL')+'</div>'
      +'</div>';
    html+='<div class="stmt-acc-body" id="'+accId+'" style="display:none;">';

    const byMonth={};
    cardTxs.forEach(t=>{ if(!byMonth[t.month]) byMonth[t.month]=[]; byMonth[t.month].push(t); });
    Object.entries(byMonth).forEach(([month,mTxs])=>{
      const mTotal=mTxs.reduce((s,t)=>s+t.amount,0);
      html+='<div style="padding:6px 16px 2px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">'
        +'<span style="font-weight:700;font-size:12px;color:#475569;">📅 '+month+'</span>'
        +'<span style="font-size:12px;color:var(--danger);font-weight:700;">₪'+Math.round(mTotal).toLocaleString('he-IL')+'</span>'
        +'</div>';
      mTxs.forEach(function(t){
        const effCat=getEffectiveCat(t);
        const txIssues=issueMap[t.id]||[];
        const hasDanger=txIssues.some(i=>i.severity==='danger');
        const warnIcon=txIssues.length>0?(hasDanger?'🔴 ':'⚠️ '):'';
        const isApproved=approvedTxs.has(t.id);
        const isEscalated=disputeItems.some(d=>d.issue&&d.issue.tx&&d.issue.tx.id===t.id);
        // Approve button: 3 states — escalated (⚑), approved (✓), pending ('')
        const approveClass='tx-approve-btn'+(isEscalated?' escalated':isApproved?' approved':'');
        const approveIcon=isEscalated?'⚑':isApproved?'✓':'';
        const approveTitle=isEscalated?'הועבר לחריגים':isApproved?'מאושר — לחץ לביטול':'סמן כמאושר';
        html+='<div class="stmt-row" style="'+(isApproved?'opacity:.7;':'')+(hasDanger?'background:#fff5f5;':txIssues.length?'background:#fffbeb;':'')+'">'
          +'<button class="'+approveClass+'" onclick="toggleApprove('+t.id+');renderStatementTab();" title="'+approveTitle+'" style="flex-shrink:0;margin-left:8px;">'+approveIcon+'</button>'
          +'<div class="stmt-date">'+t.date+'</div>'
          +'<div class="stmt-name">'+warnIcon+t.name+'</div>'
          +'<div class="stmt-cat" id="cat-cell-'+t.id+'" style="position:relative;">'
            +'<span class="badge '+(CAT_BADGE[effCat]||'badge-gray')+'" style="font-size:10px;cursor:pointer;" onclick="toggleInlineEdit('+t.id+')" title="לחץ לעריכה">'+effCat+' ✎</span>'
          +'</div>'
          +'<div style="display:flex;gap:4px;align-items:center;">'
            +'<button onclick="escalateDisputeFromTx('+t.id+')" style="background:transparent;border:none;cursor:pointer;font-size:13px;opacity:.6;" title="שלח לחריגים">⚑</button>'
          +'</div>'
          +'<div class="stmt-amount debit">₪'+t.amount.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
          +'</div>';
      });
    });
    html+='</div></div>';
  });

  el.innerHTML=html;
}

// ── Management tab with categories section ────────────────────────────────────
function renderManagementTab(){
  const el=document.getElementById('managementContent');
  if(!el) return;

  const selectedColor=_selectedNewProjColor||PROJECT_COLORS[PROJECTS.length%PROJECT_COLORS.length];
  let colorPickerHtml='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;" id="colorRow">';
  PROJECT_COLORS.forEach(c=>{
    colorPickerHtml+='<div class="proj-color-btn'+(c===selectedColor?' selected':'')+'" style="background:'+c+';width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid '+(c===selectedColor?'#1e293b':'transparent')+';" onclick="selectNewProjColor(\''+c+'\')" title="'+c+'"></div>';
  });
  colorPickerHtml+='</div>';

  let html='';

  // New project form
  html+='<div class="card" style="margin-bottom:18px;"><h3>➕ פרוייקט חדש</h3>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:12px;">'
    +'<div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">שם פרוייקט</label>'
    +'<input id="new-proj-name" type="text" placeholder="לדוגמא: טיול אירופה" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:220px;font-family:inherit;"></div>'
    +'<div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">אייקון</label>'
    +'<input id="new-proj-icon" type="text" placeholder="📁" maxlength="4" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:18px;width:64px;text-align:center;font-family:inherit;"></div>'
    +'<div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">צבע</label>'+colorPickerHtml+'</div>'
    +'<button onclick="addProjectFromForm()" style="background:var(--primary);color:white;border:none;border-radius:8px;padding:8px 18px;font-size:14px;font-weight:700;cursor:pointer;align-self:flex-end;">הוסף</button>'
    +'</div></div>';

  // Projects list
  if(PROJECTS.length===0){
    html+='<div class="empty-state" style="margin-bottom:18px;"><div class="icon">📂</div>אין פרוייקטים עדיין</div>';
  } else {
    html+='<div class="card" style="margin-bottom:18px;"><h3>📋 פרוייקטים פעילים</h3><div style="margin-top:12px;">';
    PROJECTS.forEach(proj=>{
      const assignedIds=Object.keys(txProjectMap).filter(k=>txProjectMap[k]===proj.id);
      const assignedTxs=assignedIds.map(k=>TRANSACTIONS.find(t=>String(t.id)===k)).filter(Boolean);
      const total=assignedTxs.reduce((s,t)=>s+t.amount,0);
      const months=[...new Set(assignedTxs.map(t=>t.month))];
      html+='<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">'
        +'<div style="width:40px;height:40px;border-radius:10px;background:'+proj.color+'22;display:flex;align-items:center;justify-content:center;font-size:20px;">'+proj.icon+'</div>'
        +'<div style="flex:1;"><div style="font-weight:700;font-size:15px;">'+proj.name+'</div>'
        +'<div style="font-size:12px;color:#64748b;">'+assignedTxs.length+' עסקאות · '+months.length+' חודשים</div></div>'
        +'<div style="font-size:20px;font-weight:800;color:'+proj.color+';">₪'+Math.round(total).toLocaleString('he-IL')+'</div>'
        +'<button onclick="viewProjectTransactions('+proj.id+')" style="background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;">👁</button>'
        +'<button onclick="deleteProject('+proj.id+')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;">🗑</button>'
        +'</div>';
    });
    html+='</div></div>';
  }

  // Categories type table
  const allCats=[...new Set(TRANSACTIONS.map(t=>getEffectiveCat(t)))].sort();
  const typeDefs=[{v:'expense',l:'הוצאה',c:'#ef4444'},{v:'income',l:'הכנסה',c:'#10b981'},{v:'investment',l:'השקעה',c:'#8b5cf6'},{v:'ignore',l:'התעלם',c:'#94a3b8'}];
  html+='<div class="card" style="margin-bottom:18px;"><h3>🏷 סוג קטגוריה (לחישוב מאזן)</h3>'
    +'<div style="font-size:12px;color:#64748b;margin-bottom:10px;">קבע האם כל קטגוריה היא הוצאה, הכנסה, השקעה או להתעלם — ישפיע על חישובי המאזן</div>'
    +'<div class="scroll-x"><table class="tbl"><thead><tr><th>קטגוריה</th><th>סוג</th><th>עסקאות</th><th>סכום</th></tr></thead><tbody>';
  allCats.forEach(cat=>{
    const txCount=TRANSACTIONS.filter(t=>getEffectiveCat(t)===cat).length;
    const txTotal=TRANSACTIONS.filter(t=>getEffectiveCat(t)===cat).reduce((s,t)=>s+t.amount,0);
    const curType=getCatType(cat);
    const _esc=cat.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const opts=typeDefs.map(td=>'<option value="'+td.v+'"'+(td.v===curType?' selected':'')+'>'+td.l+'</option>').join('');
    html+='<tr><td><span class="badge '+(CAT_BADGE[cat]||'badge-gray')+'">'+cat+'</span></td>'
      +'<td><select data-cat="'+_esc+'" onchange="setCatType(this.dataset.cat,this.value)" style="font-size:12px;border:1px solid #e2e8f0;border-radius:6px;padding:3px 6px;cursor:pointer;">'+opts+'</select></td>'
      +'<td style="color:#64748b;">'+txCount+'</td>'
      +'<td style="font-weight:700;text-align:left;">'+fmt(txTotal)+'</td></tr>';
  });
  html+='</tbody></table></div></div>';

  // Export section
  html+='<div class="card"><h3>📤 ייצוא נתונים</h3><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'
    +'<button onclick="exportXLSX_transactions()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📊 Excel עסקאות</button>'
    +'<button onclick="exportXLSX_merchants()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📊 Excel בתי עסק</button>'
    +'<button onclick="exportXLSX_categories()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📊 Excel קטגוריות</button>'
    +'<button onclick="exportXLSX_statement()" style="background:#10b981;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📊 Excel דף חשבון</button>'
    +'<button onclick="exportCSV()" style="background:#1a56db;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📥 CSV</button>'
    +'<button onclick="exportJSON()" style="background:#7c3aed;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">📋 JSON</button>'
    +'<button onclick="confirmSystemReset()" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;">🗑️ איפוס מערכת</button>'
    +'</div></div>';

  el.innerHTML=html;
}

// ── Insurance tab ─────────────────────────────────────────────────────────────
function renderInsuranceTab(){
  const insTxs=TRANSACTIONS.filter(t=>t.type!=='פנימי'&&(getEffectiveCat(t)==='ביטוח ובריאות'||t.name.includes('ביטוח')||t.name.includes('פוליסה')));
  if(!insTxs.length){ document.getElementById('insuranceContent').innerHTML='<div class="empty-state"><div class="icon">🛡️</div>אין עסקאות ביטוח</div>'; return; }
  const providers={};
  insTxs.forEach(t=>{ const k=t.name; if(!providers[k]) providers[k]={name:k,card:t.card,txs:[]}; providers[k].txs.push(t); });
  const totalAll=insTxs.reduce((s,t)=>s+t.amount,0);
  const months=[...new Set(insTxs.map(t=>t.month))];
  const avgMonthly=months.length?totalAll/months.length:0;
  const typeBreak={};
  insTxs.forEach(t=>{ const tp=insType(t.name); typeBreak[tp.label]=(typeBreak[tp.label]||0)+t.amount; });
  const today=new Date();

  let html='<div class="kpi-row" style="margin-bottom:18px;">'
    +'<div class="kpi-card"><div class="kpi-label">סה"כ ביטוחים</div><div class="kpi-value" style="color:#0e7490;">'+fmt(totalAll)+'</div><div class="kpi-sub">כל התקופה</div></div>'
    +'<div class="kpi-card"><div class="kpi-label">ממוצע לחודש</div><div class="kpi-value" style="color:#0e7490;">'+fmt(avgMonthly)+'</div><div class="kpi-sub">'+months.length+' חודשים</div></div>'
    +'<div class="kpi-card"><div class="kpi-label">ספקים פעילים</div><div class="kpi-value" style="color:#0e7490;">'+Object.keys(providers).length+'</div></div>'
    +'</div>';

  html+='<div class="card" style="margin-bottom:18px;"><h3>🗂️ פילוח לפי סוג</h3><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">';
  Object.entries(typeBreak).sort((a,b)=>b[1]-a[1]).forEach(([type,amt])=>{
    const pct=(amt/totalAll*100).toFixed(0);
    const tp=insType(type);
    html+='<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 16px;min-width:110px;text-align:center;">'
      +'<div style="font-size:22px;">'+tp.icon+'</div><div style="font-weight:700;font-size:13px;">'+type+'</div>'
      +'<div style="font-size:18px;font-weight:800;color:#0e7490;">₪'+Math.round(amt).toLocaleString('he-IL')+'</div>'
      +'<div style="font-size:11px;color:#64748b;">'+pct+'%</div></div>';
  });
  html+='</div></div>';

  html+='<div class="card"><h3>📋 פירוט לפי ספק</h3><div style="margin-top:12px;">';
  Object.entries(providers).sort((a,b)=>b[1].txs.reduce((s,t)=>s+t.amount,0)-a[1].txs.reduce((s,t)=>s+t.amount,0)).forEach(([key,p])=>{
    const tp=insType(p.name);
    const totalAmt=p.txs.reduce((s,t)=>s+t.amount,0);
    const mc=[...new Set(p.txs.map(t=>t.month))].length;
    const avg=totalAmt/mc;
    const ds=insRenewalDates[key]||'';
    let renewalHtml='',alertBorder='';
    if(ds){
      const renew=new Date(new Date(ds).setFullYear(new Date(ds).getFullYear()+1));
      const days=Math.round((renew-today)/(1000*60*60*24));
      if(days<0){ alertBorder='border-right:3px solid #dc2626;'; renewalHtml='<span style="background:#fee2e2;color:#dc2626;border-radius:12px;padding:2px 8px;font-size:11px;margin-right:6px;">⚠️ חידוש עבר!</span>'; }
      else if(days<=45){ alertBorder='border-right:3px solid #f59e0b;'; renewalHtml='<span style="background:#fef3c7;color:#92400e;border-radius:12px;padding:2px 8px;font-size:11px;margin-right:6px;">⏰ '+days+' ימים</span>'; }
      else renewalHtml='<span style="background:#dcfce7;color:#166534;border-radius:12px;padding:2px 8px;font-size:11px;margin-right:6px;">✅ חידוש '+renew.toLocaleDateString('he-IL')+'</span>';
    }
    const safeKey=key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html+='<div class="ins-provider-row" style="'+alertBorder+'">'
      +'<div style="flex:1;">'
        +'<div class="ins-provider-name">'+tp.icon+' '+p.name+'</div>'
        +'<div class="ins-provider-sub"><span class="badge badge-teal">'+tp.label+'</span><span class="card-tag" style="margin-right:4px;">'+p.card+'</span>'+mc+' חודשים · ₪'+Math.round(avg).toLocaleString('he-IL')+'/חודש</div>'
        +'<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
          +'<label style="font-size:11px;color:#64748b;">📅 תאריך ראשון:</label>'
          +'<input type="date" value="'+ds+'" style="font-size:11px;border:1px solid #e2e8f0;border-radius:5px;padding:2px 6px;" onchange="updateInsRenewal(\''+safeKey+'\',this.value)">'
          +renewalHtml
        +'</div>'
      +'</div>'
      +'<div style="text-align:left;min-width:90px;">'
        +'<div class="ins-provider-amount">₪'+Math.round(totalAmt).toLocaleString('he-IL')+'</div>'
        +'<div style="font-size:11px;color:#64748b;">סה"כ</div>'
        +'<button onclick="escalateInsuranceDispute(\''+safeKey+'\','+Math.round(avg)+')" style="margin-top:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;">💬 בדיקת מחיר</button>'
      +'</div></div>';
  });
  html+='</div></div>';
  document.getElementById('insuranceContent').innerHTML=html;

  const badge=document.getElementById('insuranceBadge');
  if(badge){
    const expiring=Object.keys(providers).filter(k=>{
      const d=insRenewalDates[k]; if(!d) return false;
      const r=new Date(new Date(d).setFullYear(new Date(d).getFullYear()+1));
      return (r-today)/(1000*60*60*24)<=45;
    }).length;
    badge.style.display=expiring>0?'inline':'none';
    if(expiring>0) badge.textContent=expiring;
  }
}

// ── Add escalated CSS ─────────────────────────────────────────────────────────
(function(){
  const s=document.createElement('style');
  s.textContent='.tx-approve-btn.escalated{background:#fff7ed;border-color:#f59e0b;color:#92400e;font-size:11px;}'
    +'.stmt-date-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;margin-bottom:14px;border-radius:10px;}'
    +'.stmt-row{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid #f1f5f9;transition:background .1s;}'
    +'.stmt-row:hover{background:#f8fafc;}'
    +'.stmt-date{font-family:monospace;font-size:11px;color:#64748b;white-space:nowrap;min-width:78px;flex-shrink:0;}'
    +'.stmt-name{flex:1;font-weight:600;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;}'
    +'.stmt-cat{min-width:110px;flex-shrink:0;}'
    +'.stmt-amount{font-weight:700;text-align:left;white-space:nowrap;min-width:80px;font-size:14px;}'
    +'.stmt-amount.debit{color:var(--danger,#ef4444);}'
    +'.stmt-acc-header{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;background:#f8fafc;border-bottom:1px solid #e2e8f0;transition:background .15s;}'
    +'.stmt-acc-header:hover{background:#f1f5f9;}'
    +'.stmt-acc-toggle{font-size:10px;color:#94a3b8;transition:transform .15s;flex-shrink:0;}'
    +'.stmt-acc-title{font-weight:700;font-size:15px;flex:1;}'
    +'.stmt-acc-meta{font-size:12px;color:#64748b;}'
    +'.stmt-acc-amount{font-weight:800;font-size:16px;color:var(--danger,#ef4444);text-align:left;min-width:90px;}'
    +'.stmt-acc-body{display:none;}'
    +'.proj-picker{position:absolute;top:100%;right:0;z-index:100;background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:160px;padding:6px 0;}'
    +'.proj-picker-item{padding:7px 14px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;}'
    +'.proj-picker-item:hover{background:#f8fafc;}'
    +'.proj-picker-none{padding:7px 14px;cursor:pointer;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;}'
    +'.proj-picker-none:hover{background:#fef2f2;color:#ef4444;}'
    +'.proj-assign-btn{background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:#64748b;white-space:nowrap;}'
    +'.proj-assign-btn:hover{background:#e2e8f0;}'
    +'.proj-badge{display:inline-block;border:1px solid;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;}'
    +'.proj-color-btn.selected{transform:scale(1.25);box-shadow:0 0 0 2px #1e293b;}'
    +'.inline-edit-panel{display:none;gap:4px;padding:4px;flex-wrap:wrap;position:relative;z-index:50;background:white;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;box-shadow:0 4px 12px rgba(0,0,0,.08);}'
    +'.ins-provider-row{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #f1f5f9;}'
    +'.ins-provider-name{font-weight:700;font-size:15px;}'
    +'.ins-provider-sub{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;color:#64748b;flex-wrap:wrap;}'
    +'.ins-provider-amount{font-size:22px;font-weight:800;color:#1e293b;}'
    +'.badge-green{background:#dcfce7;color:#166534;}'
    ;
  document.head.appendChild(s);
})();



// ═══════════════════════════════════════════════════════
// USER PROFILE SYSTEM — v3 (contact info + structured fields + partner section)
// ════════════════════════════════════════════════════════════════════════════

// ── Data structure ────────────────────────────────────
let userProfile = JSON.parse(localStorage.getItem('userProfile') || 'null') || {
  // ── Contact (optional — for email scan + reports)
  name:              '',
  mobile:            '',
  email:             '',
  birthDate:         '',   // YYYY-MM-DD

  // ── Family
  familyStatus:      '',  // single/married/cohabiting/divorced/widowed
  childrenCount:     0,   // integer 0-10
  childrenAges:      [],  // array of age-range codes per child (length == childrenCount)

  // ── Housing
  region:            '',  // gush-dan/jerusalem/haifa-north/center/south/abroad
  housingType:       '',  // renting/owned/mortgage/parents
  apartmentsCount:   '',  // 0/1/2/3plus  (investment properties)

  // ── Self employment & profession
  professionField:   '',  // medicine/law/tech/finance/education/engineering/real-estate/trade/art/other
  employmentType:    '',  // employee/self-employed/combined
  role:              '',  // worker/team-lead/manager/director/owner
  workSector:        '',  // tech/finance/education/health/gov/industry/commerce/services/other

  // ── Lifestyle
  religiosity:       '',  // secular/traditional/religious/orthodox
  carsCount:         '',  // 0/1/2/3plus
  hasPets:           '',  // yes/no
  education:         '',  // highschool/vocational/bachelor/master/phd

  // ── Partner (only relevant if married/cohabiting)
  partnerName:           '',
  partnerBirthDate:      '',   // YYYY-MM-DD
  partnerProfessionField:'',
  partnerEmploymentType: '',
  partnerRole:           '',
  partnerSector:         '',
  partnerEducation:      '',
  partnerReligiosity:    '',
  partnerCarsOwn:        '',   // yes/no — does partner own their own car?
};

// ── Label maps ─────────────────────────────────────────
const FAMILY_LABELS     = { single:'רווק/ה', married:'נשוי/אה', cohabiting:'ידועים בציבור', divorced:'גרוש/ה', widowed:'אלמן/ה' };
const HOUSING_LABELS    = { renting:'שוכר/ת', owned:'בעלים (ללא משכנתא)', mortgage:'בעלים + משכנתא', parents:'גר אצל הורים' };
const REGION_LABELS     = { 'gush-dan':'גוש דן / ת"א', jerusalem:'ירושלים', 'haifa-north':'חיפה והצפון', center:'מרכז (שאינו ת"א)', south:'דרום', abroad:'חו"ל / אחר' };
const RELIGION_LABELS   = { secular:'חילוני/ת', traditional:'מסורתי/ת', religious:'דתי/ה', orthodox:'חרדי/ת' };
const PROFESSION_LABELS = { employee:'שכיר/ה', 'self-employed':'עצמאי/ת', business:'בעל/ת עסק', retired:'פנסיונר/ית', student:'סטודנט/ית', unemployed:'ללא עיסוק', none:'לא רלוונטי' };
const SECTOR_LABELS     = { tech:'הייטק', finance:'פיננסים / ביטוח', education:'חינוך', health:'בריאות', gov:'ממשלה / ציבורי', industry:'תעשייה / ייצור', commerce:'מסחר / קמעונאות', services:'שירותים', other:'אחר' };
const EDUCATION_LABELS  = { highschool:'תיכון', vocational:'טכנאי / מקצועי', bachelor:'תואר ראשון', master:'תואר שני', phd:'דוקטורט' };
const PROFESSION_FIELD_LABELS = { medicine:'רפואה / בריאות', law:'משפטים', tech:'הייטק / מחשבים', finance:'פיננסים / חשבונאות', education:'חינוך', engineering:'הנדסה', 'real-estate':'נדל"ן', trade:'מסחר / קמעונאות', art:'אמנות / תקשורת', other:'אחר' };
const EMPLOYMENT_TYPE_LABELS  = { employee:'שכיר/ה', 'self-employed':'עצמאי/ת', combined:'שכיר+עצמאי' };
const ROLE_LABELS             = { worker:'עובד/ת', 'team-lead':'ראש צוות', manager:'מנהל/ת', director:'דירקטור/ית', owner:'בעל/ת עסק', freelancer:'פרילנסר' };

const KID_AGE_RANGES = [
  ['0-2','👶 תינוק (0-2)'], ['3-5','🎨 גיל גן (3-5)'], ['6-9','📚 כיתות א-ג (6-9)'],
  ['10-12','📖 כיתות ד-ו (10-12)'], ['13-15','🎒 חטיבה (13-15)'], ['16-18','🏫 תיכון (16-18)'], ['19+','🎓 בוגר (19+)']
];

// ── Profile-derived analytics helpers ────────────────
function getFamilySize(){
  const adults = ['married','cohabiting'].includes(userProfile.familyStatus) ? 2 : 1;
  return adults + Math.max(0, parseInt(userProfile.childrenCount)||0);
}

function getKidsInSchool(){
  return (userProfile.childrenAges||[]).filter(r=>['6-9','10-12','13-15','16-18'].includes(r)).length;
}

function hasYoungKids(){
  return (userProfile.childrenAges||[]).some(r=>['0-2','3-5'].includes(r));
}

function hasPartner(){
  return ['married','cohabiting'].includes(userProfile.familyStatus);
}

function getCostIndex(){
  // Region cost multiplier vs national average
  const regionMult = { 'gush-dan':1.35, jerusalem:1.15, 'haifa-north':0.9, center:1.0, south:0.82, abroad:1.0 };
  return regionMult[userProfile.region] || 1.0;
}

function getEducationCostMult(){
  // Religious observance significantly affects private education costs
  const m = { secular:1.0, traditional:1.1, religious:1.6, orthodox:2.2 };
  return m[userProfile.religiosity] || 1.0;
}

function getFoodCostMult(){
  // Kosher premium + more home cooking in orthodox households
  const m = { secular:1.0, traditional:1.05, religious:1.15, orthodox:1.25 };
  return m[userProfile.religiosity] || 1.0;
}

function getProfileLabel(){
  const name = userProfile.name ? userProfile.name.split(' ')[0]+' · ' : '';
  const fs  = FAMILY_LABELS[userProfile.familyStatus] || '';
  const k   = parseInt(userProfile.childrenCount)||0;
  const kids = k > 0 ? ` · ${k} ילד${k===1?'':'ים'}` : '';
  const reg = REGION_LABELS[userProfile.region] ? ` · ${REGION_LABELS[userProfile.region]}` : '';
  return `${name}${fs}${kids}${reg}`;
}

// ── Benchmarks — refined by family size + modifiers ──
const BENCHMARKS_BASE = {
  food:       { 1:1300, 2:2100, 3:2900, 4:3700, 5:4500, 6:5300 },
  restaurant: { 1:550,  2:850,  3:1100, 4:1350, 5:1600, 6:1850 },
  transport:  { 1:850,  2:1300, 3:1700, 4:2100, 5:2500, 6:2900 },
  insurance:  { 1:480,  2:850,  3:1300, 4:1700, 5:2100, 6:2400 },
  digital:    { 1:190,  2:280,  3:330,  4:380,  5:430,  6:480  },
  cosmetics:  { 1:280,  2:480,  3:600,  4:700,  5:800,  6:900  },
  education:  { 1:100,  2:200,  3:900,  4:1600, 5:2400, 6:3200 },
  fuel:       { 1:350,  2:600,  3:750,  4:900,  5:1050, 6:1200 },
};
const CAT_BENCHMARK_MAP = {
  'מזון וצריכה':'food', 'מסעדות, קפה וברים':'restaurant', 'תחבורה ורכבים':'transport',
  'ביטוח ובריאות':'insurance', 'מנויים דיגיטליים':'digital', 'קוסמטיקה וטיפוח':'cosmetics',
  'חינוך':'education', 'דלק, חשמל וגז':'fuel'
};

function getBenchmark(catKey){
  const size = Math.min(6, Math.max(1, getFamilySize()));
  const base = (BENCHMARKS_BASE[catKey]||{})[size] || 0;
  if(!base) return null;
  const ci   = getCostIndex();
  const edMult  = catKey==='education' ? getEducationCostMult() : 1;
  const foodMult= catKey==='food' ? getFoodCostMult() : 1;
  return Math.round(base * ci * edMult * foodMult);
}

function getBenchmarkAlert(cat, monthlyAvg){
  const key = CAT_BENCHMARK_MAP[cat];
  if(!key || !userProfile.familyStatus) return null;
  const bm = getBenchmark(key);
  if(!bm) return null;
  const ratio = monthlyAvg / bm;
  if(ratio > 1.4) return { type:'danger',  pct:Math.round((ratio-1)*100), bm };
  if(ratio > 1.2) return { type:'warning', pct:Math.round((ratio-1)*100), bm };
  return null;
}

// ── Profile Modal ─────────────────────────────────────
let _profileOpen = false;

function openProfileModal(){
  _profileOpen = true;
  renderProfileForm();
  document.getElementById('profileModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeProfileModal(){
  _profileOpen = false;
  document.getElementById('profileModal').classList.add('hidden');
  document.body.style.overflow = '';
}

// Temp children list during editing
let _editChildren = [];

function saveProfile(){
  const getV = id => (document.getElementById(id)||{}).value||'';
  // Contact
  userProfile.name              = getV('pf-name');
  userProfile.mobile            = getV('pf-mobile');
  userProfile.email             = getV('pf-email');
  userProfile.birthDate         = getV('pf-birthdate');
  // Family
  userProfile.familyStatus      = getV('pf-family');
  const cnt = parseInt(getV('pf-kids-count'))||0;
  userProfile.childrenCount     = cnt;
  userProfile.childrenAges      = _editChildren.slice(0, cnt);
  // Housing
  userProfile.region            = getV('pf-region');
  userProfile.housingType       = getV('pf-housing');
  userProfile.apartmentsCount   = getV('pf-apartments');
  // Employment
  userProfile.professionField   = getV('pf-prof-field');
  userProfile.employmentType    = getV('pf-emp-type');
  userProfile.role              = getV('pf-role');
  userProfile.workSector        = getV('pf-sector');
  // Lifestyle
  userProfile.religiosity       = getV('pf-religion');
  userProfile.carsCount         = getV('pf-cars');
  userProfile.hasPets           = getV('pf-pets');
  userProfile.education         = getV('pf-edu');
  // Partner
  userProfile.partnerName           = getV('pf-partner-name');
  userProfile.partnerBirthDate      = getV('pf-partner-birthdate');
  userProfile.partnerProfessionField= getV('pf-partner-prof-field');
  userProfile.partnerEmploymentType = getV('pf-partner-emp-type');
  userProfile.partnerRole           = getV('pf-partner-role');
  userProfile.partnerSector         = getV('pf-partner-sector');
  userProfile.partnerEducation      = getV('pf-partner-edu');
  userProfile.partnerReligiosity    = getV('pf-partner-religion');
  userProfile.partnerCarsOwn        = getV('pf-partner-cars-own');
  localStorage.setItem('userProfile', JSON.stringify(userProfile));
  const ptab = document.getElementById('profileTab');
  if(ptab) ptab.textContent = '👤 ' + (getProfileLabel()||'פרופיל');
  updateHeaderUser();
  closeProfileModal();
  renderAll();
  if(document.getElementById('tab-mortgage')?.classList.contains('active'))    renderMortgageTab();
  if(document.getElementById('tab-investments')?.classList.contains('active')) renderInvestmentsTab();
}

function updateHeaderUser(){
  // Update header name span
  const nameSpan = document.getElementById('headerUserName');
  if(nameSpan) nameSpan.textContent = userProfile.name ? '— '+userProfile.name : '';

  // Update user info bar name
  const uibName = document.getElementById('uib-name-text');
  if(uibName){
    const label = getProfileLabel();
    uibName.textContent = userProfile.name || (label ? label : 'לא הוגדר משתמש');
    uibName.style.color = userProfile.name ? '#93c5fd' : '#f87171';
  }

  // Update folder path in info bar
  const folderText = document.getElementById('uib-folder-text');
  if(folderText){
    const fp = (_appSettings||{}).folderPath;
    if(fp){
      // Show just last 2 path segments to save space
      const parts = fp.replace(/\\/g,'/').split('/').filter(Boolean);
      folderText.textContent = '…/' + parts.slice(-2).join('/');
      folderText.style.color = '#6ee7b7';
    } else {
      folderText.textContent = 'תיקייה לא הוגדרה';
      folderText.style.color = '#f87171';
    }
  }
}

let _resetProfilePending = false;
let _resetProfileTimer = null;

function resetProfileStep(){
  const btn = document.getElementById('resetProfileBtn');
  if(!btn) return;
  if(!_resetProfilePending){
    _resetProfilePending = true;
    btn.textContent = '⚠️ לחץ שוב לאישור';
    btn.style.background = '#fee2e2';
    btn.style.color = '#991b1b';
    _resetProfileTimer = setTimeout(function(){
      _resetProfilePending = false;
      btn.textContent = '🔄 איפוס פרופיל';
      btn.style.background = 'transparent';
      btn.style.color = '#f87171';
    }, 3000);
  } else {
    clearTimeout(_resetProfileTimer);
    _resetProfilePending = false;
    btn.textContent = '🔄 איפוס פרופיל';
    btn.style.background = 'transparent';
    btn.style.color = '#f87171';
    doResetProfile();
  }
}

function confirmResetProfile(){ doResetProfile(); }

function doResetProfile(){
  userProfile = {
    name:'', mobile:'', email:'', birthDate:'',
    familyStatus:'', childrenCount:0, childrenAges:[],
    region:'', housingType:'', apartmentsCount:'',
    professionField:'', employmentType:'', role:'', workSector:'',
    religiosity:'', carsCount:'', hasPets:'', education:'',
    partnerName:'', partnerBirthDate:'', partnerProfessionField:'',
    partnerEmploymentType:'', partnerRole:'', partnerSector:'', partnerEducation:'',
    partnerReligiosity:'', partnerCarsOwn:'',
  };
  localStorage.removeItem('userProfile');
  localStorage.removeItem('authUser');
  localStorage.removeItem('termsAccepted');
  localStorage.removeItem('onboardingProfileSkipped');
  updateHeaderUser();
  // Trigger onboarding
  const ptab = document.getElementById('profileTab');
  if(ptab) ptab.textContent = '👤 פרופיל';
  setTimeout(function(){
    openProfileModal();
    const titleEl = document.getElementById('profileModalTitle');
    if(titleEl) titleEl.textContent = '👋 ברוך הבא! הגדר פרופיל אישי';
  }, 100);
}

function _updateChildAge(idx, val){
  _editChildren[idx] = val;
}
function _syncKidsCount(){
  const cnt = parseInt(document.getElementById('pf-kids-count')?.value)||0;
  // Grow or shrink _editChildren to match count
  while(_editChildren.length < cnt) _editChildren.push('6-9');
  _editChildren.length = cnt;
  _rerenderKidsList();
}
function _rerenderKidsList(){
  const el = document.getElementById('pf-kids-list');
  if(!el) return;
  const count = _editChildren.length;
  if(count === 0){ el.innerHTML = ''; return; }
  let h = `<div style="margin-top:10px;">`;
  _editChildren.forEach((r,i)=>{
    h += `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:12px;color:#64748b;min-width:54px;">ילד ${i+1}</span>
      <select onchange="_updateChildAge(${i},this.value)" style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;font-size:13px;font-family:inherit;">
        ${KID_AGE_RANGES.map(([v,l])=>`<option value="${v}"${v===r?' selected':''}>${l}</option>`).join('')}
      </select>
    </div>`;
  });
  h += '</div>';
  el.innerHTML = h;
}

function renderProfileForm(){
  const p = userProfile;
  _editChildren = (p.childrenAges||[]).slice();
  if(_editChildren.length===0 && (p.childrenAgeRanges||[]).length>0){
    _editChildren = p.childrenAgeRanges.slice();
  }

  const sel = (id, opts, cur, extra) =>
    `<select id="${id}" ${extra||''} style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;width:100%;font-family:inherit;">${opts.map(([v,l])=>`<option value="${v}"${cur===v?' selected':''}>${l}</option>`).join('')}</select>`;
  const txt = (id, ph, cur) =>
    `<input id="${id}" type="text" placeholder="${ph}" value="${cur||''}" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;width:100%;font-family:inherit;box-sizing:border-box;">`;
  const dateInp = (id, cur) =>
    `<input id="${id}" type="date" value="${cur||''}" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;width:100%;font-family:inherit;box-sizing:border-box;direction:ltr;">`;
  const fld = (label, ctrl) =>
    `<div style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">${label}</label>${ctrl}</div>`;
  const grid2 = (...items) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px;">${items.join('')}</div>`;
  const sec = (icon, title, body) =>
    `<div style="background:#f8fafc;border-radius:10px;padding:13px 15px;margin-bottom:14px;"><div style="font-size:11px;font-weight:800;color:#1a56db;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">${icon} ${title}</div>${body}</div>`;

  const kc = Math.max(parseInt(p.childrenCount)||0, _editChildren.length);
  const kSel = `<select id="pf-kids-count" onchange="_syncKidsCount()" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;width:100%;font-family:inherit;">${['0','1','2','3','4','5','6'].map(v=>`<option value="${v}"${String(kc)===v?' selected':''}>${v==='0'?'אין ילדים':v==='6'?'6+':v+' ילד'+(parseInt(v)===1?'':'ים')}</option>`).join('')}</select>`;

  document.getElementById('profileModalBody').innerHTML =
    `<div style="max-height:70vh;overflow-y:auto;padding-right:4px;">` +
    `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;font-size:12px;color:#1e40af;margin-bottom:14px;">` +
    `\u{1F4A1} כל השדות <strong>אופציונליים</strong> — הנתונים משמשים בלבד לאופטימיזציה של המלצות. לא נשמר מידע בשרת.</div>` +

    sec('\u{1F464}','פרטים אישיים',
      grid2(fld('שם מלא', txt('pf-name','ישראל ישראלי', p.name)), fld('נייד', txt('pf-mobile','050-0000000', p.mobile))) +
      grid2(fld('כתובת מייל', txt('pf-email','your@email.com', p.email)),
            fld('תאריך לידה', dateInp('pf-birthdate', p.birthDate)))
    ) +

    sec('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}','מצב משפחתי וילדים',
      grid2(
        fld('סטטוס', sel('pf-family',[['','בחר...'],['single','רווק/ה'],['married','נשוי/אה'],['cohabiting','ידועים בציבור'],['divorced','גרוש/ה'],['widowed','אלמן/ה']], p.familyStatus)),
        fld('מספר ילדים', kSel)
      ) +
      '<div id="pf-kids-list"></div>'
    ) +

    sec('\u{1F3E0}','מגורים',
      grid2(
        fld('אזור מגורים', sel('pf-region',[['','בחר...'],['gush-dan','גוש דן / ת"א'],['jerusalem','ירושלים'],['haifa-north','חיפה והצפון'],['center','מרכז (שאינו ת"א)'],['south','דרום'],['abroad','חו"ל / אחר']], p.region)),
        fld('מצב דיור', sel('pf-housing',[['','בחר...'],['renting','שוכר/ת'],['owned','דירה בבעלות'],['mortgage','דירה + משכנתא'],['parents','אצל הורים']], p.housingType))
      ) +
      fld('דירות נוספות (להשקעה)', sel('pf-apartments',[['0','אין — דירה יחידה'],['1','דירה אחת נוספת'],['2','2 דירות נוספות'],['3plus','3+']], p.apartmentsCount))
    ) +

    sec('\u{1F4BC}','תעסוקה והשכלה',
      grid2(
        fld('תחום מקצועי', sel('pf-prof-field',[['','בחר...'],['medicine','רפואה / בריאות'],['law','משפטים'],['tech','הייטק / מחשבים'],['finance','פיננסים / חשבונאות'],['education','חינוך / אקדמיה'],['engineering','הנדסה'],['real-estate','נדל"ן'],['trade','מסחר / קמעונאות'],['art','אמנות / תקשורת'],['other','אחר']], p.professionField)),
        fld('סוג העסקה', sel('pf-emp-type',[['','בחר...'],['employee','שכיר/ה'],['self-employed','עצמאי/ת'],['combined','שכיר + עצמאי']], p.employmentType))
      ) +
      grid2(
        fld('תפקיד', sel('pf-role',[['','בחר...'],['worker','עובד/ת'],['team-lead','ראש צוות'],['manager','מנהל/ת'],['director','דירקטור/ית / VP'],['owner','בעל/ת עסק'],['freelancer','פרילנסר']], p.role)),
        fld('סקטור', sel('pf-sector',[['','בחר...'],['tech','הייטק'],['finance','פיננסים'],['education','חינוך'],['health','בריאות'],['gov','ממשלה / ציבורי'],['industry','תעשייה'],['commerce','מסחר'],['services','שירותים'],['other','אחר']], p.workSector))
      ) +
      grid2(
        fld('השכלה', sel('pf-edu',[['','בחר...'],['highschool','תיכון'],['vocational','טכנאי / מקצועי'],['bachelor','תואר ראשון'],['master','תואר שני'],['phd','דוקטורט']], p.education)),
        fld('זרם דתי', sel('pf-religion',[['','בחר...'],['secular','חילוני/ת'],['traditional','מסורתי/ת'],['religious','דתי/ה'],['orthodox','חרדי/ת']], p.religiosity))
      ) +
      grid2(
        fld('מספר רכבים', sel('pf-cars',[['','בחר...'],['0','אין רכב'],['1','רכב אחד'],['2','שני רכבים'],['3plus','3+']], p.carsCount)),
        fld('חיות מחמד', sel('pf-pets',[['','בחר...'],['no','אין'],['yes','יש חיות מחמד']], p.hasPets))
      )
    ) +

    sec('\u{1F491}','בן / בת זוג',
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px;">מלא/י אם רלוונטי — משמש לניתוח הכנסת הבית המשולבת ולהשוואת פרופיל</div>' +
      grid2(
        fld('שם', txt('pf-partner-name','שם בן/בת הזוג', p.partnerName)),
        fld('תאריך לידה', dateInp('pf-partner-birthdate', p.partnerBirthDate))
      ) +
      grid2(
        fld('תחום מקצועי', sel('pf-partner-prof-field',[['','לא רלוונטי'],['medicine','רפואה / בריאות'],['law','משפטים'],['tech','הייטק / מחשבים'],['finance','פיננסים / חשבונאות'],['education','חינוך / אקדמיה'],['engineering','הנדסה'],['real-estate','נדל"ן'],['trade','מסחר / קמעונאות'],['art','אמנות / תקשורת'],['other','אחר']], p.partnerProfessionField)),
        fld('סוג העסקה', sel('pf-partner-emp-type',[['','לא רלוונטי'],['employee','שכיר/ה'],['self-employed','עצמאי/ת'],['combined','שכיר + עצמאי']], p.partnerEmploymentType))
      ) +
      grid2(
        fld('תפקיד', sel('pf-partner-role',[['','לא רלוונטי'],['worker','עובד/ת'],['team-lead','ראש צוות'],['manager','מנהל/ת'],['director','דירקטור/ית / VP'],['owner','בעל/ת עסק'],['freelancer','פרילנסר']], p.partnerRole)),
        fld('סקטור', sel('pf-partner-sector',[['','לא רלוונטי'],['tech','הייטק'],['finance','פיננסים'],['education','חינוך'],['health','בריאות'],['gov','ממשלה / ציבורי'],['industry','תעשייה'],['commerce','מסחר'],['services','שירותים'],['other','אחר']], p.partnerSector))
      ) +
      grid2(
        fld('השכלה', sel('pf-partner-edu',[['','לא רלוונטי'],['highschool','תיכון'],['vocational','טכנאי / מקצועי'],['bachelor','תואר ראשון'],['master','תואר שני'],['phd','דוקטורט']], p.partnerEducation)),
        fld('זרם דתי', sel('pf-partner-religion',[['','לא רלוונטי'],['secular','חילוני/ת'],['traditional','מסורתי/ת'],['religious','דתי/ה'],['orthodox','חרדי/ת']], p.partnerReligiosity))
      ) +
      fld('רכב אישי לבן/בת הזוג', sel('pf-partner-cars-own',[['','לא רלוונטי'],['yes','כן — יש רכב אישי'],['no','לא — משתמש/ת ברכב משותף / תחבורה']], p.partnerCarsOwn))
    ) +
    `</div>`;

  _rerenderKidsList();
}

// Show onboarding on first load if no profile
window.addEventListener('DOMContentLoaded', function(){
  // Init user info bar always
  setTimeout(updateHeaderUser, 200);

  // Profile tab label sync — auth/onboarding handled by AUTH SYSTEM
  const ptab = document.getElementById('profileTab');
  if(ptab && getProfileLabel()) ptab.textContent = '👤 ' + getProfileLabel();
});

// Hook saveFolderPath to keep info bar in sync
document.addEventListener('DOMContentLoaded', function(){
  const origSave = window.saveFolderPath;
  if(origSave){
    window.saveFolderPath = function(){ origSave(); setTimeout(updateHeaderUser, 100); };
  }
});

// ═══════════════════════════════════════════════════════
// MORTGAGE TAB
// ═══════════════════════════════════════════════════════

// Mortgage manual data (persisted in localStorage)
let mortgageData = JSON.parse(localStorage.getItem('mortgageData') || '{}');
// { remainingBalance: 0, interestRate: 0, endYear: 0, propertyValue: 0, notes: '' }

function saveMortgageData(){
  const get = id => (document.getElementById(id)||{}).value||'';
  mortgageData = {
    remainingBalance: parseFloat(get('mort-balance'))||0,
    interestRate:     parseFloat(get('mort-rate'))||0,
    endYear:          parseInt(get('mort-end-year'))||0,
    propertyValue:    parseFloat(get('mort-property-val'))||0,
    notes:            get('mort-notes'),
  };
  localStorage.setItem('mortgageData', JSON.stringify(mortgageData));
  renderMortgageTab();
}

function renderMortgageTab(){
  const el = document.getElementById('mortgageContent');
  if(!el) return;

  // Auto-detect mortgage payments from transactions
  const mortCats = ['משכנתא והלוואות','הלוואות'];
  const mortTxs = TRANSACTIONS.filter(t => mortCats.includes(getEffectiveCat(t)));
  const totalPaid = mortTxs.reduce((s,t)=>s+t.amount,0);

  // Monthly breakdown
  const byMonth = {};
  mortTxs.forEach(t=>{ if(!byMonth[t.month]) byMonth[t.month]=0; byMonth[t.month]+=t.amount; });
  const monthlyAmts = Object.values(byMonth);
  const avgMonthly = monthlyAmts.length ? monthlyAmts.reduce((s,v)=>s+v,0)/monthlyAmts.length : 0;

  // Smart alerts
  const md = mortgageData;
  const rate = md.interestRate || 0;
  const highRateAlert = rate > 4.5 ? `<div class="benchmark-alert danger" style="margin-bottom:14px;">🚨 ריבית <strong>${rate}%</strong> גבוהה מהממוצע השוקי (3.8%). כדאי לבדוק מחזור משכנתא!</div>` :
                        rate > 3.5 ? `<div class="benchmark-alert warning" style="margin-bottom:14px;">⚠️ ריבית <strong>${rate}%</strong> — ניתן לבחון מחזור למסלול נמוך יותר</div>` :
                        rate > 0   ? `<div class="benchmark-alert success" style="margin-bottom:14px;">✅ ריבית <strong>${rate}%</strong> — תנאים סבירים לשוק הנוכחי</div>` : '';

  // LTV if we have data
  const ltv = md.propertyValue > 0 && md.remainingBalance > 0
    ? `<div class="kpi-card" style="flex:1;min-width:130px;"><div class="kpi-label">יחס LTV</div><div class="kpi-value">${(md.remainingBalance/md.propertyValue*100).toFixed(0)}%</div><div class="kpi-sub">חוב מול שווי</div></div>` : '';

  // Years remaining
  const now = new Date().getFullYear();
  const yearsLeft = md.endYear > now ? md.endYear - now : 0;

  // Suggestions — use bank income data (income fields removed from profile)
  const avgBankIncome = BANK_INCOME.length > 0
    ? BANK_INCOME.reduce((s,b)=>s+b.amount,0) / Math.max(1,[...new Set(BANK_INCOME.map(b=>b.month))].length)
    : 0;
  const totalHHIncome = avgBankIncome; // derived from actual bank data
  const mortRatio = totalHHIncome > 0 && avgMonthly > 0 ? (avgMonthly/totalHHIncome*100).toFixed(0) : null;
  const mortRatioAlert = mortRatio && parseFloat(mortRatio) > 35
    ? `<div class="benchmark-alert warning">⚠️ תשלום המשכנתא הוא <strong>${mortRatio}%</strong> מהכנסת הבית. מומלץ לא לעבור 30-35%.</div>`
    : mortRatio ? `<div class="benchmark-alert success">✅ תשלום המשכנתא הוא <strong>${mortRatio}%</strong> מהכנסת הבית — יחס בריא.</div>` : '';

  let html = '';

  html += highRateAlert;
  if(mortRatioAlert) html += '<div style="margin-bottom:14px;">'+mortRatioAlert+'</div>';

  // KPI row
  html += '<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">'
    + `<div class="kpi-card" style="flex:1;min-width:130px;"><div class="kpi-label">תשלום ממוצע/חודש</div><div class="kpi-value" style="color:var(--danger);">${fmt(avgMonthly)}</div></div>`
    + `<div class="kpi-card" style="flex:1;min-width:130px;"><div class="kpi-label">שולם עד כה (בתקופה)</div><div class="kpi-value">${fmt(totalPaid)}</div></div>`
    + (md.remainingBalance ? `<div class="kpi-card" style="flex:1;min-width:130px;"><div class="kpi-label">יתרת חוב</div><div class="kpi-value" style="color:#7c3aed;">${fmt(md.remainingBalance)}</div></div>` : '')
    + (yearsLeft ? `<div class="kpi-card" style="flex:1;min-width:130px;"><div class="kpi-label">שנים לסיום</div><div class="kpi-value">${yearsLeft}</div></div>` : '')
    + ltv
    + '</div>';

  // Monthly trend table
  if(Object.keys(byMonth).length > 0){
    html += '<div class="card" style="margin-bottom:18px;"><h3>📅 תשלומים חודשיים</h3><div style="margin-top:10px;">';
    Object.entries(byMonth).forEach(([month, amt])=>{
      const w = Math.min(100, (amt/avgMonthly)*70);
      html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div style="min-width:100px;font-weight:600;font-size:13px;">${month}</div>
        <div style="flex:1;background:#f1f5f9;border-radius:4px;height:10px;overflow:hidden;">
          <div style="width:${w}%;height:100%;background:#7c3aed;border-radius:4px;"></div>
        </div>
        <div style="font-weight:700;font-size:14px;text-align:left;min-width:85px;">${fmt(amt)}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  // Manual details form
  html += `<div class="card"><h3>✏️ פרטי משכנתא (ידני)</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:12px;">
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">יתרת חוב נוכחית (₪)</label>
        <input id="mort-balance" type="number" value="${md.remainingBalance||''}" placeholder="1500000" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">שיעור ריבית ממוצע (%)</label>
        <input id="mort-rate" type="number" step="0.1" value="${md.interestRate||''}" placeholder="3.5" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">שנת סיום</label>
        <input id="mort-end-year" type="number" value="${md.endYear||''}" placeholder="${new Date().getFullYear()+20}" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">שווי נכס משוער (₪)</label>
        <input id="mort-property-val" type="number" value="${md.propertyValue||''}" placeholder="2500000" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
    </div>
    <div style="margin-top:10px;"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">הערות / מסלולים</label>
      <textarea id="mort-notes" placeholder="לדוגמא: פריים + 1.5%, שליש בריבית קבועה..." style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;width:100%;box-sizing:border-box;min-height:60px;font-family:inherit;">${md.notes||''}</textarea>
    </div>
    <button onclick="saveMortgageData()" style="margin-top:12px;background:#1a56db;color:white;border:none;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer;">💾 שמור</button>
  </div>`;

  // Smart suggestions
  html += '<div class="card" style="margin-top:18px;"><h3>💡 כלים ומידע שימושי</h3><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">';
  const suggestions = [
    {icon:'🔄',title:'מחזור משכנתא',desc:'מחזור יכול לחסוך אלפי שקלים בשנה. מומלץ לבדוק כל 3-5 שנים.',color:'#1a56db'},
    {icon:'📊',title:'מסלולי ריבית',desc:'שקול שילוב בין פריים, קבועה צמודה ולא צמודה לפי פרופיל הסיכון שלך.',color:'#7c3aed'},
    {icon:'⬆️',title:'תשלומים מוקדמים',desc:'תשלום עודף ב-1,000₪/חודש יכול לקצר את המשכנתא ב-5-8 שנים.',color:'#10b981'},
    {icon:'🏦',title:'ביטוח משכנתא',desc:'בדוק השוואת מחירים לביטוח חיים ומבנה — לרוב ניתן לחסוך 30-50%.',color:'#f59e0b'},
  ];
  suggestions.forEach(s=>{
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;flex:1;min-width:200px;">
      <div style="font-size:24px;margin-bottom:6px;">${s.icon}</div>
      <div style="font-weight:700;font-size:14px;color:${s.color};margin-bottom:4px;">${s.title}</div>
      <div style="font-size:12px;color:#64748b;">${s.desc}</div>
    </div>`;
  });
  html += '</div></div>';

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// INVESTMENTS TAB
// ═══════════════════════════════════════════════════════

let investmentsData = JSON.parse(localStorage.getItem('investmentsData') || '{}');
// { portfolioValue: 0, pensionValue: 0, savingsFund: 0, notes: '' }

function saveInvestmentsData(){
  const get = id => (document.getElementById(id)||{}).value||'';
  investmentsData = {
    portfolioValue: parseFloat(get('inv-portfolio'))||0,
    pensionValue:   parseFloat(get('inv-pension'))||0,
    savingsFund:    parseFloat(get('inv-savings-fund'))||0,
    trainingFund:   parseFloat(get('inv-training-fund'))||0,
    notes:          get('inv-notes'),
  };
  localStorage.setItem('investmentsData', JSON.stringify(investmentsData));
  renderInvestmentsTab();
}

function renderInvestmentsTab(){
  const el = document.getElementById('investmentsContent');
  if(!el) return;

  // Auto-detect investment transactions
  const invCats = ['השקעות ונייר ערך','חיסכון ופקדונות','העברת כספים'];
  const invTxs = TRANSACTIONS.filter(t => invCats.includes(getEffectiveCat(t)));
  const totalInvested = invTxs.reduce((s,t)=>s+t.amount, 0);

  const byMonth = {};
  invTxs.forEach(t=>{ if(!byMonth[t.month]) byMonth[t.month]=0; byMonth[t.month]+=t.amount; });
  const monthlyAmts = Object.values(byMonth);
  const avgMonthly = monthlyAmts.length ? monthlyAmts.reduce((s,v)=>s+v,0)/monthlyAmts.length : 0;

  const id = investmentsData;
  const totalKnown = (id.portfolioValue||0)+(id.pensionValue||0)+(id.savingsFund||0)+(id.trainingFund||0);

  // Income context — use bank income data directly
  const avgBankIncome = BANK_INCOME.length > 0
    ? BANK_INCOME.reduce((s,b)=>s+b.amount,0) / Math.max(1,[...new Set(BANK_INCOME.map(b=>b.month))].length)
    : 0;
  const effectiveIncome = avgBankIncome; // from actual bank transactions

  const invRatio = effectiveIncome > 0 && avgMonthly > 0 ? (avgMonthly/effectiveIncome*100).toFixed(0) : null;

  // Recommendation: should invest at least 15-20% of income
  const recAmt = effectiveIncome > 0 ? effectiveIncome * 0.15 : 0;
  const diffAmt = recAmt - avgMonthly;

  // Alert
  const invAlert = !invRatio ? '' :
    parseFloat(invRatio) >= 20 ? `<div class="benchmark-alert success" style="margin-bottom:14px;">🌟 מצוין! אתה מחסכן <strong>${invRatio}%</strong> מהכנסתך — מעל ממוצע המומלץ (15%)</div>` :
    parseFloat(invRatio) >= 15 ? `<div class="benchmark-alert success" style="margin-bottom:14px;">✅ אתה מחסכן <strong>${invRatio}%</strong> מהכנסתך — עומד ביעד המינימלי</div>` :
    parseFloat(invRatio) > 0   ? `<div class="benchmark-alert warning" style="margin-bottom:14px;">⚠️ אתה מחסכן רק <strong>${invRatio}%</strong> מהכנסתך. מומלץ לפחות 15% (${fmt(recAmt)}/חודש). חסר ${fmt(diffAmt)}/חודש.</div>` :
    effectiveIncome > 0 ? `<div class="benchmark-alert warning" style="margin-bottom:14px;">💡 לא זוהו הפקדות חיסכון חודשיות. מומלץ להפקיד לפחות ${fmt(recAmt)}/חודש (15% מהכנסה)</div>` : '';

  let html = '';
  html += invAlert;

  // KPIs
  html += '<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">'
    + `<div class="kpi-card" style="flex:1;min-width:120px;"><div class="kpi-label">הפקדה ממוצע/חודש</div><div class="kpi-value" style="color:#7c3aed;">${avgMonthly>0?fmt(avgMonthly):'—'}</div></div>`
    + `<div class="kpi-card" style="flex:1;min-width:120px;"><div class="kpi-label">הפקדות בתקופה</div><div class="kpi-value">${fmt(totalInvested)}</div></div>`
    + (totalKnown>0 ? `<div class="kpi-card" style="flex:1;min-width:120px;"><div class="kpi-label">סה"כ תיק (ידני)</div><div class="kpi-value" style="color:#10b981;">${fmt(totalKnown)}</div></div>` : '')
    + (invRatio ? `<div class="kpi-card" style="flex:1;min-width:120px;"><div class="kpi-label">% מהכנסה</div><div class="kpi-value" style="${parseFloat(invRatio)>=15?'color:#10b981;':'color:#f59e0b;'}">${invRatio}%</div></div>` : '')
    + '</div>';

  // Portfolio breakdown (manual)
  if(totalKnown > 0){
    const segments = [
      {label:'תיק השקעות', val:id.portfolioValue||0, color:'#1a56db'},
      {label:'פנסיה', val:id.pensionValue||0, color:'#10b981'},
      {label:'קרן השתלמות', val:id.trainingFund||0, color:'#f59e0b'},
      {label:'קופת גמל / חיסכון', val:id.savingsFund||0, color:'#7c3aed'},
    ].filter(s=>s.val>0);

    html += '<div class="card" style="margin-bottom:18px;"><h3>💼 תמהיל תיק נוכחי</h3><div style="margin-top:12px;">';
    segments.forEach(s=>{
      const pct = (s.val/totalKnown*100).toFixed(0);
      html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="min-width:120px;font-size:13px;font-weight:600;">${s.label}</div>
        <div style="flex:1;background:#f1f5f9;border-radius:6px;height:14px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${s.color};border-radius:6px;"></div>
        </div>
        <div style="min-width:80px;text-align:left;font-weight:700;">${fmt(s.val)}</div>
        <div style="min-width:35px;text-align:left;font-size:12px;color:#64748b;">${pct}%</div>
      </div>`;
    });
    html += '</div></div>';
  }

  // Monthly investment trend
  if(Object.keys(byMonth).length > 0){
    html += '<div class="card" style="margin-bottom:18px;"><h3>📅 הפקדות חודשיות (מזוהות)</h3><div style="margin-top:10px;">';
    Object.entries(byMonth).forEach(([month,amt])=>{
      const w = avgMonthly > 0 ? Math.min(100,(amt/avgMonthly)*70) : 30;
      html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div style="min-width:100px;font-weight:600;font-size:13px;">${month}</div>
        <div style="flex:1;background:#f1f5f9;border-radius:4px;height:10px;overflow:hidden;">
          <div style="width:${w}%;height:100%;background:#7c3aed;border-radius:4px;"></div>
        </div>
        <div style="font-weight:700;font-size:14px;text-align:left;min-width:85px;">${fmt(amt)}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  // Manual portfolio form
  html += `<div class="card" style="margin-bottom:18px;"><h3>✏️ יתרות תיק (ידני)</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:12px;">
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">💹 תיק השקעות / ני"ע (₪)</label>
        <input id="inv-portfolio" type="number" value="${id.portfolioValue||''}" placeholder="0" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">🏛️ פנסיה (₪)</label>
        <input id="inv-pension" type="number" value="${id.pensionValue||''}" placeholder="0" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">📚 קרן השתלמות (₪)</label>
        <input id="inv-training-fund" type="number" value="${id.trainingFund||''}" placeholder="0" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">🏦 קופת גמל / פיקדון (₪)</label>
        <input id="inv-savings-fund" type="number" value="${id.savingsFund||''}" placeholder="0" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;"></div>
    </div>
    <div style="margin-top:10px;"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">הערות</label>
      <textarea id="inv-notes" placeholder="לדוגמא: תיק IB, מניות ישראל, קרן מחקה S&P500..." style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;width:100%;box-sizing:border-box;min-height:60px;font-family:inherit;">${id.notes||''}</textarea>
    </div>
    <button onclick="saveInvestmentsData()" style="margin-top:12px;background:#1a56db;color:white;border:none;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer;">💾 שמור</button>
  </div>`;

  // Investment suggestions based on profile
  html += '<div class="card"><h3>💡 אפיקי השקעה מומלצים לבחינה</h3><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">';
  const invSuggestions = [
    {icon:'📈',title:'קרן מחקה S&P500',desc:'השקעה פסיבית במניות 500 החברות הגדולות בארה"ב. עלות נמוכה, תשואה היסטורית 10%/שנה.', color:'#1a56db',tag:'מניות'},
    {icon:'🏠',title:'נדל"ן להשקעה',desc:'דירה להשכרה יוצרת הכנסה פסיבית. בדוק תשואה של 3-5% ברוטו.',color:'#f59e0b',tag:'נדל"ן'},
    {icon:'🏛️',title:'קרן פנסיה / גמל',desc:'ניצול טבות מס על הפקדות מעל התקרה. שקול גמל להשקעה לנזילות.',color:'#10b981',tag:'פנסיה'},
    {icon:'📚',title:'קרן השתלמות',desc:'הטבת המס הטובה ביותר — 6% שכר. ניתן לנצל גם אחרי 6 שנים.',color:'#7c3aed',tag:'מס'},
    {icon:'💵',title:'אגרות חוב ממשלתיות',desc:'סיכון נמוך, תשואה צנועה. מתאים לחלק ה"בטוח" של התיק.',color:'#0891b2',tag:'אגח'},
    {icon:'🌍',title:'פיזור גלובלי',desc:'אל תשים הכל בשוק ישראלי — פזר לארה"ב, אירופה, שווקים מתפתחים.',color:'#64748b',tag:'פיזור'},
  ];
  invSuggestions.forEach(s=>{
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;flex:1;min-width:200px;max-width:calc(33% - 12px);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <span style="font-size:24px;">${s.icon}</span>
        <span style="background:${s.color}22;color:${s.color};border-radius:8px;padding:2px 8px;font-size:10px;font-weight:700;">${s.tag}</span>
      </div>
      <div style="font-weight:700;font-size:14px;color:${s.color};margin-bottom:4px;">${s.title}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.4;">${s.desc}</div>
    </div>`;
  });
  html += '</div></div>';

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// CASH FLOW CALENDAR — enhanced in מאזן tab
// ═══════════════════════════════════════════════════════

function renderCashFlowCalendar(){
  const el = document.getElementById('cashFlowCalendar');
  if(!el) return;

  // Total known balance
  const totalBalance = STATEMENT_BALANCES.reduce((s,b)=>s+(b.balance||0),0);
  if(totalBalance === 0){
    el.innerHTML = '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;font-size:13px;color:#92400e;">⚠️ עדכן יתרות חשבון בדף החשבון לקבלת המלצה מדויקת</div>';
    return;
  }

  // Get recurring (fixed) transactions to project forward
  const fixedTxs = TRANSACTIONS.filter(t => t.chargeType === 'קבוע' && getCatType(getEffectiveCat(t)) === 'expense');
  const byCard = {};
  fixedTxs.forEach(t=>{
    if(!byCard[t.card]) byCard[t.card] = {total:0, count:0};
    byCard[t.card].total += t.amount; byCard[t.card].count++;
  });

  // Known upcoming income (from BANK_INCOME pattern — estimate next month)
  const incomeEntries = BANK_INCOME;
  const avgIncome = incomeEntries.length > 0
    ? incomeEntries.reduce((s,b)=>s+b.amount,0) / [...new Set(incomeEntries.map(b=>b.month))].length
    : 0; // no income data available — bank data required

  // CC billing cycle - typically charges hit bank on 10th of month
  const ccMonthlyAvg = TRANSACTIONS.filter(t => CC_CARDS.includes(t.card) && getCatType(getEffectiveCat(t))==='expense')
    .reduce((s,t,_,a) => s + t.amount/[...new Set(a.map(x=>x.month))].length, 0);

  // Mortgage/loan fixed monthly
  const mortMonthly = TRANSACTIONS.filter(t=>['משכנתא והלוואות','הלוואות'].includes(getEffectiveCat(t)))
    .reduce((s,t,_,a)=>s+t.amount/[...new Set(a.map(x=>x.month))].length,0);

  // Build 30-day projection
  const today = new Date();
  const next30 = new Date(today); next30.setDate(next30.getDate()+30);

  // Key dates in the next 30 days
  const events = [];

  // Credit card charge date (usually 1st or 10th of next month)
  const ccChargeDate = new Date(today.getFullYear(), today.getMonth()+1, 10);
  if(ccChargeDate <= next30){
    events.push({date:ccChargeDate, label:'חיוב כרטיסי אשראי', amount:-ccMonthlyAvg, type:'expense'});
  }

  // Mortgage (usually 1st of month)
  if(mortMonthly > 0){
    const mortDate = new Date(today.getFullYear(), today.getMonth()+1, 1);
    if(mortDate <= next30) events.push({date:mortDate, label:'תשלום משכנתא', amount:-mortMonthly, type:'expense'});
  }

  // Salary (usually 5th-10th of month)
  const salaryDate = new Date(today.getFullYear(), today.getMonth()+1, 5);
  if(salaryDate <= next30 && avgIncome > 0){
    events.push({date:salaryDate, label:'הכנסה צפויה', amount:avgIncome, type:'income'});
  }

  events.sort((a,b)=>a.date-b.date);

  // Running balance simulation
  let runningBalance = totalBalance;
  let minBalance = totalBalance;
  let minDate = null;
  const dayEvents = events.map(ev=>{
    runningBalance += ev.amount;
    if(runningBalance < minBalance){ minBalance=runningBalance; minDate=ev.date; }
    return {...ev, runningBalance};
  });

  // Buffer recommendation (2 months expenses)
  const avgMonthlyExp = TRANSACTIONS.filter(t=>getCatType(getEffectiveCat(t))==='expense')
    .reduce((s,t,_,a)=>{ const months=[...new Set(a.map(x=>x.month))].length; return s+t.amount/months; },0);
  const bufferNeeded = Math.ceil(avgMonthlyExp * 1.5 / 5000) * 5000; // round to nearest 5k
  const safeToTransfer = Math.max(0, totalBalance - bufferNeeded);
  const transferSuggestion = Math.floor(safeToTransfer / 5000) * 5000;

  let html = '';

  // Recommendation box
  html += `<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:14px;padding:18px 20px;margin-bottom:16px;">
    <div style="font-size:16px;font-weight:800;color:#166534;margin-bottom:10px;">💡 המלצת העברה לחיסכון</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:150px;"><div style="font-size:12px;color:#64748b;margin-bottom:3px;">יתרה נוכחית</div><div style="font-size:20px;font-weight:800;color:#1e293b;">${fmt(totalBalance)}</div></div>
      <div style="flex:1;min-width:150px;"><div style="font-size:12px;color:#64748b;margin-bottom:3px;">בופר מינימלי מומלץ</div><div style="font-size:20px;font-weight:800;color:#7c3aed;">${fmt(bufferNeeded)}</div><div style="font-size:10px;color:#94a3b8;">≈ 1.5 חודשי הוצאות</div></div>
      <div style="flex:1;min-width:150px;background:white;border-radius:10px;padding:12px 14px;border:1.5px solid #10b981;">
        <div style="font-size:12px;color:#064e3b;font-weight:700;margin-bottom:3px;">✅ מומלץ להעביר</div>
        <div style="font-size:24px;font-weight:900;color:#10b981;">${transferSuggestion > 0 ? fmt(transferSuggestion) : '—'}</div>
        ${transferSuggestion > 0 ? '<div style="font-size:11px;color:#64748b;">לחיסכון / השקעה</div>' : '<div style="font-size:11px;color:#dc2626;">יתרה לא מספיקה לבופר</div>'}
      </div>
    </div>
  </div>`;

  // 30-day cash flow events
  if(dayEvents.length > 0){
    html += '<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:14px;color:#475569;margin-bottom:10px;">📅 אירועים פיננסיים צפויים (30 יום)</div>';
    dayEvents.forEach(ev=>{
      const isIncome = ev.type === 'income';
      const dateStr = ev.date.toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit'});
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid ${isIncome?'#86efac':'#fca5a5'};border-radius:10px;margin-bottom:6px;background:${isIncome?'#f0fdf4':'#fef2f2'};">
        <span style="font-size:18px;">${isIncome?'💰':'💳'}</span>
        <div style="flex:1;"><div style="font-weight:600;font-size:13px;">${ev.label}</div><div style="font-size:11px;color:#64748b;">${dateStr}</div></div>
        <div style="font-weight:800;font-size:15px;color:${isIncome?'#10b981':'#ef4444'};">${isIncome?'+':''}${fmt(Math.abs(ev.amount))}</div>
        <div style="font-size:12px;color:#94a3b8;min-width:80px;text-align:left;">יתרה: ${fmt(ev.runningBalance)}</div>
      </div>`;
    });
    html += '</div>';

    if(minBalance < bufferNeeded * 0.8){
      html += `<div class="benchmark-alert danger">🚨 בתאריך ${minDate?.toLocaleDateString('he-IL')} היתרה הצפויה (${fmt(minBalance)}) פחות מהבופר המינימלי. שקול להימנע מהעברה לחיסכון החודש.</div>`;
    }
  }

  // Context: when is it good to transfer
  html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12px;color:#475569;">
    <div style="font-weight:700;margin-bottom:6px;">🗓️ מתי כדאי להעביר לחיסכון?</div>
    עדיף להעביר <strong>אחרי קבלת משכורת ולפני החיוב הגדול</strong> (בד"כ בין ה-6 ל-9 לחודש).
    כך וודא שהיתרה מכסה את כל ההתחייבויות הקרובות.
  </div>`;

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// BENCHMARK ALERTS — add to Overview/Categories screens
// ═══════════════════════════════════════════════════════

function renderBenchmarkAlerts(){
  const el = document.getElementById('benchmarkAlertsPanel');
  if(!el) return;
  if(!userProfile.familyStatus){ el.innerHTML=''; return; }

  const data = getFiltered().filter(t=>t.type!=='פנימי');
  const months = [...new Set(data.map(t=>t.month))];
  const numMonths = months.length || 1;

  const byCategory = {};
  data.forEach(t=>{ const c=getEffectiveCat(t); if(!byCategory[c]) byCategory[c]=0; byCategory[c]+=t.amount; });

  const alerts = [];
  Object.entries(byCategory).forEach(([cat, total])=>{
    const monthlyAvg = total / numMonths;
    const alert = getBenchmarkAlert(cat, monthlyAvg);
    if(alert){
      const bm = alert.bm;
      alerts.push({cat, monthlyAvg, bm, type: alert.type, pct: alert.pct});
    }
  });

  if(alerts.length === 0){ el.innerHTML=''; return; }

  alerts.sort((a,b)=>b.pct-a.pct);

  let html = `<div style="background:${alerts.some(a=>a.type==='danger')?'#fef2f2':'#fffbeb'};border:1.5px solid ${alerts.some(a=>a.type==='danger')?'#fca5a5':'#fde68a'};border-radius:12px;padding:14px 16px;margin-bottom:16px;">
    <div style="font-weight:800;font-size:14px;margin-bottom:10px;color:#1e293b;">🔍 השוואה לממוצע לאומי — פרופיל: ${getProfileLabel()}</div>
    <div style="display:flex;flex-direction:column;gap:8px;">`;
  alerts.forEach(a=>{
    const icon = a.type==='danger'?'🔴':'⚠️';
    html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span>${icon}</span>
      <span style="font-weight:700;flex:1;">${a.cat}</span>
      <span style="font-size:12px;color:#64748b;">שלך: <strong>${fmt(a.monthlyAvg)}</strong>/חודש</span>
      <span style="font-size:12px;color:#64748b;">ממוצע: ${fmt(a.bm)}/חודש</span>
      <span style="background:${a.type==='danger'?'#fee2e2':'#fef3c7'};color:${a.type==='danger'?'#dc2626':'#92400e'};border-radius:8px;padding:2px 8px;font-size:12px;font-weight:700;">+${a.pct}% מהממוצע</span>
    </div>`;
  });
  html += '</div></div>';

  el.innerHTML = html;
  // Benchmark alerts + cash flow calendar after every render
  setTimeout(renderBenchmarkAlerts, 50);
  const _savTab = document.getElementById('tab-savings');
  if(_savTab && _savTab.classList.contains('active')) setTimeout(renderCashFlowCalendar, 50);
}

// CSS for benchmark alerts
(function(){
  const s = document.createElement('style');
  s.textContent = `
    .benchmark-alert{padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:10px;}
    .benchmark-alert.success{background:#f0fdf4;border:1px solid #86efac;color:#166534;}
    .benchmark-alert.warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e;}
    .benchmark-alert.danger{background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}
    .modal-overlay.hidden{display:none;}
  `;
  document.head.appendChild(s);
})();