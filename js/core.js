/* 共用件：模板引擎、提示词装配、弹层、选牌器、主题、键盘避让。 */
(function () {
  var D = window.TAROT_DATA;
  var App = window.App = window.App || {};

  /* ---------------- 基础工具 ---------------- */
  App.el = function (sel, root) { return (root || document).querySelector(sel); };
  App.els = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  App.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  App.uid = function () {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ---------------- 数据 ---------------- */
  App.cards = D.cards;
  App.spreads = D.spreads;
  App.styles = D.styles;
  App.defaultStyle = D.defaultStyle;
  App.templates = D.prompts;
  App.cardById = {};
  App.cards.forEach(function (c) { App.cardById[c.id] = c; });

  App.spreadsAll = function () { return App.spreads.concat(App.state.customSpreads || []); };
  App.spread = function (id) {
    var all = App.spreadsAll();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return all[0];
  };
  App.style = function (id) {
    for (var i = 0; i < App.styles.length; i++) if (App.styles[i].id === id) return App.styles[i];
    return App.styles[0];
  };
  App.face = function (card, orientation) {
    return orientation === 'rev' ? card.rev : card.up;
  };

  /* ---------------- 模板引擎（与 Android TemplateEngine 同构） ---------------- */
  var BLOCK = /\{\{#(each|if) ([A-Za-z_]\w*)\}\}((?:(?!\{\{#)[\s\S])*?)\{\{\/\1\}\}/;
  var VAR = /\{\{([A-Za-z_]\w*)\}\}/g;

  function truthy(v) {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  function render(tpl, ctx) {
    var out = tpl, guard = 0, m;
    while (guard++ < 80) {
      m = BLOCK.exec(out);
      if (!m) break;
      var kind = m[1], key = m[2], inner = m[3], rep = '';
      if (kind === 'if') {
        rep = truthy(ctx[key]) ? render(inner, ctx) : '';
      } else {
        var list = Array.isArray(ctx[key]) ? ctx[key] : [];
        rep = list.map(function (item, idx) {
          var child = Object.assign({}, ctx);
          if (item && typeof item === 'object') Object.assign(child, item);
          child._index = idx + 1;
          return render(inner, child);
        }).join('\n');
      }
      out = out.slice(0, m.index) + rep + out.slice(m.index + m[0].length);
    }
    return out.replace(VAR, function (_, k) {
      var v = ctx[k];
      return v == null ? '' : String(v);
    });
  }
  App.render = render;

  function cardCtx(card, orientation) {
    var face = App.face(card, orientation);
    return {
      card: card.name,
      orientation: orientation === 'rev' ? '逆位' : '正位',
      keywords: face.kw.join(' · '),
      cardText: face.text,
    };
  }
  function styleCtx(style) { return { styleName: style.name, styleGuide: style.guide }; }

  App.todayLine = function (ts) {
    return App.fmtDate(ts) + ' · 星期' + '日一二三四五六'[new Date(ts).getDay()];
  };

  App.dailyPrompt = function (draft) {
    var card = App.cardById[draft.cardId];
    if (!card) return '';
    var style = App.style(draft.styleId);
    var ctx = Object.assign(cardCtx(card, draft.orientation), styleCtx(style));
    ctx.date = App.todayLine(draft.at || Date.now());
    ctx.mood = (draft.mood || '').trim();
    return render(App.templates.daily, ctx);
  };

  App.spreadPrompt = function (draft) {
    var spread = App.spread(draft.spreadId);
    var style = App.style(draft.styleId);
    var cards = [];
    (spread.positions || []).forEach(function (pos, i) {
      var pick = draft.picks && draft.picks[i];
      if (!pick) return;
      var card = App.cardById[pick.cardId];
      if (!card) return;
      var item = cardCtx(card, pick.orientation);
      item.label = pos.label;
      item.positionMeaning = pos.meaning;
      cards.push(item);
    });
    var ctx = Object.assign(styleCtx(style), {
      spreadName: spread.name,
      cardCount: spread.count,
      question: (draft.question || '').trim(),
      cards: cards,
    });
    return render(App.templates.spread, ctx);
  };

  /* ---------------- 日期 ---------------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  App.pad2 = pad2;
  App.pad4 = function (n) { n = String(n); while (n.length < 4) n = '0' + n; return n; };
  App.fmtDate = function (ts) {
    var d = new Date(ts);
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
  };
  App.fmtShort = function (ts) {
    var d = new Date(ts);
    return pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  App.fmtTime = function (ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  var CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  App.monthKey = function (ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  };
  App.monthLabel = function (ts) {
    var d = new Date(ts);
    var m = CN_MONTH[d.getMonth()] + '月';
    return d.getFullYear() === new Date().getFullYear() ? m : d.getFullYear() + '.' + (d.getMonth() + 1) + ' 月';
  };

  /* ---------------- 提示 ---------------- */
  var toastEl = null, toastTimer = 0;
  App.toast = function (msg) {
    toastEl = toastEl || document.getElementById('toast');
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  };

  App.copy = function (text, okMsg) {
    var done = function () { App.toast(okMsg || '已复制'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  };
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { document.execCommand('copy'); done(); } catch (e) { App.toast('复制失败，请手动选取'); }
    document.body.removeChild(ta);
  }

  /* ---------------- 弹层（低透明黑遮罩 · 容器自带阴影 · 可下拉收起） ---------------- */
  var sheetRoot = null;

  App.sheet = function (opts) {
    sheetRoot = sheetRoot || document.getElementById('sheet-root');
    var scrim = document.createElement('div');
    scrim.className = 'sheet-scrim';
    var sheet = document.createElement('div');
    sheet.className = 'sheet' + (opts.wide ? ' max' : '');
    sheet.innerHTML =
      '<div class="sheet-grab"><i></i></div>' +
      '<div class="sheet-head">' +
        '<div class="tt"><h2>' + App.esc(opts.title || '') + '</h2>' +
        (opts.sub ? '<p class="hint" style="margin-top:4px">' + App.esc(opts.sub) + '</p>' : '') +
        '</div>' +
        '<button class="iconbtn" data-x aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="sheet-body"></div>';
    var body = sheet.querySelector('.sheet-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    sheetRoot.appendChild(scrim);
    sheetRoot.appendChild(sheet);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      sheet.classList.remove('on');
      scrim.classList.remove('on');
      window.setTimeout(function () {
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        document.removeEventListener('keydown', onKey);
        if (opts.onClose) opts.onClose();
        App.updateKbInset();
      }, 300);
    }

    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', close);
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) close();
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sheet.classList.add('on');
        scrim.classList.add('on');
        App.updateKbInset();
      });
    });

    /* 下拉收起：1:1 跟手，超过 30% 或快速甩出关掉 */
    var startY = 0, dy = 0, dragging = false, lastY = 0, lastT = 0, vel = 0, height = 1;
    var grab = sheet.querySelector('.sheet-grab');
    grab.addEventListener('pointerdown', function (e) {
      if (closed) return;
      dragging = true; startY = e.clientY; dy = 0;
      lastY = e.clientY; lastT = Date.now(); vel = 0;
      height = sheet.getBoundingClientRect().height || 1;
      sheet.classList.add('dragging');
      grab.setPointerCapture(e.pointerId);
    });
    grab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      var now = Date.now();
      if (now - lastT > 0) vel = (e.clientY - lastY) / (now - lastT);
      lastY = e.clientY; lastT = now;
      sheet.style.transform = 'translate3d(0,' + dy + 'px,0)';
      scrim.style.opacity = String(Math.max(0, 1 - dy / (height * 1.2)));
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove('dragging');
      sheet.style.transform = '';
      scrim.style.opacity = '';
      if (dy > height * 0.3 || (vel > 0.6 && dy > 16)) close();
    }
    grab.addEventListener('pointerup', endDrag);
    grab.addEventListener('pointercancel', endDrag);
    return { el: sheet, body: body, close: close };
  };

  /* ---------------- 选牌器 ---------------- */
  var CATS = [
    { id: 'all', label: '全部' },
    { id: 'major', label: '大阿卡纳' },
    { id: 'wands', label: '权杖' },
    { id: 'cups', label: '圣杯' },
    { id: 'swords', label: '宝剑' },
    { id: 'coins', label: '星币' },
  ];
  var SUIT = { wands: '权杖', cups: '圣杯', swords: '宝剑', coins: '星币' };

  App.pickCard = function (opts) {
    opts = opts || {};
    var cat = 'all', query = '', picked = opts.current || null;
    var s = App.sheet({
      title: opts.title || '选一张牌',
      sub: opts.sub || '点一下牌面即可落牌',
      wide: true,
      body:
        '<div class="picker-search"><input id="pk-q" type="search" placeholder="搜索牌名 / 英文名" /></div>' +
        '<div class="picker-tabs" id="pk-tabs">' +
        CATS.map(function (c) { return '<button data-cat="' + c.id + '" aria-selected="' + (c.id === cat) + '">' + c.label + '</button>'; }).join('') +
        '</div>' +
        '<div class="card-grid" id="pk-grid"></div>',
    });

    var grid = s.body.querySelector('#pk-grid');
    function inCat(card) {
      if (cat === 'all') return true;
      if (cat === 'major') return card.arcana === 'major';
      return card.suit === SUIT[cat];
    }
    function draw() {
      var q = query.trim();
      var list = App.cards.filter(function (c) {
        if (!inCat(c)) return false;
        if (!q) return true;
        return c.name.indexOf(q) >= 0 || c.en.toLowerCase().indexOf(q.toLowerCase()) >= 0;
      });
      grid.innerHTML = list.length ? list.map(function (c) {
        return '<button data-id="' + c.id + '" aria-pressed="' + (c.id === picked) + '">' +
          '<div class="ci"><img src="' + c.img + '" alt="' + App.esc(c.name) + '" loading="lazy" /></div>' +
          '<div class="cn">' + App.esc(c.name) + '</div></button>';
      }).join('') : '<p class="hint" style="grid-column:1/-1;padding:16px 0">没有匹配的牌</p>';
    }
    draw();

    s.body.querySelector('#pk-q').addEventListener('input', function (e) { query = e.target.value; draw(); });
    s.body.querySelector('#pk-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.getAttribute('data-cat');
      App.els('[data-cat]', s.body).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      draw();
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (!b) return;
      var card = App.cardById[b.getAttribute('data-id')];
      picked = card.id;
      s.close();
      if (opts.onPick) opts.onPick(card);
    });
    return s;
  };

  /* ---------------- 主题 ---------------- */
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  App.resolveTheme = function (mode) {
    if (mode === 'dark' || mode === 'light') return mode;
    return mql && mql.matches ? 'dark' : 'light';
  };
  App.applyTheme = function (animate) {
    var resolved = App.resolveTheme(App.state.settings.theme);
    var html = document.documentElement;
    if (animate && html.getAttribute('data-theme') !== resolved) {
      html.classList.add('theme-fade');
      window.setTimeout(function () { html.classList.remove('theme-fade'); }, 420);
    }
    html.setAttribute('data-theme', resolved);
  };
  if (mql && mql.addEventListener) {
    mql.addEventListener('change', function () {
      if (App.state.settings.theme === 'auto') App.applyTheme(true);
    });
  }

  /* ---------------- 键盘避让 ---------------- */
  App.updateKbInset = function () {
    var vv = window.visualViewport;
    var kb = 0;
    if (vv) kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    App.kb = kb;
    document.documentElement.style.setProperty('--kb', kb + 'px');
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', App.updateKbInset);
    window.visualViewport.addEventListener('scroll', App.updateKbInset);
  }
})();
