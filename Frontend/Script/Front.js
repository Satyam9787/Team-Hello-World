/* ==========================================
   PRAHARI DASHBOARD
   WebSocket + Redis Batch + Response Actions
========================================== */


/* ==========================================
   API CONFIGURATION
========================================== */

const BASE = '';

const API = {
  connect: '/api/systems/connect',
  summary: '/api/summary',
  eventsAck: '/api/events/ack',

  killProcess: '/kill_process',
  blockConnection: '/block_connection',
  freezeSystem: '/freeze_demo'
};

const VERDICTS = [
  'safe',
  'unsafe',
  'unknown',
  'partial'
];

const $ = id => document.getElementById(id);


/* ==========================================
   GLOBAL STATE
========================================== */

let systems = [];

let procRows = [];
let netRows = [];

let first = true;
let demo = false;

let openId = null;
let tab = 'proc';
let vfilter = 'all';

let selectedProcessRow = null;
let selectedNetworkRow = null;

const seenEventIds = new Set();
const MAX_SEEN_EVENT_IDS = 10000;

const tiles = new Map();

function rememberEventId(eventId) {

  if (seenEventIds.has(eventId)) {
    return false;
  }

  seenEventIds.add(eventId);

  if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
    const oldestId = seenEventIds.values().next().value;
    seenEventIds.delete(oldestId);
  }

  return true;
}


/* ==========================================
   BASIC HELPERS
========================================== */

const el = (tag, cls, text) => {

  const element = document.createElement(tag);

  if (cls) {
    element.className = cls;
  }

  if (text != null) {
    element.textContent = String(text);
  }

  return element;
};


async function getJSON(url, opts = {}) {

  const response = await fetch(BASE + url, {

    credentials: BASE ? 'include' : 'same-origin',

    ...opts

  });

  let data;

  try {
    data = await response.json();
  } catch (_) {
    throw new Error(`Invalid JSON response from ${url}`);
  }

  if (!response.ok) {
    throw new Error(
      data.message || `HTTP ${response.status}: ${url}`
    );
  }

  return data;
}


async function postAction(url, payload) {

  const response = await getJSON(url, {

    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify(payload)

  });

  if (response.success !== true) {

    throw new Error(
      response.message || 'Action execution failed'
    );

  }

  return response;
}


const verdictOf = row => {

  const verdict = String(
    row.verdict || ''
  ).toLowerCase();

  if (VERDICTS.includes(verdict)) {
    return verdict;
  }

  if (row.status === 'blocked') {
    return 'unsafe';
  }

  if (row.status === 'allowed') {
    return 'safe';
  }

  return 'unknown';
};


const cmdOf = row =>
  row.cmd || row.name || '';


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
    : date.toLocaleTimeString([], {
        hour12: false
      });

};


const byTime = (a, b) =>
  new Date(b.time) - new Date(a.time);


const logsOf = (rows, id) =>
  rows
    .filter(row => row.system_id === id)
    .sort(byTime);


function getSystem(systemId) {

  return systems.find(
    system => system.id === systemId
  );

}


/* ==========================================
   SECURITY ALERTS + DETAIL MODALS
========================================== */

let alertHost;
let reasonModal;
let netModal;


function ensureSecurityUI() {

  if (!alertHost) {

    alertHost = el('div', 'security-alerts');

    alertHost.id = 'securityAlerts';

    alertHost.setAttribute('aria-live', 'assertive');

    alertHost.setAttribute('aria-atomic', 'false');

    document.body.appendChild(alertHost);

  }


  /* ---------- PROCESS MODAL ---------- */

  if (!reasonModal) {

    reasonModal = el('div', 'modal');

    reasonModal.id = 'processReasonModal';

    reasonModal.hidden = true;

    reasonModal.setAttribute('role', 'dialog');

    reasonModal.setAttribute('aria-modal', 'true');

    reasonModal.setAttribute(
      'aria-labelledby',
      'processReasonTitle'
    );


    const win = el('div', 'win mid');

    const titlebar = el('div', 'titlebar');

    const title = el(
      'span',
      null,
      'Process details'
    );

    title.id = 'processReasonTitle';


    const close = el('button', 'x', '×');

    close.type = 'button';

    close.setAttribute('data-close', '');

    close.setAttribute('aria-label', 'Close');


    titlebar.append(title, close);


    const body = el(
      'div',
      'win-body process-reason-body'
    );


    const name = el('h3');

    name.id = 'processReasonName';


    const status = el('p');

    status.id = 'processReasonStatus';

    status.className = 'reason-status';


    const reasonLabel = el(
      'strong',
      null,
      'Detection reason'
    );


    const reason = el('p');

    reason.id = 'processReasonText';

    reason.className = 'process-reason-text';


    const meta = el('p');

    meta.id = 'processReasonMeta';

    meta.className = 'hint';


    const killButton = el(
      'button',
      'primary',
      'Kill the process'
    );

    killButton.type = 'button';

    killButton.id = 'killProcessButton';

    killButton.style.background = '#b91c1c';

    killButton.style.color = '#ffffff';

    killButton.style.marginTop = '15px';

    killButton.onclick = killSelectedProcess;


    body.append(
      name,
      status,
      reasonLabel,
      reason,
      meta,
      killButton
    );


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


  /* ---------- NETWORK MODAL ---------- */

  if (!netModal) {

    netModal = el('div', 'modal');

    netModal.id = 'networkDetailModal';

    netModal.hidden = true;

    netModal.setAttribute('role', 'dialog');

    netModal.setAttribute('aria-modal', 'true');

    netModal.setAttribute(
      'aria-labelledby',
      'netDetailTitle'
    );


    const win = el('div', 'win mid');

    const titlebar = el('div', 'titlebar');

    const title = el(
      'span',
      null,
      'Network connection details'
    );

    title.id = 'netDetailTitle';


    const close = el('button', 'x', '×');

    close.type = 'button';

    close.setAttribute('data-close', '');

    close.setAttribute('aria-label', 'Close');


    titlebar.append(title, close);


    const body = el(
      'div',
      'win-body process-reason-body'
    );


    const name = el('h3');

    name.id = 'netDetailName';


    const status = el('p');

    status.id = 'netDetailStatus';

    status.className = 'reason-status';


    const fields = el('dl', 'net-detail-grid');

    fields.id = 'netDetailFields';


    const reasonLabel = el(
      'strong',
      null,
      'Detection reason'
    );


    const reason = el('p');

    reason.id = 'netDetailReason';

    reason.className = 'process-reason-text';


    const rawLabel = el(
      'strong',
      null,
      'Raw event data'
    );

    rawLabel.className = 'net-raw-label';


    const raw = el('pre', 'net-raw');

    raw.id = 'netDetailRaw';


    const blockButton = el(
      'button',
      'primary',
      'Block the connection'
    );

    blockButton.type = 'button';

    blockButton.id = 'blockConnectionButton';

    blockButton.style.background = '#b91c1c';

    blockButton.style.color = '#ffffff';

    blockButton.style.marginTop = '15px';

    blockButton.onclick = blockSelectedConnection;


    body.append(
      name,
      status,
      fields,
      reasonLabel,
      reason,
      rawLabel,
      raw,
      blockButton
    );


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


/* ==========================================
   PROCESS DETAILS
========================================== */

function showProcessReason(row) {

  ensureSecurityUI();

  selectedProcessRow = row;

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
    `UID: ${row.uid ?? '—'} | ` +
    `Event: ${row.event || '—'} | ` +
    `Time: ${fmtTime(row.time)}`;

  const button = $('killProcessButton');

  button.disabled = false;

  button.textContent = 'Kill the process';

  openModal(reasonModal);

}


/* ==========================================
   NETWORK DETAILS
========================================== */

function showNetworkDetails(row) {

  ensureSecurityUI();

  selectedNetworkRow = row;

  const status = verdictOf(row);

  const target =
    row.port !== '—' && row.port != null
      ? `${row.dest}:${row.port}`
      : row.dest;

  $('netDetailName').textContent =
    `${row.process || 'unknown'} → ${target}`;

  $('netDetailStatus').textContent =
    `Status: ${status.toUpperCase()}`;

  $('netDetailStatus').className =
    `reason-status ${status}`;


  const fullTime = new Date(row.time);

  const fields = [

    [
      'Time',
      isNaN(fullTime)
        ? String(row.time)
        : fullTime.toLocaleString([], {
            hour12: false
          })
    ],

    ['Hostname', getSystem(row.system_id)?.name || '—'],

    ['Host ID', row.system_id || '—'],

    ['Process', row.process || '—'],

    ['PID', row.pid ?? '—'],

    ['Protocol', row.transportProtocol || '—'],

    ['Address family', row.family || '—'],

    ['Destination IP', row.dest || '—'],

    ['Destination port', row.port ?? '—'],

    ['Event ID', row.id || '—']

  ];


  const box = $('netDetailFields');

  box.textContent = '';

  fields.forEach(([key, value]) => {

    box.append(
      el('dt', null, key),
      el('dd', null, value)
    );

  });


  $('netDetailReason').textContent =
    row.reason || 'No reason provided by the backend.';

  $('netDetailRaw').textContent =
    row.raw
      ? JSON.stringify(row.raw, null, 2)
      : 'No raw data available.';


  const blockButton = $('blockConnectionButton');

  blockButton.disabled = false;

  blockButton.textContent = 'Block the connection';

  openModal(netModal);

}


/* ==========================================
   ACTION 1: KILL PROCESS
========================================== */

async function killSelectedProcess() {

  const row = selectedProcessRow;

  if (!row) {
    alert('No process selected.');
    return;
  }

  const system = getSystem(row.system_id);

  if (!system) {
    alert('Target system not found.');
    return;
  }

  const pid = Number(row.pid);

  if (!Number.isSafeInteger(pid) || pid <= 1) {
    alert('Invalid process ID.');
    return;
  }

  if (
    row.uid == null ||
    row.start_time_ticks == null
  ) {
    alert(
      'Process identity metadata is missing. ' +
      'The backend must receive UID and process start-time ticks ' +
      'before allowing termination.'
    );
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to terminate ` +
    `${row.name} (PID ${pid}) on ${system.name}?`
  );

  if (!confirmed) return;

  const button = $('killProcessButton');

  button.disabled = true;

  button.textContent = 'Terminating...';

  try {

    const result = await postAction(
      API.killProcess,
      {
        action: 'kill_process',

        hostname: system.name,

        host_id: system.host_id,

        pid,

        ppid: Number(row.ppid),

        uid: Number(row.uid),

        start_time_ticks: Number(row.start_time_ticks),

        event_id: row.id
      }
    );


    // Remove the process log only after confirmed success.

    procRows = procRows.filter(
      item => item.id !== row.id
    );

    selectedProcessRow = null;


    closeModal(reasonModal);

    renderStats();

    renderFloor();

    renderTally();

    if (openId) {
      drawDetail();
    }

    alert(
      result.message ||
      'Process terminated successfully.'
    );

  } catch (error) {

    console.error(
      '[Prahari] Kill process failed:',
      error
    );

    alert(
      'Failed to terminate process: ' + error.message
    );

    button.disabled = false;

    button.textContent = 'Kill the process';

  }

}


/* ==========================================
   ACTION 2: BLOCK NETWORK CONNECTION
========================================== */

async function blockSelectedConnection() {

  const row = selectedNetworkRow;

  if (!row) {
    alert('No network connection selected.');
    return;
  }

  const system = getSystem(row.system_id);

  if (!system) {
    alert('Target system not found.');
    return;
  }

  if (!row.dest || row.dest === '—') {
    alert('Invalid destination IP.');
    return;
  }

  const port = Number(row.port);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    alert('Invalid destination port.');
    return;
  }

  const protocol = String(
    row.transportProtocol || ''
  ).toLowerCase();

  if (protocol !== 'tcp') {
    alert(
      'The current firewall script supports TCP only. ' +
      'This connection cannot be blocked using that script.'
    );
    return;
  }

  const confirmed = confirm(
    `Block outgoing TCP connection to ` +
    `${row.dest}:${port} on ${system.name}?`
  );

  if (!confirmed) return;

  const button = $('blockConnectionButton');

  button.disabled = true;

  button.textContent = 'Blocking...';

  try {

    const result = await postAction(
      API.blockConnection,
      {
        action: 'block_connection',

        hostname: system.name,

        host_id: system.host_id,

        pid: Number(row.pid),

        destination_ip: row.dest,

        destination_port: port,

        protocol,

        family: row.family || null,

        event_id: row.id
      }
    );


    selectedNetworkRow = null;

    closeModal(netModal);

    alert(
      result.message ||
      'Network connection blocked successfully.'
    );

  } catch (error) {

    console.error(
      '[Prahari] Block connection failed:',
      error
    );

    alert(
      'Failed to block connection: ' + error.message
    );

    button.disabled = false;

    button.textContent = 'Block the connection';

  }

}


/* ==========================================
   ACTION 3: FREEZE SYSTEM DEMO (/freeze_demo)
   Posts the hostname + host_id that are bound
   to the clicked computer tile.
========================================== */

async function freezeSystem(systemId, button) {

  const system = getSystem(systemId);

  if (!system) {
    alert('System not found.');
    return;
  }

  if (system.status === 'disconnected') {
    alert('Cannot send action to a disconnected system.');
    return;
  }

  // hostname / host_id stored with this visual computer
  const tileEl = tiles.get(systemId);

  const hostname = tileEl?.dataset.hostname || system.name;

  const hostId = tileEl?.dataset.hostId || system.host_id;

  if (!hostname || !hostId) {
    alert('Hostname or Host ID missing for this system.');
    return;
  }

  const confirmed = confirm(
    `Freeze ${hostname} for 10 seconds?`
  );

  if (!confirmed) return;

  button.disabled = true;

  button.textContent = 'Starting...';

  let timer = null;

  try {

    const result = await postAction(
      API.freezeSystem,
      {
        action: 'freeze_demo',

        hostname: hostname,

        host_id: hostId
      }
    );

    // The freeze lasts 10 seconds; keep the button locked meanwhile.

    let left = 10;

    button.textContent = `Frozen (${left}s)`;

    timer = setInterval(() => {

      left--;

      if (left <= 0) {

        clearInterval(timer);

        button.disabled =
          system.status === 'disconnected';

        button.textContent = 'Freeze the system';

        return;
      }

      button.textContent = `Frozen (${left}s)`;

    }, 1000);

    alert(
      result.message ||
      'Freeze demonstration started.'
    );

  } catch (error) {

    console.error(
      '[Prahari] Freeze demo failed:',
      error
    );

    alert(
      'Freeze demonstration failed: ' + error.message
    );

    if (timer) clearInterval(timer);

    button.disabled = false;

    button.textContent = 'Freeze the system';

  }

}


/* ==========================================
   UNSAFE PROCESS ALERT
========================================== */

function showUnsafeAlert(row) {

  ensureSecurityUI();

  const alertBox = el('section', 'security-alert');

  alertBox.setAttribute('role', 'alert');

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

  const details = el(
    'button',
    'security-alert-details',
    'View details'
  );

  details.type = 'button';

  details.onclick = () => showProcessReason(row);

  const dismiss = el(
    'button',
    'security-alert-close',
    'Dismiss'
  );

  dismiss.type = 'button';

  dismiss.onclick = () => alertBox.remove();

  alertBox.append(
    heading,
    description,
    reason,
    details,
    dismiss
  );

  alertHost.prepend(alertBox);

  window.setTimeout(() => alertBox.remove(), 10000);

}


/* ==========================================
   DASHBOARD STATISTICS
========================================== */

function renderStats() {

  const count = status =>
    systems.filter(
      system => system.status === status
    ).length;

  $('nTotal').textContent =
    systems.length - count('disconnected');

  $('nUse').textContent =
    count('in_use');

  $('nOff').textContent =
    count('disconnected');

  $('nBad').textContent =
    count('damaged');

}


/* ==========================================
   ADMIN PROFILE
========================================== */

function renderAdmin(profile = {}) {

  $('aName').textContent =
    profile.name || 'Admin';

  $('aRole').textContent =
    profile.role || '';

  $('avatar').textContent =
    (profile.name || 'A')
      .trim()
      .charAt(0)
      .toUpperCase();

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


/* ==========================================
   VERDICT COUNTS
========================================== */

function verdictCounts() {

  const ids = new Set(
    systems.map(system => system.id)
  );

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


/* ==========================================
   TALLY
========================================== */

function fillTally(box, counts) {

  const total = Math.max(
    1,
    VERDICTS.reduce(
      (sum, verdict) =>
        sum + (counts[verdict] || 0),
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

  fillTally(
    $('tally'),
    verdictCounts()
  );

}


/* ==========================================
   SUMMARY WINDOW
========================================== */

function computeSummary() {

  const count = status =>
    systems.filter(
      system => system.status === status
    ).length;

  const ids = new Set(
    systems.map(system => system.id)
  );

  const processes = procRows.filter(
    row => ids.has(row.system_id)
  );

  const connections = netRows.filter(
    row => ids.has(row.system_id)
  );

  const times = processes
    .concat(connections)
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

    last_seen: times.length
      ? Math.max(...times)
      : null

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

  fillTally(
    $('sumTally'),
    data.verdicts || {}
  );

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

    renderSummary(
      await getJSON(API.summary)
    );

  } catch (error) {

    console.warn(
      '[Prahari] Summary API unavailable:',
      error
    );

  }

}


$('openSummary').onclick = openSummary;


$('sumAdd').onclick = () => {

  closeModal($('sumModal'));

  resetConnect();

  openModal($('connectModal'));

};


/* ==========================================
   COMPUTER TILES
========================================== */

function buildTile(system) {

  const wrapper = el('div', 'system-unit');

  wrapper.style.display = 'flex';

  wrapper.style.flexDirection = 'column';

  wrapper.style.alignItems = 'center';

  wrapper.style.gap = '10px';

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

  tilt.append(
    bezel,
    el('div', 'neck'),
    el('div', 'foot')
  );

  button.append(
    tilt,
    el('span', 'mname')
  );

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


  // FREEZE SYSTEM BUTTON

  const freezeButton = el(
    'button',
    'freeze-system-btn',
    'Freeze the system'
  );

  freezeButton.type = 'button';

  freezeButton.style.background = '#92400e';

  freezeButton.style.color = '#ffffff';

  freezeButton.style.border = 'none';

  freezeButton.style.borderRadius = '6px';

  freezeButton.style.padding = '9px 14px';

  freezeButton.style.cursor = 'pointer';

  freezeButton.onclick = event => {

    event.stopPropagation();

    freezeSystem(system.id, freezeButton);

  };


  wrapper.append(button, freezeButton);

  return wrapper;

}


function renderFloor() {

  const floor = $('floor');

  const keep = new Set(
    systems.map(system => system.id)
  );

  tiles.forEach((wrapper, id) => {

    if (!keep.has(id)) {

      wrapper.remove();

      tiles.delete(id);

    }

  });

  systems.forEach(system => {

    let wrapper = tiles.get(system.id);

    if (!wrapper) {

      wrapper = buildTile(system);

      tiles.set(system.id, wrapper);

    }

    wrapper.dataset.id = system.id;

    // hostname + host_id stored with this visual computer
    wrapper.dataset.hostname = system.name;

    wrapper.dataset.hostId = system.host_id;

    const tile = wrapper.querySelector('.mon');

    tile.dataset.id = system.id;

    tile.className =
      'mon ' +
      (
        system.status === 'in_use'
          ? ''
          : system.status === 'idle'
            ? 'idle'
            : system.status
      );

    tile.setAttribute(
      'aria-label',
      'Open ' + system.name + ' logs'
    );

    tile.querySelector('.mname').textContent =
      system.name;

    const freezeButton =
      wrapper.querySelector('.freeze-system-btn');

    // Don't override the button while the 10-second freeze countdown runs.
    if (!freezeButton.textContent.startsWith('Frozen')) {

      freezeButton.disabled =
        system.status === 'disconnected';

    }

    floor.appendChild(wrapper);

    drawScreen(
      tile.querySelector('.screen'),
      system
    );

  });

  floor.appendChild(addTile());

}


/* ==========================================
   ADD SYSTEM TILE
========================================== */

let addEl;

function addTile() {

  if (addEl) return addEl;

  addEl = el('button', 'mon add');

  addEl.type = 'button';

  const tilt = el('div', 'tilt');

  const bezel = el('div', 'bezel');

  const screen = el('div', 'screen');

  screen.appendChild(
    el('span', 'plus', '+')
  );

  const bar = el('div', 'case-bar');

  bar.append(
    el('i', 'led'),
    el('span', 'slot')
  );

  bezel.append(screen, bar);

  tilt.append(
    bezel,
    el('div', 'neck'),
    el('div', 'foot')
  );

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


/* ==========================================
   DRAW SYSTEM MONITOR
========================================== */

function drawScreen(screen, system) {

  const rows = logsOf(
    procRows,
    system.id
  ).slice(0, 8);

  const signature =
    system.status + '|' +
    rows.map(row =>
      row.pid +
      cmdOf(row) +
      verdictOf(row)
    ).join(',');

  if (screen.dataset.sig === signature) {
    return;
  }

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

    const line = el(
      'div',
      'ln ' + verdictOf(row)
    );

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


/* ==========================================
   SYSTEM DETAILS WINDOW
========================================== */

function openSystem(id) {

  openId = id;

  tab = 'proc';

  vfilter = 'all';

  const system = getSystem(id);

  $('sTitle').textContent =
    (system ? system.name : id) +
    (
      system
        ? ' — ' + (
            STATUS[system.status] || system.status
          )
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
    tab === 'proc'
      ? procRows
      : netRows,
    openId
  );

  const counts = {
    all: rows.length,
    safe: 0,
    unsafe: 0,
    unknown: 0,
    partial: 0
  };

  rows.forEach(row => {
    counts[verdictOf(row)]++;
  });

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
    ? [
        'Time',
        'PID',
        'Process',
        'Command',
        'Verdict'
      ]
    : [
        'Time',
        'Proto',
        'Destination',
        'Port',
        'PID',
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

      tr.appendChild(
        el('td', 'nw', row.pid)
      );

      const processCell = el('td', 'nw');

      const processLink = el(
        'button',
        'process-name-link',
        row.name || 'unknown'
      );

      processLink.type = 'button';

      processLink.title =
        'View process status and reason';

      processLink.onclick = () =>
        showProcessReason(row);

      processCell.appendChild(processLink);

      tr.appendChild(processCell);

      tr.appendChild(
        el('td', 'cmd', row.cmd || row.name)
      );

    } else {

      tr.appendChild(
        el('td', 'nw', row.proto || '—')
      );

      tr.appendChild(
        el('td', 'nw', row.dest)
      );

      tr.appendChild(
        el('td', 'nw', row.port)
      );

      tr.appendChild(
        el('td', 'nw', row.pid ?? '—')
      );

      tr.appendChild(
        el('td', 'nw', row.process || '—')
      );

      tr.classList.add('row-click');

      tr.tabIndex = 0;

      tr.title = 'View connection details';

      tr.onclick = () =>
        showNetworkDetails(row);

      tr.onkeydown = event => {

        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {

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


/* ==========================================
   SYSTEM TABS
========================================== */

document.querySelectorAll('.tab').forEach(button => {

  button.onclick = () => {

    tab = button.dataset.tab;

    vfilter = 'all';

    document.querySelectorAll('.tab').forEach(item => {

      item.classList.toggle(
        'on',
        item === button
      );

    });

    drawDetail();

  };

});


/* ==========================================
   MODALS
========================================== */

let lastFocus;

function openModal(modal) {

  lastFocus = document.activeElement;

  modal.hidden = false;

  const focusTarget =
    modal.querySelector('input,.x');

  if (focusTarget) {
    focusTarget.focus();
  }

}


function closeModal(modal) {

  modal.hidden = true;

  if (modal.id === 'sysModal') {
    openId = null;
  }

  if (modal.id === 'processReasonModal') {
    selectedProcessRow = null;
  }

  if (modal.id === 'networkDetailModal') {
    selectedNetworkRow = null;
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


/* ==========================================
   CONNECT SYSTEM
========================================== */

function resetConnect() {

  $('sysName').value = '';

  $('cErr').hidden = true;

}


$('makeCmd').onclick = () => {

  const name = $('sysName').value.trim();

  const error = $('cErr');

  error.hidden = true;

  if (!name) {

    error.textContent =
      'Enter a name for the system.';

    error.hidden = false;

    return;

  }

  closeModal($('connectModal'));

  openModal($('adminContactModal'));

};


/* ==========================================
   LIVE STATUS
========================================== */

function setLive(ok) {

  const live = $('live');

  live.textContent = demo
    ? 'Demo system / API mode'
    : ok
      ? 'Live'
      : 'Reconnecting';

  live.classList.toggle(
    'down',
    demo || !ok
  );

}


/* ==========================================
   SYSTEM IDENTIFICATION
   hostname + host_id arrive with every batch and
   are stored on the system object (and later on
   its computer tile).
========================================== */

function getOrCreateSystem(hostname, hostId) {

  if (!hostname || !hostId) {

    throw new Error(
      'Batch is missing hostname or host_id'
    );

  }

  const id = String(hostId);

  const name = String(hostname);

  let system = systems.find(
    item => item.id === id
  );

  if (!system) {

    system = {

      id,

      host_id: id,

      name,

      status: 'in_use'

    };

    systems.push(system);

  } else {

    system.name = name;

    system.host_id = id;

    system.status = 'in_use';

  }

  return id;

}


/* ==========================================
   EVENT NORMALIZATION
========================================== */

function parseBatchLog(item, kind) {

  try {

    const payload =
      typeof item === 'string'
        ? JSON.parse(item)
        : item;

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      throw new Error('Invalid event payload');
    }

    return payload;

  } catch (error) {

    console.error(
      `[Prahari] Invalid ${kind} log:`,
      error,
      item
    );

    throw error;

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
        value < 1e12
          ? value * 1000
          : value
      ).toISOString()
    : new Date().toISOString();

}


function normalizedVerdict(payload) {

  const value = String(
    payload.status ||
    payload.verdict ||
    ''
  ).toLowerCase();

  if (VERDICTS.includes(value)) {
    return value;
  }

  if (value === 'blocked') {
    return 'unsafe';
  }

  if (value === 'allowed') {
    return 'safe';
  }

  return 'unknown';

}


/* ==========================================
   PROCESS LOGS
========================================== */

function processProcessLogs(batch, systemId) {

  if (!Array.isArray(batch.process_logs)) {

    throw new Error(
      'process_logs must be an array'
    );

  }

  batch.process_logs.forEach((item, index) => {

    const eventId =
      `${systemId}:${batch.batch_id}:process:${index}`;

    if (seenEventIds.has(eventId)) {
      return;
    }

    const payload =
      parseBatchLog(item, 'process');

    const status =
      normalizedVerdict(payload);

    const name = String(
      payload.comm ||
      payload.name ||
      'unknown'
    );

    const row = {

      id: eventId,

      time: eventTimestamp(payload),

      system_id: systemId,

      pid: payload.pid ?? '—',

      ppid: payload.ppid ?? '—',

      uid: payload.uid ?? null,

      start_time_ticks:
        payload.start_time_ticks ??
        payload.start_ticks ??
        null,

      name,

      cmd: String(
        payload.cmd || name
      ),

      event: String(
        payload.event || 'PROCESS_EXEC_ATTEMPT'
      ),

      verdict: status,

      reason: String(
        payload.reason ||
        'No reason provided by the backend.'
      )

    };

    procRows.push(row);

    if (status === 'unsafe') {
      showUnsafeAlert(row);
    }

    rememberEventId(eventId);

  });

  procRows.sort(byTime);

  if (procRows.length > 2000) {
    procRows = procRows.slice(0, 2000);
  }

}


/* ==========================================
   NETWORK LOGS
========================================== */

function processNetworkLogs(batch, systemId) {

  if (!Array.isArray(batch.network_logs)) {

    throw new Error(
      'network_logs must be an array'
    );

  }

  batch.network_logs.forEach((item, index) => {

    const eventId =
      `${systemId}:${batch.batch_id}:network:${index}`;

    if (seenEventIds.has(eventId)) {
      return;
    }

    const payload =
      parseBatchLog(item, 'network');

    const row = {

      id: eventId,

      time: eventTimestamp(payload),

      system_id: systemId,

      proto: String(
        payload.protocol ||
        payload.family ||
        '—'
      ),

      transportProtocol: String(
        payload.transport_protocol ||
        payload.l4_protocol ||
        (
          ['tcp', 'udp'].includes(
            String(payload.protocol || '').toLowerCase()
          )
            ? payload.protocol
            : ''
        )
      ).toLowerCase(),

      family: String(
        payload.family ||
        '—'
      ),

      dest: String(
        payload.destination_ip ||
        payload.dest ||
        payload.remote_ip ||
        '—'
      ),

      port:
        payload.destination_port ??
        payload.port ??
        '—',

      process: String(
        payload.comm ||
        payload.process ||
        payload.name ||
        '—'
      ),

      pid: payload.pid ?? '—',

      verdict: normalizedVerdict(payload),

      reason: String(
        payload.reason ||
        'No reason provided by the backend.'
      ),

      raw: payload

    };

    netRows.push(row);

    rememberEventId(eventId);

  });

  netRows.sort(byTime);

  if (netRows.length > 2000) {
    netRows = netRows.slice(0, 2000);
  }

}


/* ==========================================
   COMPLETE BATCH PROCESSOR
========================================== */

function processCompleteBatch(batch) {

  if (
    !batch ||
    typeof batch !== 'object'
  ) {
    throw new Error('Invalid batch received');
  }

  if (!batch.batch_id) {

    throw new Error(
      'Batch is missing batch_id'
    );

  }

  const systemId = getOrCreateSystem(
    batch.hostname,
    batch.host_id
  );

  processProcessLogs(
    batch,
    systemId
  );

  processNetworkLogs(
    batch,
    systemId
  );

  console.log(
    `[Prahari] Batch processed | ` +
    `Hostname: ${batch.hostname} | ` +
    `Host ID: ${batch.host_id} | ` +
    `Process: ${batch.process_count} | ` +
    `Network: ${batch.network_count}`
  );

}


/* ==========================================
   ACKNOWLEDGE COMPLETE BATCH
========================================== */

async function acknowledgeBatch(redisId) {

  const response = await getJSON(
    API.eventsAck,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        redis_id: redisId
      })
    }
  );

  if (
    response.success !== true ||
    response.acknowledged !== true
  ) {
    throw new Error(
      'Batch acknowledgement was unsuccessful'
    );
  }

  console.log(
    `[Prahari] Batch acknowledged and deleted: ${redisId}`
  );

}


/* ==========================================
   WEBSOCKET CLIENT
========================================== */

let praHariSocket = null;

let reconnectDelay = 1000;

const MAX_RECONNECT_DELAY = 10000;

let reconnectTimer = null;

let reconnectScheduled = false;

let incomingBatchQueue = [];

let renderScheduled = false;


/* ==========================================
   INCOMING BATCH
========================================== */

function handleIncomingBatch(message) {

  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type !== 'batch') {
    return;
  }

  if (!message.batch) {

    console.warn(
      '[Prahari WS] Empty batch received'
    );

    return;

  }

  incomingBatchQueue.push(message.batch);

  scheduleBatchRendering();

}


/* ==========================================
   BATCH RENDER SCHEDULER
========================================== */

function scheduleBatchRendering() {

  if (renderScheduled) {
    return;
  }

  renderScheduled = true;

  requestAnimationFrame(() => {

    renderScheduled = false;

    if (incomingBatchQueue.length === 0) {
      return;
    }

    const batches = incomingBatchQueue.splice(
      0,
      incomingBatchQueue.length
    );

    let processed = 0;

    for (const batch of batches) {

      try {

        processCompleteBatch(batch);

        processed++;

      } catch (error) {

        console.error(
          '[Prahari WS] Batch processing failed:',
          error,
          batch
        );

      }

    }

    if (processed > 0) {

      demo = false;

      first = false;

      renderStats();

      renderFloor();

      renderTally();

      if (openId) {
        drawDetail();
      }

      console.log(
        `[Prahari WS] Rendered ${processed} batch(es)`
      );

    }

    if (incomingBatchQueue.length > 0) {
      scheduleBatchRendering();
    }

  });

}


/* ==========================================
   CONNECT WEBSOCKET
========================================== */

function connectPrahariWebSocket() {

  if (
    praHariSocket &&
    (
      praHariSocket.readyState === WebSocket.OPEN ||
      praHariSocket.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }

  const protocol =
    location.protocol === 'https:' ? 'wss:' : 'ws:';

  const wsURL =
    `${protocol}//${location.host}/ws`;

  console.log(
    '[Prahari WS] Connecting:',
    wsURL
  );

  const socket = new WebSocket(wsURL);

  praHariSocket = socket;


  /* ---------- CONNECTION OPEN ---------- */

  socket.onopen = () => {

    if (praHariSocket !== socket) {
      return;
    }

    console.log(
      '[Prahari WS] Connected successfully'
    );

    reconnectDelay = 1000;

    reconnectScheduled = false;

    demo = false;

    setLive(true);

  };


  /* ---------- RECEIVE MESSAGE ---------- */

  socket.onmessage = event => {

    if (praHariSocket !== socket) {
      return;
    }

    try {

      const message = JSON.parse(event.data);

      handleIncomingBatch(message);

    } catch (error) {

      console.error(
        '[Prahari WS] Invalid message received:',
        error
      );

    }

  };


  /* ---------- CONNECTION ERROR ---------- */

  socket.onerror = error => {

    console.error(
      '[Prahari WS] Connection error:',
      error
    );

  };


  /* ---------- CONNECTION CLOSED ---------- */

  socket.onclose = event => {

    if (praHariSocket !== socket) {
      return;
    }

    console.warn(
      '[Prahari WS] Disconnected:',
      event.code,
      event.reason
    );

    praHariSocket = null;

    setLive(false);

    scheduleReconnect();

  };

}


/* ==========================================
   RECONNECTION
========================================== */

function scheduleReconnect() {

  if (reconnectScheduled) {
    return;
  }

  reconnectScheduled = true;

  const delay = reconnectDelay;

  console.log(
    `[Prahari WS] Reconnecting in ${delay}ms`
  );

  reconnectTimer = setTimeout(() => {

    reconnectScheduled = false;

    connectPrahariWebSocket();

  }, delay);

  reconnectDelay = Math.min(
    reconnectDelay * 2,
    MAX_RECONNECT_DELAY
  );

}


/* ==========================================
   START DASHBOARD
========================================== */

ensureSecurityUI();

renderAdmin();

connectPrahariWebSocket();
