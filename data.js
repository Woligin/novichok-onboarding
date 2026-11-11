/* Вымышленные данные, похожие на описание компании: склад, магазины, отдел продаж, офис.
   Реальных людей здесь нет. Даты считаются от сегодняшнего дня, чтобы демо всегда было живым. */
(function (root) {
  'use strict';

  function rng(seed) { // детерминированный генератор, чтобы демо не менялось от запуска к запуску
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function iso(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  var CPS = [3, 7, 14, 30, 60, 90];
  var NAMES = ['Алексей К.', 'Мария П.', 'Дмитрий С.', 'Ольга В.', 'Игорь Н.', 'Анна Л.', 'Сергей М.', 'Елена Р.',
    'Павел Т.', 'Наталья Б.', 'Роман Ж.', 'Ирина Д.', 'Андрей Ф.', 'Юлия Г.', 'Максим Е.', 'Татьяна О.',
    'Виктор А.', 'Светлана И.', 'Кирилл З.', 'Дарья Х.', 'Артём Ч.', 'Вера Ш.', 'Глеб Ю.', 'Полина Я.'];
  var DEPTS = ['Склад', 'Магазин', 'Отдел продаж', 'Офис'];
  var MENTORS = ['Наставник А.', 'Наставник Б.', 'Наставник В.', 'Наставник Г.'];

  // профиль: как человек обычно отвечает
  var PROFILES = {
    ok: [4, 5],
    drift: [3, 4],
    risk: [1, 3]
  };

  function build(today) {
    var rand = rng(20261111);
    var list = [];
    var plan = [
      // [дней с выхода, профиль]
      [1, 'ok'], [2, 'ok'], [4, 'ok'], [5, 'drift'], [8, 'ok'], [9, 'risk'], [12, 'ok'], [15, 'drift'],
      [16, 'ok'], [20, 'risk'], [24, 'ok'], [31, 'drift'], [33, 'ok'], [38, 'risk'], [45, 'ok'], [52, 'drift'],
      [61, 'ok'], [64, 'risk'], [70, 'ok'], [78, 'drift'], [85, 'ok'], [92, 'ok'], [40, 'ok'], [28, 'drift']
    ];
    plan.forEach(function (p, i) {
      var d = p[0], prof = PROFILES[p[1]];
      var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d);
      var checkins = {};
      CPS.forEach(function (cp, idx) {
        if (cp > d) return;
        if (rand() < 0.12) return; // иногда не отвечают
        var lo = prof[0], hi = prof[1];
        // у «рисковых» оценки со временем падают
        var shift = p[1] === 'risk' ? -idx * 0.3 : 0;
        function pick() {
          var v = Math.round(lo + rand() * (hi - lo) + shift);
          return Math.max(1, Math.min(5, v));
        }
        checkins[cp] = {
          clarity: pick(), support: pick(), intent: pick(),
          wantsTalk: p[1] === 'risk' && rand() < 0.3,
          date: iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + cp))
        };
      });
      list.push({
        id: 'e' + (i + 1),
        name: NAMES[i],
        dept: DEPTS[Math.floor(rand() * DEPTS.length)],
        startDate: iso(start),
        mentor: (p[1] === 'risk' && rand() < 0.4) ? '' : MENTORS[i % MENTORS.length],
        checkins: checkins
      });
    });
    return list;
  }

  var api = { build: build, iso: iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovichokData = api;
})(typeof window !== 'undefined' ? window : this);
