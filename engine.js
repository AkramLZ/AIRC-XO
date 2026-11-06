/*
 * XO Game Engine
 */
(function (root) {
  'use strict';

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  function other(mark) {
    return mark === 'X' ? 'O' : 'X';
  }

  function emptyCells(board) {
    var cells = [];
    for (var i = 0; i < 9; i++) if (!board[i]) cells.push(i);
    return cells;
  }

  /**
   * Returns { mark, line } for a completed line, or null.
   */
  function findWin(board) {
    for (var k = 0; k < LINES.length; k++) {
      var a = LINES[k][0], b = LINES[k][1], c = LINES[k][2];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return {
          mark: board[a],
          line: LINES[k].slice()
        };
      }
    }
    return null;
  }

  function isFull(board) {
    return emptyCells(board).length === 0;
  }

  // Minimax value of a position from `me`'s point of view, with `turn` to move.
  // Faster wins score higher and slower losses score less negative.
  var memo = new Map();

  function value(board, turn, me) {
    var key = board.map(function (c) { return c || '-'; }).join('') + turn + me;
    if (memo.has(key)) return memo.get(key);

    var free = emptyCells(board);
    var win = findWin(board);
    var v;

    if (win) {
      v = (win.mark === me ? 1 : -1) * (1 + free.length);
    } else if (free.length === 0) {
      v = 0;
    } else {
      var maximise = turn === me;
      v = maximise ? -Infinity : Infinity;
      for (var i = 0; i < free.length; i++) {
        board[free[i]] = turn;
        var s = value(board, other(turn), me);
        board[free[i]] = null;
        v = maximise ? Math.max(v, s) : Math.min(v, s);
      }
    }

    memo.set(key, v);
    return v;
  }

  /**
   * All equally strong moves for `me`. Among moves with the best minimax value,
   * prefers the ones that leave the opponent the most replies that lose.
   */
  function bestMoves(board, me) {
    var opp = other(me);
    var free = emptyCells(board);
    var scored = free.map(function (i) {
      board[i] = me;
      var v = value(board, opp, me);
      var traps = 0;
      if (!findWin(board)) {
        var replies = emptyCells(board);
        for (var r = 0; r < replies.length; r++) {
          board[replies[r]] = opp;
          if (value(board, me, me) > 0) traps++;
          board[replies[r]] = null;
        }
      }
      board[i] = null;
      return {
        index: i,
        value: v,
        traps: traps
      };
    });

    var topValue = Math.max.apply(null, scored.map(function (m) { return m.value; }));
    var top = scored.filter(function (m) { return m.value === topValue; });
    var topTraps = Math.max.apply(null, top.map(function (m) { return m.traps; }));
    return top
      .filter(function (m) { return m.traps === topTraps; })
      .map(function (m) { return m.index; });
  }

  /**
   * Picks one move for `me`, choosing randomly among equally strong options.
   */
  function pickMove(board, me, random) {
    var options = bestMoves(board.slice(), me);
    var rnd = typeof random === 'function' ? random() : Math.random();
    return options[Math.floor(rnd * options.length)];
  }

  var api = {
    LINES: LINES,
    other: other,
    emptyCells: emptyCells,
    findWin: findWin,
    isFull: isFull,
    bestMoves: bestMoves,
    pickMove: pickMove
  };

  root.XOEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
