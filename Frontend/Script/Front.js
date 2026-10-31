/* ---------- API CONFIGURATION ---------- */
const BASE = '';

const API = {
  eventsNext: '/api/events/next',
  eventsAck: '/api/events/ack',
  connect: '/api/systems/connect',
  summary: '/api/summary'
};

const POLL_MS = 5000;
const VERDICTS = ['safe', 'unsafe', 'unknown', 'partial'];
const $ = id => document.getElementById(id);

let systems = [];
let procRows = [];
let netRows = [];
let first = true;
let demo = false;
let openId = null;
let tab = 'proc';
let vfilter = 'all';

const seenEventIds = new Set();
let refreshInProgress = false;
const tiles = new Map();

/* ---------- SECURITY ALERTS + REASON DIALOG ---------- */

let alertHost;
let reasonModal;
let netModal;

function ensureSecurityUI() {
  if (!alertHost) {
    alertHost = document.createElement('div');
    alertHost.id = 'securityAlerts';
    alertHost.className = 'security-alerts';
    alertHost.setAttribute('aria-live', 'assertive');
    alertHost.setAttribute('aria-atomic', 'false');
    document.body.appendChild(alertHost);
  }

  if (!reasonModal) {
    reasonModal = document.createElement('div');
    reasonModal.id = 'processReasonModal';
    reasonModal.className = 'modal';
    reasonModal.hidden = true;
    reasonModal.setAttribute('role', 'dialog');
    reasonModal.setAttribute('aria-modal', 'true');
    reasonModal.setAttribute('aria-labelledby', 'processReasonTitle');

    const win = el('div', 'win mid');
    const titlebar = el('div', 'titlebar');

    const title = el('span', null, 'Process details');
    title.id = 'processReasonTitle';

    const close = el('button', 'x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.setAttribute('data-close', '');

    titlebar.append(title, close);

    const body = el('div', 'win-body process-reason-body');

    const name = el('h3');
    name.id = 'processReasonName';

    const status = el('p');
    status.id = 'processReasonStatus';
    status.className = 'reason-status';

    const reasonLabel = el('strong', null, 'Detection reason');

    const reason = el('p');
    reason.id = 'processReasonText';
    reason.className = 'process-reason-text';

    const meta = el('p');
    meta.id = 'processReasonMeta';
    meta.className = 'hint';

    body.append(name, status, reasonLabel, reason, meta);
    win.append(titlebar, body);
    reasonModal.appendChild(win);
    document.body.appendChild(reasonModal);

    reasonModal.addEventListener('click', event => {
      if (
        event.target === reasonModal ||
        event.target.hasAttribute('data-close')
      ) {
        closeModal(reasonModal);
      }
    });
  }

  if (!netModal) {
    netModal = document.createElement('div');
    netModal.id = 'networkDetailModal';
    netModal.className = 'modal';
    netModal.hidden = true;
    netModal.setAttribute('role', 'dialog');
    netModal.setAttribute('aria-modal', 'true');
    netModal.setAttribute('aria-labelledby', 'netDetailTitle');

    const win = el('div', 'win mid');
    const titlebar = el('div', 'titlebar');

    const title = el('span', null, 'Network connection details');
    title.id = 'netDetailTitle';

    const close = el('button', 'x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.setAttribute('data-close', '');

    titlebar.append(title, close);

    const body = el('div', 'win-body process-reason-body');

    const name = el('h3');
    name.id = 'netDetailName';

    const status = el('p');
    status.id = 'netDetailStatus';
    status.className = 'reason-status';

    const fields = el('dl', 'net-detail-grid');
    fields.id = 'netDetailFields';

    const reasonLabel = el('strong', null, 'Detection reason');

    const reason = el('p');
    reason.id = 'netDetailReason';
    reason.className = 'process-reason-text';

    const rawLabel = el('strong', null, 'Raw event data');
    rawLabel.className = 'net-raw-label';

    const raw = el('pre', 'net-raw');
    raw.id = 'netDetailRaw';

    body.append(name, status, fields, reasonLabel, reason, rawLabel, raw);
    win.append(titlebar, body);
    netModal.appendChild(win);
    document.body.appendChild(netModal);

    netModal.addEventListener('click', event => {
      if (
        event.target === netModal ||
        event.target.hasAttribute('data-close')
      ) {
        closeModal(netModal);
      }
    });
  }
}

function showUnsafeAlert(row) {
  ensureSecurityUI();

  const alert = el('section', 'security-alert');
  alert.setAttribute('role', 'alert');

  const heading = el(
    'strong',
    null,
    '⚠ UNSAFE PROCESS DETECTED'
  );

  const description = el(
    'p',
    null,
    `${row.name || 'Unknown process'} (PID ${row.pid ?? '—'})`
  );

  const reason = el(
    'p',
    null,
    row.reason || 'No detection reason provided by the backend.'
  );

  const details = el('button', 'security-alert-details', 'View details');
  details.type = 'button';
  details.onclick = () => showProcessReason(row);

  const dismiss = el('button', 'security-alert-close', 'Dismiss');
  dismiss.type = 'button';
  dismiss.onclick = () => alert.remove();

  alert.append(heading, description, reason, details, dismiss);
  alertHost.prepend(alert);

  // Remove the notification after 10 seconds.
  window.setTimeout(() => alert.remove(), 10000);
}

function showProcessReason(row) {
  ensureSecurityUI();

  const status = verdictOf(row);

  $('processReasonName').textContent =
    row.name || 'Unknown process';

  $('processReasonStatus').textContent =
    `Status: ${status.toUpperCase()}`;

  $('processReasonStatus').className =
    `reason-status ${status}`;

  $('processReasonText').textContent =
    row.reason || 'No reason provided by the backend.';

  $('processReasonMeta').textContent =
    `PID: ${row.pid ?? '—'} | ` +
    `PPID: ${row.ppid ?? '—'} | ` +
    `Event: ${row.event || '—'} | ` +
    `Time: ${fmtTime(row.time)}`;

  openModal(reasonModal);
}

function showNetworkDetails(row) {
  ensureSecurityUI();

  const status = verdictOf(row);
  const target = row.port !== '—' && row.port != null
    ? `${row.dest}:${row.port}`
    : row.dest;

  $('netDetailName').textContent =
    `${row.process || 'unknown'} → ${target}`;

  $('netDetailStatus').textContent =
    `Status: ${status.toUpperCase()}`;

  $('netDetailStatus').className = `reason-status ${status}`;

  const fullTime = new Date(row.time);

  const fields = [
    ['Time', isNaN(fullTime) ? String(row.time) : fullTime.toLocaleString([], { hour12: false })],
    ['Process', row.process || '—'],
    ['PID', row.pid ?? '—'],
    ['Protocol', row.proto || '—'],
    ['Destination IP', row.dest || '—'],
    ['Destination port', row.port ?? '—'],
    ['Event ID', row.id || '—']
  ];

  const box = $('netDetailFields');
  box.textContent = '';

  fields.forEach(([key, value]) => {
    box.append(el('dt', null, key), el('dd', null, value));
  });

  $('netDetailReason').textContent =
    row.reason || 'No reason provided by the backend.';

  $('netDetailRaw').textContent = row.raw
    ? JSON.stringify(row.raw, null, 2)
    : 'No raw data available.';

  openModal(netModal);
}

/* ---------- HELPERS ---------- */

async function getJSON(url, opts = {}) {
  const response = await fetch(BASE + url, {
    credentials: BASE ? 'include' : 'same-origin',
    ...opts
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

const el = (tag, cls, text) => {
  const element = document.createElement(tag);

  if (cls) element.className = cls;
  if (text != null) element.textContent = String(text);

  return element;
};

const verdictOf = row => {
  const verdict = String(row.verdict || '').toLowerCase();

  if (VERDICTS.includes(verdict)) {
    return verdict;
  }

  if (row.status === 'blocked') return 'unsafe';
  if (row.status === 'allowed') return 'safe';

  return 'unknown';
};

const cmdOf = row => row.cmd || row.name || '';

const STATUS = {
  in_use: 'In use',
  idle: 'Idle',
  disconnected: 'Disconnected',
  damaged: 'Damaged'
};

const fmtTime = value => {
  const date = new Date(value);

  return isNaN(date)
    ? String(value)
    : date.toLocaleTimeString([], { hour12: false });
};

const byTime = (a, b) =>
  new Date(b.time) - new Date(a.time);

const logsOf = (rows, id) =>
  rows.filter(row => row.system_id === id).sort(byTime);

/* ---------- DASHBOARD STATS ---------- */

function renderStats() {
  const count = status =>
    systems.filter(system => system.status === status).length;

  $('nTotal').textContent =
    systems.length - count('disconnected');

  $('nUse').textContent = count('in_use');
  $('nOff').textContent = count('disconnected');
  $('nBad').textContent = count('damaged');
}

function renderAdmin(profile = {}) {
  $('aName').textContent = profile.name || 'Admin';
  $('aRole').textContent = profile.role || '';

  $('avatar').textContent =
    (profile.name || 'A').trim().charAt(0).toUpperCase();

  const data = $('aData');
  data.textContent = '';

  [
    ['Email', profile.email],
    ['Organization', profile.org],
    ['Joined', profile.joined]
  ].forEach(([key, value]) => {
    data.append(
      el('dt', null, key),
      el('dd', null, value || '—')
    );
  });
}

function verdictCounts() {
  const ids = new Set(systems.map(system => system.id));

  const counts = {
    safe: 0,
    unsafe: 0,
    unknown: 0,
    partial: 0
  };

  procRows.concat(netRows).forEach(row => {
    if (ids.has(row.system_id)) {
      counts[verdictOf(row)]++;
    }
  });

  return counts;
}

function fillTally(box, counts) {
  const total = Math.max(
    1,
    VERDICTS.reduce(
      (sum, verdict) => sum + (counts[verdict] || 0),
      0
    )
  );

  if (!box.children.length) {
    VERDICTS.forEach(verdict => {
      const row = el('div', 't ' + verdict);

      row.append(
        el('span', null, verdict),
        el('div', 'tr'),
        el('em', null, '0')
      );

      row.children[1].appendChild(el('i'));
      box.appendChild(row);
    });
  }

  VERDICTS.forEach((verdict, index) => {
    const row = box.children[index];
    const count = counts[verdict] || 0;

    row.querySelector('i').style.width =
      (count / total * 100) + '%';

    row.querySelector('em').textContent = count;
  });
}

function renderTally() {
  fillTally($('tally'), verdictCounts());
}

/* ---------- SUMMARY WINDOW ---------- */

function computeSummary() {
  const count = status =>
    systems.filter(system => system.status === status).length;

  const ids = new Set(systems.map(system => system.id));

  const processes = procRows.filter(row =>
    ids.has(row.system_id)
  );

  const connections = netRows.filter(row =>
    ids.has(row.system_id)
  );

  const times = processes.concat(connections)
    .map(row => new Date(row.time).getTime())
    .filter(time => !isNaN(time));

  return {
    total: systems.length,
    in_use: count('in_use'),
    idle: count('idle'),
    disconnected: count('disconnected'),
    damaged: count('damaged'),
    verdicts: verdictCounts(),
    processes: processes.length,
    connections: connections.length,
    last_seen: times.length ? Math.max(...times) : null
  };
}

function renderSummary(data) {
  const num = value => Number(value) || 0;
  const total = num(data.total);
  const disconnected = num(data.disconnected);

  const figures = $('sumFigs');
  figures.textContent = '';

  [
    ['Total systems', total, 'c'],
    ['Connected', total - disconnected, 'c'],
    ['In use', num(data.in_use), 'g'],
    ['Idle', num(data.idle), 'i'],
    ['Disconnected', disconnected, 'm'],
    ['Damaged', num(data.damaged), 'r']
  ].forEach(([label, value, cls]) => {
    const figure = el('div', 'fig ' + cls);

    figure.append(
      el('b', null, value),
      el('span', null, label)
    );

    figures.appendChild(figure);
  });

  fillTally($('sumTally'), data.verdicts || {});

  const meta = $('sumMeta');
  meta.textContent = '';

  [
    ['Process records', num(data.processes)],
    ['Network records', num(data.connections)],
    [
      'Last activity',
      data.last_seen
        ? new Date(data.last_seen).toLocaleString()
        : '—'
    ]
  ].forEach(([key, value]) => {
    meta.append(
      el('dt', null, key),
      el('dd', null, value)
    );
  });
}

async function openSummary() {
  renderSummary(computeSummary());
  openModal($('sumModal'));

  try {
    renderSummary(await getJSON(API.summary));
  } catch (_) {
    // Keep the locally calculated summary.
  }
}

$('openSummary').onclick = openSummary;

$('sumAdd').onclick = () => {
  closeModal($('sumModal'));
  resetConnect();
  openModal($('connectModal'));
};

/* ---------- COMPUTER TILES ---------- */

function buildTile(system) {
  const button = el('button', 'mon');
  button.type = 'button';

  const tilt = el('div', 'tilt');
  const bezel = el('div', 'bezel');
  const screen = el('div', 'screen');

  const bar = el('div', 'case-bar');
  bar.append(
    el('i', 'led'),
    el('span', 'slot'),
    el('span', 'slot')
  );

  bezel.append(screen, bar);
  tilt.append(bezel, el('div', 'neck'), el('div', 'foot'));

  button.append(tilt, el('span', 'mname'));

  button.addEventListener('click', () => {
    openSystem(button.dataset.id);
  });

  button.addEventListener('mousemove', event => {
    const rect = button.getBoundingClientRect();

    tilt.style.setProperty(
      '--ry',
      ((event.clientX - rect.left) / rect.width - 0.5) * 14 + 'deg'
    );

    tilt.style.setProperty(
      '--rx',
      (0.5 - (event.clientY - rect.top) / rect.height) * 10 + 'deg'
    );
  });

  button.addEventListener('mouseleave', () => {
    tilt.style.setProperty('--rx', '0deg');
    tilt.style.setProperty('--ry', '0deg');
  });

  return button;
}

function renderFloor() {
  const floor = $('floor');
  const keep = new Set(systems.map(system => system.id));

  tiles.forEach((tile, id) => {
    if (!keep.has(id)) {
      tile.remove();
      tiles.delete(id);
    }
  });

  systems.forEach(system => {
    let tile = tiles.get(system.id);

    if (!tile) {
      tile = buildTile(system);
      tiles.set(system.id, tile);
    }

    tile.dataset.id = system.id;

    tile.className =
      'mon ' +
      (system.status === 'in_use'
        ? ''
        : system.status === 'idle'
          ? 'idle'
          : system.status);

    tile.setAttribute(
      'aria-label',
      'Open ' + system.name + ' logs'
    );

    tile.querySelector('.mname').textContent = system.name;

    floor.appendChild(tile);

    drawScreen(tile.querySelector('.screen'), system);
  });

  floor.appendChild(addTile());
}

let addEl;

function addTile() {
  if (addEl) return addEl;

  addEl = el('button', 'mon add');
  addEl.type = 'button';

  const tilt = el('div', 'tilt');
  const bezel = el('div', 'bezel');
  const screen = el('div', 'screen');

  screen.appendChild(el('span', 'plus', '+'));

  const bar = el('div', 'case-bar');
  bar.append(el('i', 'led'), el('span', 'slot'));

  bezel.append(screen, bar);
  tilt.append(bezel, el('div', 'neck'), el('div', 'foot'));

  addEl.append(
    tilt,
    el('span', 'mname', 'Connect a system')
  );

  addEl.onclick = () => {
    resetConnect();
    openModal($('connectModal'));
  };

  return addEl;
}

function drawScreen(screen, system) {
  const rows = logsOf(procRows, system.id).slice(0, 8);

  const signature =
    system.status + '|' +
    rows.map(row =>
      row.pid + cmdOf(row) + verdictOf(row)
    ).join(',');

  if (screen.dataset.sig === signature) return;

  const previousTop = screen.dataset.top;
  screen.dataset.sig = signature;
  screen.textContent = '';

  if (
    system.status === 'disconnected' ||
    system.status === 'damaged'
  ) {
    screen.appendChild(
      el(
        'div',
        'off-msg',
        system.status === 'damaged'
          ? 'SYSTEM FAULT'
          : 'NO SIGNAL'
      )
    );
  }

  rows.forEach((row, index) => {
    const line = el('div', 'ln ' + verdictOf(row));

    line.append(
      el('i'),
      el('span', null, cmdOf(row))
    );

    if (
      !first &&
      index === 0 &&
      previousTop !== row.pid + cmdOf(row)
    ) {
      line.classList.add('fresh');
    }

    screen.appendChild(line);
  });

  if (
    !rows.length &&
    system.status !== 'disconnected' &&
    system.status !== 'damaged'
  ) {
    screen.appendChild(
      el('div', 'off-msg', 'AWAITING DATA')
    );
  }

  screen.dataset.top = rows[0]
    ? rows[0].pid + cmdOf(rows[0])
    : '';
}

/* ---------- SYSTEM DETAILS WINDOW ---------- */

function openSystem(id) {
  openId = id;
  tab = 'proc';
  vfilter = 'all';

  const system = systems.find(item => item.id === id);

  $('sTitle').textContent =
    (system ? system.name : id) +
    (
      system
        ? ' — ' + (STATUS[system.status] || system.status)
        : ''
    );

  document.querySelectorAll('.tab').forEach(button => {
    button.classList.toggle(
      'on',
      button.dataset.tab === tab
    );
  });

  drawDetail();
  openModal($('sysModal'));
}

function drawDetail() {
  if (!openId) return;

  const rows = logsOf(
    tab === 'proc' ? procRows : netRows,
    openId
  );

  const counts = {
    all: rows.length,
    safe: 0,
    unsafe: 0,
    unknown: 0,
    partial: 0
  };

  rows.forEach(row => counts[verdictOf(row)]++);

  const chips = $('chips');
  chips.textContent = '';

  ['all', ...VERDICTS].forEach(verdict => {
    const button = el(
      'button',
      'chip ' +
        (verdict === 'all' ? '' : verdict) +
        (vfilter === verdict ? ' on' : ''),
      verdict + ' · ' + counts[verdict]
    );

    button.type = 'button';

    button.onclick = () => {
      vfilter = verdict;
      drawDetail();
    };

    chips.appendChild(button);
  });

  const head = $('sHead');
  head.textContent = '';

  const header = el('tr');

  const columns = tab === 'proc'
    ? ['Time', 'PID', 'Process', 'Command', 'Verdict']
    : [
        'Time',
        'Proto',
        'Destination',
        'Port',
        'Process',
        'Verdict'
      ];

  columns.forEach(column => {
    header.appendChild(el('th', null, column));
  });

  head.appendChild(header);

  const body = $('sBody');
  body.textContent = '';

  const shown = rows
    .filter(row =>
      vfilter === 'all' ||
      verdictOf(row) === vfilter
    )
    .slice(0, 300);

  shown.forEach(row => {
    const tr = el('tr');
    const verdict = verdictOf(row);

    tr.appendChild(
      el('td', 'nw', fmtTime(row.time))
    );

    if (tab === 'proc') {
      tr.appendChild(el('td', 'nw', row.pid));

      // Clicking the process name opens its reason.
      const processCell = el('td', 'nw');

      const processLink = el(
        'button',
        'process-name-link',
        row.name || 'unknown'
      );

      processLink.type = 'button';
      processLink.title = 'View process status and reason';
      processLink.onclick = () => showProcessReason(row);

      processCell.appendChild(processLink);
      tr.appendChild(processCell);

      tr.appendChild(
        el('td', 'cmd', row.cmd || row.name)
      );
    } else {
      tr.appendChild(
        el('td', 'nw', row.proto || '—')
      );

      tr.appendChild(el('td', 'nw', row.dest));
      tr.appendChild(el('td', 'nw', row.port));

      tr.appendChild(
        el('td', 'nw', row.process || '—')
      );

      // Clicking anywhere on a network row opens its details.
      tr.classList.add('row-click');
      tr.tabIndex = 0;
      tr.title = 'View connection details';
      tr.onclick = () => showNetworkDetails(row);
      tr.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showNetworkDetails(row);
        }
      };
    }

    const td = el('td');

    td.appendChild(
      el('span', 'tag ' + verdict, verdict)
    );

    tr.appendChild(td);
    body.appendChild(tr);
  });

  $('sEmpty').hidden = shown.length > 0;
}

document.querySelectorAll('.tab').forEach(button => {
  button.onclick = () => {
    tab = button.dataset.tab;
    vfilter = 'all';

    document.querySelectorAll('.tab').forEach(item => {
      item.classList.toggle('on', item === button);
    });

    drawDetail();
  };
});

/* ---------- MODALS ---------- */

let lastFocus;

function openModal(modal) {
  lastFocus = document.activeElement;
  modal.hidden = false;

  const focusTarget = modal.querySelector('input,.x');

  if (focusTarget) {
    focusTarget.focus();
  }
}

function closeModal(modal) {
  modal.hidden = true;

  if (modal.id === 'sysModal') {
    openId = null;
  }

  if (lastFocus && lastFocus.focus) {
    lastFocus.focus();
  }
}

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', event => {
    if (
      event.target === modal ||
      event.target.hasAttribute('data-close')
    ) {
      closeModal(modal);
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document
      .querySelectorAll('.modal:not([hidden])')
      .forEach(closeModal);
  }
});

/* ---------- CONNECT SYSTEM ---------- */

function resetConnect() {
  $('sysName').value = '';
  $('cmdBox').hidden = true;
  $('cErr').hidden = true;
}

$('makeCmd').onclick = async () => {
  const name = $('sysName').value.trim();
  const error = $('cErr');

  error.hidden = true;

  if (!name) {
    error.textContent = 'Enter a name for the system.';
    error.hidden = false;
    return;
  }

  let result;

  try {
    result = await getJSON(API.connect, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
  } catch (_) {
    if (!demo) {
      error.textContent =
        'Could not reach the server. Try again.';
      error.hidden = false;
      return;
    }

    result = {
      command:
        'curl -sSL https://your-server/agent.sh | sudo bash -s -- --token DEMO-TOKEN-1234'
    };
  }

  $('cmdText').textContent = result.command;
  $('cmdBox').hidden = false;

  refresh();
};

$('copyCmd').onclick = async event => {
  try {
    await navigator.clipboard.writeText(
      $('cmdText').textContent
    );

    event.target.textContent = 'Copied';

    setTimeout(() => {
      event.target.textContent = 'Copy command';
    }, 1500);
  } catch (_) {
    // Clipboard access may be unavailable.
  }
};

/* ---------- LIVE STATUS ---------- */

function setLive(ok) {
  const live = $('live');

  live.textContent = demo
    ? 'Demo system / API mode'
    : ok
      ? 'Live'
      : 'Reconnecting';

  live.classList.toggle('down', demo || !ok);
}

/* ---------- PROCESS + NETWORK BATCH API ---------- */

function ensureLocalSystem() {
  if (!systems.length) {
    systems = [{
      id: 'ebpf-local',
      name: 'eBPF-Shield Host',
      status: 'in_use'
    }];
  }

  return systems[0].id;
}

function parsePayload(item, kind) {
  try {
    const payload = typeof item.payload === 'string'
      ? JSON.parse(item.payload)
      : item.payload;

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      throw new Error('Invalid payload');
    }

    return payload;
  } catch (error) {
    console.error(
      `[Prahari] Invalid ${kind} payload:`,
      error,
      item
    );

    return {
      status: 'partial',
      reason: 'The event payload could not be parsed.',
      comm: `Invalid ${kind} event`
    };
  }
}

function eventTimestamp(payload) {
  const value = Number(
    payload.timestamp_unix ??
    payload.timestamp ??
    payload.time
  );

  return Number.isFinite(value) && value > 0
    ? new Date(
        value < 1e12 ? value * 1000 : value
      ).toISOString()
    : new Date().toISOString();
}

function normalizedVerdict(payload) {
  const value = String(
    payload.status || payload.verdict || ''
  ).toLowerCase();

  if (VERDICTS.includes(value)) return value;
  if (value === 'blocked') return 'unsafe';
  if (value === 'allowed') return 'safe';

  return 'unknown';
}

/* ---------- PROCESS BATCH ---------- */

function processProcessBatch(batch) {
  if (
    !batch ||
    batch.available !== true ||
    !Array.isArray(batch.events) ||
    !batch.events.length
  ) {
    return null;
  }

  const systemId = ensureLocalSystem();

  for (const item of batch.events) {
    if (item.id == null) {
      throw new Error(
        'Process event is missing its Redis event ID; refusing acknowledgement.'
      );
    }

    const eventId = `process:${String(item.id)}`;

    if (seenEventIds.has(eventId)) continue;

    const payload = parsePayload(item, 'process');
    const status = normalizedVerdict(payload);
    const name = String(payload.comm || payload.name || 'unknown');

    const row = {
      id: eventId,
      time: eventTimestamp(payload),
      system_id: systemId,
      pid: payload.pid ?? '—',
      ppid: payload.ppid ?? '—',
      name,
      cmd: String(payload.cmd || name),
      event: String(payload.event || 'PROCESS_EXEC_ATTEMPT'),
      verdict: status,
      reason: String(
        payload.reason || 'No reason provided by the backend.'
      )
    };

    procRows.push(row);

    if (status === 'unsafe') {
      showUnsafeAlert(row);
    }

    seenEventIds.add(eventId);
  }

  procRows.sort(byTime);

  if (procRows.length > 2000) {
    procRows = procRows.slice(0, 2000);
  }

  return batch.batch_id;
}

/* ---------- NETWORK BATCH ---------- */

function processNetworkBatch(batch) {
  if (
    !batch ||
    batch.available !== true ||
    !Array.isArray(batch.events) ||
    !batch.events.length
  ) {
    return null;
  }

  const systemId = ensureLocalSystem();

  for (const item of batch.events) {
    if (item.id == null) {
      throw new Error(
        'Network event is missing its Redis event ID; refusing acknowledgement.'
      );
    }

    const eventId = `network:${String(item.id)}`;

    if (seenEventIds.has(eventId)) continue;

    const payload = parsePayload(item, 'network');

    netRows.push({
      id: eventId,
      time: eventTimestamp(payload),
      system_id: systemId,
      proto: String(payload.protocol || payload.family || '—'),
      dest: String(
        payload.destination_ip ||
        payload.dest ||
        payload.remote_ip ||
        '—'
      ),
      port: payload.destination_port ?? payload.port ?? '—',
      process: String(
        payload.comm ||
        payload.process ||
        payload.name ||
        '—'
      ),
      pid: payload.pid ?? '—',
      verdict: normalizedVerdict(payload),
      reason: String(
        payload.reason || 'No reason provided by the backend.'
      ),
      raw: payload
    });

    seenEventIds.add(eventId);
  }

  netRows.sort(byTime);

  if (netRows.length > 2000) {
    netRows = netRows.slice(0, 2000);
  }

  return batch.batch_id;
}

/* ---------- FETCH BOTH BATCHES ---------- */

async function fetchEventBatches() {
  const response = await getJSON(API.eventsNext);

  if (!response || response.success !== true) {
    throw new Error(
      'Events API returned an unsuccessful response.'
    );
  }

  return {
    processBatchId: processProcessBatch(response.process),
    networkBatchId: processNetworkBatch(response.network)
  };
}

/* ---------- ACKNOWLEDGE BOTH BATCHES ---------- */

async function acknowledgeBatches(batchIds) {
  const body = {};

  if (batchIds.processBatchId != null) {
    body.process_batch_id = batchIds.processBatchId;
  }

  if (batchIds.networkBatchId != null) {
    body.network_batch_id = batchIds.networkBatchId;
  }

  if (!Object.keys(body).length) return;

  const response = await fetch(BASE + API.eventsAck, {
    method: 'POST',
    credentials: BASE ? 'include' : 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Batch acknowledgement failed: HTTP ${response.status}`
    );
  }
}

/* ---------- MAIN REFRESH LOOP ---------- */

async function refresh() {
  if (refreshInProgress) return;

  refreshInProgress = true;

  try {
    // No /api/dashboard call: this page monitors the local eBPF host.
    ensureLocalSystem();
    renderAdmin();

    demo = false;
    setLive(true);

    let batchIds = {
      processBatchId: null,
      networkBatchId: null
    };

    try {
      batchIds = await fetchEventBatches();
    } catch (error) {
      console.error(
        '[Prahari] Could not fetch/process event batches:',
        error
      );

      setLive(false);
    }

    renderStats();
    renderFloor();
    renderTally();
    drawDetail();

    first = false;

    // Acknowledge both stream batches after processing and rendering.
    try {
      await acknowledgeBatches(batchIds);
    } catch (error) {
      console.error(
        '[Prahari] Batch acknowledgement failed:',
        error
      );
    }

  } finally {
    refreshInProgress = false;
  }
}

/* ---------- START ---------- */

ensureSecurityUI();
refresh();
setInterval(refresh, POLL_MS);
