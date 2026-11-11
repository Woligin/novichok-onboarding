(function () {
  'use strict';
  var N = window.Novichok, D = window.NovichokData;
  var KEY = 'novichok-checkins-v1';

  // дату можно подменить для демо: ?date=2026-11-11
  var q = new URLSearchParams(location.search).get('date');
  var today = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? N.parseDate(q) : N.parseDate(new Date());

  var emps = D.build(today);
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  function applySaved() {
    emps.forEach(function (e) {
      var s = saved[e.id];
      if (s) Object.keys(s).forEach(function (cp) { e.checkins[cp] = s[cp]; });
    });
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* без хранилища работает в памяти */ }
  }
  applySaved();

  var state = { tab: 'hr', dept: '', level: '', open: null, flash: '' };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var LEVEL = { high: 'Высокий', mid: 'Средний', low: 'Низкий', done: 'Прошёл 90 дней' };
  function pill(level) { return h('span', { class: 'pill ' + level }, LEVEL[level]); }
  function draft(e) {
    return 'Здравствуйте, ' + e.name.split(' ')[0] + '! Это HR. Хотим узнать, как у вас дела на новом месте и чем можем помочь. ' +
      'Удобно ли поговорить 10 минут сегодня?';
  }

  function render() {
    var view = document.getElementById('view');
    view.textContent = '';
    var tabs = document.getElementById('tabs');
    tabs.textContent = '';
    [['hr', 'Сводка для HR'], ['survey', 'Опрос новичка'], ['data', 'О данных']].forEach(function (t) {
      tabs.appendChild(h('button', {
        role: 'tab', 'aria-selected': String(state.tab === t[0]),
        onclick: function () { state.tab = t[0]; state.flash = ''; render(); }
      }, t[1]));
    });
    if (state.tab === 'hr') renderHr(view);
    else if (state.tab === 'survey') renderSurvey(view);
    else renderData(view);
  }

  function renderHr(view) {
    var s = N.summary(emps, today);
    var stats = h('div', { class: 'stats' }, [
      stat(s.high, 'Высокий риск'), stat(s.mid, 'Средний риск'),
      stat(s.overdue, 'Просроченных опросов'), stat(s.total, 'Всего новичков')
    ]);
    view.appendChild(stats);

    var list = N.todayList(emps, today, 6);
    var card = h('section', { class: 'card' }, [h('h2', {}, 'Кому написать сегодня')]);
    if (!list.length) card.appendChild(h('p', { class: 'note' }, 'Тревожных сигналов нет.'));
    list.forEach(function (r) {
      var msgBox = h('div', { class: 'msg', hidden: 'hidden' }, draft(r.emp));
      card.appendChild(h('div', { class: 'row' }, [
        h('div', {}, [
          h('div', { class: 'who' }, [r.emp.name + ' · ' + r.emp.dept + ' · ' + r.a.days + '-й день ']),
          h('ul', {}, r.a.reasons.slice(0, 3).map(function (x) { return h('li', {}, x); })),
          r.a.action ? h('div', { class: 'act' }, 'Что сделать: ' + r.a.action) : '',
          msgBox
        ]),
        h('div', { style: 'text-align:right;white-space:nowrap' }, [
          pill(r.a.level), h('div', { class: 'note' }, 'риск ' + r.a.score), h('br'),
          h('button', { class: 'btn small', onclick: function () { msgBox.hidden = !msgBox.hidden; } }, 'Текст сообщения')
        ])
      ]));
    });
    view.appendChild(card);

    var all = h('section', { class: 'card' }, [h('h2', {}, 'Все новички')]);
    var depts = Array.from(new Set(emps.map(function (e) { return e.dept; })));
    var fd = h('select', { 'aria-label': 'Отдел', onchange: function (ev) { state.dept = ev.target.value; render(); } },
      [h('option', { value: '' }, 'Все отделы')].concat(depts.map(function (d) {
        return h('option', Object.assign({ value: d }, state.dept === d ? { selected: 'selected' } : {}), d);
      })));
    var fl = h('select', { 'aria-label': 'Риск', onchange: function (ev) { state.level = ev.target.value; render(); } },
      [['', 'Любой риск'], ['high', 'Высокий'], ['mid', 'Средний'], ['low', 'Низкий'], ['done', 'Прошли 90 дней']].map(function (o) {
        return h('option', Object.assign({ value: o[0] }, state.level === o[0] ? { selected: 'selected' } : {}), o[1]);
      }));
    all.appendChild(h('div', { class: 'filters' }, [fd, fl]));

    var rows = emps.map(function (e) { return { e: e, a: N.assess(e, today) }; })
      .filter(function (r) { return (!state.dept || r.e.dept === state.dept) && (!state.level || r.a.level === state.level); })
      .sort(function (x, y) { return y.a.score - x.a.score; });
    var tbody = h('tbody');
    rows.forEach(function (r) {
      tbody.appendChild(h('tr', { class: 'click', tabindex: '0', onclick: function () { state.open = state.open === r.e.id ? null : r.e.id; render(); } }, [
        h('td', {}, r.e.name), h('td', { class: 'hide-sm' }, r.e.dept), h('td', {}, String(r.a.days)),
        h('td', {}, [pill(r.a.level)]), h('td', {}, String(r.a.score)), h('td', { class: 'hide-sm' }, r.e.mentor || 'нет')
      ]));
      if (state.open === r.e.id) {
        var tl = h('div', { class: 'tl' }, N.checkpointStatus(r.e, today).map(function (c) {
          var label = { done: 'отвечено', due: 'пора ответить', overdue: 'просрочено', future: 'впереди' }[c.state];
          var extra = c.answer ? ' (' + c.answer.clarity + '/' + c.answer.support + '/' + c.answer.intent + ')' : '';
          return h('div', { class: 'cp ' + c.state }, [h('b', {}, c.day + '-й день'), h('div', {}, label + extra)]);
        }));
        tbody.appendChild(h('tr', {}, [h('td', { colspan: '6' }, [
          tl, h('ul', { class: 'note' }, r.a.reasons.map(function (x) { return h('li', {}, x); }))
        ])]));
      }
    });
    all.appendChild(h('table', {}, [
      h('thead', {}, h('tr', {}, ['Имя', 'Отдел', 'День', 'Риск', 'Баллы', 'Наставник'].map(function (t, i) {
        return h('th', { class: (i === 1 || i === 5) ? 'hide-sm' : '' }, t);
      }))), tbody
    ]));
    all.appendChild(h('p', { class: 'note' }, 'Нажмите на строку: покажем опросы по дням. В скобках оценки по трём вопросам (понятно что делать / есть у кого спросить / хочет остаться, от 1 до 5).'));
    view.appendChild(all);
  }

  function stat(n, label) { return h('div', { class: 'stat' }, [h('b', {}, String(n)), h('span', {}, label)]); }

  function renderSurvey(view) {
    var pending = [];
    emps.forEach(function (e) {
      N.checkpointStatus(e, today).forEach(function (c) {
        if (c.state === 'due' || c.state === 'overdue') pending.push({ e: e, c: c });
      });
    });
    var card = h('section', { class: 'card' }, [h('h2', {}, 'Опрос новичка (так это видит сотрудник)')]);
    if (state.flash) card.appendChild(h('p', { class: 'msg', role: 'status' }, state.flash));
    if (!pending.length) {
      card.appendChild(h('p', { class: 'note' }, 'Сейчас нет опросов, на которые нужно ответить.'));
      view.appendChild(card); return;
    }
    var sel = h('select', { id: 'who', 'aria-label': 'Кто отвечает' }, pending.map(function (p, i) {
      return h('option', { value: String(i) }, p.e.name + ' · опрос на ' + p.c.day + '-й день' + (p.c.state === 'overdue' ? ' (просрочен)' : ''));
    }));
    card.appendChild(h('div', { class: 'filters' }, [sel]));
    var form = h('form', { novalidate: 'novalidate' });
    N.QUESTIONS.forEach(function (qq) {
      var sc = h('div', { class: 'scale', role: 'radiogroup', 'aria-label': qq.text });
      [1, 2, 3, 4, 5].forEach(function (v) {
        sc.appendChild(h('label', {}, [h('input', { type: 'radio', name: qq.id, value: String(v) }), h('span', {}, String(v))]));
      });
      form.appendChild(h('fieldset', {}, [h('legend', {}, qq.text), sc, h('div', { class: 'note' }, '1 — совсем нет, 5 — да, полностью')]));
    });
    form.appendChild(h('label', {}, [h('input', { type: 'checkbox', name: 'wantsTalk' }), ' Хочу поговорить с HR лично']));
    var err = h('p', { class: 'note', role: 'alert', style: 'color:var(--high)' });
    form.appendChild(err);
    form.appendChild(h('button', { class: 'btn primary', type: 'submit' }, 'Отправить'));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var p = pending[+sel.value];
      var ans = { wantsTalk: form.elements.wantsTalk.checked, date: D.iso(today) };
      N.QUESTIONS.forEach(function (qq) {
        var r = form.querySelector('input[name=' + qq.id + ']:checked');
        ans[qq.id] = r ? +r.value : NaN;
      });
      if (!N.validateAnswer(ans)) { err.textContent = 'Ответьте на все три вопроса.'; return; }
      p.e.checkins[p.c.day] = ans;
      saved[p.e.id] = saved[p.e.id] || {};
      saved[p.e.id][p.c.day] = ans;
      persist();
      var a = N.assess(p.e, today);
      state.flash = 'Спасибо, ответ сохранён. Для HR риск по сотруднику ' + p.e.name + ' теперь: ' + LEVEL[a.level].toLowerCase() + ' (' + a.score + ').';
      render();
    });
    card.appendChild(form);
    view.appendChild(card);
  }

  function renderData(view) {
    view.appendChild(h('section', { class: 'card' }, [
      h('h2', {}, 'О данных и расчёте'),
      h('p', {}, 'Сотрудники вымышлены (24 человека: склад, магазин, отдел продаж, офис). Даты выхода считаются от сегодняшнего дня.'),
      h('p', {}, 'Риск считается по простым правилам, а не моделью: низкие оценки в опросе, падение оценок, просроченные опросы, нет наставника, просьба поговорить. Это способ решить, кому писать первым, а не прогноз ухода.'),
      h('button', { class: 'btn', onclick: function () {
        saved = {}; persist(); emps = D.build(today); render();
      } }, 'Сбросить ответы')
    ]));
  }

  render();
})();
