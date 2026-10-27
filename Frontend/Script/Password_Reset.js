(function(){
  // ---------- Peer activity ticker content ----------
  const rooms = [
    {s:'Calc II', v:'12 peers', d:'up'}, {s:'Orgo Chem', v:'4 peers', d:'down'},
    {s:'Data Structures', v:'19 peers', d:'up'}, {s:'Spanish 201', v:'7 peers', d:'up'},
    {s:'Physics Lab', v:'3 peers', d:'down'}, {s:'Linear Algebra', v:'15 peers', d:'up'},
    {s:'Essay Writing', v:'6 peers', d:'up'}, {s:'Microecon', v:'9 peers', d:'down'},
    {s:'Flashcard Sprint', v:'22 peers', d:'up'}, {s:'Thesis Group', v:'2 peers', d:'up'}
  ];
  function buildTicker(el){
    let html = '';
    for (let i=0;i<3;i++){
      rooms.forEach(item=>{
        const arrow = item.d === 'up' ? '▲' : '▼';
        html += `<span>${item.s} <span class="${item.d}">${arrow} ${item.v}</span></span>`;
      });
    }
    el.innerHTML = html;
  }
  buildTicker(document.getElementById('tickerRow1'));

  // ---------- Elements ----------
  const pwInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const pwWrap = document.getElementById('pwWrap');
  const confirmWrap = document.getElementById('confirmWrap');
  const matchHint = document.getElementById('matchHint');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');
  const strengthValue = document.getElementById('strengthValue');
  const form = document.getElementById('resetForm');
  const successPanel = document.getElementById('successPanel');

  // ---------- Password visibility toggles ----------
  document.querySelectorAll('.toggle-vis').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = document.getElementById(btn.dataset.target);
      const isPw = target.type === 'password';
      target.type = isPw ? 'text' : 'password';
      btn.style.color = isPw ? 'var(--teal)' : '';
    });
  });

  // ---------- Strength scoring ----------
  function scorePassword(pw){
    const rules = {
      len: pw.length >= 8,
      case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
      num: /[0-9]/.test(pw),
      sym: /[^A-Za-z0-9]/.test(pw)
    };
    let score = 0;
    if (rules.len) score += 25;
    if (rules.case) score += 25;
    if (rules.num) score += 25;
    if (rules.sym) score += 25;
    if (pw.length > 8) score = Math.min(100, score + Math.min(10, pw.length - 8));
    return { score, rules };
  }

  // ---------- Canvas strength-trend chart ----------
  const canvas = document.getElementById('strengthChart');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let history = [0];

  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function colorForScore(score){
    if (score >= 75) return '#2f8f7c';
    if (score >= 50) return '#d98e3f';
    if (score > 0) return '#c9584f';
    return '#b7b2c8';
  }

  function drawChart(){
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0,0,w,h);

    ctx.strokeStyle = 'rgba(34,31,44,0.06)';
    ctx.lineWidth = 1;
    for(let gy=0; gy<=2; gy++){
      const y = (h/2)*gy;
      ctx.beginPath();
      ctx.moveTo(0,y+0.5);
      ctx.lineTo(w,y+0.5);
      ctx.stroke();
    }

    if (history.length < 2) return;

    const maxPoints = 40;
    const pts = history.slice(-maxPoints);
    const stepX = w / (maxPoints - 1);
    const startX = w - (pts.length - 1) * stepX;

    const currentScore = pts[pts.length-1];
    const lineColor = colorForScore(currentScore);

    ctx.beginPath();
    pts.forEach((val,i)=>{
      const x = startX + i*stepX;
      const y = h - (val/100)*h*0.85 - 3;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.lineTo(startX + (pts.length-1)*stepX, h);
    ctx.lineTo(startX, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0, lineColor + '33');
    grad.addColorStop(1, lineColor + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((val,i)=>{
      const x = startX + i*stepX;
      const y = h - (val/100)*h*0.85 - 3;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const lastX = startX + (pts.length-1)*stepX;
    const lastY = h - (pts[pts.length-1]/100)*h*0.85 - 3;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.2, 0, Math.PI*2);
    ctx.fillStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 7;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function labelForScore(score){
    if (score === 0) return '— idle';
    if (score < 50) return score + ' · weak';
    if (score < 75) return score + ' · fair';
    if (score < 100) return score + ' · strong';
    return '100 · excellent';
  }

  drawChart();

  // ---------- Validation wiring ----------
  function updateTags(rules){
    document.querySelectorAll('.tag').forEach(tag=>{
      const rule = tag.dataset.rule;
      tag.classList.toggle('met', !!rules[rule]);
    });
  }

  function checkMatch(){
    if (!confirmInput.value){
      matchHint.textContent = '';
      confirmWrap.classList.remove('error','ok');
      return false;
    }
    if (confirmInput.value === pwInput.value){
      matchHint.textContent = 'Passwords match';
      matchHint.className = 'hint ok';
      confirmWrap.classList.remove('error');
      confirmWrap.classList.add('ok');
      return true;
    } else {
      matchHint.textContent = 'Passwords do not match';
      matchHint.className = 'hint err';
      confirmWrap.classList.remove('ok');
      confirmWrap.classList.add('error');
      return false;
    }
  }

  function evaluateForm(){
    const { score, rules } = scorePassword(pwInput.value);
    strengthValue.textContent = labelForScore(score);
    strengthValue.style.color = colorForScore(score);
    updateTags(rules);

    const last = history[history.length-1];
    if (last !== score){
      history.push(score);
      if (history.length > 40) history.shift();
    }
    drawChart();

    const allRulesMet = Object.values(rules).every(Boolean);
    pwWrap.classList.toggle('ok', allRulesMet && pwInput.value.length > 0);
    pwWrap.classList.toggle('error', pwInput.value.length > 0 && !allRulesMet && pwInput.value.length >= 8);

    const matches = checkMatch();
    submitBtn.disabled = !(allRulesMet && matches);
  }

  pwInput.addEventListener('input', evaluateForm);
  confirmInput.addEventListener('input', evaluateForm);

  // ---------- Submission (backend contract kept identical to the auth service) ----------
  async function handleSubmit(event){
    event.preventDefault();
    if (submitBtn.disabled) return;

    btnText.style.opacity = '0.6';
    btnText.textContent = 'Updating password...';
    spinner.style.display = 'inline-block';
    submitBtn.style.pointerEvents = 'none';
    pwInput.disabled = true;
    confirmInput.disabled = true;

    try {
      const reset_token = sessionStorage.getItem('reset_token');
      const response = await fetch('/api/Pass-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pwInput.value,
          confirmPassword: confirmInput.value,
          reset_token: reset_token
        })
      });

      const data = await response.json().catch(()=>({}));

      if (data.status === 'Success'){
        btnText.textContent = 'Password updated';
        spinner.style.display = 'none';
        setTimeout(()=>{ successPanel.classList.add('show'); form.style.display = 'none'; }, 300);
        setTimeout(()=>{ window.location.href = '/login'; }, 1400);
      } else {
        btnText.textContent = 'Try again';
        spinner.style.display = 'none';
        submitBtn.style.pointerEvents = 'auto';
        submitBtn.classList.add('error-state');
        pwInput.disabled = false;
        confirmInput.disabled = false;
        btnText.style.opacity = '1';
        matchHint.textContent = data.message || 'Could not update password. Please try again.';
        matchHint.className = 'hint err';
        setTimeout(()=> submitBtn.classList.remove('error-state'), 1800);
      }
    } catch (err){
      console.error('Password update failed:', err);
      btnText.textContent = 'Network error — retry';
      spinner.style.display = 'none';
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.classList.add('error-state');
      pwInput.disabled = false;
      confirmInput.disabled = false;
      btnText.style.opacity = '1';
      setTimeout(()=> submitBtn.classList.remove('error-state'), 1800);
    }
  }

  form.addEventListener('submit', handleSubmit);
})();
