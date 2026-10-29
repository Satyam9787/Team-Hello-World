/* Prahari OTP: TVA visual effects. Visual only, no network calls, no OTP logic. */
(function(){
  var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine=window.matchMedia("(pointer: fine)").matches;
  var root=document.documentElement;
  var card=document.getElementById("card");

  /* card: stop the entrance animation once it has played, so shake/ok states never replay it */
  if(card){
    var done=false;
    var ready=function(){if(!done){done=true;card.classList.add("ready")}};
    card.addEventListener("animationend",function(e){if(e.target===card&&e.animationName==="fileIn")ready()});
    setTimeout(ready,1600);
  }

  /* cursor: dot follows instantly, ring trails, spotlight tracks */
  if(fine&&!rm){
    var dot=document.querySelector(".cur-dot"),ring=document.querySelector(".cur-ring");
    if(dot&&ring){
      var x=innerWidth/2,y=innerHeight/2,rx=x,ry=y;
      addEventListener("mousemove",function(e){
        x=e.clientX;y=e.clientY;
        document.body.classList.add("cur-on");
        dot.style.transform="translate("+x+"px,"+y+"px)";
        root.style.setProperty("--mx",x+"px");root.style.setProperty("--my",y+"px");
      });
      document.addEventListener("mouseleave",function(){document.body.classList.remove("cur-on")});
      document.addEventListener("mouseover",function(e){ring.classList.toggle("hov",!!e.target.closest("a,button"))});
      (function loop(){
        rx+=(x-rx)*.16;ry+=(y-ry)*.16;
        ring.style.transform="translate("+rx+"px,"+ry+"px)";
        requestAnimationFrame(loop);
      })();
    }
    addEventListener("mousedown",function(e){
      var p=document.createElement("div");p.className="tpulse";
      p.style.left=e.clientX+"px";p.style.top=e.clientY+"px";
      document.body.appendChild(p);setTimeout(function(){p.remove()},800);
    });
  }

  /* TVA dial behind the card */
  (function(){
    var d=document.createElement("div");d.className="dial";d.setAttribute("aria-hidden","true");
    var ticks="";
    for(var i=0;i<60;i++){
      var long=i%5===0,a=i*6*Math.PI/180,r1=long?318:328,r2=340;
      ticks+="<line x1='"+(400+Math.sin(a)*r1).toFixed(1)+"' y1='"+(400-Math.cos(a)*r1).toFixed(1)+"' x2='"+(400+Math.sin(a)*r2).toFixed(1)+"' y2='"+(400-Math.cos(a)*r2).toFixed(1)+"'/>";
    }
    d.innerHTML="<svg viewBox='0 0 800 800'>"+
      "<g class='r1'><circle class='ring' cx='400' cy='400' r='388'/><circle class='ring dash' cx='400' cy='400' r='366'/></g>"+
      "<g class='r2 ticks'>"+ticks+"</g>"+
      "<g class='r3'><circle class='ring dash' cx='400' cy='400' r='270'/><circle class='ring' cx='400' cy='400' r='236'/></g>"+
      "<g class='hmin'><line class='hand' x1='400' y1='400' x2='400' y2='120'/></g>"+
      "<g class='hhr'><line class='hand' x1='400' y1='400' x2='400' y2='210'/></g>"+
      "<circle class='core' cx='400' cy='400' r='9'/></svg>";
    document.body.insertBefore(d,document.body.firstChild);
  })();

  /* Sacred Timeline strands */
  (function(){
    var c=document.getElementById("rain");if(!c||rm)return;
    var g=c.getContext("2d"),W=0,H=0,strands=[],branches=[],dust=[],last=0,t=0;
    function size(){
      W=c.width=innerWidth;H=c.height=innerHeight;strands=[];dust=[];
      var n=9,i;
      for(i=0;i<n;i++)strands.push({y:H*(.1+.8*i/(n-1)),a:14+Math.random()*28,f:.0025+Math.random()*.004,s:.35+Math.random()*.5,p:Math.random()*6.28,pulse:Math.random(),sp:.004+Math.random()*.006});
      for(i=0;i<70;i++)dust.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6+.4,v:.15+Math.random()*.4,d:Math.random()*6.28});
    }
    function yAt(s,x){return s.y+Math.sin(x*s.f+s.p+t*s.s)*s.a}
    size();addEventListener("resize",size);
    function spawn(){
      if(!strands.length)return;
      branches.push({s:strands[Math.floor(Math.random()*strands.length)],x0:W*.1+Math.random()*W*.7,len:160+Math.random()*240,dir:Math.random()<.5?-1:1,age:0});
      if(branches.length>4)branches.shift();
    }
    spawn();setInterval(spawn,3800);
    function draw(ts){
      requestAnimationFrame(draw);
      if(ts-last<33)return;last=ts;t+=.033;
      g.clearRect(0,0,W,H);
      g.lineWidth=1;
      strands.forEach(function(s){
        g.strokeStyle="rgba(238,122,31,.38)";
        g.beginPath();
        for(var x=0;x<=W;x+=12){var y=yAt(s,x);if(x)g.lineTo(x,y);else g.moveTo(x,y)}
        g.stroke();
        s.pulse=(s.pulse+s.sp)%1;
        var px=s.pulse*W,py=yAt(s,px),gr=g.createRadialGradient(px,py,0,px,py,16);
        gr.addColorStop(0,"rgba(255,214,150,.95)");gr.addColorStop(1,"rgba(238,122,31,0)");
        g.fillStyle=gr;g.beginPath();g.arc(px,py,16,0,6.283);g.fill();
      });
      branches.forEach(function(b){
        b.age+=.033;
        var grow=Math.min(b.age/2,1),fade=b.age>3.4?Math.max(0,1-(b.age-3.4)/1.4):1;
        if(fade<=0)return;
        g.strokeStyle="rgba(236,83,57,"+(.7*fade)+")";
        g.setLineDash(b.age>3.4?[4,7]:[]);
        g.beginPath();
        for(var k=0;k<=b.len*grow;k+=10){
          var x=b.x0+k,y=yAt(b.s,x)+b.dir*k*.5;
          if(k)g.lineTo(x,y);else g.moveTo(x,y);
        }
        g.stroke();g.setLineDash([]);
      });
      g.fillStyle="rgba(248,168,79,.55)";
      dust.forEach(function(d){
        d.x+=d.v*.6;d.y-=d.v*.35;d.d+=.02;
        if(d.x>W)d.x=0;
        if(d.y<0)d.y=H;
        g.globalAlpha=.35+.35*Math.sin(d.d);
        g.beginPath();g.arc(d.x,d.y,d.r,0,6.283);g.fill();
      });
      g.globalAlpha=1;
    }
    requestAnimationFrame(draw);
  })();

  /* digit boxes get a "filled" class (visual pop only) */
  document.querySelectorAll(".otp-input").forEach(function(el){
    function sync(){el.classList.toggle("filled",el.value!=="")}
    el.addEventListener("input",sync);
    el.addEventListener("paste",function(){setTimeout(function(){document.querySelectorAll(".otp-input").forEach(function(o){o.classList.toggle("filled",o.value!=="")})},0)});
  });
  /* clear "filled" when otp.js empties the boxes programmatically */
  (function(){
    var boxes=document.querySelectorAll(".otp-input");
    setInterval(function(){boxes.forEach(function(o){if(o.value===""&&o.classList.contains("filled"))o.classList.remove("filled")})},300);
  })();

  /* card state: shake on an error message, green when verified (watches otp.js, never changes it) */
  if(card){
    var err=document.getElementById("otpError"),succ=document.getElementById("successState");
    var lastMsg="";
    if(err){
      new MutationObserver(function(){
        var shown=err.classList.contains("visible")&&err.textContent;
        if(shown&&err.textContent!==lastMsg&&!/new verification code has been sent/i.test(err.textContent)){
          card.classList.remove("bad");void card.offsetWidth;card.classList.add("bad");
          logLine("> code rejected","r");
          setTimeout(function(){card.classList.remove("bad")},650);
        }
        lastMsg=shown?err.textContent:"";
      }).observe(err,{attributes:true,childList:true,characterData:true,subtree:true,attributeFilter:["class"]});
    }
    if(succ){
      new MutationObserver(function(){
        if(succ.classList.contains("active")){card.classList.add("ok");logLine("> identity confirmed","g")}
      }).observe(succ,{attributes:true,attributeFilter:["class"]});
    }
  }

  /* session log: short status lines on the CRT strip */
  var log=document.getElementById("log");
  function logLine(text,cls){
    if(!log)return;
    var cur=log.querySelector("i");if(cur)cur.parentNode.remove();
    var d=document.createElement("div");if(cls)d.className=cls;d.textContent=text;log.appendChild(d);
    while(log.children.length>4)log.removeChild(log.firstChild);
    var c=document.createElement("div");c.innerHTML="<i></i>";log.appendChild(c);
  }
  if(log){
    var seq=["> secure channel opened","> code sent to your email","> awaiting 6 digit code"],n=0;
    (function next(){
      if(n>=seq.length)return;
      logLine(seq[n],n===2?"g":"");n++;
      setTimeout(next,rm?0:700);
    })();
  }
})();