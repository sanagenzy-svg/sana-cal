/**
 * sana sci calc - Core Calculator Engine
 * Feature-packed scientific calculator with precision trigonometry,
 * safe expression parser, tactile audio feedback, and calculation history.
 */

(function () {
  'use strict';

  // --- State Variables ---
  let state = {
    expression: '',         // Full expression string being built
    currentInput: '0',      // Current token / entry displayed
    lastAnswer: 0,          // Last computed result (Ans)
    angleMode: 'DEG',       // 'DEG' or 'RAD'
    is2nd: false,           // 2nd function toggle
    isHyp: false,           // Hyperbolic function toggle
    memory: 0,              // Memory accumulator (M)
    history: [],            // List of { expression, result, timestamp }
    soundEnabled: true,     // Web Audio click toggle
    justCalculated: false   // True if previous button was '='
  };

  // --- Audio Context for Soft Tactile Clicks ---
  let audioCtx = null;
  function playClickSound() {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  // --- DOM Elements ---
  const elScreenMain = document.getElementById('screen-main');
  const elScreenExpr = document.getElementById('screen-expression');
  const elIndicatorAngle = document.getElementById('indicator-angle');
  const elIndicator2nd = document.getElementById('indicator-2nd');
  const elIndicatorHyp = document.getElementById('indicator-hyp');
  const elIndicatorMem = document.getElementById('indicator-memory');
  const elSoundIcon = document.getElementById('sound-icon');
  const elBtnSound = document.getElementById('btn-sound-toggle');
  const elBtnCopy = document.getElementById('btn-copy');
  const elCopyTooltip = document.getElementById('copy-tooltip');
  const elBtnHistory = document.getElementById('btn-toggle-history');
  const elHistoryDrawer = document.getElementById('history-drawer');
  const elBtnCloseHistory = document.getElementById('btn-close-history');
  const elBtnClearHistory = document.getElementById('btn-clear-history');
  const elHistoryList = document.getElementById('history-list');
  const elBtnAngle = document.getElementById('btn-angle-mode');
  const elBtn2nd = document.getElementById('btn-2nd');
  const elBtnHyp = document.getElementById('btn-hyp');

  // --- LocalStorage Persistence ---
  function loadStoredData() {
    try {
      const savedHist = localStorage.getItem('sana_calc_history');
      if (savedHist) state.history = JSON.parse(savedHist);

      const savedSound = localStorage.getItem('sana_calc_sound');
      if (savedSound !== null) state.soundEnabled = savedSound === 'true';

      const savedMem = localStorage.getItem('sana_calc_memory');
      if (savedMem) state.memory = parseFloat(savedMem) || 0;
    } catch (e) {
      console.warn('Storage access warning', e);
    }
  }

  function saveStoredHistory() {
    try {
      localStorage.setItem('sana_calc_history', JSON.stringify(state.history.slice(0, 50)));
    } catch (e) {}
  }

  // --- Helper Math Functions ---
  function factorial(n) {
    if (n < 0) return NaN;
    if (n > 170) return Infinity; // JS Number overflow
    if (Math.floor(n) !== n) {
      // Lanczos approximation for Gamma(n+1) if non-integer
      return gamma(n + 1);
    }
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // Lanczos approximation for Gamma
  function gamma(z) {
    const g = 7;
    const C = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109583111202,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    let x = C[0];
    for (let i = 1; i < g + 2; i++) {
      x += C[i] / (z + i);
    }
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  // Precise Trigonometry Handling with Degree/Radian Conversion
  function toRad(val) {
    return state.angleMode === 'DEG' ? (val * Math.PI) / 180 : val;
  }

  function fromRad(rad) {
    return state.angleMode === 'DEG' ? (rad * 180) / Math.PI : rad;
  }

  function trigSin(x) {
    if (state.angleMode === 'DEG') {
      const norm = ((x % 360) + 360) % 360;
      if (norm === 0 || norm === 180) return 0;
      if (norm === 30 || norm === 150) return 0.5;
      if (norm === 90) return 1;
      if (norm === 210 || norm === 330) return -0.5;
      if (norm === 270) return -1;
    }
    return Math.sin(toRad(x));
  }

  function trigCos(x) {
    if (state.angleMode === 'DEG') {
      const norm = ((x % 360) + 360) % 360;
      if (norm === 90 || norm === 270) return 0;
      if (norm === 60 || norm === 300) return 0.5;
      if (norm === 0) return 1;
      if (norm === 180) return -1;
      if (norm === 120 || norm === 240) return -0.5;
    }
    return Math.cos(toRad(x));
  }

  function trigTan(x) {
    if (state.angleMode === 'DEG') {
      const norm = ((x % 360) + 360) % 360;
      if (norm === 90 || norm === 270) return NaN;
      if (norm === 0 || norm === 180) return 0;
      if (norm === 45 || norm === 225) return 1;
      if (norm === 135 || norm === 315) return -1;
    }
    return Math.tan(toRad(x));
  }

  function trigAsin(x) {
    if (x < -1 || x > 1) return NaN;
    return fromRad(Math.asin(x));
  }

  function trigAcos(x) {
    if (x < -1 || x > 1) return NaN;
    return fromRad(Math.acos(x));
  }

  function trigAtan(x) {
    return fromRad(Math.atan(x));
  }

  // Hyperbolic
  function trigSinh(x) { return Math.sinh(x); }
  function trigCosh(x) { return Math.cosh(x); }
  function trigTanh(x) { return Math.tanh(x); }
  function trigAsinh(x) { return Math.asinh(x); }
  function trigAcosh(x) { return Math.acosh(x); }
  function trigAtanh(x) { return Math.atanh(x); }

  // Clean rounding of floating point noise e.g. 0.30000000000000004 -> 0.3
  function cleanFloat(val) {
    if (typeof val !== 'number' || isNaN(val)) return NaN;
    if (!isFinite(val)) return val;
    // Check close to zero
    if (Math.abs(val) < 1e-13) return 0;
    // Check close to integer
    const rounded = Math.round(val);
    if (Math.abs(val - rounded) < 1e-12) return rounded;

    // Use precision 12
    const str = parseFloat(val.toPrecision(12)).toString();
    return parseFloat(str);
  }

  function formatDisplayNumber(num) {
    if (isNaN(num)) return 'Error';
    if (num === Infinity) return 'Infinity';
    if (num === -Infinity) return '-Infinity';

    const abs = Math.abs(num);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-7)) {
      return num.toExponential(6).replace(/\+?0*([0-9]+)$/, '$1');
    }

    const cleaned = cleanFloat(num);
    const parts = cleaned.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // --- Math Expression Evaluator ---
  // Safely evaluates math expressions with full operator precedence & functions
  function evaluateMathExpression(rawExpr) {
    if (!rawExpr || rawExpr.trim() === '') return 0;

    // Replace display symbols with internal tokens
    let expr = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, `(${Math.PI})`)
      .replace(/e(?![a-z0-9_])/gi, `(${Math.E})`)
      .replace(/Ans/g, `(${state.lastAnswer})`);

    // Implicit multiplication fixes:
    // e.g. 2(3) -> 2*(3), (2)(3) -> (2)*(3), 5sin -> 5*sin
    expr = expr.replace(/(\d)(\()/g, '$1*$2');
    expr = expr.replace(/(\))(\d)/g, '$1*$2');
    expr = expr.replace(/(\))(\()/g, '$1*$2');
    expr = expr.replace(/(\d)([a-z√])/gi, '$1*$2');
    expr = expr.replace(/(\))([a-z√])/gi, '$1*$2');

    // Balance unclosed open parentheses automatically
    let openCount = 0;
    for (let char of expr) {
      if (char === '(') openCount++;
      if (char === ')') openCount--;
    }
    while (openCount > 0) {
      expr += ')';
      openCount--;
    }

    // Custom Tokenized Recursive-Descent or Safe Function Map
    const context = {
      sin: trigSin,
      cos: trigCos,
      tan: trigTan,
      asin: trigAsin,
      acos: trigAcos,
      atan: trigAtan,
      sinh: trigSinh,
      cosh: trigCosh,
      tanh: trigTanh,
      asinh: trigAsinh,
      acosh: trigAcosh,
      atanh: trigAtanh,
      ln: (x) => Math.log(x),
      log: (x) => Math.log10(x),
      sqrt: (x) => Math.sqrt(x),
      cbrt: (x) => Math.cbrt(x),
      fact: factorial,
      abs: Math.abs,
      pow: Math.pow,
      root: (y, x) => Math.pow(x, 1 / y)
    };

    // Pre-process factorial: replaces something like "5!" or "(2+3)!" with "fact(...)"
    expr = replaceFactorials(expr);

    // Pre-process percentages: e.g. "50%" -> "(50*0.01)", "(2+3)%" -> "((2+3)*0.01)"
    expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1*0.01)').replace(/\)%/g, ')*0.01');

    // Pre-process power operator: x ^ y -> Math.pow(x, y) or **
    expr = expr.replace(/\^/g, '**');

    // Pre-process square root symbol: √(x) -> sqrt(x)
    expr = expr.replace(/√\(/g, 'sqrt(');
    expr = expr.replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)');

    // Pre-process cube root: ∛(x) -> cbrt(x)
    expr = expr.replace(/∛\(/g, 'cbrt(');
    expr = expr.replace(/∛(\d+(?:\.\d+)?)/g, 'cbrt($1)');

    // Pre-process yth root: y√x or root(y, x)
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*root\s*(\d+(?:\.\d+)?)/g, 'root($1, $2)');

    // Validate characters to ensure safe execution
    const allowedRegex = /^[0-9+\-*/().,^eE\s*<>!=&|?:_a-zA-Z]+$/;
    if (!allowedRegex.test(expr)) {
      throw new Error('Invalid characters');
    }

    // Construct execution using defined functions scope
    const fnKeys = Object.keys(context);
    const fnVals = Object.values(context);
    // Wrap expression in return
    const runner = new Function(...fnKeys, `"use strict"; return (${expr});`);
    const result = runner(...fnVals);

    return cleanFloat(result);
  }

  // Helper to replace postfix "!" with fact(...)
  function replaceFactorials(str) {
    let result = str;
    let idx = result.indexOf('!');
    while (idx !== -1) {
      // Look back for operand (number or parenthesis expression)
      let start = idx - 1;
      if (result[start] === ')') {
        let depth = 1;
        start--;
        while (start >= 0 && depth > 0) {
          if (result[start] === ')') depth++;
          else if (result[start] === '(') depth--;
          start--;
        }
        start++; // start of the parenthesized expr
      } else {
        while (start >= 0 && /[0-9.]/.test(result[start])) {
          start--;
        }
        start++;
      }
      const operand = result.substring(start, idx);
      const replacement = `fact(${operand})`;
      result = result.substring(0, start) + replacement + result.substring(idx + 1);
      idx = result.indexOf('!', start + replacement.length);
    }
    return result;
  }

  // --- Display Update Functions ---
  function updateUI() {
    // Screen expression
    elScreenExpr.textContent = state.expression;

    // Screen main output
    if (state.currentInput === '' && state.expression !== '') {
      // Showing active expression preview or 0
      elScreenMain.textContent = '0';
    } else {
      elScreenMain.textContent = state.currentInput;
    }

    // Shrink text size dynamically if too long
    const len = elScreenMain.textContent.length;
    if (len > 14) {
      elScreenMain.style.fontSize = '1.35rem';
    } else if (len > 10) {
      elScreenMain.style.fontSize = '1.75rem';
    } else {
      elScreenMain.style.fontSize = '';
    }

    // Status Badges
    elIndicatorAngle.textContent = state.angleMode;
    elIndicatorAngle.classList.toggle('active', state.angleMode === 'RAD');

    elIndicator2nd.classList.toggle('active', state.is2nd);
    elIndicatorHyp.classList.toggle('active', state.isHyp);
    elIndicatorMem.classList.toggle('active', state.memory !== 0);

    // Sound button icon
    elSoundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';

    // Update 2nd function hints on buttons
    document.querySelectorAll('.btn-sci').forEach((btn) => {
      const pText = btn.querySelector('.primary-text');
      const sHint = btn.querySelector('.shift-hint');
      const func = btn.getAttribute('data-func');

      if (state.is2nd && btn.hasAttribute('data-inv')) {
        btn.classList.add('shift-active');
      } else {
        btn.classList.remove('shift-active');
      }
    });

    // Update 2nd / hyp button appearance
    elBtn2nd.classList.toggle('active', state.is2nd);
    elBtnHyp.classList.toggle('active', state.isHyp);
  }

  // --- Calculator Input Handlers ---
  function appendNumber(num) {
    if (state.justCalculated) {
      state.expression = '';
      state.currentInput = num;
      state.justCalculated = false;
    } else {
      if (state.currentInput === '0' || state.currentInput === 'Error') {
        state.currentInput = num;
      } else {
        state.currentInput += num;
      }
    }
    updateUI();
  }

  function appendDot() {
    if (state.justCalculated) {
      state.expression = '';
      state.currentInput = '0.';
      state.justCalculated = false;
    } else {
      if (!state.currentInput.includes('.')) {
        state.currentInput += '.';
      }
    }
    updateUI();
  }

  function appendOperator(op) {
    if (state.currentInput === 'Error') return;

    if (state.justCalculated) {
      state.expression = state.lastAnswer + ' ' + op + ' ';
      state.currentInput = '';
      state.justCalculated = false;
    } else {
      if (state.currentInput !== '') {
        state.expression += state.currentInput + ' ' + op + ' ';
        state.currentInput = '';
      } else if (state.expression !== '') {
        // Replace previous trailing operator
        state.expression = state.expression.trimEnd().replace(/[\+\−×÷\^]$/, op) + ' ';
      }
    }
    updateUI();
  }

  function appendBracket(b) {
    if (state.justCalculated) {
      state.expression = '';
      state.justCalculated = false;
    }
    if (b === '(') {
      if (state.currentInput !== '' && state.currentInput !== '0') {
        state.expression += state.currentInput + ' × (';
      } else {
        state.expression += '(';
      }
      state.currentInput = '';
    } else {
      if (state.currentInput !== '') {
        state.expression += state.currentInput + ')';
        state.currentInput = '';
      } else {
        state.expression += ')';
      }
    }
    updateUI();
  }

  function appendConstant(c) {
    if (state.justCalculated) {
      state.expression = '';
      state.justCalculated = false;
    }
    state.currentInput = c;
    updateUI();
  }

  function applyFunction(funcKey, invKey, hypKey, invhypKey) {
    let targetFunc = funcKey;

    if (state.isHyp && state.is2nd && invhypKey) {
      targetFunc = invhypKey;
    } else if (state.isHyp && hypKey) {
      targetFunc = hypKey;
    } else if (state.is2nd && invKey) {
      targetFunc = invKey;
    }

    const cur = state.currentInput !== '' ? state.currentInput : '0';

    switch (targetFunc) {
      case 'sin':
      case 'cos':
      case 'tan':
      case 'asin':
      case 'acos':
      case 'atan':
      case 'sinh':
      case 'cosh':
      case 'tanh':
      case 'asinh':
      case 'acosh':
      case 'atanh':
      case 'ln':
      case 'log':
        // Wrap as func(
        if (state.justCalculated) {
          state.expression = `${targetFunc}(${state.lastAnswer})`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '' && state.currentInput !== '0') {
          state.expression += `${targetFunc}(${state.currentInput})`;
          state.currentInput = '';
        } else {
          state.expression += `${targetFunc}(`;
        }
        break;

      case 'exp_e': // e^x
        state.expression += `e^(`;
        state.currentInput = '';
        break;

      case 'exp_10': // 10^x
        state.expression += `10^(`;
        state.currentInput = '';
        break;

      case 'square': // x²
        if (state.justCalculated) {
          state.expression = `(${state.lastAnswer})^2`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '') {
          state.expression += `(${state.currentInput})^2`;
          state.currentInput = '';
        } else if (state.expression !== '') {
          state.expression = `(${state.expression.trim()})^2`;
        }
        break;

      case 'cube': // x³
        if (state.justCalculated) {
          state.expression = `(${state.lastAnswer})^3`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '') {
          state.expression += `(${state.currentInput})^3`;
          state.currentInput = '';
        } else if (state.expression !== '') {
          state.expression = `(${state.expression.trim()})^3`;
        }
        break;

      case 'sqrt': // √x
        if (state.justCalculated) {
          state.expression = `√(${state.lastAnswer})`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '' && state.currentInput !== '0') {
          state.expression += `√(${state.currentInput})`;
          state.currentInput = '';
        } else {
          state.expression += `√(`;
        }
        break;

      case 'cbrt': // ∛x
        if (state.justCalculated) {
          state.expression = `∛(${state.lastAnswer})`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '' && state.currentInput !== '0') {
          state.expression += `∛(${state.currentInput})`;
          state.currentInput = '';
        } else {
          state.expression += `∛(`;
        }
        break;

      case 'reciprocal': // 1/x
        if (state.justCalculated) {
          state.expression = `(1/${state.lastAnswer})`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '' && state.currentInput !== '0') {
          state.expression += `(1/${state.currentInput})`;
          state.currentInput = '';
        } else if (state.expression !== '') {
          state.expression = `(1/(${state.expression.trim()}))`;
        }
        break;

      case 'factorial': // n!
        if (state.justCalculated) {
          state.expression = `(${state.lastAnswer})!`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '') {
          state.expression += `${state.currentInput}!`;
          state.currentInput = '';
        } else if (state.expression !== '') {
          state.expression += `!`;
        }
        break;

      case 'percent': // %
        if (state.justCalculated) {
          state.expression = `(${state.lastAnswer})%`;
          state.currentInput = '';
          state.justCalculated = false;
        } else if (state.currentInput !== '') {
          state.expression += `${state.currentInput}%`;
          state.currentInput = '';
        } else if (state.expression !== '') {
          state.expression += `%`;
        }
        break;
    }

    // Reset 2nd mode after single shifted function use
    if (state.is2nd) {
      state.is2nd = false;
    }
    updateUI();
  }

  function negateInput() {
    if (state.currentInput !== '' && state.currentInput !== '0') {
      if (state.currentInput.startsWith('-')) {
        state.currentInput = state.currentInput.substring(1);
      } else {
        state.currentInput = '-' + state.currentInput;
      }
    } else if (state.justCalculated) {
      state.currentInput = (-state.lastAnswer).toString();
      state.expression = '';
      state.justCalculated = false;
    }
    updateUI();
  }

  function deleteLast() {
    if (state.justCalculated) {
      clearAll();
      return;
    }
    if (state.currentInput.length > 1) {
      state.currentInput = state.currentInput.slice(0, -1);
    } else if (state.currentInput.length === 1 && state.currentInput !== '0') {
      state.currentInput = '0';
    } else if (state.expression.length > 0) {
      // Remove trailing space or characters
      state.expression = state.expression.trimEnd();
      state.expression = state.expression.slice(0, -1).trimEnd();
    }
    updateUI();
  }

  function clearAll() {
    state.expression = '';
    state.currentInput = '0';
    state.justCalculated = false;
    updateUI();
  }

  function calculate() {
    let fullExpr = state.expression;
    if (state.currentInput !== '') {
      fullExpr += state.currentInput;
    }

    if (!fullExpr || fullExpr.trim() === '') return;

    try {
      const result = evaluateMathExpression(fullExpr);

      if (isNaN(result)) {
        state.currentInput = 'Error';
      } else {
        const formatted = formatDisplayNumber(result);
        state.lastAnswer = result;

        // Push to history
        addHistoryItem(fullExpr, formatted);

        // Update display state
        state.expression = fullExpr + ' =';
        state.currentInput = formatted;
        state.justCalculated = true;
      }
    } catch (err) {
      console.error(err);
      state.currentInput = 'Error';
      state.justCalculated = true;
    }

    updateUI();
  }

  // --- History System ---
  function addHistoryItem(expr, res) {
    const item = {
      expression: expr,
      result: res,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.history.unshift(item);
    if (state.history.length > 40) state.history.pop();
    saveStoredHistory();
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      elHistoryList.innerHTML = `<div class="history-empty">No calculations yet.<br><small>Your calculations will be saved here.</small></div>`;
      return;
    }

    elHistoryList.innerHTML = state.history.map((item, idx) => `
      <div class="history-item" data-idx="${idx}" title="Click to recall this calculation">
        <span class="history-item-exp">${escapeHtml(item.expression)}</span>
        <span class="history-item-res">= ${escapeHtml(item.result)}</span>
      </div>
    `).join('');

    // Attach click handlers to items
    elHistoryList.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = el.getAttribute('data-idx');
        const selected = state.history[idx];
        if (selected) {
          state.expression = selected.expression;
          state.currentInput = selected.result.replace(/,/g, '');
          state.justCalculated = true;
          updateUI();
          closeHistory();
          playClickSound();
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function openHistory() {
    renderHistory();
    elHistoryDrawer.classList.add('open');
    elHistoryDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeHistory() {
    elHistoryDrawer.classList.remove('open');
    elHistoryDrawer.setAttribute('aria-hidden', 'true');
  }

  // --- Memory Operations ---
  function handleMemory(action) {
    const curVal = parseFloat(state.currentInput.replace(/,/g, '')) || state.lastAnswer || 0;
    switch (action) {
      case 'mc':
        state.memory = 0;
        break;
      case 'mr':
        state.currentInput = state.memory.toString();
        state.justCalculated = false;
        break;
      case 'm-plus':
        state.memory += curVal;
        break;
      case 'm-minus':
        state.memory -= curVal;
        break;
    }
    try {
      localStorage.setItem('sana_calc_memory', state.memory.toString());
    } catch (e) {}
    updateUI();
  }

  // --- Copy to Clipboard ---
  function copyResult() {
    const textToCopy = state.currentInput !== '' ? state.currentInput.replace(/,/g, '') : '0';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showCopyTooltip();
      }).catch(() => {
        fallbackCopy(textToCopy);
      });
    } else {
      fallbackCopy(textToCopy);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showCopyTooltip();
    } catch (err) {}
    document.body.removeChild(textArea);
  }

  function showCopyTooltip() {
    elCopyTooltip.classList.add('show');
    setTimeout(() => {
      elCopyTooltip.classList.remove('show');
    }, 1400);
  }

  // --- Visual Button Press Effect for Keyboard ---
  function triggerButtonAnimation(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }
  }

  // --- Event Listeners Setup ---
  function initListeners() {
    // Keypad Grid delegation
    document.querySelector('.keypad-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      playClickSound();

      const action = btn.getAttribute('data-action');
      const val = btn.getAttribute('data-val');

      switch (action) {
        case 'num':
          appendNumber(val);
          break;
        case 'dot':
          appendDot();
          break;
        case 'op':
          if (val === '^' && state.is2nd) {
            // yroot
            appendOperator('root');
            state.is2nd = false;
          } else {
            appendOperator(val);
          }
          break;
        case 'bracket':
          appendBracket(val);
          break;
        case 'const':
          appendConstant(val);
          break;
        case 'func':
          applyFunction(
            btn.getAttribute('data-func'),
            btn.getAttribute('data-inv'),
            btn.getAttribute('data-hyp'),
            btn.getAttribute('data-invhyp')
          );
          break;
        case 'negate':
          negateInput();
          break;
        case 'ans':
          appendNumber(state.lastAnswer.toString());
          break;
        case 'delete':
          deleteLast();
          break;
        case 'clear':
          clearAll();
          break;
        case 'equals':
          calculate();
          break;
      }
    });

    // Toolbar Buttons
    elBtnAngle.addEventListener('click', () => {
      playClickSound();
      state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
      updateUI();
    });

    elBtn2nd.addEventListener('click', () => {
      playClickSound();
      state.is2nd = !state.is2nd;
      updateUI();
    });

    elBtnHyp.addEventListener('click', () => {
      playClickSound();
      state.isHyp = !state.isHyp;
      updateUI();
    });

    // Memory Buttons
    document.querySelectorAll('.mem-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        playClickSound();
        handleMemory(btn.getAttribute('data-action'));
      });
    });

    // Sound Toggle
    elBtnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      try {
        localStorage.setItem('sana_calc_sound', state.soundEnabled.toString());
      } catch (e) {}
      if (state.soundEnabled) playClickSound();
      updateUI();
    });

    // Copy Button
    elBtnCopy.addEventListener('click', () => {
      playClickSound();
      copyResult();
    });

    // History Toggle
    elBtnHistory.addEventListener('click', () => {
      playClickSound();
      openHistory();
    });

    elBtnCloseHistory.addEventListener('click', () => {
      playClickSound();
      closeHistory();
    });

    elBtnClearHistory.addEventListener('click', () => {
      playClickSound();
      state.history = [];
      saveStoredHistory();
      renderHistory();
    });

    // Close history with Escape key or clicking outside
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elHistoryDrawer.classList.contains('open')) {
        closeHistory();
        return;
      }
    });

    // --- Physical Keyboard Listener ---
    document.addEventListener('keydown', (e) => {
      // Don't intercept when focusing inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        playClickSound();
        appendNumber(key);
        triggerButtonAnimation(`.btn-num[data-val="${key}"]`);
        e.preventDefault();
      } else if (key === '.') {
        playClickSound();
        appendDot();
        triggerButtonAnimation(`.btn[data-action="dot"]`);
        e.preventDefault();
      } else if (key === '+' || key === '-') {
        playClickSound();
        const mapped = key === '+' ? '+' : '−';
        appendOperator(mapped);
        triggerButtonAnimation(`.btn-op[data-val="${mapped}"]`);
        e.preventDefault();
      } else if (key === '*' || key === 'x' || key === 'X') {
        playClickSound();
        appendOperator('×');
        triggerButtonAnimation(`.btn-op[data-val="×"]`);
        e.preventDefault();
      } else if (key === '/') {
        playClickSound();
        appendOperator('÷');
        triggerButtonAnimation(`.btn-op[data-val="÷"]`);
        e.preventDefault();
      } else if (key === '^') {
        playClickSound();
        appendOperator('^');
        triggerButtonAnimation(`.btn-sci[data-val="^"]`);
        e.preventDefault();
      } else if (key === '(' || key === ')') {
        playClickSound();
        appendBracket(key);
        triggerButtonAnimation(`.btn-sci[data-val="${key}"]`);
        e.preventDefault();
      } else if (key === 'Enter' || key === '=') {
        playClickSound();
        calculate();
        triggerButtonAnimation(`.btn-equals`);
        e.preventDefault();
      } else if (key === 'Backspace') {
        playClickSound();
        deleteLast();
        triggerButtonAnimation(`.btn-danger`);
        e.preventDefault();
      } else if (key === 'Escape') {
        playClickSound();
        clearAll();
        triggerButtonAnimation(`.btn-danger-accent`);
        e.preventDefault();
      } else if (key === 's' || key === 'S') {
        playClickSound();
        applyFunction('sin', 'asin', 'sinh', 'asinh');
        triggerButtonAnimation(`.btn-sci[data-func="sin"]`);
        e.preventDefault();
      } else if (key === 'c' || key === 'C') {
        playClickSound();
        applyFunction('cos', 'acos', 'cosh', 'acosh');
        triggerButtonAnimation(`.btn-sci[data-func="cos"]`);
        e.preventDefault();
      } else if (key === 't' || key === 'T') {
        playClickSound();
        applyFunction('tan', 'atan', 'tanh', 'atanh');
        triggerButtonAnimation(`.btn-sci[data-func="tan"]`);
        e.preventDefault();
      } else if (key === 'l' || key === 'L') {
        playClickSound();
        applyFunction('log', 'exp_10');
        triggerButtonAnimation(`.btn-sci[data-func="log"]`);
        e.preventDefault();
      } else if (key === 'n' || key === 'N') {
        playClickSound();
        applyFunction('ln', 'exp_e');
        triggerButtonAnimation(`.btn-sci[data-func="ln"]`);
        e.preventDefault();
      } else if (key === 'p' || key === 'P') {
        playClickSound();
        appendConstant('π');
        triggerButtonAnimation(`.btn-sci[data-val="π"]`);
        e.preventDefault();
      } else if (key === 'e' || key === 'E') {
        playClickSound();
        appendConstant('e');
        triggerButtonAnimation(`.btn-sci[data-val="e"]`);
        e.preventDefault();
      } else if (key === '!') {
        playClickSound();
        applyFunction('factorial');
        triggerButtonAnimation(`.btn-sci[data-func="factorial"]`);
        e.preventDefault();
      } else if (key === '%') {
        playClickSound();
        applyFunction('percent');
        triggerButtonAnimation(`.btn-sci[data-func="percent"]`);
        e.preventDefault();
      }
    });
  }

  // --- Initialization ---
  function init() {
    loadStoredData();
    initListeners();
    updateUI();
  }

  // --- Self-Test Runner (activates with ?test=true in URL or window.runTests()) ---
  function runSelfTests() {
    const tests = [
      { expr: '2 + 3 × 4', expected: 14, name: 'Operator Precedence' },
      { expr: '10 ÷ 2 + 3', expected: 8, name: 'Division and Addition' },
      { expr: 'sin(30)', expected: 0.5, name: 'Trig sin(30°)' },
      { expr: 'cos(60)', expected: 0.5, name: 'Trig cos(60°)' },
      { expr: 'tan(45)', expected: 1, name: 'Trig tan(45°)' },
      { expr: '5!', expected: 120, name: 'Factorial 5!' },
      { expr: '2^3', expected: 8, name: 'Exponent 2^3' },
      { expr: '√(16)', expected: 4, name: 'Square Root √(16)' },
      { expr: '∛(27)', expected: 3, name: 'Cube Root ∛(27)' },
      { expr: 'log(100)', expected: 2, name: 'Log base 10' },
      { expr: '(2 + 3) × (4 − 1)', expected: 15, name: 'Parentheses' },
      { expr: '50% × 200', expected: 100, name: 'Percentage' }
    ];

    let passed = 0;
    const results = [];
    tests.forEach((t) => {
      try {
        const val = evaluateMathExpression(t.expr);
        const ok = Math.abs(val - t.expected) < 1e-6;
        if (ok) passed++;
        results.push({ name: t.name, expr: t.expr, got: val, expected: t.expected, pass: ok });
      } catch (err) {
        results.push({ name: t.name, expr: t.expr, error: err.message, pass: false });
      }
    });

    window.__TEST_RESULTS__ = { total: tests.length, passed, results };
    console.log(`[sana sci calc Tests] ${passed}/${tests.length} passed`, results);
    
    // Output test results to DOM so headless runners can inspect easily
    const testDiv = document.createElement('div');
    testDiv.id = 'test-results-output';
    testDiv.style.display = 'none';
    testDiv.textContent = JSON.stringify(window.__TEST_RESULTS__);
    document.body.appendChild(testDiv);
    
    return window.__TEST_RESULTS__;
  }

  window.runTests = runSelfTests;

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      if (window.location.search.includes('test=true')) runSelfTests();
    });
  } else {
    init();
    if (window.location.search.includes('test=true')) runSelfTests();
  }
})();
