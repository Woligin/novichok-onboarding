const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../logic.js');
const D = require('../data.js');

const TODAY = new Date(2026, 10, 11); // 11 ноября 2026
const emp = (daysAgo, extra) => Object.assign({
  id: 'x', name: 'Тест Т.', dept: 'Склад', mentor: 'Наставник А.', checkins: {},
  startDate: D.iso(new Date(2026, 10, 11 - daysAgo))
}, extra || {});
const ans = (c, s, i, extra) => Object.assign({ clarity: c, support: s, intent: i, wantsTalk: false }, extra || {});

test('daysBetween считает дни и не зависит от времени суток', () => {
  assert.equal(N.daysBetween('2026-11-01', new Date(2026, 10, 11, 23, 59)), 10);
  assert.equal(N.daysBetween('2026-11-11', '2026-11-11'), 0);
});

test('parseDate отклоняет мусор', () => {
  assert.throws(() => N.parseDate('вчера'));
});

test('контрольные точки: впереди, пора, просрочено, отвечено', () => {
  const e = emp(10, { checkins: { 3: ans(5, 5, 5) } });
  const st = Object.fromEntries(N.checkpointStatus(e, TODAY).map(c => [c.day, c.state]));
  assert.equal(st[3], 'done');
  assert.equal(st[7], 'overdue');   // 10 - 7 = 3 > GRACE
  assert.equal(st[14], 'future');
});

test('граница GRACE: через 2 дня ещё «пора», через 3 уже «просрочено»', () => {
  const st = (d) => N.checkpointStatus(emp(d), TODAY).find(c => c.day === 7).state;
  assert.equal(st(6), 'future');
  assert.equal(st(7), 'due');
  assert.equal(st(9), 'due');
  assert.equal(st(10), 'overdue');
});

test('довольный новичок с наставником: низкий риск', () => {
  const e = emp(8, { checkins: { 3: ans(5, 5, 5), 7: ans(5, 4, 5) } });
  const a = N.assess(e, TODAY);
  assert.equal(a.level, 'low');
  assert.equal(a.score, 0);
});

test('низкое «хочу остаться» даёт высокий вес и совет поговорить', () => {
  const e = emp(8, { checkins: { 3: ans(4, 4, 2), 7: ans(4, 4, 1) } });
  const a = N.assess(e, TODAY);
  assert.equal(a.score, 30);
  assert.equal(a.level, 'mid');
  assert.match(a.action, /Поговорить/);
});

test('просьба поговорить с HR всегда на первом месте в совете', () => {
  const e = emp(8, { checkins: { 7: ans(2, 2, 2, { wantsTalk: true }) } });
  const a = N.assess(e, TODAY);
  assert.equal(a.level, 'high');
  assert.match(a.action, /сам попросил/);
});

test('падение оценок на балл и больше добавляет риск', () => {
  const flat = emp(16, { checkins: { 3: ans(4, 4, 4), 7: ans(4, 4, 4), 14: ans(4, 4, 4) } });
  const drop = emp(16, { checkins: { 3: ans(5, 5, 5), 7: ans(5, 5, 5), 14: ans(4, 4, 4) } });
  assert.equal(N.assess(flat, TODAY).score, 0);
  assert.equal(N.assess(drop, TODAY).score, 15);
});

test('нет наставника: +15, просроченные опросы: +15 за каждый, максимум 30', () => {
  const e = emp(20, { mentor: '' }); // ни одного ответа: 3, 7, 14 просрочены
  const a = N.assess(e, TODAY);
  assert.equal(a.score, 30 + 15);
});

test('после 90 дней (+GRACE) сотрудник выходит из расчёта', () => {
  assert.notEqual(N.assess(emp(92), TODAY).level, 'done'); // 92 = 90 + GRACE, ещё в окне
  assert.equal(N.assess(emp(93), TODAY).level, 'done');
});

test('будущая дата выхода не ломает расчёт', () => {
  const a = N.assess(emp(-3), TODAY);
  assert.equal(a.level, 'low');
});

test('оценка ограничена 100', () => {
  const e = emp(40, { mentor: '', checkins: { 30: ans(1, 1, 1, { wantsTalk: true }) } });
  assert.equal(N.assess(e, TODAY).score, 100);
});

test('todayList: только средний и высокий, по убыванию риска', () => {
  const list = N.todayList([
    emp(8, { id: 'a', checkins: { 7: ans(5, 5, 5) } }),
    emp(8, { id: 'b', checkins: { 7: ans(4, 4, 1) } }),
    emp(8, { id: 'c', checkins: { 7: ans(1, 1, 1) } })
  ], TODAY);
  assert.deepEqual(list.map(r => r.emp.id), ['c', 'b']);
});

test('validateAnswer: только целые 1..5 по всем вопросам', () => {
  assert.equal(N.validateAnswer(ans(1, 5, 3)), true);
  assert.equal(N.validateAnswer(ans(0, 5, 3)), false);
  assert.equal(N.validateAnswer(ans(1, 6, 3)), false);
  assert.equal(N.validateAnswer(ans(1, 2.5, 3)), false);
  assert.equal(N.validateAnswer({ clarity: 3, support: 3 }), false);
});

test('демо-данные: 24 человека, у всех валидные ответы, есть и риск, и спокойные', () => {
  const emps = D.build(TODAY);
  assert.equal(emps.length, 24);
  emps.forEach(e => Object.values(e.checkins).forEach(a => assert.ok(N.validateAnswer(a), e.name)));
  const s = N.summary(emps, TODAY);
  assert.ok(s.high + s.mid > 0, 'должны быть сотрудники в зоне риска');
  assert.ok(s.low > 0, 'должны быть спокойные');
  assert.equal(s.total, 24);
});

test('демо-данные детерминированы', () => {
  assert.deepEqual(D.build(TODAY), D.build(TODAY));
});

test('запоздалый ответ на ранний опрос считается самым свежим сигналом', () => {
  const e = emp(9, { checkins: {
    7: Object.assign(ans(4, 4, 4), { date: '2026-11-09' }),
    3: Object.assign(ans(1, 1, 1, { wantsTalk: true }), { date: '2026-11-11' })
  } });
  const a = N.assess(e, TODAY);
  assert.equal(a.level, 'high');
  assert.match(a.action, /сам попросил/);
});
