// FinTrack — Auth, Onboarding & Terms



// ===== AUTH SYSTEM =====
(function(){
  // Called after DOM ready
  function checkAuthOnLoad(){
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('authUser')); } catch(e){}
    if(saved && saved.name){
      // Already logged in — sync to profile and show dashboard
      if(!userProfile.name) { userProfile.name = saved.name; }
      if(!userProfile.email && saved.email) { userProfile.email = saved.email; }
      updateHeaderUser();
      // Show main app
      var ma = document.getElementById('mainApp');
      if(ma) ma.style.display = 'block';
      // Check folder
      if(!(_appSettings && _appSettings.folderPath)){
        setTimeout(showFolderStepIfNeeded, 700);
      }
    } else {
      // Show auth screen
      var el = document.getElementById('authScreen');
      if(el) el.style.display = 'flex';
    }
  }

  window.authWithGoogle = function(){
    _showOAuthSim('Google', 'google', '\U0001f171\uFE0F');
  };
  window.authWithFacebook = function(){
    _showOAuthSim('Facebook', 'facebook', '\U0001f1eb');
  };

  function _showOAuthSim(provider, type, icon){
    var ov = document.getElementById('oauthSimOverlay');
    var ic = document.getElementById('oauthSimIcon');
    var ti = document.getElementById('oauthSimTitle');
    var su = document.getElementById('oauthSimSubtitle');
    var pv = document.getElementById('oauthSimProvider');
    var nm = document.getElementById('oauthSimName');
    var em = document.getElementById('oauthSimEmail');
    if(ic) ic.textContent = icon;
    if(ti) ti.textContent = '\u05db\u05e0\u05d9\u05e1\u05d4 \u05e2\u05dd ' + provider;
    if(su) su.textContent = '\u05d1\u05d2\u05e8\u05e1\u05ea \u05d4\u05deו\u05e6\u05e8 \u05d9\u05e4\u05ea\u05d7 \u05d7\u05dcו\u05df ' + provider + ' \u05d0\u05de\u05d9\u05eaי';
    if(pv) pv.value = type;
    if(nm) nm.value = '';
    if(em) em.value = '';
    if(ov) ov.style.display = 'flex';
    setTimeout(function(){ if(nm) nm.focus(); }, 100);
  }

  window.completeOAuthSim = function(){
    var name  = (document.getElementById('oauthSimName')||{}).value || '';
    var email = (document.getElementById('oauthSimEmail')||{}).value || '';
    var prov  = (document.getElementById('oauthSimProvider')||{}).value || 'oauth';
    name = name.trim(); email = email.trim();
    if(!name){ alert('\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd'); return; }
    _completeAuth(name, email, prov);
    var ov = document.getElementById('oauthSimOverlay');
    if(ov) ov.style.display = 'none';
  };

  window.authWithEmail = function(){
    var nameRow = document.getElementById('authNameRow');
    var nameEl  = document.getElementById('authNameInput');
    var emailEl = document.getElementById('authEmailInput');
    var passEl  = document.getElementById('authPassInput');
    var name  = nameEl  ? nameEl.value.trim()  : '';
    var email = emailEl ? emailEl.value.trim() : '';
    var pass  = passEl  ? passEl.value         : '';

    // First click: show name row if hidden
    if(nameRow && nameRow.style.display === 'none'){
      nameRow.style.display = 'block';
      if(nameEl) nameEl.focus();
      return;
    }
    if(!name && email){ name = email.split('@')[0]; }
    if(!name){
      alert('\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd');
      if(nameEl) nameEl.focus();
      return;
    }
    _completeAuth(name, email, 'email');
  };

  function _completeAuth(name, email, provider){
    var authUser = { name: name, email: email, provider: provider, ts: Date.now() };
    localStorage.setItem('authUser', JSON.stringify(authUser));

    // Sync to userProfile
    if(!userProfile.name) userProfile.name = name;
    if(!userProfile.email && email) userProfile.email = email;
    try {
      if(typeof saveProfile === 'function') saveProfile();
      else localStorage.setItem('userProfile', JSON.stringify(userProfile));
    } catch(e){}

    updateHeaderUser();

    var scr = document.getElementById('authScreen');
    if(scr) scr.style.display = 'none';

    // Show main app
    var ma = document.getElementById('mainApp');
    if(ma) ma.style.display = 'block';

    // Check folder
    showOnboardingProfile();
  }

  // ---- FOLDER STEP ----
  window.showFolderStepIfNeeded = function(){
    if(_appSettings && _appSettings.folderPath) return; // already set
    var ov = document.getElementById('folderStepOverlay');
    if(ov) ov.style.display = 'flex';
  };

  window.triggerFolderPick = function(){
    // Try to call existing folder-pick function if it exists
    if(typeof openSetupWizard === 'function'){
      var ov = document.getElementById('folderStepOverlay');
      if(ov) ov.style.display = 'none';
      openSetupWizard();
    } else if(typeof openSettings === 'function'){
      var ov = document.getElementById('folderStepOverlay');
      if(ov) ov.style.display = 'none';
      openSettings();
    } else {
      alert('\u05e0\u05d0 \u05d1\u05d7\u05e8 \u05ea\u05d9\u05e7\u05d9\u05d9\u05d4 \u05d3\u05e8\u05da \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05d4\u05deע\u05e8\u05db\u05ea');
    }
  };

  window.skipFolderStep = function(){
    var ov = document.getElementById('folderStepOverlay');
    if(ov) ov.style.display = 'none';
  };

  // ---- INIT on DOMContentLoaded ----
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(checkAuthOnLoad, 300);
  });

  // Expose for external use (e.g. logout)
  window.logoutAuth = function(){
    localStorage.removeItem('authUser');
    location.reload();
  };
})();


// ══════════════════════════════════════════════════════════
// TERMS OF SERVICE
// ══════════════════════════════════════════════════════════
var _defaultTermsContent = "<h3 style='color:#e2e8f0;'>תנאי שימוש — דשבורד פיננסי חכם</h3><p style='color:#94a3b8;'><strong>עדכון אחרון: מרץ 2026</strong></p><h4 style='color:#93c5fd;margin-top:20px;'>1. כללי</h4><p>השימוש במערכת מהווה הסכמה לתנאים אלה. המערכת מיועדת לניהול פיננסי אישי בלבד ואינה מהווה ייעוץ פיננסי מוסדר.</p><h4 style='color:#93c5fd;margin-top:16px;'>2. פרטיות ואבטחת מידע</h4><p>הנתונים שלך מאוחסנים בענן מאובטח עם הצפנה מלאה. לא נחשוף מידע אישי לצדדים שלישיים ללא הסכמתך המפורשת. אנו עומדים בדרישות תקנות הגנת הפרטיות הישראליות.</p><h4 style='color:#93c5fd;margin-top:16px;'>3. שימוש בנתונים</h4><p>הנתונים הפיננסיים שלך ישמשו אך ורק לצורך הצגת ניתוחים, המלצות ולוחות מחוונים בתוך המערכת. אנו לא מוכרים ולא משתפים נתוני משתמשים.</p><h4 style='color:#93c5fd;margin-top:16px;'>4. אחריות</h4><p>המערכת מספקת כלים לניתוח פיננסי בלבד. ההחלטות הפיננסיות הן באחריות המשתמש בלבד. אין לראות בתכנים המוצגים ייעוץ השקעות, מס או כל ייעוץ פיננסי מוסדר אחר.</p><h4 style='color:#93c5fd;margin-top:16px;'>5. קניין רוחני</h4><p>כל זכויות הקניין הרוחני במערכת שמורות. אין להעתיק, לשכפל או להפיץ את המערכת או חלקים ממנה.</p><h4 style='color:#93c5fd;margin-top:16px;'>6. שינויים בתנאים</h4><p>אנו שומרים לעצמנו את הזכות לעדכן תנאים אלה. שימוש מתמשך במערכת לאחר שינוי התנאים מהווה הסכמה לתנאים המעודכנים.</p><h4 style='color:#93c5fd;margin-top:16px;'>7. יצירת קשר</h4><p>לשאלות ופניות: support@financial-dashboard.co.il</p><br><p style='color:#6ee7b7;text-align:center;font-weight:700;padding:16px;'>— סוף תנאי השימוש —</p>";

function _getTermsContent(){
  return localStorage.getItem('termsContent') || _defaultTermsContent;
}
function openTermsModal(){
  var box = document.getElementById('termsScrollBox');
  var content = document.getElementById('termsContent');
  var acceptBtn = document.getElementById('termsAcceptBtn');
  var hint = document.getElementById('termsScrollHint');
  var modal = document.getElementById('termsModal');
  if(!modal) return;
  if(content) content.innerHTML = _getTermsContent();
  if(box) box.scrollTop = 0;
  if(acceptBtn){ acceptBtn.disabled=true; acceptBtn.style.opacity='0.45'; acceptBtn.style.cursor='not-allowed'; }
  if(hint) hint.style.display='';
  modal.style.display = 'flex';
  setTimeout(checkTermsScroll, 150);
}
function closeTermsModal(){
  var modal = document.getElementById('termsModal');
  if(modal) modal.style.display = 'none';
}
function checkTermsScroll(){
  var box = document.getElementById('termsScrollBox');
  var acceptBtn = document.getElementById('termsAcceptBtn');
  var hint = document.getElementById('termsScrollHint');
  if(!box || !acceptBtn) return;
  var atBottom = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 30);
  if(atBottom){
    acceptBtn.disabled = false;
    acceptBtn.style.opacity = '1';
    acceptBtn.style.cursor = 'pointer';
    if(hint) hint.style.display = 'none';
  }
}
function acceptTermsAndClose(){
  localStorage.setItem('termsAccepted','1');
  closeTermsModal();
  var cb = document.getElementById('authTermsCheck');
  if(cb){ cb.checked = true; toggleAuthBtn(); }
}
function toggleAuthBtn(){
  var cb = document.getElementById('authTermsCheck');
  var btn = document.getElementById('authMainBtn');
  var accepted = cb && cb.checked;
  if(btn){
    btn.disabled = !accepted;
    btn.style.opacity = accepted ? '1' : '0.45';
    btn.style.cursor = accepted ? 'pointer' : 'not-allowed';
  }
}
// Gate Google/Facebook on terms too
(function(){
  var _origG = window.authWithGoogle;
  var _origF = window.authWithFacebook;
  window.authWithGoogle = function(){
    var cb = document.getElementById('authTermsCheck');
    if(!cb || !cb.checked){ openTermsModal(); return; }
    if(typeof _origG === 'function') _origG();
  };
  window.authWithFacebook = function(){
    var cb = document.getElementById('authTermsCheck');
    if(!cb || !cb.checked){ openTermsModal(); return; }
    if(typeof _origF === 'function') _origF();
  };
})();

// Auto-check on load if already accepted
document.addEventListener('DOMContentLoaded', function(){
  if(localStorage.getItem('termsAccepted')==='1'){
    var cb = document.getElementById('authTermsCheck');
    if(cb){ cb.checked=true; toggleAuthBtn(); }
  }
});

// Edit terms from management panel
function openTermsEditor(){
  var current = _getTermsContent();
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:25000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;direction:rtl;';
  modal.innerHTML = '<div style="background:#1e293b;border-radius:16px;width:min(700px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.7);">'
    +'<div style="padding:16px 20px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;">'
    +'<h3 style="color:#f1f5f9;margin:0;font-size:1em;">✏️ עריכת תנאי שימוש (HTML)</h3>'
    +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>'
    +'</div>'
    +'<textarea id="termsEditorArea" style="flex:1;background:#0f172a;color:#e2e8f0;border:none;padding:16px;font-size:12px;font-family:monospace;resize:none;min-height:380px;direction:ltr;tab-size:2;"></textarea>'
    +'<div style="padding:12px 20px;border-top:1px solid #334155;display:flex;gap:10px;justify-content:flex-end;">'
    +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:#334155;color:#94a3b8;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;">ביטול</button>'
    +'<button onclick="_saveTermsContent()" style="background:#3b82f6;color:white;border:none;border-radius:8px;padding:8px 20px;font-weight:700;cursor:pointer;">שמור</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
  setTimeout(function(){ var a=document.getElementById('termsEditorArea'); if(a) a.value=current; },60);
}
function _saveTermsContent(){
  var area = document.getElementById('termsEditorArea');
  if(area && area.value.trim()){
    localStorage.setItem('termsContent', area.value.trim());
    var m = area.closest('div[style*="fixed"]');
    if(m) m.remove();
    if(typeof showToast==='function') showToast('\u2705 תנאי השימוש עודכנו');
  }
}

// ══════════════════════════════════════════════════════════
// ONBOARDING PROFILE STEP
// ══════════════════════════════════════════════════════════
function showOnboardingProfile(){
  var ov = document.getElementById('onboardingProfileOverlay');
  if(ov) ov.style.display = 'flex';
}
function hideOnboardingProfile(){
  var ov = document.getElementById('onboardingProfileOverlay');
  if(ov) ov.style.display = 'none';
}
function goToProfileFromOnboarding(){
  hideOnboardingProfile();
  setTimeout(function(){
    if(typeof openProfileModal==='function') openProfileModal();
    var titleEl = document.getElementById('profileModalTitle');
    if(titleEl) titleEl.textContent = '\u270f\ufe0f השלם את הפרופיל שלך';
  }, 150);
}
function skipOnboardingProfile(){
  hideOnboardingProfile();
  localStorage.setItem('onboardingProfileSkipped','1');
  setTimeout(function(){
    if(typeof showFolderStepIfNeeded==='function') showFolderStepIfNeeded();
  }, 300);
}


// ══════════════════════════════════════════════════════════════
// AUTH UX FIXES v2
// ══════════════════════════════════════════════════════════════

// Password strength
function updatePasswordStrength(){
  var pass = (document.getElementById('authPassInput')||{}).value || '';
  var wrap = document.getElementById('passStrengthWrap');
  var bar  = document.getElementById('passStrengthBar');
  var lbl  = document.getElementById('passStrengthLabel');
  if(!wrap) return;
  if(!pass){ wrap.style.display='none'; return; }
  wrap.style.display='block';

  var score = 0;
  if(pass.length >= 8) score++;
  if(pass.length >= 12) score++;
  if(/[A-Z]/.test(pass)) score++;
  if(/[0-9]/.test(pass)) score++;
  if(/[^A-Za-z0-9]/.test(pass)) score++;

  var pct   = [0,25,50,75,90,100][score];
  var color = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e'][score-1] || '#ef4444';
  var texts = ['','חלשה מאוד','חלשה','בינונית','חזקה','חזקה מאוד'];
  var tclrs = ['','#ef4444','#f97316','#eab308','#84cc16','#22c55e'];

  bar.style.width  = pct+'%';
  bar.style.background = color;
  lbl.textContent  = texts[score] || '';
  lbl.style.color  = tclrs[score] || '#94a3b8';

  // Enable main button only if terms accepted AND pass strength >= 2
  _refreshAuthBtn();
}

function _refreshAuthBtn(){
  var btn = document.getElementById('authMainBtn');
  if(!btn) return;
  var termsOk = localStorage.getItem('termsAccepted')==='1';
  var pass = (document.getElementById('authPassInput')||{}).value||'';
  // For social login, terms is enough. For email, also need pass>=8
  var ok = termsOk;
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '0.45';
  btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
}

function togglePassVisibility(){
  var inp = document.getElementById('authPassInput');
  var btn = document.getElementById('passToggleBtn');
  if(!inp) return;
  if(inp.type==='password'){ inp.type='text'; if(btn) btn.textContent='\uD83D\uDE48'; }
  else { inp.type='password'; if(btn) btn.textContent='\uD83D\uDC41'; }
}

// Override toggleAuthBtn to use new visual checkbox
function toggleAuthBtn(){
  var accepted = localStorage.getItem('termsAccepted')==='1';
  var visual = document.getElementById('authTermsCheckVisual');
  var badge  = document.getElementById('termsReadBadge');
  if(visual){
    if(accepted){
      visual.innerHTML = '<span style="color:#22c55e;font-size:14px;">✓</span>';
      visual.style.borderColor = '#22c55e';
      visual.style.background  = 'rgba(34,197,94,0.15)';
    } else {
      visual.innerHTML = '';
      visual.style.borderColor = '#475569';
      visual.style.background  = 'transparent';
    }
  }
  if(badge) badge.style.display = accepted ? '' : 'none';
  _refreshAuthBtn();
}

// Override acceptTermsAndClose to call new toggleAuthBtn
var _prevAcceptTerms = window.acceptTermsAndClose;
window.acceptTermsAndClose = function(){
  localStorage.setItem('termsAccepted','1');
  closeTermsModal();
  toggleAuthBtn();
};

// On load, restore state
document.addEventListener('DOMContentLoaded', function(){
  if(localStorage.getItem('termsAccepted')==='1') toggleAuthBtn();
});

// Override authWithEmail with improved flow
var _origEmailAuth = window.authWithEmail;
window.authWithEmail = function(){
  var nameEl  = document.getElementById('authNameInput');
  var emailEl = document.getElementById('authEmailInput');
  var passEl  = document.getElementById('authPassInput');
  var name    = nameEl  ? nameEl.value.trim()  : '';
  var email   = emailEl ? emailEl.value.trim() : '';
  var pass    = passEl  ? passEl.value         : '';

  if(!localStorage.getItem('termsAccepted')){
    openTermsModal(); return;
  }
  if(!name){
    nameEl && nameEl.focus();
    _authShake(nameEl);
    _showAuthError('\u05E0\u05D0 \u05DC\u05D4\u05D6\u05D9\u05DF \u05E9\u05DD \u05DE\u05DC\u05D0');
    return;
  }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    emailEl && emailEl.focus();
    _authShake(emailEl);
    _showAuthError('\u05D0\u05E0\u05D0 \u05D4\u05D6\u05DF \u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05D9\u05D9\u05DC \u05EA\u05E7\u05D9\u05E0\u05D4');
    return;
  }
  if(pass.length < 8){
    passEl && passEl.focus();
    _authShake(passEl);
    _showAuthError('\u05E1\u05D9\u05E1\u05DE\u05D0 \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \u05DC\u05E4\u05D7\u05D5\u05EA 8 \u05EA\u05D5\u05D5\u05D9\u05DD');
    return;
  }
  // Show verification step
  _showEmailVerify(email, name, 'email');
};

function _showAuthError(msg){
  var existing = document.getElementById('authErrorMsg');
  if(existing) existing.remove();
  var el = document.createElement('p');
  el.id = 'authErrorMsg';
  el.style.cssText = 'color:#f87171;font-size:13px;margin:8px 0 0;text-align:center;';
  el.textContent = msg;
  var btn = document.getElementById('authMainBtn');
  if(btn) btn.parentNode.insertBefore(el, btn.nextSibling);
  setTimeout(function(){ if(el.parentNode) el.remove(); }, 3000);
}

function _authShake(el){
  if(!el) return;
  el.style.animation='shake .4s ease';
  setTimeout(function(){ el.style.animation=''; },400);
}

// Email verification flow
function _showEmailVerify(email, name, provider){
  var step = document.getElementById('emailVerifyStep');
  var disp = document.getElementById('verifyEmailDisplay');
  if(disp) disp.textContent = email;
  if(step){
    step.style.display = 'flex';
    step._pendingName     = name;
    step._pendingEmail    = email;
    step._pendingProvider = provider || 'email';
  }
  var inp = document.getElementById('verifyCodeInput');
  if(inp){ inp.value=''; setTimeout(function(){ inp.focus(); },200); }
}

function checkVerifyCode(){
  var inp = document.getElementById('verifyCodeInput');
  if(!inp || inp.value.replace(/\s/g,'') !== '123456') return;
  var step = document.getElementById('emailVerifyStep');
  var name = step && step._pendingName;
  var email= step && step._pendingEmail;
  var prov = step && step._pendingProvider;
  if(step) step.style.display='none';
  if(typeof _completeAuth==='function') _completeAuth(name||'', email||'', prov||'email');
}

function skipVerifyForNow(){
  var step = document.getElementById('emailVerifyStep');
  var name = step && step._pendingName;
  var email= step && step._pendingEmail;
  var prov = step && step._pendingProvider;
  if(step) step.style.display='none';
  if(typeof _completeAuth==='function') _completeAuth(name||'', email||'', prov||'email');
}

// Override social auth to also go through verify step
;(function(){
  var _origG2 = window.authWithGoogle;
  var _origF2 = window.authWithFacebook;
  window.authWithGoogle = function(){
    if(!localStorage.getItem('termsAccepted')){ openTermsModal(); return; }
    _showOAuthSimGated('Google','google');
  };
  window.authWithFacebook = function(){
    if(!localStorage.getItem('termsAccepted')){ openTermsModal(); return; }
    _showOAuthSimGated('Facebook','facebook');
  };
})();

function _showOAuthSimGated(provider, type){
  // Use existing oauthSimOverlay
  var ov = document.getElementById('oauthSimOverlay');
  var ic = document.getElementById('oauthSimIcon');
  var ti = document.getElementById('oauthSimTitle');
  var su = document.getElementById('oauthSimSubtitle');
  var pv = document.getElementById('oauthSimProvider');
  var nm = document.getElementById('oauthSimName');
  var em = document.getElementById('oauthSimEmail');
  if(ic) ic.textContent = provider==='Google' ? '\uD83D\uDFE6' : '\uD83D\uDFE6';
  if(ti) ti.textContent = '\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E2\u05DD '+provider;
  if(su) su.textContent = '\u05D1\u05D2\u05E8\u05E1\u05EA \u05D4\u05DE\u05D5\u05E6\u05E8 \u05D9\u05E4\u05EA\u05D7 \u05D7\u05DC\u05D5\u05DF '+provider+' \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA';
  if(pv) pv.value = type;
  if(nm) nm.value='';
  if(em) em.value='';
  if(ov) ov.style.display='flex';
  setTimeout(function(){ if(nm) nm.focus(); },100);
}

// Override completeOAuthSim to use verify step
var _prevCompleteOAuth = window.completeOAuthSim;
window.completeOAuthSim = function(){
  var name  = (document.getElementById('oauthSimName')||{}).value||'';
  var email = (document.getElementById('oauthSimEmail')||{}).value||'';
  var prov  = (document.getElementById('oauthSimProvider')||{}).value||'oauth';
  name=name.trim(); email=email.trim();
  if(!name){ alert('\u05E0\u05D0 \u05DC\u05D4\u05D6\u05D9\u05DF \u05E9\u05DD'); return; }
  var ov = document.getElementById('oauthSimOverlay');
  if(ov) ov.style.display='none';
  if(email){
    _showEmailVerify(email, name, prov);
  } else {
    if(typeof _completeAuth==='function') _completeAuth(name,'',prov);
  }
};

// CSS for shake animation
(function(){
  var s=document.createElement('style');
  s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}';
  document.head && document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════
// PROFILE FORM: pre-fill name/email from auth, hide from form
// ══════════════════════════════════════════════════════════════
;(function(){
  var _origRenderProfileForm = window.renderProfileForm || null;
  // We'll patch by overriding after render — simpler approach:
  // After profile modal opens, fill read-only auth info
  var _origOpenProfile = window.openProfileModal;
  window.openProfileModal = function(){
    if(typeof _origOpenProfile==='function') _origOpenProfile();
    setTimeout(_injectAuthInfoIntoProfile, 50);
  };
})();

function _injectAuthInfoIntoProfile(){
  // Get auth user
  var authUser = null;
  try { authUser = JSON.parse(localStorage.getItem('authUser')); } catch(e){}
  if(!authUser) return;

  // Show a read-only banner at top of profile form
  var existing = document.getElementById('profileAuthBanner');
  if(existing) return; // already shown

  var modal = document.getElementById('profileModal');
  var form = modal && modal.querySelector('#profileForm, .profile-form, form');
  // Find first form element inside profileModal
  var firstInput = modal && modal.querySelector('input, select');
  if(!firstInput) return;
  var container = firstInput.closest('.modal-body, div') || firstInput.parentNode;

  var banner = document.createElement('div');
  banner.id = 'profileAuthBanner';
  banner.style.cssText = 'background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;direction:rtl;';
  banner.innerHTML = '<div style="flex:1;">'
    +'<div style="font-size:11px;color:#64748b;margin-bottom:4px;">פרטי הרישום</div>'
    +'<div style="font-weight:700;color:#e2e8f0;font-size:14px;">'+(authUser.name||'')+'</div>'
    +'<div style="color:#94a3b8;font-size:12px;">'+(authUser.email||'')+'</div>'
    +'</div>'
    +'<span style="color:#22c55e;font-size:20px;">✓</span>';

  // Insert at top of modal body
  var body = modal && (modal.querySelector('.modal-body') || modal.querySelector('[style*="overflow"]'));
  if(body){ body.insertBefore(banner, body.firstChild); }

  // Pre-fill pf-name and pf-email if empty
  var nameEl  = document.getElementById('pf-name');
  var emailEl = document.getElementById('pf-email');
  if(nameEl  && !nameEl.value  && authUser.name)  nameEl.value  = authUser.name;
  if(emailEl && !emailEl.value && authUser.email) emailEl.value = authUser.email;
}

// ══════════════════════════════════════════════════════════════
// SAVE PROFILE → FOLDER STEP (during onboarding)
// ══════════════════════════════════════════════════════════════
;(function(){
  var _origSaveProfile = window.saveProfile;
  window.saveProfile = function(){
    if(typeof _origSaveProfile==='function') _origSaveProfile();
    // After saving, if onboarding not done, go to folder step
    if(!_appSettings.folderPath && !localStorage.getItem('onboardingDone')){
      localStorage.setItem('onboardingDone','1');
      setTimeout(function(){
        if(typeof showFolderStepIfNeeded==='function') showFolderStepIfNeeded();
      }, 400);
    }
  };
})();

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS SUMMARY BAR UPDATE
// ══════════════════════════════════════════════════════════════
;(function(){
  var _origRenderTxTable = window.renderTxTable;
  window.renderTxTable = function(){
    if(typeof _origRenderTxTable==='function') _origRenderTxTable();
    _updateTxSummaryBar();
  };
})();

function _updateTxSummaryBar(){
  var data = (typeof getFiltered==='function') ? getFiltered() : [];
  // Apply current search filter too
  var search = (document.getElementById('txSearch')||{}).value||'';
  if(search){
    var sl = search.toLowerCase();
    data = data.filter(function(t){ return (t.name||'').toLowerCase().includes(sl)||(t.cat||'').toLowerCase().includes(sl); });
  }
  var total = data.reduce(function(s,t){return s+t.amount;},0);
  var count = data.length;
  var avg   = count ? total/count : 0;
  // Date range
  var dates = data.map(function(t){return t.date||'';}).filter(Boolean).sort();
  var rangeText = dates.length ? (dates[0]+' — '+dates[dates.length-1]) : '—';

  var elTotal = document.getElementById('txSumTotal');
  var elCount = document.getElementById('txSumCount');
  var elAvg   = document.getElementById('txSumAvg');
  var elRange = document.getElementById('txSumRange');
  if(elTotal) elTotal.textContent = '\u20AA' + total.toLocaleString('he-IL',{maximumFractionDigits:0});
  if(elCount) elCount.textContent = count.toLocaleString('he-IL');
  if(elAvg)   elAvg.textContent   = '\u20AA' + avg.toLocaleString('he-IL',{maximumFractionDigits:0});
  if(elRange) elRange.textContent = rangeText;
}

// ══════════════════════════════════════════════════════════════
// CREDIT CARD DETAIL ALERT (on load / tab switch)
// ══════════════════════════════════════════════════════════════
function checkCreditCardDetails(){
  // Check if we have credit card payment entries but no itemized CC transactions
  var hasCCPayments = (typeof TRANSACTIONS!=='undefined') &&
    TRANSACTIONS.some(function(t){ return (t.cat||'').includes('\u05EA\u05E9\u05DC\u05D5\u05DD \u05DB\u05E8\u05D8\u05D9\u05E1'); });
  // Check if we have itemized CC data (chargeType = 'credit')
  var hasCCDetail = (typeof TRANSACTIONS!=='undefined') &&
    TRANSACTIONS.some(function(t){ return t.source==='credit_card'||t.isCC||t.ccDetail; });

  var banner = document.getElementById('undetailed-cc-banner');
  if(banner){
    if(hasCCPayments && !hasCCDetail){
      banner.style.display = 'block';
      var list = document.getElementById('undetailed-cc-list');
      if(list) list.innerHTML = '\u05D9\u05E9 \u05EA\u05E9\u05DC\u05D5\u05DE\u05D9 \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D0\u05E9\u05E8\u05D0\u05D9 \u05D1\u05D3\u05E3 \u05D4\u04D7\u05E9\u05D1\u05D5\u05DF — \u05D0\u05E0\u05D0 \u05D4\u05D5\u05E8\u05D3 \u05D0\u05EA \u05E4\u05D9\u05E8\u05D5\u05D8 \u05D4\u05E2\u05E1\u05E7\u05D0\u05D5\u05EA \u05E9\u05DC \u05DB\u05E8\u05D8\u05D9\u05E1\u05D9 \u05D4\u05D0\u05E9\u05E8\u05D0\u05D9 \u05DC\u05EA\u05D9\u05E7\u05D9\u05D9\u05D5.';
    }
  }
}
document.addEventListener('DOMContentLoaded', function(){ setTimeout(checkCreditCardDetails,1000); });

// ══════════════════════════════════════════════════════════════
// ADVISOR / AGENT SECTION
// ══════════════════════════════════════════════════════════════
var _advisors = JSON.parse(localStorage.getItem('_advisors')||'[]');

function renderAdvisorSection(){
  var el = document.getElementById('advisorSection');
  if(!el) return;
  var html = '<div class="card" style="margin-top:0;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    +'<h3 style="margin:0;">👔 סוכנים ויועצים מקושרים</h3>'
    +'<button onclick="openAddAdvisorModal()" style="background:#3b82f6;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;font-weight:700;">+ הוסף יועץ</button>'
    +'</div>';

  if(_advisors.length===0){
    html += '<div style="text-align:center;padding:30px;color:#64748b;">'
      +'<div style="font-size:2em;margin-bottom:8px;">👔</div>'
      +'<div style="font-size:14px;margin-bottom:4px;">אין סוכנים מקושרים עדיין</div>'
      +'<div style="font-size:12px;">הוסף יועץ כלכלי, יועץ ביטוח או מנהל תיק השקעות</div>'
      +'</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:10px;">';
    _advisors.forEach(function(a,i){
      html += '<div style="background:#0f172a;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;border:1px solid #334155;">'
        +'<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">'+(_roleEmoji(a.role))+'</div>'
        +'<div style="flex:1;">'
        +'<div style="font-weight:700;color:#e2e8f0;font-size:14px;">'+a.name+'</div>'
        +'<div style="color:#94a3b8;font-size:12px;">'+a.role+(_firmLabel(a))+'</div>'
        +'<div style="margin-top:4px;display:flex;gap:8px;">'
        +(a.phone ? '<a href="tel:'+a.phone+'" style="color:#60a5fa;font-size:12px;text-decoration:none;">📞 '+a.phone+'</a>' : '')
        +(a.email ? '<a href="mailto:'+a.email+'" style="color:#60a5fa;font-size:12px;text-decoration:none;">✉️ '+a.email+'</a>' : '')
        +'</div>'
        +'</div>'
        +'<button onclick="_removeAdvisor('+i+')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:4px;" title="\u05D4\u05E1\u05E8">✕</button>'
        +'</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function _roleEmoji(role){
  var map={'\u05D9\u05D5\u05E2\u05E5 \u05DB\u05DC\u05DB\u05DC\u05D9':'💼','\u05D9\u05D5\u05E2\u05E5 \u05D1\u05D9\u05D8\u05D5\u05D7':'🛡️','\u05DE\u05E0\u05D4\u05DC \u05EA\u05D9\u05E7 \u05D4\u05E9\u05E7\u05E2\u05D5\u05EA':'📈','\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF':'🧾','\u05E1\u05D5\u05DB\u05DF \u05D1\u05E0\u05E7\u05D0\u05D9':'🏦'};
  return map[role]||'👔';
}
function _firmLabel(a){ return a.firm ? ' · '+a.firm : ''; }

function openAddAdvisorModal(){
  var roles = ['\u05D9\u05D5\u05E2\u05E5 \u05DB\u05DC\u05DB\u05DC\u05D9','\u05D9\u05D5\u05E2\u05E5 \u05D1\u05D9\u05D8\u05D5\u05D7','\u05DE\u05E0\u05D4\u05DC \u05EA\u05D9\u05E7 \u05D4\u05E9\u05E7\u05E2\u05D5\u05EA','\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF','\u05E1\u05D5\u05DB\u05DF \u05D1\u05E0\u05E7\u05D0\u05D9'];
  var modal = document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;z-index:25000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;direction:rtl;';
  modal.innerHTML='<div style="background:#1e293b;border-radius:16px;width:min(460px,95vw);padding:28px;box-shadow:0 25px 50px rgba(0,0,0,.7);">'
    +'<h3 style="color:#f1f5f9;margin:0 0 20px;font-size:1.1em;">👔 הוסף יועץ / סוכן</h3>'
    +'<select id="adv-role" style="width:100%;margin-bottom:10px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px 12px;font-size:14px;">'
    +roles.map(function(r){return'<option value="'+r+'">'+r+'</option>';}).join('')+'</select>'
    +'<input id="adv-name" placeholder="\u05E9\u05DD \u05DE\u05DC\u05D1" style="width:100%;box-sizing:border-box;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:9px 12px;font-size:14px;margin-bottom:10px;" />'
    +'<input id="adv-firm" placeholder="\u05E9\u05DD \u05D7\u05D1\u05E8\u05D4 / \u05DE\u05E9\u05E8\u05D3 (\u05D0\u05D5\u05F4\u05F6\u05D9\u05D5\u05E0\u05DC\u05D9)" style="width:100%;box-sizing:border-box;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:9px 12px;font-size:14px;margin-bottom:10px;" />'
    +'<input id="adv-phone" placeholder="\u05D8\u05DC\u05E4\u05D5\u05DF" type="tel" style="width:100%;box-sizing:border-box;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:9px 12px;font-size:14px;margin-bottom:10px;" />'
    +'<input id="adv-email" placeholder="\u05DE\u05D9\u05D9\u05DC" type="email" style="width:100%;box-sizing:border-box;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:9px 12px;font-size:14px;margin-bottom:16px;" />'
    +'<div style="display:flex;gap:10px;">'
    +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="flex:1;background:#334155;color:#94a3b8;border:none;border-radius:8px;padding:10px;cursor:pointer;">\u05D1\u05D9\u05D8\u05D5\u05DC</button>'
    +'<button onclick="_saveAdvisor(this)" style="flex:1;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;">\u05E9\u05DE\u05D5\u05E8</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
}
function _saveAdvisor(btn){
  var name = (document.getElementById('adv-name')||{}).value||'';
  if(!name.trim()){ alert('\u05E0\u05D0 \u05D4\u05D6\u05DF \u05E9\u05DD'); return; }
  _advisors.push({
    role:(document.getElementById('adv-role')||{}).value||'',
    name:name.trim(),
    firm:(document.getElementById('adv-firm')||{}).value||'',
    phone:(document.getElementById('adv-phone')||{}).value||'',
    email:(document.getElementById('adv-email')||{}).value||''
  });
  localStorage.setItem('_advisors',JSON.stringify(_advisors));
  btn.closest('div[style*="fixed"]').remove();
  renderAdvisorSection();
  if(typeof showToast==='function') showToast('\u2705 \u05D9\u05D5\u05E2\u05E5 \u05E0\u05D5\u05E1\u05E3 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4');
}
function _removeAdvisor(i){
  _advisors.splice(i,1);
  localStorage.setItem('_advisors',JSON.stringify(_advisors));
  renderAdvisorSection();
}

// Hook renderAdvisorSection into renderManagementTab
;(function(){
  var _origMgmt = window.renderManagementTab;
  window.renderManagementTab = function(){
    if(typeof _origMgmt==='function') _origMgmt();
    setTimeout(renderAdvisorSection, 50);
  };
})();

