(function() {
  'use strict';

  // Read config from window.__nb (set before this script loads)
  var cfg = window.__nb || {};
  var BIZ_KEY      = cfg.bizKey || '';
  var BIZ_NAME     = cfg.bizName || 'Your Business';
  var BOT_NAME     = cfg.botName || (BIZ_NAME + ' Assistant');
  var ACCENT_COLOR = cfg.accentColor || '#0A2540';
  var BACKEND_URL  = cfg.backend || 'https://botbuilder-backend-production.up.railway.app';
  var LEAD_EMAIL   = cfg.leadEmail || '';
  var HOURS        = cfg.hours || null;
  var AUTO_OPEN_DELAY = cfg.autoOpen || null;
  var SYSTEM_PROMPT = cfg.systemPrompt || '';
  var GREETING     = cfg.greeting || '';
  var IS_LEAD_GEN  = true;

  // Quick replies - populated from server
  var _nbQuickReplies = {
    question: ['Get a quote', 'Hours & availability', 'Service area'],
    callback: [],
    emergency: ['Emergency service', 'Get a quote', 'Service area']
  };

  // Fetch full client config from server
  if (BIZ_KEY) {
    fetch(BACKEND_URL + '/client-info/' + BIZ_KEY)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!SYSTEM_PROMPT && data.systemPrompt) { SYSTEM_PROMPT = data.systemPrompt; }
        if (!HOURS && data.hours) { HOURS = data.hours; }
        if (data.quickReplies && data.quickReplies.length > 0) { _nbQuickReplies.question = data.quickReplies; }
        if (data.emergencyReplies && data.emergencyReplies.length > 0) { _nbQuickReplies.emergency = data.emergencyReplies; }
        if (data.calendarConnected && !_nbQuickReplies.question.some(function(r) { return r.toLowerCase().includes('book') || r.toLowerCase().includes('appoint'); })) {
          _nbQuickReplies.question.unshift('Book an appointment');
          _nbQuickReplies.question = _nbQuickReplies.question.slice(0, 4);
        }
      })
      .catch(function() {});
  }

  var messages = [];
  var isOpen = false;
  var leadCaptured = false;
  var greetingSent = false;
  var isAdminMode = false;

  var style2 = document.createElement('style');
  style2.textContent = '#nb-widget-btn{position:fixed;bottom:24px;right:24px;z-index:9999;width:60px;height:60px;border-radius:50%;background:linear-gradient(145deg,#1a3a5c,#0A2540);border:none;cursor:pointer;box-shadow:0 4px 24px rgba(10,37,64,0.35),0 1px 3px rgba(0,0,0,0.1),inset 0 1px 0 rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s;-webkit-tap-highlight-color:transparent}#nb-widget-btn:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(10,37,64,0.4)}#nb-widget-btn svg{width:26px;height:26px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;position:absolute;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)}#nb-widget-btn .nb-open{opacity:1;transform:translate(-50%,-50%) rotate(0deg) scale(1)}#nb-widget-btn .nb-close{opacity:0;transform:translate(-50%,-50%) rotate(-90deg) scale(0.5)}#nb-widget-btn.open .nb-open{opacity:0;transform:translate(-50%,-50%) rotate(90deg) scale(0.5)}#nb-widget-btn.open .nb-close{opacity:1;transform:translate(-50%,-50%) rotate(0deg) scale(1)}#nb-widget-btn.open #nb-badge{display:none!important}#nb-badge{position:absolute;top:1px;right:1px;width:17px;height:17px;background:#ef4444;border-radius:50%;border:2px solid white;font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center}#nb-chat-box{position:fixed;bottom:96px;right:16px;z-index:9998;width:calc(100vw - 32px);max-width:388px;background:white;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,0.18),0 4px 16px rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.06);display:none;flex-direction:column;overflow:hidden;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;transform:translateY(16px);transition:opacity 0.25s ease,transform 0.25s cubic-bezier(0.16,1,0.3,1)}#nb-chat-box.open{display:flex}#nb-chat-box.visible{opacity:1;transform:translateY(0)}#nb-home-header{background:#0A2540;position:relative;overflow:hidden}#nb-home-header::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(147,197,253,0.07) 1px,transparent 1px);background-size:20px 20px;pointer-events:none}#nb-orb1{position:absolute;top:-40px;right:-20px;width:160px;height:160px;background:radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 65%);pointer-events:none}#nb-orb2{position:absolute;bottom:-20px;left:60px;width:120px;height:120px;background:radial-gradient(circle,rgba(147,197,253,0.1) 0%,transparent 65%);pointer-events:none}#nb-header-inner{position:relative;z-index:1;padding:24px 22px 22px}#nb-av-row{display:flex;margin-bottom:18px}.nb-av{width:44px;height:44px;border-radius:50%;border:2.5px solid rgba(10,37,64,0.8);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;font-family:"Plus Jakarta Sans",-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25)}.nb-av1{background:linear-gradient(135deg,#1e4d8c,#2563eb);color:white;z-index:2}.nb-av2{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:10px;letter-spacing:0.02em;margin-left:-10px;z-index:1}#nb-home-greeting{font-family:"Plus Jakarta Sans",-apple-system,sans-serif;font-size:22px;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1.2;margin-bottom:6px}#nb-home-sub{font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:14px}#nb-live-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.18);color:#4ade80;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px}#nb-live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.6);animation:nb-livepulse 2s infinite}@keyframes nb-livepulse{0%,100%{opacity:1}50%{opacity:0.5}}#nb-actions{background:#f8fafc;padding:16px 16px 6px}#nb-action-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#94a3b8;margin-bottom:10px;padding:0 2px}.nb-action-btn{width:100%;background:white;border:1.5px solid #e2e8f0;border-radius:16px;padding:15px 16px;display:flex;align-items:center;gap:13px;cursor:pointer;font-family:inherit;transition:all 0.18s;text-align:left;margin-bottom:8px}.nb-action-btn:hover{border-color:#cbd5e1;box-shadow:0 4px 16px rgba(0,0,0,0.07);transform:translateY(-1px)}.nb-action-btn:active{transform:translateY(0)}.nb-btn-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.nb-btn-icon svg{width:19px;height:19px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.nb-icon-chat{background:#eff6ff}.nb-icon-chat svg{stroke:#2563eb}.nb-icon-phone{background:#f0fdf4}.nb-icon-phone svg{stroke:#16a34a}.nb-icon-emergency{background:#fff7ed}.nb-icon-emergency svg{stroke:#ea580c}.nb-btn-title{font-family:"Plus Jakarta Sans",-apple-system,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px}.nb-btn-sub{font-size:12px;color:#64748b;line-height:1.4}.nb-btn-arrow{margin-left:auto;color:#cbd5e1;flex-shrink:0;transition:transform 0.15s,color 0.15s}.nb-action-btn:hover .nb-btn-arrow{color:#94a3b8;transform:translateX(2px)}.nb-btn-arrow svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round}#nb-home-footer{background:#f8fafc;padding:10px 16px 14px;text-align:center;font-size:10.5px;color:#cbd5e1;border-top:1px solid #f1f5f9}#nb-chat-screen{display:none;flex-direction:column;background:white}#nb-chat-screen.nb-visible{display:flex}#nb-chat-top{padding:14px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;background:white}#nb-back-btn{width:32px;height:32px;border-radius:9px;background:#f8fafc;border:1.5px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0}#nb-back-btn:hover{background:#f1f5f9;border-color:#cbd5e1}#nb-back-btn svg{width:16px;height:16px;stroke:#475569;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}#nb-chat-top-name{font-family:"Plus Jakarta Sans",-apple-system,sans-serif;font-size:14px;font-weight:700;color:#0f172a}#nb-chat-top-status{display:flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;margin-top:1px}#nb-cs-dot{width:5px;height:5px;border-radius:50%;background:#22c55e;animation:nb-livepulse 2s infinite}#nb-messages{flex:1;min-height:300px;max-height:360px;overflow-y:auto;padding:18px 14px 10px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}#nb-messages::-webkit-scrollbar{width:0}.nb-msg{max-width:268px;padding:10px 15px;font-size:13.5px;line-height:1.55;word-wrap:break-word;white-space:pre-wrap}.nb-msg.bot{background:white;color:#0f172a;border:1.5px solid #e2e8f0;border-radius:4px 18px 18px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.04);align-self:flex-start}.nb-msg.user{background:linear-gradient(145deg,#1a3a5c,#0A2540);color:white;border-radius:18px 4px 18px 18px;box-shadow:0 2px 8px rgba(10,37,64,0.2);align-self:flex-end}.nb-typing-indicator{align-self:flex-start;background:white;border:1.5px solid #e2e8f0;border-radius:4px 18px 18px 18px;padding:12px 16px;display:flex;gap:5px;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)}.nb-typing-indicator span{width:5px;height:5px;border-radius:50%;background:#94a3b8;display:inline-block;animation:nb-bounce 1.2s infinite}.nb-typing-indicator span:nth-child(2){animation-delay:0.2s}.nb-typing-indicator span:nth-child(3){animation-delay:0.4s}@keyframes nb-bounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-5px);opacity:1}}#nb-quick-replies{display:flex;flex-wrap:wrap;gap:6px;padding:6px 14px 0}.nb-qr-btn{background:white;border:1.5px solid #e2e8f0;border-radius:99px;padding:6px 14px;font-size:12.5px;font-weight:500;color:#334155;cursor:pointer;font-family:inherit;transition:all 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.04)}.nb-qr-btn:hover{border-color:#0A2540;background:#0A2540;color:white}#nb-input-row{padding:12px 14px 14px;background:white;border-top:1px solid #f1f5f9}#nb-input-box{display:flex;align-items:flex-end;gap:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:9px 9px 9px 14px;transition:all 0.15s}#nb-input-box:focus-within{border-color:#0A2540;background:white;box-shadow:0 0 0 3px rgba(10,37,64,0.07)}#nb-input{flex:1;border:none;background:transparent;font-size:16px;font-family:inherit;color:#0f172a;outline:none;line-height:1.4}#nb-input::placeholder{color:#94a3b8}#nb-send{width:34px;height:34px;border-radius:10px;background:linear-gradient(145deg,#1a3a5c,#0A2540);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(10,37,64,0.25);transition:all 0.15s;-webkit-tap-highlight-color:transparent}#nb-send:hover{transform:scale(1.06)}#nb-send svg{width:14px;height:14px;stroke:white;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}#nb-chat-foot{text-align:center;margin-top:8px;font-size:10px;color:#cbd5e1}#nb-after-hours-pill{position:fixed;bottom:92px;right:16px;z-index:9997;background:#1e293b;color:white;font-size:11px;font-weight:600;padding:5px 11px;border-radius:99px;white-space:nowrap;opacity:0;transform:translateY(4px);transition:all 0.3s ease;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.25)}#nb-after-hours-pill.visible{opacity:1;transform:translateY(0)}@media(max-width:480px){#nb-chat-box{right:0;left:0;width:100%;max-width:100%;border-radius:20px 20px 0 0;bottom:0;height:85dvh;max-height:85dvh;transform:none!important;transition:opacity 0.2s ease!important;position:fixed;}#nb-widget-btn{bottom:80px;right:16px}#nb-messages{max-height:none;flex:1;}}';
  // Dynamic accent color styles (responds to color picker)
  var styleAccent = document.createElement('style');
  styleAccent.id = 'nb-accent-style';
  styleAccent.textContent =
    '#nb-widget-btn { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '.nb-msg.user { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '#nb-send { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '#nb-home-header { background: ' + ACCENT_COLOR + ' !important; }' +
    '.nb-qr-btn:hover { background: ' + ACCENT_COLOR + ' !important; border-color: ' + ACCENT_COLOR + ' !important; }' +
    '#nb-input-box:focus-within { border-color: ' + ACCENT_COLOR + ' !important; box-shadow: 0 0 0 3px ' + ACCENT_COLOR + '15 !important; }'

  var nbAccentStyle = document.createElement('style');
  nbAccentStyle.id = 'nb-accent-style';
  nbAccentStyle.textContent =
    '#nb-widget-btn { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '.nb-msg.user { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '#nb-send { background: linear-gradient(145deg, ' + ACCENT_COLOR + 'dd, ' + ACCENT_COLOR + ') !important; }' +
    '#nb-home-header { background: ' + ACCENT_COLOR + ' !important; }' +
    '.nb-qr-btn:hover { background: ' + ACCENT_COLOR + ' !important; border-color: ' + ACCENT_COLOR + ' !important; }' +
    '#nb-input-box:focus-within { border-color: ' + ACCENT_COLOR + ' !important; }';
  document.head.appendChild(nbAccentStyle);

  // Check if industry needs emergency button
  var EMERGENCY_INDUSTRIES = ['hvac','heating','cooling','air','plumb','electric','roof','pest','appliance','locksmith','auto','mechanic','flood','restoration','sewer','drain','gas','furnace'];
  var industryLower = (cfg.industry || '').toLowerCase();
  var showEmergency = EMERGENCY_INDUSTRIES.some(function(ind) { return industryLower.includes(ind); });

  var bizInitial = (BIZ_NAME || BOT_NAME || 'B').charAt(0).toUpperCase();

  var btn = document.createElement('button');
  btn.id = 'nb-widget-btn';
  btn.setAttribute('aria-label', 'Chat with us');
  btn.innerHTML =
    '<svg class="nb-open" viewBox="0 0 24 24" style="width:26px;height:26px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    '<svg class="nb-close" viewBox="0 0 24 24" style="width:22px;height:22px;stroke:white;fill:none;stroke-width:2.5;stroke-linecap:round;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-90deg) scale(0.5);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    '<div id="nb-badge" style="position:absolute;top:1px;right:1px;width:17px;height:17px;background:#ef4444;border-radius:50%;border:2px solid white;font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;"></div>';
  document.body.appendChild(btn);

  var box = document.createElement('div');
  box.id = 'nb-chat-box';
  box.innerHTML =
    '<div id="nb-home-screen">' +
      '<div id="nb-home-header">' +
        '<div id="nb-orb1"></div><div id="nb-orb2"></div>' +
        '<div id="nb-header-inner">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;">' +
            '<div id="nb-av-row" style="margin-bottom:0;"><div class="nb-av nb-av1">' + bizInitial + '</div><div class="nb-av nb-av2">AI</div></div>' +
            '<button onclick="window._nbCloseWidget()" style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.08);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:rgba(255,255,255,0.6);fill:none;stroke-width:2.5;stroke-linecap:round;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
          '</div>' +
          '<div id="nb-home-greeting">Hi there &#x1F44B;<br>How can we help?</div>' +
          '<div id="nb-home-sub">' + (BIZ_NAME || BOT_NAME) + '</div>' +
          '<div id="nb-live-badge"><div id="nb-live-dot"></div> We\'re online now</div>' +
        '</div>' +
      '</div>' +
      '<div id="nb-actions">' +
        '<div id="nb-action-label">What do you need?</div>' +
        '<button class="nb-action-btn" onclick="window._nbShowChat(\'question\')">' +
          '<div class="nb-btn-icon nb-icon-chat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
          '<div><div class="nb-btn-title">I have a question</div><div class="nb-btn-sub">Get answers instantly, 24/7</div></div>' +
          '<div class="nb-btn-arrow"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>' +
        '</button>' +
        '<button class="nb-action-btn" onclick="window._nbShowChat(\'callback\')">' +
          '<div class="nb-btn-icon nb-icon-phone"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>' +
          '<div><div class="nb-btn-title">Request a callback</div><div class="nb-btn-sub">Leave your number, we\'ll call back</div></div>' +
          '<div class="nb-btn-arrow"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>' +
        '</button>' +
      '</div>' +
      '<div id="nb-home-footer">Powered by Netify Builds</div>' +
    '</div>' +
    '<div id="nb-chat-screen">' +
      '<div id="nb-chat-top">' +
        '<button id="nb-back-btn" onclick="window._nbShowHome()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>' +
        '<div style="flex:1;"><div id="nb-chat-top-name">' + BOT_NAME + '</div><div id="nb-chat-top-status"><div id="nb-cs-dot"></div>&nbsp;Online · Replies instantly</div></div>' +
        '<button onclick="window._nbCloseWidget()" style="width:28px;height:28px;border-radius:8px;background:#f8fafc;border:1.5px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;">' +
          '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#475569;fill:none;stroke-width:2.5;stroke-linecap:round;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="nb-messages"></div>' +
      '<div id="nb-quick-replies"></div>' +
      '<div id="nb-input-row"><div id="nb-input-box"><input id="nb-input" placeholder="Type a message..." autocomplete="off" /><button id="nb-send"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div><div id="nb-chat-foot">Powered by Netify Builds</div></div>' +
    '</div>';
  document.body.appendChild(box);

  var pill = document.getElementById('nb-after-hours-pill') || document.createElement('div');

  var nbFirstMsgs = {
    question: "Sure, what's on your mind? I can answer questions about our services, pricing, hours, or anything else.",
    callback: "Of course! What's your name and best callback number?",
    emergency: "We're on it. What's happening right now?"
  };
  var nbContextReplies = _nbQuickReplies;

  window._nbShowChat = function(type) {
    type = type || 'question';
    var home = document.getElementById('nb-home-screen');
    var chat = document.getElementById('nb-chat-screen');
    if (home) home.style.display = 'none';
    if (chat) chat.classList.add('nb-visible');
    var msgs = document.getElementById('nb-messages');
    if (msgs && msgs.children.length === 0 && !greetingSent) {
      var firstMsg = nbFirstMsgs[type] || nbFirstMsgs.question;
      messages = [];
      addMsg(firstMsg, 'bot');
      messages.push({ role: 'assistant', content: firstMsg });
      greetingSent = true;
      showQuickReplies(nbContextReplies[type] || []);
    }
    setTimeout(function() { var i = document.getElementById('nb-input'); if (i) i.focus(); }, 300);
  };

  var nbScrollY = 0;
  function nbLockScroll() { nbScrollY = window.scrollY; document.body.style.overflow = 'hidden'; }
  function nbUnlockScroll() { document.body.style.overflow = ''; }

  window._nbCloseWidget = function() {
    isOpen = false;
    if (window.innerWidth <= 480) { nbUnlockScroll(); }
    box.classList.remove('visible');
    btn.style.display = 'flex';
    btn.classList.remove('open');
    setTimeout(function() { box.classList.remove('open'); }, 220);
  };

  window._nbShowHome = function() {
    var home = document.getElementById('nb-home-screen');
    var chat = document.getElementById('nb-chat-screen');
    if (home) home.style.display = 'block';
    if (chat) chat.classList.remove('nb-visible');
    messages = []; greetingSent = false; leadCaptured = false; isAdminMode = false;
    var msgsEl = document.getElementById('nb-messages');
    if (msgsEl) msgsEl.innerHTML = '';
    var qrEl = document.getElementById('nb-quick-replies');
    if (qrEl) qrEl.innerHTML = '';
  };

  function updateOpenStatus() {}

  function showQuickReplies(repliesArr) {
    var qr = document.getElementById('nb-quick-replies');
    if (!qr) return;
    var list = repliesArr || [];
    if (list.length === 0) { qr.innerHTML = ''; return; }
    if (qr.children.length > 0) return;
    list.forEach(function(label) {
      var b = document.createElement('button');
      b.className = 'nb-qr-btn';
      b.textContent = label;
      b.onclick = function(e) {
        e.stopPropagation();
        qr.innerHTML = '';
        document.getElementById('nb-input').value = label;
        document.getElementById('nb-send').dispatchEvent(new MouseEvent('click', { bubbles: false }));
      };
      qr.appendChild(b);
    });
  }

  function openChat() {
    isOpen = true;
    btn.style.display = 'none';
    box.classList.add('open');
    if (window.innerWidth <= 480) { nbLockScroll(); }
    pill.classList && pill.classList.remove('visible');
    setTimeout(function() { box.classList.add('visible'); }, 10);
    var home = document.getElementById('nb-home-screen');
    var chat = document.getElementById('nb-chat-screen');
    if (!greetingSent) {
      if (home) home.style.display = 'block';
      if (chat) chat.classList.remove('nb-visible');
    } else {
      if (home) home.style.display = 'none';
      if (chat) chat.classList.add('nb-visible');
      setTimeout(function() { var i = document.getElementById('nb-input'); if(i) i.focus(); }, 380);
    }
  }

  function closeChat() {
    isOpen = false;
    if (window.innerWidth <= 480) { nbUnlockScroll(); }
    box.classList.remove('visible');
    btn.style.display = 'flex';
    btn.classList.remove('open');
    setTimeout(function() { box.classList.remove('open'); }, 220);
  }

  btn.addEventListener('click', function() { if (isOpen) closeChat(); else openChat(); });

  function addMsg(text, role) {
    var el = document.createElement('div');
    el.className = 'nb-msg ' + role;
    el.textContent = text;
    var m = document.getElementById('nb-messages');
    if (m) { m.appendChild(el); m.scrollTop = m.scrollHeight; }
    return el;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'nb-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    var m = document.getElementById('nb-messages');
    if (m) { m.appendChild(el); m.scrollTop = m.scrollHeight; }
    return el;
  }

  function parseLead(reply) {
    var match = reply.match(/LEAD[\s_]?CAPTURED[\s]*[|][\s]*([^|\n]*)[|][\s]*([^|\n]*)[|][\s]*([^|\n]*)[|][\s]*([^|\n\r]*)/i);
    if (!match) return null;
    var name = match[1].trim();
    var phone = match[2].trim().replace(/[^\d\s\-\(\)\+\.]/g, '').trim();
    if (!name && !phone) return null;
    var triggerIdx = reply.search(/LEAD[\s_]?CAPTURED/i);
    return { name: name||'Not provided', phone: phone||'Not provided', jobType: match[3].trim()||'Not specified', urgency: match[4].trim()||'Not specified', cleanReply: triggerIdx > 0 ? reply.substring(0, triggerIdx).trim() : '' };
  }

  async function sendMessage() {
    var qr = document.getElementById('nb-quick-replies');
    if (qr) qr.innerHTML = '';
    var input = document.getElementById('nb-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = ''; input.disabled = true;
    addMsg(text, 'user');
    messages.push({ role: 'user', content: text });
    var typing = showTyping();
    try {
      var res = await fetch(BACKEND_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-10), systemPrompt: SYSTEM_PROMPT, bizKey: BIZ_KEY || '', isAdminSession: false })
      });
      var data = {};
      try { data = await res.json(); } catch(e) {}
      var reply = (data && (data.reply || data.error)) || 'Sorry, something went wrong. Please try again.';
      try { typing.remove(); } catch(e) {}
      if (!leadCaptured && reply.includes('LEAD_CAPTURED|')) {
        var lead = parseLead(reply);
        if (lead && lead.phone && lead.phone !== 'Not provided') {
          leadCaptured = true;
          var displayReply = lead.cleanReply || "Thanks! We've got your info and someone will be reaching out soon.";
          addMsg(displayReply, 'bot');
          messages.push({ role: 'assistant', content: displayReply });
          fetch(BACKEND_URL + '/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: lead.name, phone: lead.phone, jobType: lead.jobType, urgency: lead.urgency, businessEmail: LEAD_EMAIL, businessName: BIZ_NAME, conversation: messages.slice(-20) })
          }).catch(function() {});
        } else {
          addMsg(reply.replace(/LEAD_CAPTURED\|.*/g, '').trim() || reply, 'bot');
          messages.push({ role: 'assistant', content: reply });
        }
      } else {
        var cleanReply = reply.replace(/LEAD_CAPTURED\|.*/g, '').trim();
        addMsg(cleanReply || reply, 'bot');
        messages.push({ role: 'assistant', content: cleanReply || reply });
        // Handle slots for calendar booking
        if (data.slots) {
          var qrEl = document.getElementById('nb-quick-replies');
          if (qrEl) {
            qrEl.innerHTML = '';
            data.slots.forEach(function(slot, i) {
              var b = document.createElement('button');
              b.className = 'nb-qr-btn';
              b.textContent = (i+1) + '. ' + slot.label;
              b.onclick = function() {
                qrEl.innerHTML = '';
                input.value = 'Option ' + (i+1);
                document.getElementById('nb-send').dispatchEvent(new MouseEvent('click', { bubbles: false }));
              };
              qrEl.appendChild(b);
            });
          }
        }
      }
    } catch(e) {
      try { typing.remove(); } catch(e2) {}
      addMsg('Having a quick hiccup, try again in a moment.', 'bot');
    } finally {
      input.disabled = false;
      try { input.focus(); } catch(e) {}
    }
  }

  document.getElementById('nb-send').addEventListener('click', sendMessage);
  document.getElementById('nb-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') sendMessage(); });

  if (AUTO_OPEN_DELAY && typeof AUTO_OPEN_DELAY === 'number') {
    setTimeout(function() { if (!isOpen) openChat(); }, AUTO_OPEN_DELAY * 1000);
  }

})();
