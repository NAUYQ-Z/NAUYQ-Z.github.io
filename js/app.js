/* 应用骨架：状态、路由、首页（年表·分卷·加号）、设置、导入导出、SW。 */
(function () {
  var App = window.App;
  var appEl = document.getElementById('app');

  App.state = {
    records: [],
    customSpreads: [],
    settings: { theme: 'auto', motion: true, defaultStyle: App.defaultStyle },
    filter: 'all',
    view: 'home',
    recordId: null,
    draft: { daily: null, spread: null },
  };

  /* ---------------- 设置持久化 ---------------- */
  // localStorage 只做「首帧镜像」，真正的数据仍在 IndexedDB
  App.mirrorPrefs = function () {
    try {
      localStorage.setItem('tarot.theme', App.state.settings.theme);
      localStorage.setItem('tarot.motion', App.state.settings.motion === false ? 'off' : 'on');
    } catch (e) { /* 隐私模式写不进去就算了，不影响使用 */ }
  };
  App.saveSettings = function () {
    App.mirrorPrefs();
    return Store.setKV('settings', App.state.settings);
  };
  App.saveCustomSpreads = function () {
    return Store.setKV('customSpreads', App.state.customSpreads);
  };
  App.nextNumber = function () {
    var n = 1;
    App.state.records.forEach(function (r) { if (r.number >= n) n = r.number + 1; });
    return n;
  };
  App.record = function (id) {
    for (var i = 0; i < App.state.records.length; i++) if (App.state.records[i].id === id) return App.state.records[i];
    return null;
  };
  App.refreshRecords = function () {
    return Store.records().then(function (list) {
      App.state.records = list;
    });
  };

  /* ---------------- 路由 ---------------- */
  function currentRoute() {
    var h = (location.hash || '#/home').replace(/^#/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'home', arg: parts[1] || null };
  }

  App.go = function (hash, replace) {
    if (hash === '#' + location.hash) { App.paint(); return; }
    if (replace) {
      history.replaceState(null, '', hash);
      App.paint();
    } else {
      location.hash = hash;
    }
  };

  window.addEventListener('hashchange', function () { App.paint(); });

  /* ---------------- 顶栏 ---------------- */
  App.topbar = function (opts) {
    opts = opts || {};
    var left = opts.back
      ? '<button class="iconbtn" data-go="' + opts.back + '" aria-label="返回">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>'
      : '<div style="width:44px"></div>';
    var right = opts.right || '';
    return '<div class="topbar">' + left + '<div class="spacer"></div>' +
      '<p class="mono ellip" style="max-width:52vw">' + App.esc(opts.title || '') + '</p>' +
      '<div class="spacer"></div>' + right + '</div>';
  };

  App.settingsIcon = function () {
    return '<button class="iconbtn" data-go="#/settings" aria-label="设置">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
  };

  /* ---------------- 首页 ---------------- */
  var FILTERS = [
    { id: 'all', label: '全部' },
    { id: 'daily', label: '日运' },
    { id: 'spread', label: '牌阵' },
  ];

  function countOf(id) {
    if (id === 'all') return App.state.records.length;
    return App.state.records.filter(function (r) { return r.type === id; }).length;
  }

  function recTitle(r) {
    if (r.type === 'daily') return (r.cards[0] && r.cards[0].cardName) || '日运';
    return r.spreadName || '牌阵';
  }

  function recSub(r) {
    if (r.type === 'daily') {
      var c = r.cards[0] || {};
      return (c.orientation === 'rev' ? '逆位' : '正位') + (r.mood ? ' · ' + r.mood : '');
    }
    return (r.cards.length ? r.cards.length + ' 张牌' : '') + (r.question ? ' · ' + r.question : '');
  }

  function thumbHtml(r) {
    var c = r.cards[0];
    var card = c ? App.cardById[c.cardId] : null;
    var cls = c && c.orientation === 'rev' ? ' style="transform:rotate(180deg)"' : '';
    if (!card) return '<div class="ci" style="width:30px;aspect-ratio:350/600;border:1px solid var(--line);border-radius:4px"></div>';
    return '<div style="width:30px;aspect-ratio:350/600;border-radius:4px;overflow:hidden;border:1px solid var(--line-soft)">' +
      '<img src="' + card.img + '" alt="" width="30" height="52" style="width:100%;height:100%;object-fit:cover;display:block"' + cls + '></div>';
  }

  function homeHtml() {
    var list = App.state.records.filter(function (r) {
      return App.state.filter === 'all' || r.type === App.state.filter;
    });

    var tabs = '<div class="tabs" role="tablist">' + FILTERS.map(function (f) {
      var n = countOf(f.id);
      return '<button class="tab" role="tab" data-filter="' + f.id + '" aria-selected="' + (App.state.filter === f.id) + '">' +
        '<span class="t-label">' + f.label + '</span>' +
        '<span class="t-count">' + App.pad2(n) + '</span>' +
        '<i class="t-bar"></i></button>';
    }).join('') + '</div>';

    var body;
    if (!list.length) {
      body = '<div class="empty shell"><p class="lead serif-l">还没有落笔的记录</p>' +
        '<p class="sub body-s" style="margin-top:8px">右下角的加号，是这里唯一的入口。</p></div>';
    } else {
      var groups = [], key = null, g = null;
      list.forEach(function (r) {
        var k = App.monthKey(r.createdAt);
        if (k !== key) { key = k; g = { key: k, ts: r.createdAt, rows: [] }; groups.push(g); }
        g.rows.push(r);
      });
      body = '<div class="timeline shell">' + groups.map(function (g) {
        return '<div class="mrow"><span class="m-label">' + App.esc(App.monthLabel(g.ts)) + '</span><span class="m-line"></span></div>' +
          g.rows.map(function (r) {
            return '<button class="row-rec" data-open="' + r.id + '">' +
              '<span class="thumb">' + thumbHtml(r) + '</span>' +
              '<span class="txt">' +
                '<span class="head"><span class="title">' + App.esc(recTitle(r)) + '</span>' +
                '<span class="tag">' + (r.type === 'daily' ? '日运' : '牌阵') + '</span></span>' +
                '<span class="body-s ellip" style="display:block;margin-top:4px">' + App.esc(recSub(r)) + '</span>' +
                '<span class="mono-sm" style="display:block;margin-top:6px">NO. ' + App.pad4(r.number) + ' · ' + App.fmtShort(r.createdAt) + '</span>' +
              '</span></button>';
          }).join('');
      }).join('') + '</div>';
    }

    return '<div class="wrap">' +
      '<div class="topbar"><div class="spacer"></div>' +
      '<p class="mono" style="letter-spacing:1.2px">塔 罗 笔 记</p><div class="spacer"></div>' +
      App.settingsIcon() + '</div>' +
      '<header class="masthead shell">' +
        '<span class="line1">牌摆在桌上，</span><span class="line2">话留在纸上。</span>' +
        '<p class="lede body">抽一张，记一笔。回头翻的时候，能看见当时是怎么想的。</p>' +
        tabs +
      '</header>' +
      body +
      '</div>' +
      '<button class="fab" data-add aria-label="新增">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
      '</button>';
  }

  /* ---------------- 加号菜单 ---------------- */
  var menu = null;

  function openMenu() {
    if (menu) return;
    var scrim = document.createElement('div');
    scrim.className = 'menu-scrim';
    var panel = document.createElement('div');
    panel.className = 'menu-panel';
    panel.innerHTML =
      '<div class="menu-head"><span class="lbl">新增</span></div>' +
      '<button class="menu-item" data-new="daily"><span class="mt"><b>新增日运</b><span>今天的这一张，正位或逆位</span></span><span class="plus">＋</span></button>' +
      '<button class="menu-item" data-new="spread"><span class="mt"><b>新增牌阵</b><span>按位落牌，多张一起读</span></span><span class="plus">＋</span></button>' +
      '<div class="hair" style="margin:0 16px"></div>' +
      '<button class="menu-item" data-new="category"><span class="mt"><b>新增分类</b><span>自己搭一个牌阵</span></span><span class="plus">＋</span></button>';
    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    menu = { scrim: scrim, panel: panel };

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scrim.classList.add('on');
        panel.classList.add('on');
      });
    });

    scrim.addEventListener('click', closeMenu);
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-new]');
      if (!b) return;
      var kind = b.getAttribute('data-new');
      closeMenu();
      setTimeout(function () {
        if (kind === 'daily') App.startDaily();
        else if (kind === 'spread') App.startSpread();
        else App.openSpreadEditor();
      }, 120);
    });
    document.addEventListener('keydown', escClose);
  }

  function escClose(e) { if (e.key === 'Escape') closeMenu(); }

  function closeMenu() {
    if (!menu) return;
    var m = menu;
    menu = null;
    m.panel.classList.remove('on');
    m.scrim.classList.remove('on');
    document.removeEventListener('keydown', escClose);
    setTimeout(function () {
      if (m.panel.parentNode) m.panel.parentNode.removeChild(m.panel);
      if (m.scrim.parentNode) m.scrim.parentNode.removeChild(m.scrim);
    }, 220);
  }

  /* ---------------- 新增分类（自建牌阵） ---------------- */
  App.openSpreadEditor = function () {
    var positions = [{ label: '位置一', meaning: '' }, { label: '位置二', meaning: '' }, { label: '位置三', meaning: '' }];
    var name = '', note = '';

    var s = App.sheet({
      title: '新增分类',
      sub: '一个分类就是一个自己搭的牌阵，1–12 个位置。',
      wide: true,
      body:
        '<div style="display:grid;gap:12px">' +
          '<div><p class="mono" style="margin-bottom:6px">名称</p><input id="ce-name" class="field" style="min-height:44px" placeholder="比如：本月三问" maxlength="20" /></div>' +
          '<div><p class="mono" style="margin-bottom:6px">一句说明</p><input id="ce-note" class="field" style="min-height:44px" placeholder="这个牌阵用来看什么" maxlength="40" /></div>' +
          '<div><p class="mono" style="margin-bottom:6px">位置（最多 12 个）</p><div id="ce-pos"></div>' +
            '<button class="btn" id="ce-addp" style="margin-top:8px">＋ 再加一个位置</button></div>' +
          '<button class="btn-primary" id="ce-save" style="margin-top:8px">保存分类</button>' +
        '</div>',
    });

    var posBox = s.body.querySelector('#ce-pos');
    function drawPos() {
      posBox.innerHTML = positions.map(function (p, i) {
        return '<div style="display:grid;grid-template-columns:64px 1fr;gap:8px;align-items:center;margin-bottom:8px">' +
          '<p class="mono" style="margin:0">位置 ' + (i + 1) + '</p>' +
          '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px;gap:8px">' +
            '<input class="field" style="min-height:42px" data-p="label" data-i="' + i + '" value="' + App.esc(p.label) + '" placeholder="名称" />' +
            '<input class="field" style="min-height:42px" data-p="meaning" data-i="' + i + '" value="' + App.esc(p.meaning) + '" placeholder="看什么" />' +
            '<button class="iconbtn" data-del="' + i + '" aria-label="删除">✕</button>' +
          '</div></div>';
      }).join('');
    }
    drawPos();

    s.body.querySelector('#ce-name').addEventListener('input', function (e) { name = e.target.value; });
    s.body.querySelector('#ce-note').addEventListener('input', function (e) { note = e.target.value; });
    posBox.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.dataset.p) return;
      positions[+t.dataset.i][t.dataset.p] = t.value;
    });
    posBox.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]');
      if (!d) return;
      if (positions.length <= 1) return;
      positions.splice(+d.getAttribute('data-del'), 1);
      drawPos();
    });
    s.body.querySelector('#ce-addp').addEventListener('click', function () {
      if (positions.length >= 12) { App.toast('最多 12 个位置'); return; }
      positions.push({ label: '位置' + (positions.length + 1), meaning: '' });
      drawPos();
    });
    s.body.querySelector('#ce-save').addEventListener('click', function () {
      var n = (name || '').trim();
      if (!n) { App.toast('给分类起个名字'); return; }
      var sp = {
        id: 'custom_' + Date.now().toString(36),
        name: n,
        note: (note || '').trim(),
        count: positions.length,
        positions: positions.map(function (p, i) {
          return { label: (p.label || '').trim() || '位置' + (i + 1), meaning: (p.meaning || '').trim() };
        }),
      };
      App.state.customSpreads.push(sp);
      App.saveCustomSpreads();
      s.close();
      App.toast('分类已保存');
      if (App.state.view === 'spread') App.paint();
    });
  };

  /* ---------------- 设置 ---------------- */
  function settingsHtml() {
    var st = App.state.settings;
    var themes = [
      { id: 'auto', label: '跟随系统' },
      { id: 'light', label: '亮色' },
      { id: 'dark', label: '深色' },
    ];
    return '<div class="wrap">' +
      App.topbar({ back: '#/home', title: '设置' }) +
      '<div class="shell" style="padding-bottom:64px">' +
        '<h1 class="h1" style="margin-top:12px">设置</h1>' +

        '<p class="group-title">外观</p>' +
        '<div class="seg-wide" id="theme-seg">' +
          themes.map(function (t) {
            return '<button data-theme="' + t.id + '" aria-pressed="' + (st.theme === t.id) + '">' + t.label + '</button>';
          }).join('') +
        '</div>' +
        '<p class="hint" style="margin-top:8px">跟随系统时由系统的亮 / 深色决定；手动选择优先于系统。</p>' +

        '<div class="hair" style="margin-top:20px"></div>' +
        '<div class="srow"><div class="st"><b>动效</b><span>牌面翻转、弹层过渡</span></div>' +
          '<button class="toggle" data-motion aria-pressed="' + (st.motion !== false) + '" aria-label="动效"><i></i></button></div>' +
        '<div class="hair"></div>' +

        '<p class="group-title">默认解读风格</p>' +
        '<p class="hint" style="margin-top:4px">' +
          App.styles.map(function (s) { return '<button class="btn" data-style-set="' + s.id + '" style="margin:4px 6px 0 0;min-height:38px;font-size:12px;' +
            (s.id === st.defaultStyle ? 'border-color:var(--copper);color:var(--copper)' : '') + '">' + App.esc(s.name) + '</button>'; }).join('') +
        '</p>' +

        '<p class="group-title">自建分类</p>' +
        (App.state.customSpreads.length
          ? App.state.customSpreads.map(function (sp) {
              return '<div class="srow"><div class="st"><b>' + App.esc(sp.name) + '</b><span>' + sp.count + ' 个位置' +
                (sp.note ? ' · ' + App.esc(sp.note) : '') + '</span></div>' +
                '<button class="btn" data-delspread="' + sp.id + '">删除</button></div><div class="hair"></div>';
            }).join('')
          : '<p class="hint">还没有自建分类。首页加号 → 新增分类可以建一个。</p>') +

        '<p class="group-title">数据</p>' +
        '<div class="srow"><div class="st"><b>导出备份</b><span>JSON 文件，含全部记录</span></div>' +
          '<button class="btn" data-export>导出</button></div><div class="hair"></div>' +
        '<div class="srow"><div class="st"><b>导入备份</b><span>同 id 的记录会被跳过</span></div>' +
          '<button class="btn" data-import>导入</button></div><div class="hair"></div>' +
        '<div class="srow"><div class="st"><b>记录数量</b><span>' + App.state.records.length + ' 条，全部存在这台设备上</span></div>' +
          '<span class="mono">' + App.state.records.length + '</span></div>' +

        '<p class="hint" style="margin-top:28px;line-height:1.9">全部离线：没有联网、没有账号。卸载或清理浏览器数据会一起清掉记录，记得定期导出。</p>' +
      '</div></div>';
  }

  function bindSettings() {
    appEl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme]');
      if (t && t.closest('#theme-seg')) {
        App.state.settings.theme = t.getAttribute('data-theme');
        App.saveSettings();
        App.applyTheme(true);
        App.paint();
        return;
      }
      var m = e.target.closest('[data-motion]');
      if (m) {
        App.state.settings.motion = !(App.state.settings.motion !== false);
        App.saveSettings();
        document.documentElement.classList.toggle('no-motion', App.state.settings.motion === false);
        App.paint();
        return;
      }
      var sd = e.target.closest('[data-style-set]');
      if (sd) {
        App.state.settings.defaultStyle = sd.getAttribute('data-style-set');
        App.saveSettings();
        App.paint();
        return;
      }
      var ds = e.target.closest('[data-delspread]');
      if (ds) {
        var id = ds.getAttribute('data-delspread');
        App.state.customSpreads = App.state.customSpreads.filter(function (s) { return s.id !== id; });
        App.saveCustomSpreads();
        App.toast('已删除');
        App.paint();
        return;
      }
      if (e.target.closest('[data-export]')) { App.exportJson(); return; }
      if (e.target.closest('[data-import]')) { App.importJson(); return; }
    });
  }

  /* ---------------- 导入导出 ---------------- */
  App.exportJson = function () {
    var payload = {
      app: '塔罗笔记',
      version: App.templates.version,
      exportedAt: Date.now(),
      records: App.state.records.map(function (r) {
        return {
          id: r.id, type: r.type, number: r.number, createdAt: r.createdAt, updatedAt: r.updatedAt,
          spreadId: r.spreadId, spreadName: r.spreadName, question: r.question, mood: r.mood,
          cards: r.cards, styleId: r.styleId, styleName: r.styleName,
          prompt: r.prompt, reading: r.reading, notes: r.notes,
        };
      }),
    };
    var text = JSON.stringify(payload, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    a.href = url;
    a.download = '塔罗笔记备份-' + d.getFullYear() + App.pad2(d.getMonth() + 1) + App.pad2(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 400);
    App.toast('已导出 ' + App.state.records.length + ' 条');
  };

  App.importJson = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        var count = 0;
        try {
          var root = JSON.parse(String(fr.result));
          var arr = (root && root.records) || [];
          var ids = {};
          App.state.records.forEach(function (r) { ids[r.id] = 1; });
          var incoming = [];
          arr.forEach(function (o) {
            if (!o || !o.id || ids[o.id]) return;
            var cards = Array.isArray(o.cards) ? o.cards : [];
            if (!cards.length) return;
            ids[o.id] = 1;
            incoming.push({
              id: o.id, type: o.type || 'daily', number: Number(o.number) || 0,
              createdAt: Number(o.createdAt) || Date.now(), updatedAt: Number(o.updatedAt) || Date.now(),
              spreadId: o.spreadId || '', spreadName: o.spreadName || '', question: o.question || '',
              mood: o.mood || '', cards: cards, styleId: o.styleId || '', styleName: o.styleName || '',
              prompt: o.prompt || '', reading: o.reading || '', notes: o.notes || '',
            });
          });
          count = incoming.length;
          if (count) {
            Store.putMany(incoming).then(function () {
              return App.refreshRecords();
            }).then(function () {
              App.toast('导入 ' + count + ' 条');
              App.paint();
            });
          } else {
            App.toast('没有新的记录可导入');
          }
        } catch (err) {
          App.toast('文件读不出来，确认是导出的 JSON');
        }
      };
      fr.readAsText(file);
    });
    input.click();
  };

  /* ---------------- 全局点击 ---------------- */
  function bindGlobal() {
    appEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-add]')) { openMenu(); return; }
      var f = e.target.closest('[data-filter]');
      if (f) {
        App.state.filter = f.getAttribute('data-filter');
        App.paint();
        return;
      }
      var goEl = e.target.closest('[data-go]');
      if (goEl) { App.go(goEl.getAttribute('data-go')); return; }
      var open = e.target.closest('[data-open]');
      if (open) { App.go('#/detail/' + open.getAttribute('data-open')); return; }
    });
  }

  /* ---------------- 绘制 ---------------- */
  var lastHash = null;

  App.paint = function () {
    var hash = location.hash || '#/home';
    var keep = hash === lastHash;
    var keepY = keep ? window.scrollY : 0;
    lastHash = hash;
    var route = currentRoute();
    App.state.view = route.name;
    var html = '', after = null;

    if (route.name === 'home') {
      html = homeHtml();
    } else if (route.name === 'daily') {
      html = App.views.daily();
      after = App.views.dailyAfter;
    } else if (route.name === 'spread') {
      html = App.views.spread();
      after = App.views.spreadAfter;
    } else if (route.name === 'detail') {
      html = App.views.detail(route.arg);
      after = App.views.detailAfter;
    } else if (route.name === 'settings') {
      html = settingsHtml();
    } else {
      html = homeHtml();
    }

    appEl.onclick = null;
    appEl.innerHTML = html;
    // 换页时清掉还开着的弹层与加号菜单，别让它悬在新页面上
    if (!keep) {
      var sr = document.getElementById('sheet-root');
      if (sr) sr.innerHTML = '';
    }
    window.scrollTo(0, keepY);
    if (after) after();
  };

  App.startDaily = function () {
    App.state.draft.daily = null;
    App.go('#/daily');
  };
  App.startSpread = function () {
    App.state.draft.spread = null;
    App.go('#/spread');
  };

  /* ---------------- 启动 ---------------- */
  function boot() {
    Store.ready().then(function () {
      return Promise.all([
        Store.getKV('settings', null),
        Store.getKV('customSpreads', []),
        App.refreshRecords(),
        Store.getKV('draft_daily', null),
        Store.getKV('draft_spread', null),
      ]);
    }).then(function (res) {
      if (res[0]) App.state.settings = Object.assign(App.state.settings, res[0]);
      App.state.customSpreads = Array.isArray(res[1]) ? res[1] : [];
      if (res[3] && res[3].cardId) App.state.draft.daily = res[3];
      if (res[4] && res[4].spreadId) App.state.draft.spread = res[4];
      if (App.state.settings.motion === false) document.documentElement.classList.add('no-motion');
      document.documentElement.setAttribute('data-theme', App.resolveTheme(App.state.settings.theme));
      App.mirrorPrefs();
      App.updateKbInset();
      bindGlobal();
      bindSettings();
      // 键盘弹起时把输入框滚进可视区（竖屏单列时尤其需要）
      appEl.addEventListener('focusin', function (e) {
        var t = e.target;
        if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
        setTimeout(function () {
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 260);
      });
      App.paint();
    });
  }

  boot();

  /* Service Worker：https / localhost 下才注册；file:// 直接跳过，功能不受影响 */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 注册失败不影响使用 */ });
    });
  }
})();
