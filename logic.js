/* Логика «Первые 90 дней»: контрольные точки, оценка риска, кому написать сегодня.
   Чистые функции, без DOM. Работает в браузере и в Node (для тестов). */
(function (root) {
  'use strict';

  var CHECKPOINTS = [3, 7, 14, 30, 60, 90];
  var GRACE = 2; // сколько дней после контрольной точки опрос ещё считается «пора ответить»
  var QUESTIONS = [
    { id: 'clarity', label: 'Понятно, что делать', text: 'Понятно ли, что от вас ждут на этой неделе?' },
    { id: 'support', label: 'Есть у кого спросить', text: 'Есть ли у кого спросить, если что-то непонятно?' },
    { id: 'intent', label: 'Хочет остаться', text: 'Хотите ли вы остаться в компании ещё хотя бы на три месяца?' }
  ];

  function parseDate(v) {
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (!m) throw new Error('Неверная дата: ' + v);
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function daysBetween(a, b) {
    var x = parseDate(a), y = parseDate(b);
    return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) -
      Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
  }

  /* Состояние каждой контрольной точки: future | due | overdue | done */
  function checkpointStatus(emp, today) {
    var d = daysBetween(emp.startDate, today);
    var checkins = emp.checkins || {};
    return CHECKPOINTS.map(function (day) {
      var answer = checkins[day] || null;
      var state;
      if (answer) state = 'done';
      else if (d < day) state = 'future';
      else if (d - day <= GRACE) state = 'due';
      else state = 'overdue';
      return { day: day, state: state, answer: answer };
    });
  }

  function avg(a) {
    return (a.clarity + a.support + a.intent) / 3;
  }

  /* Оценка риска ухода 0..100 по простым и объяснимым правилам.
     Это не прогноз, а способ расставить, кому писать первым. */
  function assess(emp, today) {
    var d = daysBetween(emp.startDate, today);
    if (d < 0) return { score: 0, level: 'low', reasons: ['Ещё не вышел на работу'], days: d, action: '' };
    if (d > 90 + GRACE) {
      return { score: 0, level: 'done', reasons: ['90 дней пройдены'], days: d, action: '' };
    }

    var score = 0, reasons = [], top = null;
    var cps = checkpointStatus(emp, today);
    // «последний» ответ считаем по дате ответа, а не по номеру точки:
    // запоздалый ответ на ранний опрос тоже самый свежий сигнал
    var answered = cps.filter(function (c) { return c.state === 'done'; });
    answered.sort(function (x, y) {
      var dx = x.answer.date || '', dy = y.answer.date || '';
      return dx < dy ? -1 : dx > dy ? 1 : x.day - y.day;
    });
    var last = answered.length ? answered[answered.length - 1] : null;
    var prev = answered.length > 1 ? answered[answered.length - 2] : null;

    if (last) {
      QUESTIONS.forEach(function (q) {
        var v = last.answer[q.id];
        if (v <= 2) {
          var add = q.id === 'intent' ? 30 : 25;
          score += add;
          reasons.push('Низкая оценка («' + q.label + '»: ' + v + ' из 5), опрос на ' + last.day + '-й день');
          if (!top || add > top.add) top = { id: q.id, add: add };
        } else if (v === 3) {
          score += 8;
          reasons.push('Сомнения («' + q.label + '»: 3 из 5), опрос на ' + last.day + '-й день');
        }
      });
      if (last.answer.wantsTalk) {
        score += 20;
        reasons.unshift('Сам попросил поговорить с HR');
        top = { id: 'talk', add: 99 };
      }
      if (prev && avg(prev.answer) - avg(last.answer) >= 1) {
        score += 15;
        reasons.push('Оценки упали с ' + prev.day + '-го на ' + last.day + '-й день');
      }
    }

    var overdue = cps.filter(function (c) { return c.state === 'overdue'; }).length;
    if (overdue) {
      score += Math.min(30, overdue * 15);
      reasons.push('Пропущено опросов: ' + overdue);
      if (!top) top = { id: 'silent', add: 0 };
    }

    if (!emp.mentor) {
      score += 15;
      reasons.push('Не назначен наставник');
      if (!top) top = { id: 'mentor', add: 0 };
    }

    score = Math.min(100, score);
    var level = score >= 60 ? 'high' : score >= 30 ? 'mid' : 'low';
    if (!reasons.length) reasons.push('Тревожных сигналов нет');

    return { score: score, level: level, reasons: reasons, days: d, action: suggestAction(top) };
  }

  function suggestAction(top) {
    if (!top) return '';
    switch (top.id) {
      case 'talk': return 'Позвонить или написать сегодня: человек сам попросил разговор.';
      case 'intent': return 'Поговорить 15 минут: узнать, что смущает, и предложить решение.';
      case 'clarity': return 'Попросить руководителя расписать задачи на неделю и проверить, что понятно.';
      case 'support': return 'Назначить или напомнить наставника, договориться о коротких встречах.';
      case 'silent': return 'Напомнить об опросе лично, не только в системе.';
      case 'mentor': return 'Назначить наставника.';
      default: return '';
    }
  }

  /* Кому написать сегодня: те, у кого риск не низкий, по убыванию риска */
  function todayList(emps, today, limit) {
    var rows = emps.map(function (e) {
      var a = assess(e, today);
      return { emp: e, a: a };
    }).filter(function (r) { return r.a.level === 'high' || r.a.level === 'mid'; });
    rows.sort(function (x, y) { return y.a.score - x.a.score || x.a.days - y.a.days; });
    return limit ? rows.slice(0, limit) : rows;
  }

  function summary(emps, today) {
    var s = { total: 0, high: 0, mid: 0, low: 0, done: 0, overdue: 0 };
    emps.forEach(function (e) {
      var a = assess(e, today);
      s.total++;
      s[a.level]++;
      s.overdue += checkpointStatus(e, today).filter(function (c) { return c.state === 'overdue'; }).length;
    });
    return s;
  }

  /* Валидация ответа на опрос: оценки 1..5 */
  function validateAnswer(ans) {
    var ok = QUESTIONS.every(function (q) {
      var v = ans[q.id];
      return Number.isInteger(v) && v >= 1 && v <= 5;
    });
    return ok;
  }

  var api = {
    CHECKPOINTS: CHECKPOINTS, GRACE: GRACE, QUESTIONS: QUESTIONS,
    parseDate: parseDate, daysBetween: daysBetween, checkpointStatus: checkpointStatus,
    assess: assess, todayList: todayList, summary: summary, validateAnswer: validateAnswer
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Novichok = api;
})(typeof window !== 'undefined' ? window : this);
