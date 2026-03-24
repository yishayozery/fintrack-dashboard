/**
 * FinTrack Advisor Portal
 * Provides financial advisors with a client management dashboard.
 * v1.9.0 · 2026-03-24
 */

(function(){
'use strict';

/* ══════════════════════════════════════════════
   DEMO DATA — mock clients for prototype
══════════════════════════════════════════════ */
var _DEMO_CLIENTS = [
  {
    id:'c1', name:'ישי עוזרי', email:'yishay@example.com', phone:'0501234567',
    lastUpload:'2026-03-18', healthScore:72, status:'urgent',
    income:18500, expenses:16200, savings:2300, savPct:12,
    topCategories:[{cat:'מסעדות',amt:2100},{cat:'קניות',amt:3400},{cat:'תחבורה',amt:900}],
    urgent:[
      {icon:'💳',text:'עמלות כרטיס אשראי גבוהות — ₪340 לחודש. יש לבקש ביטול.'},
      {icon:'🛡️',text:'כפל ביטוח רכב — נמצאו 2 פוליסות פעילות.'}
    ],
    insights:[
      {icon:'📈',text:'הוצאות קניות עלו 23% לעומת החודש שעבר'},
      {icon:'💡',text:'חיסכון חודשי: 12% מההכנסה — מתחת ליעד של 20%'},
      {icon:'🔁',text:'4 הוראות קבע לא ממופות — מצריכות סיווג'}
    ],
    meetings:[
      {date:'2026-03-10',time:'10:00',notes:'סקירה חודשית — הוצאות מסעדות'},
      {date:'2026-02-12',time:'11:00',notes:'תכנון תקציב שנתי 2026'}
    ]
  },
  {
    id:'c2', name:'שרה כהן', email:'sarah.cohen@example.com', phone:'0529876543',
    lastUpload:'2026-03-20', healthScore:85, status:'ok',
    income:22000, expenses:15800, savings:6200, savPct:28,
    topCategories:[{cat:'מזון',amt:2800},{cat:'בית',amt:1900},{cat:'בידור',amt:1200}],
    urgent:[],
    insights:[
      {icon:'✅',text:'חיסכון מעל ממוצע — 28% מההכנסה'},
      {icon:'📊',text:'הוצאות יציבות 3 חודשים ברציפות'},
      {icon:'🏠',text:'יש לבחון אפשרות מחזור משכנתא — ריבית שוק ירדה'}
    ],
    meetings:[
      {date:'2026-03-05',time:'09:00',notes:'בדיקת אופציות השקעה'},
    ]
  },
  {
    id:'c3', name:'דוד לוי', email:'david.levi@example.com', phone:'0543456789',
    lastUpload:'2026-02-28', healthScore:54, status:'pending',
    income:14000, expenses:13900, savings:100, savPct:0.7,
    topCategories:[{cat:'אשראי',amt:4200},{cat:'ביטוח',amt:1800},{cat:'קניות',amt:3100}],
    urgent:[
      {icon:'⚠️',text:'חודש שעבר לא הועלו קבצים — נתונים חסרים'},
      {icon:'💳',text:'3 כרטיסי אשראי עם חוב מצטבר של ₪18,000'}
    ],
    insights:[
      {icon:'🔴',text:'חיסכון כמעט אפסי — 0.7% מההכנסה'},
      {icon:'💸',text:'הוצאות אשראי גבוהות מהרגיל ב-40%'},
      {icon:'📋',text:'תלוש שכר חסר לחודש פברואר'}
    ],
    meetings:[
      {date:'2026-02-18',time:'14:00',notes:'דחיפות: תכנון מחדש של תקציב'}
    ]
  }
];

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
var _clients   = [];
var _activeId  = null;
var _schedTime = null;
var _advisorName = 'יועץ';

/* ══════════════════════════════════════════════
   LOAD / SAVE clients to localStorage
══════════════════════════════════════════════ */
function _loadClients(){
  try{
    var saved = localStorage.getItem('advisorClients');
    if(saved) _clients = JSON.parse(saved);
    else { _clients = _DEMO_CLIENTS.slice(); _saveClients(); }
  }catch(e){ _clients = _DEMO_CLIENTS.slice(); }
}
function _saveClients(){
  try{ localStorage.setItem('advisorClients', JSON.stringify(_clients)); }catch(e){}
}

/* ══════════════════════════════════════════════
   OPEN / CLOSE PORTAL
══════════════════════════════════════════════ */
window.openAdvisorPortal = function(){
  _loadClients();

  // Get advisor name from stored profile or default
  try{
    var p = JSON.parse(localStorage.getItem('userProfile')||'{}');
    if(p.name) _advisorName = p.name;
  }catch(e){}
  var nameEl = document.getElementById('advisorName');
  if(nameEl) nameEl.textContent = _advisorName;

  // Show portal, hide other screens
  var portal = document.getElementById('advisorPortal');
  if(portal) portal.style.display = 'block';
  var authScreen = document.getElementById('authScreen');
  if(authScreen) authScreen.style.display = 'none';
  var mainApp = document.getElementById('mainApp');
  if(mainApp) mainApp.style.display = 'none';

  _renderClientList();
  _updateStats();
};

window.closeAdvisorPortal = function(){
  var portal = document.getElementById('advisorPortal');
  if(portal) portal.style.display = 'none';
  // Return to auth screen if not logged in
  var authUser = null;
  try{ authUser = JSON.parse(localStorage.getItem('authUser')); }catch(e){}
  if(authUser){
    var mainApp = document.getElementById('mainApp');
    if(mainApp) mainApp.style.display = 'block';
  } else {
    var authScreen = document.getElementById('authScreen');
    if(authScreen) authScreen.style.display = 'block';
  }
};

/* ══════════════════════════════════════════════
   CLIENT LIST RENDERING
══════════════════════════════════════════════ */
var _currentFilter = 'all';

window.advisorFilter = function(btn, filter){
  _currentFilter = filter;
  document.querySelectorAll('.adv-filter').forEach(function(b){
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  _renderClientList();
};

function _renderClientList(){
  var list = document.getElementById('advisorClientList');
  if(!list) return;

  var filtered = _clients.filter(function(c){
    if(_currentFilter === 'all') return true;
    if(_currentFilter === 'urgent') return c.status === 'urgent';
    if(_currentFilter === 'pending') return c.status === 'pending';
    return true;
  });

  var countEl = document.getElementById('advisorClientCount');
  if(countEl) countEl.textContent = _clients.length + ' לקוחות פעילים';

  if(filtered.length === 0){
    list.innerHTML = '<div style="color:#475569;font-size:12px;text-align:center;padding:20px 0;">אין לקוחות בקטגוריה זו</div>';
    return;
  }

  list.innerHTML = filtered.map(function(c){
    var colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#22c55e'];
    var color  = colors[Math.abs(c.name.charCodeAt(0)) % colors.length];
    var initials = c.name.split(' ').map(function(w){return w[0];}).join('').substring(0,2);
    var healthColor = c.healthScore >= 80 ? '#22c55e' : c.healthScore >= 60 ? '#f59e0b' : '#f87171';
    var daysAgo = _daysAgo(c.lastUpload);
    var uploadStr = daysAgo === 0 ? 'היום' : daysAgo === 1 ? 'אתמול' : daysAgo + ' ימים';
    var isSelected = c.id === _activeId;

    return '<div class="adv-client-card'+(isSelected?' selected':'')+'" onclick="advisorSelectClient(\''+c.id+'\')">'
      +'<div class="adv-client-avatar" style="background:'+color+'">'+initials+'</div>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="color:#f1f5f9;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+c.name+'</div>'
        +'<div style="color:#475569;font-size:11px;margin-top:2px;">עודכן: '+uploadStr+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">'
        +'<div class="adv-health-dot" style="background:'+healthColor+';" title="ציון בריאות: '+c.healthScore+'"></div>'
        +'<div style="color:'+healthColor+';font-size:10px;font-weight:700;">'+c.healthScore+'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function _daysAgo(dateStr){
  if(!dateStr) return 99;
  var d = new Date(dateStr);
  var now = new Date();
  return Math.floor((now - d) / 86400000);
}

/* ══════════════════════════════════════════════
   CLIENT DETAIL VIEW
══════════════════════════════════════════════ */
window.advisorSelectClient = function(id){
  _activeId = id;
  var client = _clients.find(function(c){return c.id===id;});
  if(!client) return;

  // Update sidebar selection
  _renderClientList();

  // Populate detail view
  var welcome = document.getElementById('advisorWelcome');
  var detail  = document.getElementById('advisorClientDetail');
  if(welcome) welcome.style.display = 'none';
  if(detail)  detail.style.display  = 'block';

  // Header
  var colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#22c55e'];
  var color  = colors[Math.abs(client.name.charCodeAt(0)) % colors.length];
  var initials = client.name.split(' ').map(function(w){return w[0];}).join('').substring(0,2);
  var avatarEl = document.getElementById('advClientAvatar');
  var nameEl   = document.getElementById('advClientName');
  var emailEl  = document.getElementById('advClientEmail');
  if(avatarEl){ avatarEl.textContent = initials; avatarEl.style.background = color; }
  if(nameEl)   nameEl.textContent = client.name;
  if(emailEl)  emailEl.textContent = client.email + ' · ' + client.phone;

  // Summary cards
  var cardsEl = document.getElementById('advClientCards');
  if(cardsEl){
    var fmt = function(n){ return '₪'+(n||0).toLocaleString('he-IL'); };
    var savColor = client.savPct >= 20 ? '#22c55e' : client.savPct >= 10 ? '#f59e0b' : '#f87171';
    cardsEl.innerHTML = [
      ['💰','הכנסה חודשית', fmt(client.income), '#22c55e'],
      ['💸','הוצאות חודשיות', fmt(client.expenses), '#f87171'],
      ['🏦','חיסכון נטו', fmt(client.savings), savColor],
      ['📊','אחוז חיסכון', client.savPct+'%', savColor]
    ].map(function(row){
      return '<div class="adv-stat-card">'
        +'<div style="font-size:20px;margin-bottom:6px;">'+row[0]+'</div>'
        +'<div class="val" style="color:'+row[3]+'">'+row[2]+'</div>'
        +'<div class="lbl">'+row[1]+'</div>'
        +'</div>';
    }).join('');
  }

  // Urgent actions
  var urgSec  = document.getElementById('advUrgentSection');
  var urgList = document.getElementById('advUrgentList');
  if(urgSec && urgList){
    if(client.urgent && client.urgent.length){
      urgSec.style.display = 'block';
      urgList.innerHTML = client.urgent.map(function(u){
        return '<div class="adv-urgent-item">'
          +'<span style="font-size:18px;">'+u.icon+'</span>'
          +'<span style="color:#fbbf24;flex:1;">'+u.text+'</span>'
          +'<button onclick="advisorSendNote()" style="background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);color:#fbbf24;cursor:pointer;font-size:11px;font-family:inherit;padding:4px 10px;border-radius:7px;">שלח הנחיה</button>'
          +'</div>';
      }).join('');
    } else {
      urgSec.style.display = 'none';
    }
  }

  // Insights
  var insEl = document.getElementById('advClientInsights');
  if(insEl && client.insights && client.insights.length){
    insEl.innerHTML = client.insights.map(function(ins){
      return '<div class="adv-insight-row">'
        +'<span style="font-size:16px;flex-shrink:0;">'+ins.icon+'</span>'
        +'<span>'+ins.text+'</span>'
        +'</div>';
    }).join('');
  }

  // Meetings
  var meetEl = document.getElementById('advMeetingHistory');
  if(meetEl){
    if(client.meetings && client.meetings.length){
      meetEl.innerHTML = client.meetings.map(function(m){
        return '<div class="adv-meeting-row">'
          +'<span style="font-size:14px;">📅</span>'
          +'<span style="color:#3b82f6;font-weight:600;direction:ltr;">'+m.date+'</span>'
          +'<span style="color:#94a3b8;">'+m.time+'</span>'
          +'<span style="flex:1;color:#cbd5e1;">'+m.notes+'</span>'
          +'</div>';
      }).join('');
    } else {
      meetEl.innerHTML = '<div style="color:#475569;font-size:12px;">אין פגישות קודמות</div>';
    }
  }
};

/* ══════════════════════════════════════════════
   WHATSAPP
══════════════════════════════════════════════ */
window.advisorOpenWhatsApp = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  if(!client) return;
  var phone = (client.phone||'').replace(/\D/g,'');
  if(phone.startsWith('0')) phone = '972' + phone.slice(1);
  var msg = encodeURIComponent('שלום '+client.name+', זה '+_advisorName+' מ-FinTrack. הייתי רוצה לעדכן אותך לגבי המצב הפיננסי החודשי שלך.');
  var url = 'https://wa.me/'+phone+'?text='+msg;
  window.open(url, '_blank');
};

/* ══════════════════════════════════════════════
   SCHEDULE MODAL
══════════════════════════════════════════════ */
window.advisorOpenSchedule = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  if(!client) return;

  var modal = document.getElementById('advisorScheduleModal');
  if(!modal) return;
  modal.style.display = 'flex';

  var nameEl = document.getElementById('schedClientName');
  if(nameEl) nameEl.textContent = client.name;

  // Set min date to today
  var dateEl = document.getElementById('schedDate');
  if(dateEl){
    var today = new Date().toISOString().split('T')[0];
    dateEl.min = today;
    dateEl.value = today;
  }

  // Reset time selection
  _schedTime = null;
  document.querySelectorAll('.sched-slot').forEach(function(b){ b.classList.remove('active'); });
  var notesEl = document.getElementById('schedNotes');
  if(notesEl) notesEl.value = '';
};

window.closeScheduleModal = function(){
  var modal = document.getElementById('advisorScheduleModal');
  if(modal) modal.style.display = 'none';
};

window.selectTimeSlot = function(btn, time){
  _schedTime = time;
  document.querySelectorAll('.sched-slot').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
};

window.confirmSchedule = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  if(!client) return;

  var dateEl  = document.getElementById('schedDate');
  var notesEl = document.getElementById('schedNotes');
  var date    = dateEl ? dateEl.value : '';
  var notes   = notesEl ? notesEl.value.trim() : '';

  if(!date){ alert('יש לבחור תאריך'); return; }
  if(!_schedTime){ alert('יש לבחור שעה'); return; }

  // Save meeting to client record
  if(!client.meetings) client.meetings = [];
  client.meetings.unshift({date:date, time:_schedTime, notes:notes||'פגישה תוזמנה'});
  _saveClients();

  closeScheduleModal();
  advisorSelectClient(_activeId);

  if(typeof showToast === 'function'){
    showToast('✅ פגישה תוזמנה עם '+client.name+' ב-'+date+' '+_schedTime);
  } else {
    alert('פגישה תוזמנה עם '+client.name+' ב-'+date+' '+_schedTime);
  }
};

/* ══════════════════════════════════════════════
   NOTE / MESSAGE MODAL
══════════════════════════════════════════════ */
window.advisorSendNote = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  if(!client) return;

  var modal = document.getElementById('advisorNoteModal');
  if(!modal) return;
  modal.style.display = 'flex';

  var nameEl = document.getElementById('noteClientName');
  if(nameEl) nameEl.textContent = client.name;

  var textEl = document.getElementById('noteText');
  if(textEl) textEl.value = '';
};

window.closeNoteModal = function(){
  var modal = document.getElementById('advisorNoteModal');
  if(modal) modal.style.display = 'none';
};

window.selectNoteTemplate = function(btn){
  var tmpl = btn.dataset.tmpl;
  var textEl = document.getElementById('noteText');
  if(textEl) textEl.value = tmpl;
  // Highlight selected
  document.querySelectorAll('[data-tmpl]').forEach(function(b){
    b.style.borderColor = '#1e3a5f'; b.style.color = '#94a3b8';
  });
  btn.style.borderColor = '#3b82f6'; btn.style.color = '#93c5fd';
};

window.sendNoteViaApp = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  var textEl = document.getElementById('noteText');
  var text   = textEl ? textEl.value.trim() : '';
  if(!text){ alert('יש לכתוב הודעה'); return; }

  // Save note to client
  if(!client.notes) client.notes = [];
  client.notes.unshift({date:new Date().toISOString().split('T')[0], text:text});
  _saveClients();

  closeNoteModal();
  if(typeof showToast === 'function'){
    showToast('📩 הנחיה נשלחה ל-'+client.name);
  } else {
    alert('הנחיה נשלחה ל-'+client.name);
  }
};

window.sendNoteViaWhatsApp = function(){
  var client = _clients.find(function(c){return c.id===_activeId;});
  var textEl = document.getElementById('noteText');
  var text   = textEl ? textEl.value.trim() : '';
  if(!text){ alert('יש לכתוב הודעה'); return; }

  var phone = (client.phone||'').replace(/\D/g,'');
  if(phone.startsWith('0')) phone = '972' + phone.slice(1);
  var msg = encodeURIComponent('שלום '+client.name+', '+_advisorName+' כאן:\n\n'+text);
  closeNoteModal();
  window.open('https://wa.me/'+phone+'?text='+msg, '_blank');
};

/* ══════════════════════════════════════════════
   DEMO CLIENT ADD
══════════════════════════════════════════════ */
window.advisorAddDemoClient = function(){
  var names = ['רון אברהם','מיכל זהבי','אבי פרידמן','נועה שפירא','יוסי בר-לב'];
  var idx = _clients.length % names.length;
  var newClient = {
    id: 'c'+Date.now(), name: names[idx],
    email: names[idx].split(' ')[0].toLowerCase()+'@example.com',
    phone: '05'+Math.floor(10000000+Math.random()*89999999),
    lastUpload: new Date().toISOString().split('T')[0],
    healthScore: Math.floor(50+Math.random()*50),
    status: ['ok','pending','urgent'][Math.floor(Math.random()*3)],
    income: Math.floor(15000+Math.random()*15000),
    expenses: Math.floor(12000+Math.random()*12000),
    savings: 0, savPct: 0,
    topCategories: [],
    urgent: [], insights: [{icon:'🆕',text:'לקוח חדש — ממתין לנתונים ראשונים'}],
    meetings: []
  };
  newClient.savings = newClient.income - newClient.expenses;
  newClient.savPct  = Math.round(newClient.savings/newClient.income*100);
  _clients.push(newClient);
  _saveClients();
  _renderClientList();
  _updateStats();
  advisorSelectClient(newClient.id);
};

/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
function _updateStats(){
  var urgent   = _clients.filter(function(c){return c.status==='urgent';}).length;
  var meetings = _clients.reduce(function(acc,c){
    return acc + (c.meetings||[]).filter(function(m){
      var d = new Date(m.date);
      var now = new Date();
      var weekAhead = new Date(now.getTime()+7*86400000);
      return d >= now && d <= weekAhead;
    }).length;
  },0);

  var s1 = document.getElementById('advStatClients');
  var s2 = document.getElementById('advStatUrgent');
  var s3 = document.getElementById('advStatMeetings');
  if(s1) s1.textContent = _clients.length;
  if(s2) s2.textContent = urgent;
  if(s3) s3.textContent = meetings;
}

/* ══════════════════════════════════════════════
   VIRTUAL ADVISOR — push recommendations
   Shown inside user's dashboard as an AI panel
══════════════════════════════════════════════ */
window.initVirtualAdvisor = function(data){
  if(!data || !data.transactions) return;
  var recs = _buildRecommendations(data);
  _renderVirtualAdvisorPanel(recs);
};

function _buildRecommendations(data){
  var recs = [];
  var txns = data.transactions || [];

  // 1. High credit card fees
  var feeTxns = txns.filter(function(t){
    var n = (t.name||'').toLowerCase();
    return n.includes('עמלה') || n.includes('דמי') || n.includes('fee') || n.includes('commission');
  });
  if(feeTxns.length > 0){
    var feeTotal = feeTxns.reduce(function(a,t){return a+(t.amount||0);},0);
    recs.push({
      priority:'high', icon:'💳',
      title:'עמלות גבוהות — '+Math.round(feeTotal)+' ₪',
      text:'זיהינו עמלות כרטיס אשראי. ניתן לבקש ביטול מחברת האשראי.',
      action:'התקשר לחברת האשראי',
      actionType:'call'
    });
  }

  // 2. Low savings rate
  if(data.savPct !== undefined && data.savPct < 15){
    recs.push({
      priority:'medium', icon:'💰',
      title:'חיסכון נמוך — '+Math.round(data.savPct||0)+'%',
      text:'יעד מומלץ הוא 20% מההכנסה. שקול להגדיר הוראת קבע לחיסכון אוטומטי.',
      action:'הגדר הוראת קבע',
      actionType:'info'
    });
  }

  // 3. Insurance duplicate (heuristic)
  var insuranceTxns = txns.filter(function(t){
    var n = (t.name||'').toLowerCase();
    return n.includes('ביטוח') || n.includes('insurance') || n.includes('פוליסה');
  });
  var uniqueInsurers = {};
  insuranceTxns.forEach(function(t){ uniqueInsurers[t.name] = (uniqueInsurers[t.name]||0)+1; });
  var dupes = Object.keys(uniqueInsurers).filter(function(k){return uniqueInsurers[k]>1;});
  if(dupes.length > 0 || insuranceTxns.length > 3){
    recs.push({
      priority:'medium', icon:'🛡️',
      title:'בדיקת ביטוחים',
      text:'נמצאו '+insuranceTxns.length+' חיובי ביטוח. מומלץ לבדוק כפלים ותאריכי תפוגה.',
      action:'קבל בדיקת ביטוח',
      actionType:'lead'
    });
  }

  // 4. Salary slip missing
  if(data.hasSalarySlip === false){
    recs.push({
      priority:'low', icon:'📋',
      title:'תלוש שכר חסר',
      text:'לא זוהה תלוש שכר לחודש האחרון. הוספת תלוש תשפר את ניתוח ההכנסה.',
      action:'העלה תלוש שכר',
      actionType:'upload'
    });
  }

  // 5. Mortgage check
  var mortgageTxns = txns.filter(function(t){
    var n = (t.name||'').toLowerCase();
    return n.includes('משכנתא') || n.includes('mortgage') || n.includes('בנק') && t.amount > 2000;
  });
  if(mortgageTxns.length > 0){
    recs.push({
      priority:'low', icon:'🏠',
      title:'בדיקת מחזור משכנתא',
      text:'זיהינו תשלומי משכנתא. כדאי לבדוק האם ניתן למחזר בתנאים טובים יותר.',
      action:'בדוק מחזור',
      actionType:'lead'
    });
  }

  return recs;
}

function _renderVirtualAdvisorPanel(recs){
  var container = document.getElementById('virtualAdvisorPanel');
  if(!container) return;
  if(!recs || recs.length === 0){
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  var priorityColor = {high:'#f87171', medium:'#fbbf24', low:'#3b82f6'};
  var priorityLabel = {high:'דחוף', medium:'מומלץ', low:'לתשומת לבך'};

  container.innerHTML = '<div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:16px;padding:18px 20px;">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">'
      +'<span style="font-size:22px;">🤖</span>'
      +'<div><div style="color:#f1f5f9;font-weight:700;font-size:14px;">יועץ וירטואל</div>'
      +'<div style="color:#475569;font-size:11px;">'+recs.length+' המלצות על בסיס הנתונים שלך</div></div>'
    +'</div>'
    + recs.map(function(r){
      var col = priorityColor[r.priority] || '#3b82f6';
      var lbl = priorityLabel[r.priority] || '';
      return '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:13px 15px;margin-bottom:10px;display:flex;align-items:flex-start;gap:12px;">'
        +'<span style="font-size:20px;flex-shrink:0;">'+r.icon+'</span>'
        +'<div style="flex:1;">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
            +'<span style="color:'+col+';font-weight:700;font-size:13px;">'+r.title+'</span>'
            +'<span style="background:'+col+'22;color:'+col+';font-size:10px;font-weight:700;padding:1px 7px;border-radius:5px;">'+lbl+'</span>'
          +'</div>'
          +'<div style="color:#94a3b8;font-size:12px;line-height:1.5;">'+r.text+'</div>'
          +'<button onclick="virtualAdvisorAction(\''+r.actionType+'\',\''+encodeURIComponent(r.text)+'\')" style="margin-top:8px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:#93c5fd;cursor:pointer;font-size:11px;font-family:inherit;padding:4px 12px;border-radius:7px;">'+r.action+' ←</button>'
        +'</div>'
        +'</div>';
    }).join('')
  +'</div>';
}

window.virtualAdvisorAction = function(actionType, encodedText){
  var text = decodeURIComponent(encodedText);
  var advisorPhone = ''; // advisor phone goes here in production
  if(actionType === 'lead'){
    if(typeof showToast === 'function')
      showToast('📤 בקשתך נשלחה — נציג יצור איתך קשר בקרוב');
    else alert('בקשתך נשלחה — נציג יצור איתך קשר בקרוב');
  } else if(actionType === 'call'){
    if(typeof showToast === 'function')
      showToast('📞 התקשר לחברת האשראי שלך וציין: "אני רוצה לבטל עמלות"');
    else alert('התקשר לחברת האשראי שלך וציין: "אני רוצה לבטל עמלות"');
  } else if(actionType === 'upload'){
    // Trigger file upload flow
    var btn = document.getElementById('loadFilesBtn');
    if(btn) btn.click();
    else if(typeof showToast === 'function')
      showToast('📂 לחץ על "טען קבצים חדשים" בכפתור למעלה');
  } else {
    if(typeof showToast === 'function')
      showToast('ℹ️ '+text.substring(0,60));
    else alert(text);
  }
};

})();
