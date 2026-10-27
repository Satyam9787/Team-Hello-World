(function(){
  var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine=window.matchMedia("(pointer: fine)").matches;
  var root=document.documentElement;

  /* cursor: dot follows instantly, ring trails, spotlight tracks */
  if(fine&&!rm){
    var dot=document.querySelector(".cur-dot"),ring=document.querySelector(".cur-ring");
    var x=innerWidth/2,y=innerHeight/3,rx=x,ry=y;
    addEventListener("mousemove",function(e){
      x=e.clientX;y=e.clientY;
      document.body.classList.add("cur-on");
      dot.style.transform="translate("+x+"px,"+y+"px)";
      root.style.setProperty("--mx",x+"px");root.style.setProperty("--my",y+"px");
    });
    document.addEventListener("mouseleave",function(){document.body.classList.remove("cur-on")});
    addEventListener("mousedown",function(){ring.classList.add("dn")});
    addEventListener("mouseup",function(){ring.classList.remove("dn")});
    document.addEventListener("mouseover",function(e){
      ring.classList.toggle("hov",!!e.target.closest("a,button,li,.cap"));
    });
    (function loop(){
      rx+=(x-rx)*.16;ry+=(y-ry)*.16;
      ring.style.transform="translate("+rx+"px,"+ry+"px)";
      requestAnimationFrame(loop);
    })();
  }

  /* scroll reveal */
  var rv=document.querySelectorAll(".rv");
  if("IntersectionObserver" in window&&!rm){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("on");io.unobserve(e.target)}})},{threshold:.15});
    rv.forEach(function(el){io.observe(el)});
  }else{rv.forEach(function(el){el.classList.add("on")})}

  /* matrix rain */
  (function(){
    var c=document.getElementById("rain");if(!c||rm)return;
    var g=c.getContext("2d"),chars="01ｱｲｳｴｵｶｷｸｹｺ#$%&@<>/\\{}[]|=+*;:",fs=16,cols,drops;
    function size(){c.width=innerWidth;c.height=innerHeight;cols=Math.ceil(c.width/fs);drops=[];for(var i=0;i<cols;i++)drops.push({y:Math.random()*-60,c:Math.random()})}
    size();addEventListener("resize",size);
    var last=0;
    function draw(t){
      requestAnimationFrame(draw);
      if(t-last<55)return;last=t;
      g.fillStyle="rgba(5,11,16,.12)";g.fillRect(0,0,c.width,c.height);
      g.font=fs+"px 'IBM Plex Mono',monospace";
      for(var i=0;i<cols;i++){
        var d=drops[i];
        g.fillStyle=d.c<.07?"#c0343d":d.c<.17?"#2a6fc0":"#1fa45e";
        g.fillText(chars.charAt(Math.floor(Math.random()*chars.length)),i*fs,d.y*fs);
        if(d.y*fs>c.height&&Math.random()>.975){d.y=0;d.c=Math.random()}
        d.y+=1;
      }
    }
    requestAnimationFrame(draw);
  })();

  /* headline decrypt */
  (function(){
    var h=document.querySelector(".hero h1");if(!h||rm)return;
    var fin=h.textContent,pl="01#$%&@<>/{}[]|=+*;:",t0=null,dur=1400,delay=500;
    function rnd(){return pl.charAt(Math.floor(Math.random()*pl.length))}
    function f(t){
      if(!t0)t0=t;
      var p=(t-t0-delay)/dur,out="",n=Math.floor(Math.max(p,0)*fin.length);
      for(var i=0;i<fin.length;i++){var ch=fin.charAt(i);out+=(ch===" "||i<n)?ch:rnd()}
      h.textContent=out;
      if(p<1)requestAnimationFrame(f);else h.textContent=fin;
    }
    requestAnimationFrame(f);
  })();

  /* alerts and updates */
  var box=document.getElementById("alerts"),lastAlert=0,scopeEl=document.querySelector(".scope");
  function junk(n){var s="",p="0123456789abcdef#$%&@<>{}[]|=+*;:";for(var i=0;i<n;i++)s+=p.charAt(Math.floor(Math.random()*p.length));return s}
  function toast(kind,title,body){
    if(!box)return;
    var el=document.createElement("div");el.className="toast "+kind;
    el.innerHTML="<b>"+esc(title)+"</b><span>"+esc(body)+"</span><code>"+esc(junk(36))+"</code>";
    box.appendChild(el);
    while(box.children.length>3)box.removeChild(box.firstChild);
    setTimeout(function(){el.classList.add("out");setTimeout(function(){el.remove()},500)},6000);
  }
  function alertBad(p){
    if(Date.now()-lastAlert<6000)return;
    lastAlert=Date.now();
    toast("bad","Security alert","Unknown binary "+p.p+" executed in background");
    if(scopeEl){scopeEl.classList.add("alarm");setTimeout(function(){scopeEl.classList.remove("alarm")},1100)}
  }
  var ups=["Rule pack 2026.10.25 applied to lab-node-01","3 new reputation signatures synced","Probe updated to v0.4.2 with no restart","Policy change deployed to all Linux hosts"],ui=0;
  if(!rm){
    setTimeout(function(){toast("ok","Security update",ups[ui++%ups.length])},2200);
    setInterval(function(){toast("ok","Security update",ups[ui++%ups.length])},14000);
  }

  /* binary dump */
  var dump=document.getElementById("dump");
  if(dump){
    var dl=[],off=0,dn=0,sp="@#$%&<>{}[]|=+*;:/\\!?0123456789abcdef";
    var hex=function(){var s="";for(var i=0;i<8;i++)s+=("0"+Math.floor(Math.random()*256).toString(16)).slice(-2)+" ";return s};
    var asc=function(){var s="";for(var i=0;i<8;i++)s+=sp.charAt(Math.floor(Math.random()*sp.length));return s};
    var dstep=function(){
      off+=8;var o=("0000"+off.toString(16)).slice(-4),k=dn++%9,ln;
      if(k===8)ln="<span class='bad'>"+o+"  !! execve from /dev/shm, hidden</span>";
      else if(k===4)ln="<span class='warn'>"+o+"  ?? self-modifying code region</span>";
      else ln=o+"  "+hex()+" <span class='grn'>"+esc(asc())+"</span>";
      dl.push(ln);if(dl.length>11)dl.shift();
      dump.innerHTML=dl.join("\n");
    };
    for(var k=0;k<11;k++)dstep();
    if(!rm)setInterval(dstep,130);
  }

  /* live feed */
  var pool=[
    {n:"systemd",u:"root",p:"/usr/lib/systemd/systemd",v:"safe",r:"Signed system binary with the kernel as parent. Matches the host baseline."},
    {n:"sshd",u:"root",p:"/usr/sbin/sshd",v:"safe",r:"Known service started by systemd on its usual port."},
    {n:"nginx",u:"www-data",p:"/usr/sbin/nginx",v:"safe",r:"Package-owned binary with the expected parent and user."},
    {n:"python3",u:"dev",p:"/usr/bin/python3",v:"safe",r:"System interpreter launched from an interactive login shell."},
    {n:"cron",u:"root",p:"/usr/sbin/cron",v:"safe",r:"Scheduled job runner that matches the host baseline."},
    {n:"curl",u:"www-data",p:"/usr/bin/curl",v:"warn",r:"A web server user started a download tool. This is rare on this host."},
    {n:"bash",u:"www-data",p:"/bin/bash",v:"warn",r:"Shell spawned by the web server process. This may be a remote command."},
    {n:"kworker-x",u:"dev",p:"/tmp/.cache/kworker-x",v:"bad",r:"Unknown binary in /tmp that imitates a kernel thread. Not owned by any package."},
    {n:"xmrig",u:"dev",p:"/dev/shm/xmrig",v:"bad",r:"File hash matches a known crypto miner and it runs from shared memory."},
    {n:"nc",u:"nobody",p:"/usr/bin/nc",v:"bad",r:"Opens an outbound connection to an address never seen on this host."}
  ];
  var label={safe:"safe",warn:"suspicious",bad:"blocked"};
  var rows=document.getElementById("rows"),detail=document.getElementById("detail");
  var count={safe:0,warn:0,bad:0},items=[],sel=null,pid=2140;
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function show(it){
    sel=it;
    detail.innerHTML="<b class='"+it.v+"'>"+esc(it.n)+" is "+label[it.v]+"</b><br>"+esc(it.r)+"<br><code>"+esc(it.p)+" (user "+esc(it.u)+")</code>";
    render(false);
  }
  function render(fresh){
    rows.innerHTML="";
    items.forEach(function(it,i){
      var li=document.createElement("li");
      li.tabIndex=0;
      li.className=(it===sel?"sel ":"")+(fresh&&i===0?"new":"");
      li.innerHTML="<span class='pid'>"+it.pid+"</span><span>"+esc(it.n)+"</span><span class='tag "+it.v+"'>"+label[it.v]+"</span>";
      li.onclick=function(){show(it)};
      li.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();show(it)}};
      rows.appendChild(li);
    });
    document.getElementById("c-safe").textContent=count.safe+" safe";
    document.getElementById("c-warn").textContent=count.warn+" suspicious";
    document.getElementById("c-bad").textContent=count.bad+" blocked";
  }
  function add(fresh){
    var r=Math.random(),g=r<.65?"safe":(r<.85?"warn":"bad");
    var opts=pool.filter(function(x){return x.v===g});
    var pick=opts[Math.floor(Math.random()*opts.length)];
    pid+=Math.floor(Math.random()*40)+1;
    items.unshift(Object.assign({pid:pid},pick));
    if(items.length>7)items.pop();
    count[g]++;
    if(g==="bad"&&fresh)alertBad(pick);
    render(fresh);
  }
  for(var i=0;i<6;i++)add(false);
  if(!rm)setInterval(function(){add(true)},2000);

  /* ==========================================
     LOGIN (logic from login.js)
     "Request access" buttons open the login modal
     ========================================== */
  (function(){
    var modal=document.getElementById("login-modal");
    var loginForm=document.getElementById("login-form");
    var emailInput=document.getElementById("li-email");
    var passwordInput=document.getElementById("li-password");
    var emailError=document.getElementById("li-err-email");
    var passwordError=document.getElementById("li-err-password");
    var loginStatus=document.getElementById("login-status");
    var submitButton=loginForm?loginForm.querySelector(".card-submit"):null;
    var closeBtn=document.getElementById("login-close");
    if(!modal||!loginForm)return;

    var SUBMIT_LABEL="Sign in";
    var redirecting=false;
    var lastFocus=null;

    /* ---------- Password show / hide ---------- */
    modal.querySelectorAll(".password-toggle").forEach(function(button){
      button.addEventListener("click",function(){
        var target=document.getElementById(button.dataset.target);
        if(!target)return;
        var isPassword=target.type==="password";
        target.type=isPassword?"text":"password";
        button.setAttribute("aria-label",isPassword?"Hide password":"Show password");
        button.classList.toggle("password-visible",isPassword);
      });
    });

    /* ---------- Modal open / close ---------- */
    function openLogin(prefillEmail){
      lastFocus=document.activeElement;
      modal.hidden=false;
      document.body.classList.add("modal-open");
      if(prefillEmail)emailInput.value=prefillEmail;
      setTimeout(function(){(prefillEmail?passwordInput:emailInput).focus()},30);
    }
    function closeLogin(){
      modal.hidden=true;
      document.body.classList.remove("modal-open");
      clearErrors();
      if(lastFocus&&lastFocus.focus)lastFocus.focus();
    }

    document.querySelectorAll("[data-open-login]").forEach(function(btn){
      btn.addEventListener("click",function(e){e.preventDefault();openLogin()});
    });
    closeBtn.addEventListener("click",closeLogin);
    modal.addEventListener("mousedown",function(e){if(e.target===modal)closeLogin()});
    document.addEventListener("keydown",function(e){
      if(modal.hidden)return;
      if(e.key==="Escape"){closeLogin();return}
      if(e.key==="Tab"){ /* keep focus inside the modal */
        var f=modal.querySelectorAll("button:not([disabled]),input");
        if(!f.length)return;
        var first=f[0],last=f[f.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    });

    /* Join section form: carry the email into the login modal */
    var joinForm=document.getElementById("f");
    if(joinForm){
      joinForm.addEventListener("submit",function(e){
        e.preventDefault();
        var v=document.getElementById("em").value.trim();
        openLogin(v);
      });
    }

    /* ---------- Utility functions ---------- */
    function clearErrors(){
      emailError.textContent="";
      passwordError.textContent="";
      emailInput.classList.remove("input-error");
      passwordInput.classList.remove("input-error");
      loginStatus.textContent="";
      loginStatus.className="card-status";
    }
    function showError(field,message){
      if(field==="email"){emailError.textContent=message;emailInput.classList.add("input-error")}
      if(field==="password"){passwordError.textContent=message;passwordInput.classList.add("input-error")}
    }
    function showStatus(message,type){
      loginStatus.textContent=message;
      loginStatus.className="card-status "+(type||"");
    }
    function resetButton(){
      submitButton.disabled=false;
      submitButton.classList.remove("loading");
      submitButton.textContent=SUBMIT_LABEL;
    }

    /* ---------- Login ---------- */
    async function handleLogin(event){
      event.preventDefault();
      clearErrors();

      var email=emailInput.value.trim();
      // IMPORTANT: Do NOT trim passwords.
      var password=passwordInput.value;

      /* Frontend validation */
      if(!email){showError("email","Email is required.");emailInput.focus();return}
      var emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailPattern.test(email)){showError("email","Please enter a valid email address.");emailInput.focus();return}
      if(!password){showError("password","Password is required.");passwordInput.focus();return}

      /* Loading state */
      submitButton.disabled=true;
      submitButton.classList.add("loading");
      submitButton.textContent="Checking your credentials…";

      try{
        /* Login API */
        var response=await fetch("/api/login",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:email,password:password})
        });

        var result;
        try{
          result=await response.json();
        }catch(jsonError){
          console.error("Invalid JSON response:",jsonError);
          throw new Error("Invalid server response.");
        }
        console.log("Login response:",result);

        /* OTP required */
        if(result.status==="otp_required"){
          localStorage.setItem("userEmail",email);
          showStatus("Credentials verified. Sending verification code…","success");
          submitButton.textContent="Verification required";

          try{
            var otpResponse=await fetch("/send-otp",{
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({email:email,usecase:"LOGIN"})
            });

            var otpResult;
            try{
              otpResult=await otpResponse.json();
            }catch(jsonError){
              console.error("Invalid OTP response:",jsonError);
              throw new Error("Invalid OTP server response.");
            }
            console.log("OTP response:",otpResult);

            if(!otpResponse.ok){
              throw new Error(otpResult.message||"Unable to send OTP.");
            }

            /* OTP successfully sent */
            showStatus("Verification code sent. Redirecting…","success");
            redirecting=true;
            setTimeout(function(){window.location.href="/otp"},600);
            return;

          }catch(otpError){
            console.error("OTP Error:",otpError);
            showStatus("Unable to send verification code. Please try again.","error");
            resetButton();
            return;
          }
        }

        /* Invalid password */
        if(result.status==="Invalid_pass"){
          showError("password","Incorrect password.");
          showStatus("Your credentials could not be verified.","error");
          passwordInput.focus();
          return;
        }

        /* Too many attempts */
        if(result.status==="ATTEMPT_LIMIT_EXCEED"){
          showStatus("Too many attempts. Please try again in about 4 minutes.","error");
          return;
        }

        /* User not found */
        if(result.status==="USER_NOT_FOUND"||result.status==="NOT_FOUND"){
          showError("email","No account found with this email.");
          showStatus("We could not find this account.","error");
          emailInput.focus();
          return;
        }

        /* Email not verified */
        if(result.status==="EMAIL_NOT_VERIFIED"){
          localStorage.setItem("userEmail",email);
          showStatus("Please verify your email first.","error");
          redirecting=true;
          setTimeout(function(){window.location.href="/otp"},600);
          return;
        }

        /* Generic backend error */
        showStatus(result.message||"Unable to sign in. Please try again.","error");

      }catch(error){
        console.error("Login Error:",error);
        showStatus("Unable to connect to the server. Please try again.","error");
      }finally{
        /* Don't reset the button if we're already moving to the OTP page. */
        if(!redirecting)resetButton();
      }
    }

    loginForm.addEventListener("submit",handleLogin);

    /* ---------- Clear individual errors while typing ---------- */
    emailInput.addEventListener("input",function(){
      emailError.textContent="";
      emailInput.classList.remove("input-error");
      loginStatus.textContent="";
      loginStatus.className="card-status";
    });
    passwordInput.addEventListener("input",function(){
      passwordError.textContent="";
      passwordInput.classList.remove("input-error");
      loginStatus.textContent="";
      loginStatus.className="card-status";
    });
  })();

  /* ==========================================
     SIGNUP (logic from signup.js)
     "Create Account" button opens the signup modal
     ========================================== */
  (function(){
    var modal=document.getElementById("signup-modal");
    var form=document.getElementById("signupForm");
    if(!modal||!form)return;

    var successState=document.getElementById("successState");
    var backToForm=document.getElementById("backToForm");
    var password=document.getElementById("password");
    var strength=modal.querySelector(".strength");
    var statusEl=document.getElementById("signup-status");
    var closeBtn=document.getElementById("signup-close");
    var redirecting=false;
    var lastFocus=null;

    /* ---------- modal open / close ---------- */
    function openSignup(){
      lastFocus=document.activeElement;
      modal.hidden=false;
      document.body.classList.add("modal-open");
      setTimeout(function(){document.getElementById("firstName").focus()},30);
    }
    function closeSignup(){
      modal.hidden=true;
      document.body.classList.remove("modal-open");
      closePanel();
      if(lastFocus&&lastFocus.focus)lastFocus.focus();
    }
    document.querySelectorAll("[data-open-signup]").forEach(function(btn){
      btn.addEventListener("click",function(e){e.preventDefault();openSignup()});
    });
    closeBtn.addEventListener("click",closeSignup);
    modal.addEventListener("mousedown",function(e){if(e.target===modal)closeSignup()});

    /* switch links between login and signup modals */
    document.querySelectorAll("[data-switch-signup]").forEach(function(a){
      a.addEventListener("click",function(){
        var lm=document.getElementById("login-modal");
        if(lm){lm.hidden=true;document.body.classList.remove("modal-open")}
        openSignup();
      });
    });
    document.querySelectorAll("[data-switch-login]").forEach(function(a){
      a.addEventListener("click",function(){
        closeSignup();
        var b=document.querySelector(".hero [data-open-login]");
        if(b)b.click();
      });
    });

    /* ---------- interest picker ---------- */
    var picker=document.getElementById("interestPicker");
    var trigger=document.getElementById("interestTrigger");
    var panel=document.getElementById("interestPanel");
    var interestInput=document.getElementById("interest");
    var triggerIcon=document.getElementById("triggerIcon");
    var triggerText=document.getElementById("triggerText");
    var interestCards=panel.querySelectorAll(".interest-card");

    function openPanel(){
      panel.hidden=false;
      picker.classList.add("open");
      trigger.setAttribute("aria-expanded","true");
    }
    function closePanel(){
      panel.hidden=true;
      picker.classList.remove("open");
      trigger.setAttribute("aria-expanded","false");
    }
    function selectInterest(card){
      interestInput.value=card.dataset.value;
      triggerText.textContent=card.dataset.label;
      triggerIcon.innerHTML=card.querySelector("svg").outerHTML;
      picker.classList.add("has-value");
      interestCards.forEach(function(c){c.setAttribute("aria-selected",c===card?"true":"false")});
      setError("interest","interestError","");
      closePanel();
      trigger.focus();
    }
    function resetInterest(){
      interestInput.value="";
      triggerText.textContent="Select your interest";
      triggerIcon.innerHTML="";
      picker.classList.remove("has-value","invalid");
      interestCards.forEach(function(c){c.setAttribute("aria-selected","false")});
      closePanel();
    }
    trigger.addEventListener("click",function(){panel.hidden?openPanel():closePanel()});
    interestCards.forEach(function(card){card.addEventListener("click",function(){selectInterest(card)})});
    document.addEventListener("click",function(e){
      if(!panel.hidden&&!picker.contains(e.target))closePanel();
    });

    /* Escape + focus trap */
    document.addEventListener("keydown",function(e){
      if(modal.hidden)return;
      if(e.key==="Escape"){
        if(!panel.hidden){closePanel();trigger.focus()}
        else closeSignup();
        return;
      }
      if(e.key==="Tab"){
        var f=Array.prototype.filter.call(
          modal.querySelectorAll("button:not([disabled]),input:not([type=hidden])"),
          function(el){return el.offsetParent!==null}
        );
        if(!f.length)return;
        var first=f[0],last=f[f.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    });

    /* ---------- helpers ---------- */
    function setError(inputId,errorId,message){
      var input=document.getElementById(inputId);
      var error=document.getElementById(errorId);
      // the hidden interest input shows its error state on the picker wrapper
      var target=input.type==="hidden"?input.parentElement:input;
      if(message){target.classList.add("invalid");error.textContent=message}
      else{target.classList.remove("invalid");error.textContent=""}
    }
    function isValidEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
    function isValidUsername(u){return /^[a-zA-Z0-9_]{3,20}$/.test(u)}
    function showStatus(message,type){
      statusEl.textContent=message;
      statusEl.className="card-status "+(type||"");
    }

    function updatePasswordStrength(value){
      if(!value){strength.removeAttribute("data-level");return}
      var level=0;
      if(value.length>=8)level++;
      if(/[a-zA-Z]/.test(value)&&/\d/.test(value))level++;
      if(/[A-Z]/.test(value)&&/[a-z]/.test(value))level++;
      if(/[^a-zA-Z0-9]/.test(value))level++;
      strength.dataset.level=String(Math.max(1,level));
    }
    password.addEventListener("input",function(){updatePasswordStrength(password.value)});

    modal.querySelectorAll(".su-toggle").forEach(function(button){
      button.addEventListener("click",function(){
        var target=document.getElementById(button.dataset.target);
        var showing=target.type==="text";
        target.type=showing?"password":"text";
        button.textContent=showing?"Show":"Hide";
        button.setAttribute("aria-label",showing?"Show password":"Hide password");
      });
    });

    /* ---------- submit ---------- */
    form.addEventListener("submit",async function(event){
      event.preventDefault();
      showStatus("");

      var firstName=document.getElementById("firstName").value.trim();
      var lastName=document.getElementById("lastName").value.trim();
      var username=document.getElementById("username").value.trim();
      var email=document.getElementById("email").value.trim();
      var institution=document.getElementById("institution").value.trim();
      var passwordValue=password.value;
      var confirmPassword=document.getElementById("confirmPassword").value;
      var interest=document.getElementById("interest").value;
      var terms=document.getElementById("terms").checked;
      var submitBtn=form.querySelector(".submit-btn");
      var valid=true;

      if(!firstName){setError("firstName","firstNameError","First name is required.");valid=false}
      else setError("firstName","firstNameError","");

      if(!lastName){setError("lastName","lastNameError","Last name is required.");valid=false}
      else setError("lastName","lastNameError","");

      if(!username){setError("username","usernameError","Username is required.");valid=false}
      else if(!isValidUsername(username)){setError("username","usernameError","Username must be 3-20 characters using letters, numbers or underscore.");valid=false}
      else setError("username","usernameError","");

      if(!email){setError("email","emailError","Email address is required.");valid=false}
      else if(!isValidEmail(email)){setError("email","emailError","Enter a valid email address.");valid=false}
      else setError("email","emailError","");

      if(!institution){setError("institution","institutionError","Institution name is required.");valid=false}
      else if(institution.length<2){setError("institution","institutionError","Enter the full name of your institution.");valid=false}
      else setError("institution","institutionError","");

      if(!passwordValue){setError("password","passwordError","Password is required.");valid=false}
      else if(passwordValue.length<8){setError("password","passwordError","Password must be at least 8 characters.");valid=false}
      else setError("password","passwordError","");

      if(!confirmPassword){setError("confirmPassword","confirmPasswordError","Please confirm your password.");valid=false}
      else if(passwordValue!==confirmPassword){setError("confirmPassword","confirmPasswordError","Passwords do not match.");valid=false}
      else setError("confirmPassword","confirmPasswordError","");

      if(!interest){setError("interest","interestError","Please select your interest.");valid=false}
      else setError("interest","interestError","");

      var termsError=document.getElementById("termsError");
      if(!terms){termsError.textContent="Please accept the terms to continue.";valid=false}
      else termsError.textContent="";

      if(!valid)return;

      var originalBtnContent=submitBtn.innerHTML;
      submitBtn.disabled=true;
      submitBtn.innerHTML="<span>Connecting to Secure Node...</span>";

      try{
        var response=await fetch("/api/signup",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            firstName:firstName,
            lastName:lastName,
            username:username,
            email:email,
            institution:institution,
            password:passwordValue,
            interest:interest
          })
        });

        var data=await response.json();

        if(data.status==="otp_required"){
          localStorage.setItem("userEmail",email);

          await fetch("/send-otp",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({email:email,usecase:"SIGNUP"})
          });

          showStatus("OTP sent to entered email successfully. Redirecting…","success");
          redirecting=true;
          setTimeout(function(){window.location.href="/otp"},800);

        }else if(response.ok){
          form.style.display="none";
          successState.hidden=false;

        }else{
          showStatus(data.message||"Registration failed.","error");
        }

      }catch(error){
        console.error(error);
        showStatus("Server connection failed.","error");

      }finally{
        /* keep the button disabled while redirecting to /otp */
        if(!redirecting){
          submitBtn.disabled=false;
          submitBtn.innerHTML=originalBtnContent;
        }
      }
    });

    /* ---------- back to form ---------- */
    backToForm.addEventListener("click",function(){
      form.reset();
      strength.removeAttribute("data-level");
      showStatus("");
      modal.querySelectorAll(".field-err").forEach(function(el){el.textContent=""});
      modal.querySelectorAll("input,select").forEach(function(el){el.classList.remove("invalid")});
      modal.querySelectorAll(".su-toggle").forEach(function(b){b.textContent="Show"});
      modal.querySelectorAll(".pw-wrap input").forEach(function(i){i.type="password"});
      resetInterest();
      successState.hidden=true;
      form.style.display="";
    });
  })();
})();