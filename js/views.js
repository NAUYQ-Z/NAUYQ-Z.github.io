/* 三个工作台：日运（案台）、牌阵（牌桌）、详情（账页）。 */
(function () {
  var App = window.App;
  var V = App.views = {};

  function cardPlate(card, orientation) {
    if (!card) {
      return '<button class="card3d empty" data-act="pick"><span class="hint">点这里选一张牌</span></button>';
    }
    return '<div class="card3d ' + (orientation === 'rev' ? 'rev' : '') + '" data-plate>' +
      '<div class="inner">' +
        '<div class="face"><img src="' + card.img + '" alt="' + App.esc(card.name) + '" /></div>' +
        '<div class="face back"><img src="' + card.img + '" alt="" /></div>' +
      '</div></div>';
  }

  function styleSeg(active) {
    return '<div class="seg" data-styleseg style="flex-wrap:wrap">' +
      App.styles.map(function (s) {
        return '<button data-style="' + s.id + '" aria-pressed="' + (s.id === active) + '">' + App.esc(s.name) + '</button>';
      }).join('') + '</div>';
  }

  /* ================= 日运 ================= */
  V.daily = function () {
    if (!App.state.draft.daily) {
      App.state.draft.daily = {
        cardId: null, orientation: 'up', mood: '',
        styleId: App.state.settings.defaultStyle || App.defaultStyle,
        at: Date.now(),
      };
    }
    var d = App.state.draft.daily;
    var card = App.cardById[d.cardId];
    var face = card ? App.face(card, d.orientation) : null;
    var prompt = App.dailyPrompt(d);

    var side =
      '<div class="side">' +
        '<div class="cardbox">' + cardPlate(card, d.orientation) + '</div>' +
        (card ? '<div class="stage-text">' +
          '<p class="cn">' + App.esc(card.name) + ' · ' + (d.orientation === 'rev' ? '逆位' : '正位') + '</p>' +
          '<p class="en">' + App.esc(card.en) + '</p>' +
          '<div class="chips">' + face.kw.map(function (k) { return '<span class="chip">' + App.esc(k) + '</span>'; }).join('') + '</div>' +
          '</div>' : '<p class="hint" style="text-align:center;margin-top:12px">还没有落牌</p>') +
      '</div>';

    var form =
      '<div class="form-side">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:24px">' +
          '<div class="seg" data-orient>' +
            '<button data-o="up" aria-pressed="' + (d.orientation !== 'rev') + '">正位</button>' +
            '<button data-o="rev" aria-pressed="' + (d.orientation === 'rev') + '">逆位</button>' +
          '</div>' +
          '<button class="btn" data-act="pick">' + (card ? '换一张' : '抽一张') + '</button>' +
        '</div>' +

        '<p class="mono" style="margin:24px 0 6px">今日心境（可空）</p>' +
        '<input class="field" id="d-mood" style="min-height:44px" placeholder="一两句话，今天的状态" maxlength="60" value="' + App.esc(d.mood) + '" />' +

        '<p class="mono" style="margin:24px 0 8px">解读风格</p>' +
        styleSeg(d.styleId) +

        '<p class="mono" style="margin:24px 0 8px">可复制的整理稿</p>' +
        (prompt
          ? '<div class="prompt-box" id="d-prompt">' + App.esc(prompt) + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-act="copy">复制整理稿</button>' +
            '<button class="btn" data-act="copycard">只复制牌面</button></div>'
          : '<p class="hint">选好牌之后，这里会出现整理稿。</p>') +

        '<button class="btn-primary" data-act="save" style="margin-top:24px">' + (card ? '落笔保存' : '先选一张牌') + '</button>' +
        '<p class="hint" style="margin-top:10px;text-align:center">保存后会进年表，随时可以回来改。</p>' +
      '</div>';

    return '<div class="wrap">' +
      App.topbar({ back: '#/home', title: '日运' }) +
      '<div class="shell">' +
        '<header class="page-head">' +
          '<h1 class="h1">今天的这一张</h1>' +
          '<div class="kicker"><span class="no">NO. ' + App.pad4(App.nextNumber()) + '</span>' +
            '<span class="date">' + App.todayLine(d.at) + '</span></div>' +
        '</header>' +
        '<div class="stage-row">' + side + form + '</div>' +
        '<div style="height:40px"></div>' +
      '</div></div>';
  };

  V.dailyAfter = function () {
    var d = App.state.draft.daily;
    var root = document.getElementById('app');

    root.onclick = function (e) {
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'pick') {
          App.pickCard({
            title: '为今天选一张',
            current: d.cardId,
            onPick: function (card) {
              d.cardId = card.id;
              V.keepDailyDraft();
              App.paint();
            },
          });
          return;
        }
        if (a === 'copy') {
          App.copy(App.dailyPrompt(d), '整理稿已复制');
          return;
        }
        if (a === 'copycard') {
          var card = App.cardById[d.cardId];
          if (!card) { App.toast('还没有选牌'); return; }
          var face = App.face(card, d.orientation);
          App.copy(card.name + '（' + (d.orientation === 'rev' ? '逆位' : '正位') + '）\n' + face.kw.join(' · ') + '\n' + face.text, '牌面已复制');
          return;
        }
        if (a === 'save') {
          if (!d.cardId) { App.toast('先选一张牌'); return; }
          V.saveDaily();
          return;
        }
      }

      var o = e.target.closest('[data-o]');
      if (o && e.target.closest('[data-orient]')) {
        d.orientation = o.getAttribute('data-o');
        App.els('[data-o]', document.querySelector('[data-orient]')).forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === o));
        });
        // 先翻牌再换文案：翻面 280ms，动画结束再重排文字
        var plate = document.querySelector('.card3d[data-plate]');
        var cn = document.querySelector('.stage-text .cn');
        if (plate && cn) {
          plate.classList.toggle('rev', d.orientation === 'rev');
          var card = App.cardById[d.cardId];
          if (card) cn.textContent = card.name + ' · ' + (d.orientation === 'rev' ? '逆位' : '正位');
          var box = document.getElementById('d-prompt');
          if (box) box.textContent = App.dailyPrompt(d);
          V.keepDailyDraft();
          setTimeout(App.paint, 340);
        } else {
          App.paint();
        }
        return;
      }
      var st = e.target.closest('[data-style]');
      if (st && e.target.closest('[data-styleseg]')) {
        d.styleId = st.getAttribute('data-style');
        V.keepDailyDraft();
        App.paint();
      }
    };

    var mood = document.getElementById('d-mood');
    if (mood) mood.addEventListener('input', function (e) { d.mood = e.target.value; V.keepDailyDraft(); });
  };

  var draftTimer = 0;
  V.keepDailyDraft = function () {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      if (App.state.draft.daily) Store.setKV('draft_daily', App.state.draft.daily);
    }, 400);
  };

  var sdraftTimer = 0;
  V.keepSpreadDraft = function () {
    clearTimeout(sdraftTimer);
    sdraftTimer = setTimeout(function () {
      if (App.state.draft.spread) Store.setKV('draft_spread', App.state.draft.spread);
    }, 400);
  };

  V.saveDaily = function () {
    var d = App.state.draft.daily;
    var card = App.cardById[d.cardId];
    if (!card) return;
    var face = App.face(card, d.orientation);
    var now = Date.now();
    var style = App.style(d.styleId);
    var rec = {
      id: App.uid(),
      type: 'daily',
      number: App.nextNumber(),
      createdAt: now,
      updatedAt: now,
      spreadId: '', spreadName: '', question: '',
      mood: (d.mood || '').trim(),
      cards: [{
        label: '今日',
        positionMeaning: '',
        cardId: card.id,
        cardName: card.name,
        cardEn: card.en,
        arcana: card.arcana,
        suit: card.suit,
        orientation: d.orientation,
        keywords: face.kw.slice(),
        cardText: face.text,
      }],
      styleId: style.id,
      styleName: style.name,
      prompt: App.dailyPrompt(d),
      reading: '',
      notes: '',
    };
    Store.put(rec).then(function () {
      return App.refreshRecords();
    }).then(function () {
      App.state.draft.daily = null;
      Store.setKV('draft_daily', null);
      App.toast('已落笔');
      App.go('#/detail/' + rec.id);
    });
  };

  /* ================= 牌阵 ================= */
  V.spread = function () {
    if (!App.state.draft.spread) {
      var first = App.spreads[0];
      App.state.draft.spread = {
        spreadId: first.id,
        question: '',
        picks: [],
        styleId: App.state.settings.defaultStyle || App.defaultStyle,
      };
    }
    var d = App.state.draft.spread;
    var spread = App.spread(d.spreadId);
    if (!d.picks || d.picks.length !== spread.count) {
      var picks = [];
      for (var i = 0; i < spread.count; i++) picks.push(d.picks[i] || null);
      d.picks = picks;
    }

    var slots = spread.positions.map(function (pos, i) {
      var pick = d.picks[i];
      var card = pick ? App.cardById[pick.cardId] : null;
      return '<div class="slot-wrap" style="display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line-soft)">' +
        '<button class="slot" data-slot="' + i + '">' +
          '<span class="idx">' + App.pad2(i + 1) + '</span>' +
          '<span class="mini ' + (pick && pick.orientation === 'rev' ? 'rev' : '') + '">' +
            (card ? '<img src="' + card.img + '" alt="" />' : '') +
          '</span>' +
          '<span class="slot-txt">' +
            '<span class="lbl">' + App.esc(pos.label) + (pos.meaning ? ' · ' + App.esc(pos.meaning) : '') + '</span>' +
            '<span class="name">' + (card ? App.esc(card.name) + ' · ' + (pick.orientation === 'rev' ? '逆位' : '正位') : '<span class="muted">未落牌</span>') + '</span>' +
            '<span class="pos">' + (card ? App.esc(App.face(card, pick.orientation).kw.slice(0, 3).join(' · ')) : '点一下选牌') + '</span>' +
          '</span>' +
        '</button>' +
        (card ? '<button class="iconbtn" data-flip="' + i + '" aria-label="正逆位">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v6M12 14v6M8 10l4 4 4-4M8 14l4-4 4 4"/></svg></button>' : '') +
      '</div>';
    }).join('');

    var prompt = App.spreadPrompt(d);
    var ready = d.picks.filter(Boolean).length === spread.count;

    return '<div class="wrap">' +
      App.topbar({ back: '#/home', title: '牌阵' }) +
      '<div class="shell">' +
        '<header class="page-head">' +
          '<h1 class="h1">' + App.esc(spread.name) + '</h1>' +
          '<div class="kicker"><span class="no">NO. ' + App.pad4(App.nextNumber()) + '</span>' +
            '<span class="date">' + spread.count + ' 张牌' + (spread.note ? ' · ' + App.esc(spread.note) : '') + '</span></div>' +
          '<div style="display:flex;gap:8px;margin-top:16px">' +
            '<button class="btn" data-act="changespread">换一个牌阵</button>' +
            '<button class="btn" data-act="newcategory">新增分类</button>' +
          '</div>' +
        '</header>' +

        '<p class="mono" style="margin:24px 0 6px">核心问题（可空）</p>' +
        '<input class="field" id="s-question" style="min-height:44px" placeholder="这次想问什么" maxlength="80" value="' + App.esc(d.question) + '" />' +

        '<p class="mono" style="margin:24px 0 2px">落牌</p>' +
        '<p class="hint" style="margin-bottom:4px">点一下选牌；已落牌的格子可以按住拖到别的位置，两张牌互换。</p>' +
        '<div id="s-slots">' + slots + '</div>' +

        '<p class="mono" style="margin:24px 0 8px">解读风格</p>' +
        styleSeg(d.styleId) +

        '<p class="mono" style="margin:24px 0 8px">可复制的整理稿</p>' +
        (prompt
          ? '<div class="prompt-box">' + App.esc(prompt) + '</div>' +
            '<button class="btn" data-act="copy" style="margin-top:10px">复制整理稿</button>'
          : '<p class="hint">把每个位置都落上牌，整理稿就齐了。</p>') +

        '<button class="btn-primary" data-act="save" style="margin-top:24px">' + (ready ? '落笔保存' : '还有位置没落牌') + '</button>' +
        '<div style="height:40px"></div>' +
      '</div></div>';
  };

  V.spreadAfter = function () {
    var d = App.state.draft.spread;
    var root = document.getElementById('app');
    var q = document.getElementById('s-question');
    if (q) q.addEventListener('input', function (e) { d.question = e.target.value; V.keepSpreadDraft(); });

    /* 拖牌换位：按住已落牌的格子拖动，松手落到另一格就交换两张牌 */
    var dragging = null;
    App.els('.slot-wrap').forEach(function (wrap) {
      var slotBtn = wrap.querySelector('[data-slot]');
      var idx = +(slotBtn && slotBtn.getAttribute('data-slot'));
      if (!d.picks[idx]) return;
      wrap.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = { idx: idx, wrap: wrap, x: e.clientX, y: e.clientY, moved: false, over: -1, pid: e.pointerId };
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!dragging || dragging.wrap !== wrap) return;
        var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
        if (!dragging.moved) {
          if (Math.abs(dx) + Math.abs(dy) <= 6) return;
          // 超过阈值才接管指针：轻点依然是一次普通 click，能打开选牌器
          dragging.moved = true;
          wrap.classList.add('dragging');
          try { wrap.setPointerCapture(dragging.pid); } catch (err) { /* 有的浏览器不支持，忽略 */ }
        }
        wrap.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
        // 被拖的那行跟着手指跑，用行框而不是 elementFromPoint 判断落点，避免命中自己
        var ti = -1;
        App.els('.slot-wrap').forEach(function (w) {
          if (w === wrap) return;
          var r = w.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            var i2 = +(w.querySelector('[data-slot]').getAttribute('data-slot'));
            if (d.picks[i2]) ti = i2;
          }
        });
        if (ti !== dragging.over) {
          App.els('.slot-wrap').forEach(function (w) { w.classList.remove('drag-over'); });
          if (ti >= 0 && ti !== idx) {
            var tw = App.els('.slot-wrap')[ti];
            if (tw) tw.classList.add('drag-over');
          }
          dragging.over = ti;
        }
      });
      function endDrag(e) {
        if (!dragging || dragging.wrap !== wrap) return;
        var moved = dragging.moved, ti = dragging.over, pid = dragging.pid;
        if (moved) { try { wrap.releasePointerCapture(pid); } catch (err) { /* 已释放 */ } }
        wrap.classList.remove('dragging');
        wrap.style.transform = '';
        App.els('.slot-wrap').forEach(function (w) { w.classList.remove('drag-over'); });
        dragging = null;
        if (moved && ti >= 0 && ti !== idx && d.picks[ti]) {
          var tmp = d.picks[idx];
          d.picks[idx] = d.picks[ti];
          d.picks[ti] = tmp;
          V.keepSpreadDraft();
          V.suppressClick = true;
          setTimeout(function () { V.suppressClick = false; }, 320);
          App.paint();
        } else if (moved) {
          V.suppressClick = true;
          setTimeout(function () { V.suppressClick = false; }, 320);
        }
      }
      wrap.addEventListener('pointerup', endDrag);
      wrap.addEventListener('pointercancel', endDrag);
    });

    root.onclick = function (e) {
      if (V.suppressClick) return;
      var slot = e.target.closest('[data-slot]');
      if (slot) {
        var i = +slot.getAttribute('data-slot');
        App.pickCard({
          title: '第 ' + (i + 1) + ' 位',
          sub: App.spread(d.spreadId).positions[i].label,
          current: d.picks[i] ? d.picks[i].cardId : null,
          onPick: function (card) {
            var rev = d.picks[i] && d.picks[i].orientation === 'rev';
            d.picks[i] = { cardId: card.id, orientation: rev ? 'rev' : 'up' };
            V.keepSpreadDraft();
            App.paint();
          },
        });
        return;
      }
      var flip = e.target.closest('[data-flip]');
      if (flip) {
        var j = +flip.getAttribute('data-flip');
        var p = d.picks[j];
        if (p) p.orientation = p.orientation === 'rev' ? 'up' : 'rev';
        var mini = flip.parentNode.querySelector('.mini');
        if (mini) mini.classList.toggle('rev', p && p.orientation === 'rev');
        V.keepSpreadDraft();
        setTimeout(App.paint, 80);
        return;
      }
      var st = e.target.closest('[data-style]');
      if (st && e.target.closest('[data-styleseg]')) {
        d.styleId = st.getAttribute('data-style');
        V.keepSpreadDraft();
        App.paint();
        return;
      }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'copy') { App.copy(App.spreadPrompt(d), '整理稿已复制'); return; }
      if (a === 'newcategory') { App.openSpreadEditor(); return; }
      if (a === 'changespread') { V.spreadPicker(); return; }
      if (a === 'save') {
        var spread = App.spread(d.spreadId);
        if (d.picks.filter(Boolean).length !== spread.count) { App.toast('还有位置没落牌'); return; }
        V.saveSpread();
      }
    };
  };

  V.spreadPicker = function () {
    var d = App.state.draft.spread;
    var all = App.spreadsAll();
    var s = App.sheet({
      title: '换一个牌阵',
      sub: '内置的六个，加上自建的分类',
      body: all.map(function (sp) {
        return '<button class="slot" data-sel="' + sp.id + '" style="align-items:center">' +
          '<span class="idx">' + sp.count + '</span>' +
          '<span class="slot-txt"><span class="name">' + App.esc(sp.name) + '</span>' +
          '<span class="pos">' + App.esc(sp.note || '') + '</span></span>' +
          '<span style="color:' + (sp.id === d.spreadId ? 'var(--copper)' : 'var(--muted)') + '">' + (sp.id === d.spreadId ? '·' : '') + '</span>' +
          '</button>';
      }).join(''),
    });
    s.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sel]');
      if (!b) return;
      d.spreadId = b.getAttribute('data-sel');
      d.picks = [];
      s.close();
      setTimeout(App.paint, 60);
    });
  };

  V.saveSpread = function () {
    var d = App.state.draft.spread;
    var spread = App.spread(d.spreadId);
    var style = App.style(d.styleId);
    var now = Date.now();
    var cards = spread.positions.map(function (pos, i) {
      var pick = d.picks[i];
      var card = App.cardById[pick.cardId];
      var face = App.face(card, pick.orientation);
      return {
        label: pos.label,
        positionMeaning: pos.meaning,
        cardId: card.id,
        cardName: card.name,
        cardEn: card.en,
        arcana: card.arcana,
        suit: card.suit,
        orientation: pick.orientation,
        keywords: face.kw.slice(),
        cardText: face.text,
      };
    });
    var rec = {
      id: App.uid(),
      type: 'spread',
      number: App.nextNumber(),
      createdAt: now,
      updatedAt: now,
      spreadId: spread.id,
      spreadName: spread.name,
      question: (d.question || '').trim(),
      mood: '',
      cards: cards,
      styleId: style.id,
      styleName: style.name,
      prompt: App.spreadPrompt(d),
      reading: '',
      notes: '',
    };
    Store.put(rec).then(function () {
      return App.refreshRecords();
    }).then(function () {
      App.state.draft.spread = null;
      Store.setKV('draft_spread', null);
      App.toast('已落笔');
      App.go('#/detail/' + rec.id);
    });
  };

  /* ================= 详情 ================= */
  V.detail = function (id) {
    var r = App.record(id);
    if (!r) {
      return '<div class="wrap">' + App.topbar({ back: '#/home', title: '记录' }) +
        '<div class="shell" style="padding-top:48px"><p class="h2">这条记录找不到了</p>' +
        '<p class="hint" style="margin-top:8px">可能已经被删除。</p></div></div>';
    }
    var title = r.type === 'daily'
      ? (r.cards[0] ? r.cards[0].cardName : '日运')
      : r.spreadName;

    var plates = r.cards.map(function (c) {
      var card = App.cardById[c.cardId];
      var img = card ? card.img : '';
      return '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">' +
        '<div class="mini' + (c.orientation === 'rev' ? ' rev' : '') + '" style="width:clamp(46px,16vw,68px);aspect-ratio:350/600;border-radius:6px;overflow:hidden;border:1px solid var(--line);flex:0 0 auto">' +
          (img ? '<img src="' + img + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block' + (c.orientation === 'rev' ? ';transform:rotate(180deg)' : '') + '" />' : '') +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          (r.type === 'spread' ? '<p class="mono">' + App.esc(c.label) + (c.positionMeaning ? ' · ' + App.esc(c.positionMeaning) : '') + '</p>' : '') +
          '<p class="serif-s" style="margin-top:2px">' + App.esc(c.cardName) + ' <span style="color:var(--muted);font-size:11.5px">' + (c.orientation === 'rev' ? '逆位' : '正位') + '</span></p>' +
          '<p class="hint" style="margin-top:4px">' + App.esc((c.keywords || []).join(' · ')) + '</p>' +
          '<p class="body-s" style="margin-top:6px">' + App.esc(c.cardText || '') + '</p>' +
        '</div></div>';
    }).join('');

    var left =
      '<div class="pane left">' +
        '<div class="kicker" style="margin-top:8px"><span class="no">NO. ' + App.pad4(r.number) + '</span>' +
          '<span class="date">' + App.fmtDate(r.createdAt) + ' ' + App.fmtTime(r.createdAt) + '</span></div>' +
        '<h1 class="h1" style="margin-top:10px">' + App.esc(title) + '</h1>' +
        '<p class="hint" style="margin-top:6px">' +
          (r.type === 'daily' ? '日运' : '牌阵 · ' + App.esc(r.spreadName)) + ' · ' + App.esc(r.styleName) + '</p>' +
        (r.question ? '<div style="margin-top:16px;padding:12px;background:var(--surface);border:1px solid var(--line-soft);border-radius:8px">' +
          '<p class="mono">核心问题</p><p class="body" style="margin-top:4px">' + App.esc(r.question) + '</p></div>' : '') +
        (r.mood ? '<p class="body-s" style="margin-top:14px">当时心境：' + App.esc(r.mood) + '</p>' : '') +
        '<div style="margin-top:24px">' + plates + '</div>' +
      '</div>';

    var right =
      '<div class="pane right">' +
        '<div class="block-title"><b>解读</b><span>READING</span></div>' +
        '<textarea class="field" id="dt-reading" style="min-height:180px" placeholder="写下来的，才是自己的。">' + App.esc(r.reading) + '</textarea>' +

        '<div class="block-title" style="margin-top:24px"><b>我的笔记</b><span>NOTES</span></div>' +
        '<textarea class="field" id="dt-notes" style="min-height:120px" placeholder="补充、联想、后来发生的事。">' + App.esc(r.notes) + '</textarea>' +

        '<div class="block-title" style="margin-top:24px"><b>提示词</b><span>PROMPT</span></div>' +
        '<div class="prompt-box" style="max-height:32vh">' + App.esc(r.prompt || '（没有整理稿）') + '</div>' +
        '<button class="btn" data-act="copy" style="margin-top:10px">复制整理稿</button>' +

        '<div style="display:flex;gap:8px;margin-top:28px;align-items:center">' +
          '<button class="btn-primary" style="flex:1" data-act="save">保存</button>' +
          '<button class="btn btn-danger" data-act="del">删除</button>' +
        '</div>' +
        '<p class="mono" id="dt-updated" style="margin-top:12px;text-align:center">更新于 ' + App.fmtShort(r.updatedAt) + '</p>' +
      '</div>';

    return '<div class="wrap">' +
      App.topbar({ back: '#/home', title: 'NO. ' + App.pad4(r.number) }) +
      '<div class="shell reading">' +
        '<div class="detail-wide">' + left + '<div class="divider"></div>' + right + '</div>' +
      '</div></div>';
  };

  V.detailAfter = function () {
    var route = (location.hash || '').replace(/^#/, '').split('/');
    var id = route[2];
    var r = App.record(id);
    if (!r) return;
    var root = document.getElementById('app');
    var reading = document.getElementById('dt-reading');
    var notes = document.getElementById('dt-notes');
    var updated = document.getElementById('dt-updated');
    var timer = 0;

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(flush, 900);
    }
    function flush() {
      r.reading = reading ? reading.value : r.reading;
      r.notes = notes ? notes.value : r.notes;
      r.updatedAt = Date.now();
      Store.put(r).then(function () {
        if (updated) updated.textContent = '更新于 ' + App.fmtShort(r.updatedAt);
      });
    }
    if (reading) reading.addEventListener('input', schedule);
    if (notes) notes.addEventListener('input', schedule);

    root.onclick = function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'copy') { App.copy(r.prompt || '', '整理稿已复制'); return; }
      if (a === 'save') {
        clearTimeout(timer);
        flush();
        App.toast('已保存');
        return;
      }
      if (a === 'del') {
        if (!window.confirm('删掉这条记录？删了就找不回来了。')) return;
        Store.del(r.id).then(function () {
          return App.refreshRecords();
        }).then(function () {
          App.toast('已删除');
          App.go('#/home');
        });
      }
    };
  };
})();
