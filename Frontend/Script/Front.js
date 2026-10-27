/* ===== Backend endpoints (change to match your server) =====
 GET  /api/dashboard        -> { profile:{name,email,role,org,joined}, systems:[{id,name,status}] }
                               status: "in_use" | "idle" | "disconnected" | "damaged"
 GET  /api/logs/process     -> [{ time, system_id, pid, name, cmd, verdict }]   cmd = full command line (optional, falls back to name)
 GET  /api/logs/network     -> [{ time, system_id, proto, dest, port, process, verdict }]   proto, process optional
                               verdict: "safe" | "unsafe" | "unknown" | "partial"
                               (network rows with old "status": allowed/blocked also work)
 POST /api/systems/connect  -> body {name}  returns {token, command}   (Add a system)
 GET  /api/summary          -> { total, in_use, idle, disconnected, damaged,
                                 verdicts:{safe,unsafe,unknown,partial}, processes, connections, last_seen }
                               (if this call fails, the summary is calculated from the data already on the page)
*/
const BASE = '';   // backend address, e.g. 'https://api.yourdomain.com' (leave '' if the backend is on the same site)
const API = { dash:'/api/dashboard', proc:'/api/logs/process', net:'/api/logs/network', connect:'/api/systems/connect', summary:'/api/summary' };
const POLL_MS = 5000, VERDICTS = ['safe','unsafe','unknown','partial'];
const $ = id => document.getElementById(id);
let systems = [], procRows = [], netRows = [], first = true, demo = false;
let openId = null, tab = 'proc', vfilter = 'all';
const tiles = new Map();

/* ---------- helpers ---------- */
async function getJSON(url, opts){
  const r = await fetch(BASE + url, Object.assign({credentials: BASE ? 'include' : 'same-origin'}, opts));
  if(!r.ok) throw new Error(r.status);
  return r.json();
}
const el = (tag, cls, text) => { const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }; // textContent only: logs can contain hostile strings
const verdictOf = r => VERDICTS.includes(r.verdict) ? r.verdict : r.status==='blocked' ? 'unsafe' : r.status==='allowed' ? 'safe' : 'unknown';
const cmdOf = r => r.cmd || r.name || '';
const STATUS = {in_use:'In use', idle:'Idle', disconnected:'Disconnected', damaged:'Damaged'};
const fmtTime = t => { const d=new Date(t); return isNaN(d) ? String(t) : d.toLocaleTimeString([], {hour12:false}); };
const byTime = (a,b) => new Date(b.time) - new Date(a.time);
const logsOf = (rows, id) => rows.filter(r => r.system_id === id).sort(byTime);

/* ---------- stats + admin ---------- */
function renderStats(){
  const c = s => systems.filter(x=>x.status===s).length;
  $('nTotal').textContent = systems.length - c('disconnected');
  $('nUse').textContent = c('in_use'); $('nOff').textContent = c('disconnected'); $('nBad').textContent = c('damaged');
}
function renderAdmin(p){
  p = p || {};
  $('aName').textContent = p.name || 'Admin';
  $('aRole').textContent = p.role || '';
  $('avatar').textContent = (p.name || 'A').trim().charAt(0).toUpperCase();
  const dl = $('aData'); dl.textContent = '';
  [['Email',p.email],['Organization',p.org],['Joined',p.joined]].forEach(([k,v]) => dl.append(el('dt',null,k), el('dd',null,v||'—')));
}
function verdictCounts(){
  const ids = new Set(systems.map(x=>x.id)), n = {safe:0,unsafe:0,unknown:0,partial:0};
  procRows.concat(netRows).forEach(r => { if(ids.has(r.system_id)) n[verdictOf(r)]++; });
  return n;
}
function fillTally(box, n){
  const total = Math.max(1, VERDICTS.reduce((a,v)=>a+(n[v]||0), 0));
  if(!box.children.length) VERDICTS.forEach(v => {
    const row = el('div','t '+v); row.append(el('span',null,v), el('div','tr'), el('em',null,'0'));
    row.children[1].appendChild(el('i')); box.appendChild(row);
  });
  VERDICTS.forEach((v,i) => { const row=box.children[i]; row.querySelector('i').style.width=((n[v]||0)/total*100)+'%'; row.querySelector('em').textContent=n[v]||0; });
}
function renderTally(){ fillTally($('tally'), verdictCounts()); }

/* ---------- summary window ---------- */
function computeSummary(){
  const c = k => systems.filter(x=>x.status===k).length, ids = new Set(systems.map(x=>x.id));
  const p = procRows.filter(r=>ids.has(r.system_id)), n = netRows.filter(r=>ids.has(r.system_id));
  const times = p.concat(n).map(r=>new Date(r.time).getTime()).filter(t=>!isNaN(t));
  return {total:systems.length, in_use:c('in_use'), idle:c('idle'), disconnected:c('disconnected'), damaged:c('damaged'),
          verdicts:verdictCounts(), processes:p.length, connections:n.length, last_seen: times.length ? Math.max.apply(null,times) : null};
}
function renderSummary(d){
  const num = v => Number(v) || 0, tot = num(d.total), off = num(d.disconnected);
  const figs = $('sumFigs'); figs.textContent = '';
  [['Total systems',tot,'c'],['Connected',tot-off,'c'],['In use',num(d.in_use),'g'],['Idle',num(d.idle),'i'],['Disconnected',off,'m'],['Damaged',num(d.damaged),'r']]
    .forEach(([k,v,c]) => { const f=el('div','fig '+c); f.append(el('b',null,v), el('span',null,k)); figs.appendChild(f); });
  fillTally($('sumTally'), d.verdicts || {});
  const meta = $('sumMeta'); meta.textContent = '';
  [['Process records',num(d.processes)],['Network records',num(d.connections)],['Last activity', d.last_seen ? new Date(d.last_seen).toLocaleString() : '—']]
    .forEach(([k,v]) => meta.append(el('dt',null,k), el('dd',null,v)));
}
async function openSummary(){
  renderSummary(computeSummary()); openModal($('sumModal'));        // instant, from data already loaded
  try{ renderSummary(await getJSON(API.summary)); }catch(e){ /* keep the local summary */ }
}
$('openSummary').onclick = openSummary;
$('sumAdd').onclick = () => { closeModal($('sumModal')); resetConnect(); openModal($('connectModal')); };

/* ---------- monitor tiles (one per connected system, no list) ---------- */
function buildTile(s){
  const b = el('button','mon'); b.type='button';
  const tilt = el('div','tilt'), bez = el('div','bezel'), scr = el('div','screen');
  const bar = el('div','case-bar'); bar.append(el('i','led'), el('span','slot'), el('span','slot'));
  bez.append(scr, bar); tilt.append(bez, el('div','neck'), el('div','foot'));
  b.append(tilt, el('span','mname'));
  b.addEventListener('click', () => openSystem(b.dataset.id));
  b.addEventListener('mousemove', e => {
    const r=b.getBoundingClientRect();
    tilt.style.setProperty('--ry', ((e.clientX-r.left)/r.width-.5)*14+'deg');
    tilt.style.setProperty('--rx', (.5-(e.clientY-r.top)/r.height)*10+'deg');
  });
  b.addEventListener('mouseleave', () => { tilt.style.setProperty('--rx','0deg'); tilt.style.setProperty('--ry','0deg'); });
  return b;
}
function renderFloor(){
  const floor = $('floor'), keep = new Set(systems.map(s=>s.id));
  tiles.forEach((t,id) => { if(!keep.has(id)){ t.remove(); tiles.delete(id); } });
  systems.forEach(s => {
    let t = tiles.get(s.id);
    if(!t){ t = buildTile(s); tiles.set(s.id, t); }
    t.dataset.id = s.id;
    t.className = 'mon ' + (s.status==='in_use' ? '' : s.status==='idle' ? 'idle' : s.status);
    t.setAttribute('aria-label', 'Open ' + s.name + ' logs');
    t.querySelector('.mname').textContent = s.name;
    floor.appendChild(t);                         // keeps order stable
    drawScreen(t.querySelector('.screen'), s);
  });
  floor.appendChild(addTile());
}
let addEl;
function addTile(){
  if(addEl) return addEl;
  addEl = el('button','mon add'); addEl.type='button';
  const tilt=el('div','tilt'), bez=el('div','bezel'), scr=el('div','screen');
  scr.appendChild(el('span','plus','+'));
  const bar = el('div','case-bar'); bar.append(el('i','led'), el('span','slot'));
  bez.append(scr, bar); tilt.append(bez, el('div','neck'), el('div','foot'));
  addEl.append(tilt, el('span','mname','Connect a system'));
  addEl.onclick = () => { resetConnect(); openModal($('connectModal')); };
  return addEl;
}
function drawScreen(scr, s){
  const rows = logsOf(procRows, s.id).slice(0,8);
  const sig = s.status + '|' + rows.map(r=>r.pid+cmdOf(r)+verdictOf(r)).join(',');
  if(scr.dataset.sig === sig) return;
  const prev = scr.dataset.top; scr.dataset.sig = sig; scr.textContent = '';
  if(s.status==='disconnected' || s.status==='damaged'){
    scr.appendChild(el('div','off-msg', s.status==='damaged' ? 'SYSTEM FAULT' : 'NO SIGNAL')); }
  rows.forEach((r,i) => {
    const ln = el('div','ln '+verdictOf(r)); ln.append(el('i'), el('span',null,cmdOf(r)));
    if(!first && i===0 && prev !== r.pid+cmdOf(r)) ln.classList.add('fresh');
    scr.appendChild(ln);
  });
  if(!rows.length && s.status!=='disconnected' && s.status!=='damaged') scr.appendChild(el('div','off-msg','AWAITING DATA'));
  scr.dataset.top = rows[0] ? rows[0].pid+cmdOf(rows[0]) : '';
}

/* ---------- system window ---------- */
function openSystem(id){
  openId = id; tab = 'proc'; vfilter = 'all';
  const s = systems.find(x=>x.id===id); $('sTitle').textContent = (s ? s.name : id) + (s ? ' — ' + (STATUS[s.status]||s.status) : '');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab===tab));
  drawDetail(); openModal($('sysModal'));
}
function drawDetail(){
  if(!openId) return;
  const rows = logsOf(tab==='proc' ? procRows : netRows, openId);
  const cnt = {all:rows.length, safe:0, unsafe:0, unknown:0, partial:0};
  rows.forEach(r => cnt[verdictOf(r)]++);
  const chips = $('chips'); chips.textContent = '';
  ['all'].concat(VERDICTS).forEach(v => {
    const b = el('button','chip '+(v==='all'?'':v)+(vfilter===v?' on':''), v+' · '+cnt[v]); b.type='button';
    b.onclick = () => { vfilter = v; drawDetail(); }; chips.appendChild(b);
  });
  const head = $('sHead'); head.textContent = '';
  const hr = el('tr'); (tab==='proc' ? ['Time','PID','Process','Command','Verdict'] : ['Time','Proto','Destination','Port','Process','Verdict']).forEach(h => hr.appendChild(el('th',null,h)));
  head.appendChild(hr);
  const body = $('sBody'); body.textContent = '';
  const shown = rows.filter(r => vfilter==='all' || verdictOf(r)===vfilter).slice(0,300);
  shown.forEach(r => {
    const tr = el('tr'), v = verdictOf(r);
    tr.appendChild(el('td','nw',fmtTime(r.time)));
    if(tab==='proc'){
      tr.appendChild(el('td','nw',r.pid)); tr.appendChild(el('td','nw',r.name));
      tr.appendChild(el('td','cmd',r.cmd || r.name));
    } else {
      tr.appendChild(el('td','nw',r.proto || '—')); tr.appendChild(el('td','nw',r.dest)); tr.appendChild(el('td','nw',r.port));
      tr.appendChild(el('td','nw',r.process || '—'));
    }
    const td = el('td'); td.appendChild(el('span','tag '+v, v)); tr.appendChild(td);
    body.appendChild(tr);
  });
  $('sEmpty').hidden = shown.length > 0;
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  tab = t.dataset.tab; vfilter = 'all';
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x===t)); drawDetail();
});

/* ---------- modals ---------- */
let lastFocus;
function openModal(m){ lastFocus=document.activeElement; m.hidden=false; const f=m.querySelector('input,.x'); f&&f.focus(); }
function closeModal(m){ m.hidden=true; if(m.id==='sysModal') openId=null; lastFocus&&lastFocus.focus&&lastFocus.focus(); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m || e.target.hasAttribute('data-close')) closeModal(m); }));
document.addEventListener('keydown', e => { if(e.key==='Escape') document.querySelectorAll('.modal:not([hidden])').forEach(closeModal); });

/* ---------- connect more systems ---------- */
function resetConnect(){ $('sysName').value=''; $('cmdBox').hidden=true; $('cErr').hidden=true; }
$('makeCmd').onclick = async () => {
  const name = $('sysName').value.trim(), err = $('cErr'); err.hidden = true;
  if(!name){ err.textContent='Enter a name for the system.'; err.hidden=false; return; }
  let res;
  try{ res = await getJSON(API.connect, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}); }
  catch(e){
    if(!demo){ err.textContent='Could not reach the server. Try again.'; err.hidden=false; return; }
    res = {command:'curl -sSL https://your-server/agent.sh | sudo bash -s -- --token DEMO-TOKEN-1234'};
  }
  $('cmdText').textContent = res.command; $('cmdBox').hidden = false; refresh();
};
$('copyCmd').onclick = async e => {
  try{ await navigator.clipboard.writeText($('cmdText').textContent); e.target.textContent='Copied'; setTimeout(()=>e.target.textContent='Copy command',1500); }catch(_){}
};

/* ---------- polling ---------- */
function setLive(ok){ const l=$('live'); l.textContent = demo ? 'Demo data' : ok ? 'Live' : 'Reconnecting'; l.classList.toggle('down', demo || !ok); }
async function refresh(){
  try{
    const [d,p,n] = await Promise.all([getJSON(API.dash), getJSON(API.proc), getJSON(API.net)]);
    systems = d.systems || []; procRows = p; netRows = n; renderAdmin(d.profile); demo = false; setLive(true);
  }catch(e){ if(first) loadDemo(); else { setLive(false); return; } }
  renderStats(); renderFloor(); renderTally(); drawDetail(); first = false;
}

/* ---------- demo data (only when backend is unreachable) ---------- */
function loadDemo(){
  demo = true; setLive(true);
  renderAdmin({name:'Admin User', role:'Security administrator', email:'admin@example.com', org:'Your organization', joined:'2026-10-01'});
  systems = [{id:'s1',name:'web-01',status:'in_use'}];
  const P = [['nginx','/usr/sbin/nginx -g daemon off; -c /etc/nginx/nginx.conf','safe'],
             ['postgres','/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main','safe'],
             ['.x9f$$a','/tmp/.x9f$$a --connect 185.220.101.4:4444 --hide','unsafe'],
             ['unknown_bin','/opt/unknown_bin -s -k 0x41','unknown'],
             ['python3','/usr/bin/python3 /home/dev/export.py --upload (unsigned script)','partial'],
             ['systemd','/usr/lib/systemd/systemd --user','safe'],
             ['kworker2','/dev/shm/kworker2 -o pool.example:3333 -u x','unsafe']];
  const N = [['tcp','10.0.0.12',443,'nginx','safe'],['tcp','185.220.101.4',4444,'.x9f$$a','unsafe'],['tcp','10.0.0.30',5432,'postgres','safe'],
             ['udp','203.0.113.9',8080,'python3','partial'],['tcp','198.51.100.7',9001,'unknown_bin','unknown']];
  const now = Date.now(); procRows = []; netRows = [];
  systems.forEach((s,i) => {
    P.forEach((p,k) => procRows.push({time:now-(k*7+i)*1000, system_id:s.id, pid:1000+i*100+k, name:p[0], cmd:p[1], verdict:p[2]}));
    N.forEach((n,k) => netRows.push({time:now-(k*9+i)*1000, system_id:s.id, proto:n[0], dest:n[1], port:n[2], process:n[3], verdict:n[4]}));
  });
}

refresh(); setInterval(refresh, POLL_MS);