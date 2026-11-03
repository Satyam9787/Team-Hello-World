/* ==========================================================
   PRAHARI DASHBOARD - FRONT_ANALYSIS.JS
   Logs analysis: live, stock-market style safety graph.

   - Load this file AFTER Front.js (it reads procRows / netRows /
     systems / verdictOf / openModal from there; Front.js is NOT modified).
   - Every process + network log that Front.js receives over the
     websocket is picked up automatically and the graph keeps
     building itself, no extra API needed.
========================================================== */
(function () {
  'use strict';

  /* ---------- SETTINGS ---------- */

  // false = place events on the time they happened (timestamp_unix from the agent).
  // true  = place them on the time they reached the browser (use this if the
  //         agent machines have wrong clocks).
  var USE_ARRIVAL_TIME = false;

  var RANGES = {
    '1m':  { ms: 60e3,   bucket: 2e3,  label: 'LAST 1 MIN'  },
    '5m':  { ms: 300e3,  bucket: 5e3,  label: 'LAST 5 MIN'  },
    '15m': { ms: 900e3,  bucket: 15e3, label: 'LAST 15 MIN' },
    '1h':  { ms: 3600e3, bucket: 60e3, label: 'LAST 1 HOUR' }
  };

  var VERD   = ['safe', 'unsafe', 'unknown', 'partial'];
  var STACK  = ['safe', 'partial', 'unknown', 'unsafe'];          // bottom -> top
  var WEIGHT = { safe: 1, partial: 0.5, unknown: 0.5, unsafe: 0 };  // safety index weights
  var COL    = { safe: '#93d192', unsafe: '#ec5339', unknown: '#f6c24c', partial: '#c79bf2' };
  var ZCOL   = { safe: '#93d192', watch: '#f6c24c', danger: '#ec5339' };
  var INK = '#f3c27f', MUTE = '#8a7a58', ORANGE = '#ee7a1f';
  var FONT = '"Courier Prime","Courier New",monospace';

  var MAX_EVENTS = 40000;
  var KEEP_MS = 2 * 3600e3;


  /* ---------- ELEMENTS ---------- */

  var $a = function (id) { return document.getElementById(id); };

  var modal = $a('analysisModal');
  var openBtn = $a('openAnalysis');

  if (!modal || !openBtn) return;

  var cv = $a('anCanvas');
  var ctx = cv.getContext('2d');
  var screenEl = $a('anScreen');

  var rm = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------- STATE ---------- */

  var range = '5m';
  var sysFilter = 'all';
  var paused = false;
  var frozenNow = 0;
  var demoOn = false;
  var demoTimer = null;

  var events = [];          // {t, v, s, k, x, d}
  var seen = new Set();
  var loaded = false;
  var flash = false;

  var feed = [];
  var feedDirty = false;
  var feedFresh = 0;

  var agg = null;
  var aggAt = 0;
  var aggDirty = true;

  var headShown = null;
  var mouse = { x: 0, y: 0, on: false };
  var W = 0, H = 0, dpr = 1;
  var running = false;
  var lastReadout = 0;
  var lastZone = '';
  var sysSig = '';


  /* ---------- SMALL HELPERS ---------- */

  function verdictFor(row) {
    try {
      var v = verdictOf(row);
      return VERD.indexOf(v) >= 0 ? v : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  function sysName(id) {
    if (id === 'demo') return 'demo-feed';
    try {
      var s = systems.find(function (x) { return x.id === id; });
      return s ? s.name : id;
    } catch (e) {
      return id;
    }
  }

  function zoneOf(v) {
    return v >= 80 ? 'safe' : v >= 50 ? 'watch' : 'danger';
  }

  function clock(t, withSec) {
    return new Date(t).toLocaleTimeString([], {
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: withSec ? '2-digit' : undefined
    });
  }

  function rowLabel(r, kind) {
    if (kind === 'proc') {
      return (r.name || 'unknown') + ' · PID ' + (r.pid != null ? r.pid : '—');
    }
    var port = r.port != null && r.port !== '—' ? ':' + r.port : '';
    return (r.process || '?') + ' → ' + (r.dest || '?') + port;
  }

  function pushFeed(list) {
    list.sort(function (a, b) { return b.t - a.t; });
    list = list.slice(0, 14);
    feed = list.concat(feed).slice(0, 14);
    feedFresh = loaded ? list.length : 0;
    feedDirty = true;
  }


  /* ==========================================
     DATA COLLECTION
     Reads the rows Front.js already keeps in memory.
  ========================================== */

  function scan() {
    var lists;

    try {
      lists = [[procRows, 'proc'], [netRows, 'net']];
    } catch (e) {
      return;
    }

    var fresh = [];

    lists.forEach(function (pair) {
      var rows = pair[0], kind = pair[1];

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];

        if (!r || seen.has(r.id)) continue;
        seen.add(r.id);

        var t = USE_ARRIVAL_TIME ? Date.now() : new Date(r.time).getTime();
        if (!isFinite(t)) continue;

        var ev = {
          t: t,
          v: verdictFor(r),
          s: String(r.system_id),
          k: kind,
          x: rowLabel(r, kind)
        };

        events.push(ev);
        fresh.push(ev);
      }
    });

    if (fresh.length) {
      aggDirty = true;

      if (loaded && !modal.hidden) {
        var cutoff = Date.now() - 30000;
        fresh.forEach(function (e) {
          if (e.v === 'unsafe' && e.t > cutoff) flash = true;
        });
      }

      pushFeed(fresh.slice());
    }

    loaded = true;

    // keep the "seen" set small: only ids still present in Front.js matter
    if (seen.size > 60000) {
      seen = new Set();
      lists.forEach(function (p) {
        p[0].forEach(function (r) { seen.add(r.id); });
      });
    }
  }

  function prune() {
    var cut = Date.now() - KEEP_MS;

    events = events.filter(function (e) { return e.t >= cut; });

    if (events.length > MAX_EVENTS) {
      events.sort(function (a, b) { return a.t - b.t; });
      events = events.slice(events.length - MAX_EVENTS);
    }
  }


  /* ==========================================
     DEMO FEED (only to preview the graph; stays inside this file)
  ========================================== */

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // slow "waves" of risk so the graph has visible ups and downs
  function demoRisk(t) {
    return 0.05 +
      0.55 * Math.pow(Math.max(0, Math.sin(t / 47000)), 4) +
      0.25 * Math.pow(Math.max(0, Math.sin(t / 19000 + 2)), 6);
  }

  function demoEvent(t) {
    var r = Math.min(0.85, demoRisk(t));
    var x = Math.random();
    var v;

    if (x < r * 0.7) v = 'unsafe';
    else if (x < r * 0.7 + 0.08) v = 'unknown';
    else if (x < r * 0.7 + 0.14) v = 'partial';
    else v = 'safe';

    var name = v === 'unsafe'
      ? pick(['xmrig', 'nc', 'unknown_bin', 'reverse_sh'])
      : pick(['chrome', 'sshd', 'python3', 'bash', 'curl', 'nginx']);

    return {
      t: t,
      v: v,
      s: 'demo',
      k: Math.random() < 0.5 ? 'proc' : 'net',
      x: name + ' · PID ' + (1000 + Math.floor(Math.random() * 8000)),
      d: true
    };
  }

  function setDemo(on) {
    demoOn = on;

    var btn = $a('anDemo');
    btn.classList.toggle('on', on);
    btn.textContent = 'Demo feed: ' + (on ? 'on' : 'off');

    clearInterval(demoTimer);

    if (on) {
      var now = Date.now();

      for (var t = now - 3600e3; t < now; t += 1500) {
        events.push(demoEvent(t + Math.random() * 1000));
      }

      demoTimer = setInterval(function () {
        var n = 1 + Math.floor(Math.random() * 2);
        var list = [];

        for (var i = 0; i < n; i++) {
          var e = demoEvent(Date.now());
          events.push(e);
          list.push(e);
          if (e.v === 'unsafe' && !modal.hidden) flash = true;
        }

        pushFeed(list);
        aggDirty = true;
      }, 600);

    } else {
      events = events.filter(function (e) { return !e.d; });
    }

    aggDirty = true;
  }


  /* ==========================================
     AGGREGATION  (events -> time buckets -> safety index)
  ========================================== */

  function recompute(now) {
    var R = RANGES[range];
    var B = R.bucket;

    var first = Math.floor((now - R.ms) / B) * B - B;
    var last = Math.floor(now / B) * B;
    var n = (last - first) / B + 1;

    var arr = new Array(n);

    for (var i = 0; i < n; i++) {
      arr[i] = {
        t: first + i * B,
        c: { safe: 0, unsafe: 0, unknown: 0, partial: 0 },
        n: 0,
        score: null,
        idle: false
      };
    }

    var winStart = now - R.ms;
    var tw = R.ms / 8;                      // trailing window for the big number
    var cur = { n: 0, sum: 0 };
    var prev = { n: 0, sum: 0 };
    var total = 0, unsafeN = 0;

    for (var k = 0; k < events.length; k++) {
      var e = events[k];

      if (sysFilter !== 'all' && e.s !== sysFilter) continue;
      if (e.t < first || e.t >= last + B) continue;

      var b = arr[Math.floor((e.t - first) / B)];
      b.c[e.v]++;
      b.n++;

      if (e.t >= winStart && e.t <= now) {
        total++;
        if (e.v === 'unsafe') unsafeN++;
      }

      if (e.t > now - tw && e.t <= now) {
        cur.n++; cur.sum += WEIGHT[e.v];
      } else if (e.t > now - 2 * tw && e.t <= now - tw) {
        prev.n++; prev.sum += WEIGHT[e.v];
      }
    }

    var carry = null;
    var best = null, worst = null;

    arr.forEach(function (b) {
      if (b.n) {
        var s = 0;
        VERD.forEach(function (v) { s += b.c[v] * WEIGHT[v]; });
        b.score = s / b.n * 100;
        carry = b.score;

        if (b.t + B > winStart) {
          if (!best || b.score > best.score ||
              (b.score === best.score && b.n > best.n)) best = b;

          if (!worst || b.score < worst.score ||
              (b.score === worst.score && b.c.unsafe > worst.c.unsafe)) worst = b;
        }
      } else {
        b.score = carry;
        b.idle = true;
      }
    });

    agg = {
      range: range,
      arr: arr,
      first: first,
      B: B,
      total: total,
      unsafeN: unsafeN,
      curScore: cur.n ? cur.sum / cur.n * 100 : null,
      prevScore: prev.n ? prev.sum / prev.n * 100 : null,
      headVal: carry,
      best: best,
      worst: worst
    };
  }


  /* ==========================================
     READOUTS (big number, stats, tape)
  ========================================== */

  function updateReadouts(now) {
    var a = agg;
    if (!a) return;

    var box = $a('anIndexBox');
    var idx = $a('anIndex');
    var delta = $a('anDelta');
    var state = $a('anState');

    $a('anEmpty').hidden = a.total > 0;

    if (!a.total || a.headVal == null) {
      idx.textContent = '—';
      delta.textContent = '';
      delta.className = '';
      state.textContent = 'No data';
      box.className = 'an-index';
      lastZone = '';
    } else {
      var cur = a.curScore != null ? a.curScore : a.headVal;
      var zone = zoneOf(cur);

      idx.textContent = cur.toFixed(1);
      state.textContent = zone === 'safe' ? 'Secure' : zone === 'watch' ? 'Watch' : 'Danger';
      box.className = 'an-index ' + zone;

      if (zone !== lastZone && !rm) {
        idx.classList.remove('an-bump');
        void idx.offsetWidth;
        idx.classList.add('an-bump');
      }
      lastZone = zone;

      if (a.curScore != null && a.prevScore != null) {
        var d = a.curScore - a.prevScore;

        if (Math.abs(d) < 0.05) {
          delta.textContent = '■ 0.0';
          delta.className = '';
        } else {
          delta.textContent = (d > 0 ? '▲ +' : '▼ −') + Math.abs(d).toFixed(1);
          delta.className = d > 0 ? 'up' : 'down';
        }
      } else {
        delta.textContent = '';
        delta.className = '';
      }
    }

    $a('anUnsafe').textContent = a.unsafeN;
    $a('anTotal').textContent = a.total;

    var sec = a.B < 60e3;

    $a('anSafest').textContent = a.best
      ? clock(a.best.t, sec) + ' · ' + Math.round(a.best.score)
      : '—';

    $a('anRisk').textContent = a.worst && a.worst.score < 80
      ? clock(a.worst.t, sec) + ' · ' + Math.round(a.worst.score)
      : (a.worst ? 'none (all ≥80)' : '—');

    refreshSystems();
    drawFeed();
  }

  function drawFeed() {
    if (!feedDirty) return;
    feedDirty = false;

    var ul = $a('anFeed');
    ul.textContent = '';

    if (!feed.length) {
      var none = document.createElement('li');
      none.className = 'an-none';
      none.textContent = 'No events yet.';
      ul.appendChild(none);
      return;
    }

    feed.forEach(function (e, i) {
      var li = document.createElement('li');
      li.className = e.v + (i < feedFresh ? ' fresh' : '');

      var dot = document.createElement('i');
      dot.style.setProperty('--v', COL[e.v]);

      var wrap = document.createElement('div');
      var b = document.createElement('b');
      var s = document.createElement('small');

      b.textContent = e.x;
      s.textContent = e.v.toUpperCase() + ' · ' + sysName(e.s) + ' · ' + clock(e.t, true);

      wrap.append(b, s);
      li.append(dot, wrap);
      ul.appendChild(li);
    });

    feedFresh = 0;
  }

  function refreshSystems() {
    var list;

    try {
      list = systems.map(function (s) { return [s.id, s.name]; });
    } catch (e) {
      return;
    }

    var sig = list.join('|');
    if (sig === sysSig) return;
    sysSig = sig;

    var sel = $a('anSys');
    sel.textContent = '';

    var all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'All systems';
    sel.appendChild(all);

    list.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p[0];
      o.textContent = p[1];
      sel.appendChild(o);
    });

    var exists = sysFilter === 'all' || list.some(function (p) { return p[0] === sysFilter; });
    if (!exists) { sysFilter = 'all'; aggDirty = true; }
    sel.value = sysFilter;
  }


  /* ==========================================
     CANVAS RENDERING  (runs every frame while the window is open)
  ========================================== */

  function resize() {
    var w = screenEl.clientWidth;
    var h = screenEl.clientHeight;
    if (!w || !h) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function trace(pts) {
    ctx.moveTo(pts[0].x, pts[0].y);

    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1].x + pts[i].x) / 2;
      var my = (pts[i - 1].y + pts[i].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  function frame(ts) {
    if (!W || !H) { resize(); if (!W) return; }

    var real = Date.now();
    var now = paused ? frozenNow : real;
    var R = RANGES[range];

    if (aggDirty || !agg || real - aggAt > 200) {
      recompute(now);
      aggAt = real;
      aggDirty = false;
    }

    if (real - lastReadout > 250) {
      lastReadout = real;
      updateReadouts(now);
    }

    if (flash) {
      flash = false;
      if (!rm) {
        screenEl.classList.remove('alert');
        void screenEl.offsetWidth;
        screenEl.classList.add('alert');
      }
    }

    var a = agg;
    var B = a.B;

    /* geometry */
    var pl = 46, pr = W - 72, pt = 18, pb = H - 24;
    var pw = pr - pl, ph = pb - pt;
    var lineH = ph * 0.72, lineBot = pt + lineH;
    var volTop = pt + ph * 0.80, volH = pb - volTop;
    var t0 = now - R.ms;

    var X = function (t) { return pl + (t - t0) / R.ms * pw; };
    var Y = function (v) { return lineBot - (v / 100) * lineH; };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + FONT;
    ctx.textBaseline = 'middle';

    /* zone bands */
    ctx.fillStyle = rgba(COL.safe, 0.07);
    ctx.fillRect(pl, Y(100), pw, Y(80) - Y(100));
    ctx.fillStyle = rgba(COL.unknown, 0.05);
    ctx.fillRect(pl, Y(80), pw, Y(50) - Y(80));
    ctx.fillStyle = rgba(COL.unsafe, 0.08);
    ctx.fillRect(pl, Y(50), pw, Y(0) - Y(50));

    /* horizontal grid + y labels */
    ctx.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach(function (v) {
      ctx.strokeStyle = 'rgba(238,122,31,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pl, Math.round(Y(v)) + 0.5);
      ctx.lineTo(pr, Math.round(Y(v)) + 0.5);
      ctx.stroke();
      ctx.fillStyle = MUTE;
      ctx.fillText(v, pl - 8, Y(v));
    });

    /* threshold lines */
    ctx.setLineDash([5, 5]);
    [[80, COL.safe, 'SAFE ≥80'], [50, COL.unsafe, 'DANGER <50']].forEach(function (z) {
      ctx.strokeStyle = rgba(z[1], 0.4);
      ctx.beginPath();
      ctx.moveTo(pl, Y(z[0]));
      ctx.lineTo(pr, Y(z[0]));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(COL.safe, 0.55);
    ctx.fillText('SAFE ≥80', pl + 6, Y(80) - 8);
    ctx.fillStyle = rgba(COL.unsafe, 0.6);
    ctx.fillText('DANGER <50', pl + 6, Y(50) - 8);

    /* vertical time grid (scrolls with time) */
    var step = R.ms / 6;
    ctx.textAlign = 'center';
    for (var tt = Math.ceil(t0 / step) * step; tt <= now; tt += step) {
      var gx = Math.round(X(tt)) + 0.5;
      ctx.strokeStyle = 'rgba(238,122,31,.12)';
      ctx.beginPath();
      ctx.moveTo(gx, pt);
      ctx.lineTo(gx, pb);
      ctx.stroke();
      ctx.fillStyle = MUTE;
      ctx.fillText(clock(tt, step < 60e3), gx, pb + 13);
    }

    /* volume area label + baseline */
    ctx.strokeStyle = 'rgba(238,122,31,.25)';
    ctx.beginPath();
    ctx.moveTo(pl, volTop - 4.5);
    ctx.lineTo(pr, volTop - 4.5);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = MUTE;
    ctx.fillText('VOL', pl - 8, volTop + volH / 2);

    /* everything inside the plot is clipped to it */
    ctx.save();
    ctx.beginPath();
    ctx.rect(pl, pt - 6, pw, ph + 10);
    ctx.clip();

    /* volume bars (stacked by verdict) */
    var maxN = 1;
    a.arr.forEach(function (b) {
      if (b.t + B > t0 && b.n > maxN) maxN = b.n;
    });

    a.arr.forEach(function (b) {
      if (!b.n) return;

      var x1 = X(b.t) + 1;
      var x2 = Math.min(X(b.t + B), X(now)) - 1;
      if (x2 <= x1 || x2 < pl) return;

      var y = pb;
      STACK.forEach(function (v) {
        var h = b.c[v] / maxN * (volH - 3);
        if (!h) return;
        ctx.fillStyle = rgba(COL[v], 0.85);
        ctx.fillRect(x1, y - h, x2 - x1, h);
        y -= h;
      });
    });

    /* line points */
    var pts = [];
    var headTarget = a.headVal;

    if (headTarget != null) {
      headShown = headShown == null ? headTarget : headShown + (headTarget - headShown) * 0.18;
    }

    a.arr.forEach(function (b) {
      if (b.score == null) return;
      pts.push({
        x: X(Math.min(b.t + B / 2, now)),
        y: Y(b.score),
        b: b
      });
    });

    var headX = X(now);
    var headY = null;

    if (pts.length >= 1 && headShown != null) {
      headY = Y(headShown);
      var lp = pts[pts.length - 1];

      if (lp.x < headX - 0.5) pts.push({ x: headX, y: headY, b: null });
      else lp.y = headY;
    }

    if (pts.length >= 2) {
      var zc = ZCOL[zoneOf(headShown != null ? headShown : 100)];

      /* area fill */
      var fg = ctx.createLinearGradient(0, Y(100), 0, lineBot);
      fg.addColorStop(0, rgba(COL.safe, 0.24));
      fg.addColorStop(0.2, rgba(COL.safe, 0.14));
      fg.addColorStop(0.22, rgba(COL.unknown, 0.12));
      fg.addColorStop(0.5, rgba(COL.unknown, 0.08));
      fg.addColorStop(0.52, rgba(COL.unsafe, 0.08));
      fg.addColorStop(1, rgba(COL.unsafe, 0.02));

      ctx.beginPath();
      trace(pts);
      ctx.lineTo(pts[pts.length - 1].x, lineBot);
      ctx.lineTo(pts[0].x, lineBot);
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();

      /* line coloured by level */
      var lg = ctx.createLinearGradient(0, Y(100), 0, Y(0));
      lg.addColorStop(0, COL.safe);
      lg.addColorStop(0.19, COL.safe);
      lg.addColorStop(0.22, COL.unknown);
      lg.addColorStop(0.47, COL.unknown);
      lg.addColorStop(0.5, COL.unsafe);
      lg.addColorStop(1, COL.unsafe);

      ctx.save();
      ctx.shadowColor = zc;
      ctx.shadowBlur = rm ? 0 : 12;
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      trace(pts);
      ctx.stroke();
      ctx.restore();
    }

    /* unsafe markers */
    var pulse = rm ? 0 : Math.sin(ts / 220);
    pts.forEach(function (p) {
      if (!p.b || !p.b.c.unsafe || p.b.idle) return;

      ctx.strokeStyle = 'rgba(236,83,57,.35)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, volTop - 4);
      ctx.stroke();

      var r = 4 + pulse * 1.2;
      ctx.fillStyle = COL.unsafe;
      ctx.shadowColor = COL.unsafe;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r + 1);
      ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* live head: dot + ripple */
    if (headY != null) {
      var hc = ZCOL[zoneOf(headShown)];

      if (!rm && !paused) {
        var ph2 = (ts % 1400) / 1400;
        ctx.strokeStyle = rgba(hc, (1 - ph2) * 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(headX, headY, 4 + ph2 * 16, 0, 6.283);
        ctx.stroke();
      }

      ctx.fillStyle = hc;
      ctx.shadowColor = hc;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(headX, headY, 4.5, 0, 6.283);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    /* price tag on the right edge */
    if (headY != null) {
      var tc = ZCOL[zoneOf(headShown)];

      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(tc, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pl, headY);
      ctx.lineTo(pr, headY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = tc;
      ctx.fillRect(pr + 2, headY - 10, 62, 20);
      ctx.fillStyle = '#0b0f07';
      ctx.textAlign = 'center';
      ctx.font = '700 12px ' + FONT;
      ctx.fillText(headShown.toFixed(1), pr + 33, headY + 1);
      ctx.font = '11px ' + FONT;
    }

    /* chart caption */
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(166,142,104,.9)';
    ctx.fillText(
      (sysFilter === 'all' ? 'ALL SYSTEMS' : sysName(sysFilter).toUpperCase()) +
      '  ·  ' + R.label + '  ·  ' + (B / 1000 >= 60 ? '1 MIN' : (B / 1000) + ' S') + ' SLOTS',
      pl + 6, pt + 2
    );

    /* hover crosshair + tooltip */
    if (mouse.on && mouse.x >= pl && mouse.x <= pr && mouse.y >= pt && mouse.y <= pb) {
      var ht = t0 + (mouse.x - pl) / pw * R.ms;
      var bi = Math.floor((ht - a.first) / B);
      var hb = a.arr[bi];

      ctx.strokeStyle = 'rgba(248,168,79,.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.round(mouse.x) + 0.5, pt);
      ctx.lineTo(Math.round(mouse.x) + 0.5, pb);
      ctx.stroke();
      ctx.setLineDash([]);

      if (hb) {
        var sec2 = B < 60e3;
        var items = [
          { t: clock(hb.t, sec2) + ' – ' + clock(hb.t + B, sec2), c: ORANGE },
          {
            t: hb.n && hb.score != null
              ? 'Index  ' + hb.score.toFixed(1) + '  (' + hb.n + ' events)'
              : 'No events in this slot',
            c: INK
          }
        ];

        if (hb.n) {
          VERD.forEach(function (v) {
            if (hb.c[v]) items.push({ t: v + '  ' + hb.c[v], c: COL[v], sw: true });
          });
        }

        ctx.font = '12px ' + FONT;
        var tw = 0;
        items.forEach(function (it) { tw = Math.max(tw, ctx.measureText(it.t).width); });

        var bw = tw + 32, bh = items.length * 17 + 12;
        var bx = mouse.x + 16 + bw > pr ? mouse.x - 16 - bw : mouse.x + 16;
        var by = Math.min(Math.max(mouse.y - bh / 2, pt), pb - bh);

        ctx.fillStyle = 'rgba(20,12,5,.94)';
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);

        ctx.textAlign = 'left';
        items.forEach(function (it, i) {
          var ly = by + 14 + i * 17;
          ctx.fillStyle = it.c;

          if (it.sw) {
            ctx.fillRect(bx + 9, ly - 4, 8, 8);
            ctx.fillText(it.t, bx + 23, ly);
          } else {
            ctx.fillText(it.t, bx + 10, ly);
          }
        });

        ctx.font = '11px ' + FONT;
      }
    }
  }

  function loop(ts) {
    if (modal.hidden) { running = false; return; }
    frame(ts);
    requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }


  /* ==========================================
     CONTROLS
  ========================================== */

  openBtn.onclick = function () {
    sysSig = '';
    refreshSystems();
    openModal(modal);
    resize();
    aggDirty = true;
    lastReadout = 0;
    feedDirty = true;
    start();
  };

  $a('anRanges').addEventListener('click', function (event) {
    var btn = event.target.closest('[data-range]');
    if (!btn) return;

    range = btn.dataset.range;

    Array.prototype.forEach.call(
      $a('anRanges').querySelectorAll('[data-range]'),
      function (b) { b.classList.toggle('on', b === btn); }
    );

    aggDirty = true;
    lastReadout = 0;
  });

  $a('anSys').addEventListener('change', function (event) {
    sysFilter = event.target.value;
    aggDirty = true;
    lastReadout = 0;
  });

  $a('anPause').addEventListener('click', function () {
    paused = !paused;
    frozenNow = Date.now();

    var tag = $a('anLiveTag');
    tag.textContent = paused ? 'PAUSED' : 'LIVE';
    tag.classList.toggle('paused', paused);

    $a('anPause').textContent = paused ? 'Go live' : 'Pause';
    $a('anPause').classList.toggle('on', paused);

    aggDirty = true;
  });

  $a('anDemo').addEventListener('click', function () {
    setDemo(!demoOn);
    lastReadout = 0;
  });

  cv.addEventListener('pointermove', function (event) {
    var r = cv.getBoundingClientRect();
    mouse.x = event.clientX - r.left;
    mouse.y = event.clientY - r.top;
    mouse.on = true;
  });

  cv.addEventListener('pointerleave', function () { mouse.on = false; });

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(screenEl);
  } else {
    window.addEventListener('resize', resize);
  }


  /* ---------- START COLLECTING (even while the window is closed) ---------- */

  scan();
  setInterval(scan, 500);
  setInterval(prune, 10000);
})();