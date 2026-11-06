(function () {
  'use strict';

  var Engine = window.XOEngine;
  var HUMAN = 'X';
  var AI = 'O';
  var STORE_KEY = 'airc-xo:v1';

  var MARK_SVG = {
    X: '<svg class="mark mark-x" viewBox="0 0 100 100" aria-hidden="true">' +
         '<path pathLength="1" d="M14 14 86 86"/><path pathLength="1" d="M86 14 14 86"/></svg>',
    O: '<svg class="mark mark-o" viewBox="0 0 100 100" aria-hidden="true">' +
         '<circle pathLength="1" cx="50" cy="50" r="38" transform="rotate(-90 50 50)"/></svg>'
  };

  var MESSAGES = {
    lose: [
      'So close. One more round?',
      'The AI saw that one coming. Try again!',
      'Almost! Give it another shot.',
      'Shake it off and go again.'
    ],
    draw: [
      'Solid defence! Now go for the win.',
      'Not bad at all. The prize is still waiting.',
      'Neck and neck. Can you find the winning move?'
    ],
    win: [
      'You did it! Come and claim your prize.'
    ]
  };

  var els = {
    board: document.getElementById('board'),
    status: document.getElementById('status'),
    substatus: document.getElementById('substatus'),
    newGame: document.getElementById('new-game'),
    resetScore: document.getElementById('reset-score'),
    starterOpts: Array.prototype.slice.call(document.querySelectorAll('.starter-opt')),
    score: {
      you: document.getElementById('score-you'),
      draw: document.getElementById('score-draw'),
      ai: document.getElementById('score-ai')
    }
  };

  var state = {
    board: new Array(9).fill(null),
    turn: HUMAN,
    starter: 'human',
    over: false,
    timer: null,
    score: { you: 0, draw: 0, ai: 0 }
  };

  var cells = [];

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved) return;
      if (saved.score) {
        ['you', 'draw', 'ai'].forEach(function (k) {
          var n = Number(saved.score[k]);
          if (Number.isFinite(n) && n >= 0) state.score[k] = Math.floor(n);
        });
      }
      if (saved.starter === 'human' || saved.starter === 'ai') state.starter = saved.starter;
    } catch (e) { /* storage unavailable */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ score: state.score, starter: state.starter }));
    } catch (e) { /* storage unavailable */ }
  }

  // Rendering

  function cellLabel(i) {
    var row = Math.floor(i / 3) + 1;
    var col = (i % 3) + 1;
    var mark = state.board[i];
    var who = mark === HUMAN ? 'your X' : mark === AI ? 'AI O' : 'empty';
    return 'Row ' + row + ', column ' + col + ': ' + who;
  }

  function buildBoard() {
    for (var i = 0; i < 9; i++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.index = String(i);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', cellLabel(i));
      cell.addEventListener('click', onCellClick);
      els.board.appendChild(cell);
      cells.push(cell);
    }
  }

  function renderScore(bumpKey) {
    Object.keys(els.score).forEach(function (k) {
      els.score[k].textContent = String(state.score[k]);
    });
    if (bumpKey) {
      var el = els.score[bumpKey];
      el.classList.remove('bump');
      void el.offsetWidth; // restart animation
      el.classList.add('bump');
    }
  }

  function renderStarter() {
    els.starterOpts.forEach(function (opt) {
      opt.setAttribute('aria-checked', String(opt.dataset.starter === state.starter));
    });
  }

  function setStatus(stateName, html, subHtml) {
    els.status.dataset.state = stateName;
    els.status.innerHTML = html;
    els.substatus.innerHTML = subHtml || '';
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function placeMark(i, mark) {
    state.board[i] = mark;
    var cell = cells[i];
    cell.innerHTML = MARK_SVG[mark];
    cell.disabled = true;
    cell.setAttribute('aria-label', cellLabel(i));
  }

  function lockBoard(locked) {
    els.board.classList.toggle('is-locked', locked);
  }

  // GAME FLOW

  function newGame() {
    clearTimeout(state.timer);
    state.timer = null;
    state.board = new Array(9).fill(null);
    state.over = false;
    state.turn = state.starter === 'ai' ? AI : HUMAN;

    els.board.className = 'board';
    els.newGame.classList.remove('is-ready');
    cells.forEach(function (cell, i) {
      cell.innerHTML = '';
      cell.disabled = false;
      cell.classList.remove('is-win');
      cell.setAttribute('aria-label', cellLabel(i));
    });

    if (state.turn === AI) {
      aiTurn();
    } else {
      lockBoard(false);
      setStatus('human', 'Your turn',
        'You play <span class="tag-x">X</span>. Tap a square to begin.');
    }
  }

  function onCellClick(event) {
    var i = Number(event.currentTarget.dataset.index);
    if (state.over || state.turn !== HUMAN || state.board[i]) return;

    placeMark(i, HUMAN);
    if (finishIfOver()) return;

    state.turn = AI;
    aiTurn();
  }

  function aiTurn() {
    lockBoard(true);
    setStatus('ai', 'AI is thinking<span class="dots"><i>.</i><i>.</i><i>.</i></span>',
      'The AI plays <span class="tag-o">O</span>.');

    var delay = 420 + Math.random() * 380;
    state.timer = setTimeout(function () {
      state.timer = null;
      var i = Engine.pickMove(state.board, AI);
      placeMark(i, AI);
      if (finishIfOver()) return;

      state.turn = HUMAN;
      lockBoard(false);
      setStatus('human', 'Your turn', 'Pick your square.');
    }, delay);
  }

  function finishIfOver() {
    var win = Engine.findWin(state.board);
    var full = Engine.isFull(state.board);
    if (!win && !full) return false;

    state.over = true;
    lockBoard(true);
    els.board.classList.add('is-over');
    cells.forEach(function (cell) { cell.disabled = true; });

    var key;
    if (win) {
      win.line.forEach(function (i) { cells[i].classList.add('is-win'); });
      if (win.mark === HUMAN) {
        key = 'you';
        els.board.classList.add('result-human');
        setStatus('win', 'You win!', pick(MESSAGES.win));
      } else {
        key = 'ai';
        els.board.classList.add('result-ai');
        setStatus('lose', 'AI wins', pick(MESSAGES.lose));
      }
    } else {
      key = 'draw';
      els.board.classList.add('result-draw');
      setStatus('draw', 'Draw', pick(MESSAGES.draw));
    }

    state.score[key] += 1;
    renderScore(key);
    save();
    els.newGame.classList.add('is-ready');
    return true;
  }

  function setStarter(starter) {
    if (starter === state.starter) return;
    state.starter = starter;
    renderStarter();
    save();
    newGame();
  }

  els.starterOpts.forEach(function (opt) {
    opt.addEventListener('click', function () { setStarter(opt.dataset.starter); });
    opt.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        var next = state.starter === 'human' ? 'ai' : 'human';
        setStarter(next);
        els.starterOpts.forEach(function (o) { if (o.dataset.starter === next) o.focus(); });
      }
    });
  });

  els.newGame.addEventListener('click', newGame);

  els.resetScore.addEventListener('click', function () {
    state.score = { you: 0, draw: 0, ai: 0 };
    renderScore();
    save();
  });

  // Boot & initialize the game

  load();
  buildBoard();
  renderScore();
  renderStarter();
  newGame();
})();
