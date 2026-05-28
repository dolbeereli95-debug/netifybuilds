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

  // Fetch quick replies from server based on client config
  var _nbQuickReplies = {
    question: ['Get a quote', 'Hours & availability', 'Service area'],
    callback: [],
    emergency: ['Emergency service', 'Get a quote', 'Service area']
  };

  // Load client-specific quick replies
  fetch(BACKEND_URL + '/client-info/' + BIZ_KEY)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.quickReplies && data.quickReplies.length > 0) {
        _nbQuickReplies.question = data.quickReplies;
      }
      if (data.emergencyReplies && data.emergencyReplies.length > 0) {
        _nbQuickReplies.emergency = data.emergencyReplies;
      }
      if (data.calendarConnected && !_nbQuickReplies.question.some(function(r) { return r.toLowerCase().includes('book') || r.toLowerCase().includes('appoint'); })) {
        _nbQuickReplies.question.unshift('Book an appointment');
        _nbQuickReplies.question = _nbQuickReplies.question.slice(0, 4);
      }
    })
    .catch(function() {});

  // Context-based first messages
  var nbFirstMsgs = {
    question: "Sure, what's on your mind? I can answer questions about our services, pricing, hours, or anything else.",
    callback: "Of course! What's your name and best callback number? We'll get back to you as soon as possible.",
    emergency: "We're on it. What's the issue? Tell me what's happening and we'll get someone to you fast."
  };
  var nbContextReplies = _nbQuickReplies;

  window._nbShowChat = function(type) {
    type = type || 'question';
    var home = document.getElementById('nb-home-screen');
    var chat = document.getElementById('nb-chat-screen');
    if (home) home.style.display = 'none';
    if (chat) chat.classList.add('nb-visible');
    // Only set first message if no conversation yet
    var msgs = document.getElementById('nb-messages');
    if (msgs && msgs.children.length === 0 && !greetingSent) {
      var firstMsg = nbFirstMsgs[type] || nbFirstMsgs.question;
      messages = [];
      addMsg(firstMsg, 'bot');
      messages.push({ role: 'assistant', content: firstMsg });
      greetingSent = true;
      var replies = nbContextReplies[type] || [];
      showQuickReplies(replies);
    }
  };

  // Prevent background scroll on iOS when chat is open
  var nbScrollY = 0;
  function nbLockScroll() {
    nbScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
  }
  function nbUnlockScroll() {
    document.body.style.overflow = '';
  }

  window._nbCloseWidget = function() {
    isOpen = false;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
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
  };

  var QUICK_REPLIES = ['Get a quote', 'How does it work?', 'Pricing info', 'Talk to someone'];

  function showQuickReplies(repliesArr) {
    var qr = document.getElementById('nb-quick-replies');
    if (!qr) return;
    var list = repliesArr || QUICK_REPLIES;
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
        var sendEvt = new MouseEvent('click', { bubbles: false });
        document.getElementById('nb-send').dispatchEvent(sendEvt);
      };
      qr.appendChild(b);
    });
  }

  updateOpenStatus();
  setInterval(updateOpenStatus, 60000);

  if (AUTO_OPEN_DELAY && typeof AUTO_OPEN_DELAY === 'number') {
    setTimeout(function() { if (!isOpen) openChat(); }, AUTO_OPEN_DELAY * 1000);
  }

  var messages = [];
  var isOpen = false;
  var leadCaptured = false;
  var greetingSent = false;
  var isAdminMode = false;
  var hasEditsThisSession = false;

  var ADMIN_QUICK_REPLIES = ['Make a website change', 'Advise me on my site', 'Revert last change', 'Exit admin'];
  var DEFAULT_QUICK_REPLIES = QUICK_REPLIES;

  function showAdminQuickReplies() {
    var qr = document.getElementById('nb-quick-replies');
    if (!qr) return;
    qr.innerHTML = '';
    var replies = hasEditsThisSession
      ? ADMIN_QUICK_REPLIES
      : ADMIN_QUICK_REPLIES.filter(function(r) { return r !== 'Revert last change'; });
    replies.forEach(function(label) {
      var b = document.createElement('button');
      b.className = 'nb-qr-btn';
      b.textContent = label;
      b.onclick = function(e) {
        e.stopPropagation();
        qr.innerHTML = '';
        document.getElementById('nb-input').value = label;
        var sendEvt = new MouseEvent('click', { bubbles: false });
        document.getElementById('nb-send').dispatchEvent(sendEvt);
      };
      qr.appendChild(b);
    });
  }

  function openChat() {
    isOpen = true;
    btn.style.display = 'none';
    box.classList.add('open');
    if (window.innerWidth <= 480) { nbLockScroll(); }
    pill.classList.remove('visible');
    setTimeout(function(){ box.classList.add('visible'); }, 10);
    var home = document.getElementById('nb-home-screen');
    var chat = document.getElementById('nb-chat-screen');
    if (!greetingSent) {
      if (home) home.style.display = 'block';
      if (chat) chat.classList.remove('nb-visible');
    } else {
      if (home) home.style.display = 'none';
      if (chat) chat.classList.add('nb-visible');
      setTimeout(function(){ document.getElementById('nb-input').focus(); }, 380);
    }
  }

  function closeChat() {
    isOpen = false;
    if (window.innerWidth <= 480) { nbUnlockScroll(); }
    box.classList.remove('visible');
    btn.style.display = 'flex';
    btn.classList.remove('open');
    setTimeout(function(){ box.classList.remove('open'); }, 220);
    setTimeout(function(){ updateOpenStatus(); }, 250);
  }

  btn.addEventListener('click', function(){ if(isOpen) closeChat(); else openChat(); });
  var closeBtn = document.getElementById('nb-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeChat);
  document.addEventListener('click', function(e){ if(isOpen && e.bubbles && !box.contains(e.target) && !btn.contains(e.target)) closeChat(); });

  function addMsg(text, role) {
    var el = document.createElement('div');
    el.className = 'nb-msg ' + role;
    el.textContent = text;
    var m = document.getElementById('nb-messages');
    m.appendChild(el); m.scrollTop = m.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'nb-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    var m = document.getElementById('nb-messages');
    m.appendChild(el); m.scrollTop = m.scrollHeight;
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
    if (text.length > 500) { addMsg('Please keep your message under 500 characters so I can help you better.', 'bot'); return; }
    input.value = ''; input.disabled = true;
    addMsg(text, 'user');
    messages.push({ role: 'user', content: text });
    var typing = showTyping();
    try {
      var trimmedMessages = messages.slice(-10);
      var res = await fetch(BACKEND_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: trimmedMessages, systemPrompt: SYSTEM_PROMPT, bizKey: BIZ_KEY || '', isAdminSession: isAdminMode }) });
      var data = {};
      try { data = await res.json(); } catch(jsonErr) { data = {}; }
      var reply = (data && (data.reply || data.error)) || 'Sorry, something went wrong. Please try again.';
      try { if (typeof typing.remove === 'function') typing.remove(); } catch(e2) {}
      if (IS_LEAD_GEN && !leadCaptured && reply.includes('LEAD_CAPTURED|')) {
        var lead = parseLead(reply);
        if (lead && lead.phone && lead.phone !== 'Not provided') {
          leadCaptured = true;
          var displayReply = lead.cleanReply || "Thanks! We've got your info and someone will be reaching out soon.";
          addMsg(displayReply, 'bot');
          messages.push({ role: 'assistant', content: displayReply });
          fetch(BACKEND_URL + '/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: lead.name, phone: lead.phone, jobType: lead.jobType, urgency: lead.urgency, businessEmail: LEAD_EMAIL, businessName: BIZ_NAME, conversation: messages.slice(-20) }) }).catch(function(){});
        } else {
          var fallback = reply.replace(/LEAD_CAPTURED\|.*/g, '').trim();
          addMsg(fallback || reply, 'bot');
          messages.push({ role: 'assistant', content: fallback || reply });
        }
      } else {
        var cleanReply = reply.replace(/LEAD_CAPTURED\|.*/g, '').trim();
        addMsg(cleanReply || reply, 'bot');
        messages.push({ role: 'assistant', content: cleanReply || reply });

        // Handle admin mode
        if (data.adminMode) {
          isAdminMode = true;
          if (data.editSent) hasEditsThisSession = true;
          if (data.exitAdmin) { isAdminMode = false; hasEditsThisSession = false; }
          setTimeout(showAdminQuickReplies, 400);
        } else if (isAdminMode) {
          setTimeout(showAdminQuickReplies, 400);
        }
      }
    } catch(e) {
      try { if (typeof typing.remove === 'function') typing.remove(); } catch(e2) {}
      var errMsg = 'Having a quick hiccup, try again in a moment, or reach out at netifybuilds@gmail.com.';
      addMsg(errMsg, 'bot');
    } finally {
      input.disabled = false;
      try { input.focus(); } catch(e) {}
    }
  }

  document.getElementById('nb-send').addEventListener('click', sendMessage);
  document.getElementById('nb-input').addEventListener('keypress', function(e){ if(e.key==='Enter') sendMessage(); });

})();

})();