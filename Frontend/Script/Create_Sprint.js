(function(){
  "use strict";
  function qs(id){ return document.getElementById(id); }
  function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  var sprints = [
    { id:1, topic:"Dynamic Programming", difficulty:"Medium", duration:45, host:"Aditi Sharma", initial:"A", requirements:["Comfortable with recursion","Comfortable with arrays"], spots:"1 of 2 spots open" },
    { id:2, topic:"Binary Trees & Traversals", difficulty:"Easy", duration:30, host:"Rohan Verma", initial:"R", requirements:["Basic OOP knowledge","No prior tree experience needed"], spots:"2 of 2 spots open" },
    { id:3, topic:"Graph Algorithms (BFS/DFS)", difficulty:"Hard", duration:60, host:"Meera Iyer", initial:"M", requirements:["Comfortable with adjacency lists","Dijkstra's algorithm a plus"], spots:"1 of 1 spot open" },
    { id:4, topic:"System Design Basics", difficulty:"Medium", duration:50, host:"Karan Singh", initial:"K", requirements:["Know client–server basics","No coding required"], spots:"1 of 3 spots open" },
    { id:5, topic:"SQL Joins & Subqueries", difficulty:"Easy", duration:30, host:"Priya Nair", initial:"P", requirements:["Basic SELECT statements"], spots:"2 of 2 spots open" }
  ];

  var state = "idle"; // idle | review | connecting | active | ended
  var selectedSprint = null;
  var secondsLeft = 0;
  var timerHandle = null;
  var sprintStartedAt = null;

  var diffClass = { Easy:"badge-easy", Medium:"badge-medium", Hard:"badge-hard" };

  // ---- Render sprint list ----
  var sprintListEl = qs("sprintList");
  function renderSprintList(){
    sprintListEl.innerHTML = "";
    sprints.forEach(function(s){
      var card = document.createElement("div");
      card.className = "sprint-card";
      if (selectedSprint && selectedSprint.id === s.id && state !== "idle") card.classList.add("selected");
      if (state !== "idle" && !(selectedSprint && selectedSprint.id === s.id)) card.classList.add("disabled");
      card.innerHTML =
        '<h4>' + s.topic + '</h4>' +
        '<div class="badge-row"><span class="badge ' + diffClass[s.difficulty] + '">' + s.difficulty + '</span><span class="badge">' + s.duration + ' min</span></div>' +
        '<div class="req">' + s.requirements.join(" • ") + '</div>' +
        '<div class="meta-row">' +
          '<div class="host-line"><span class="host-dot">' + s.initial + '</span>' + s.host + '</div>' +
          '<button class="btn-join" data-id="' + s.id + '">' + ((selectedSprint && selectedSprint.id === s.id && state !== "idle") ? "Selected" : "Join") + '</button>' +
        '</div>' +
        '<div class="muted" style="margin-top:6px;">' + s.spots + '</div>';
      sprintListEl.appendChild(card);
    });
    sprintListEl.querySelectorAll(".btn-join").forEach(function(btn){
      btn.addEventListener("click", function(){
        if (state !== "idle") return;
        var id = parseInt(btn.getAttribute("data-id"), 10);
        selectSprint(sprints.filter(function(s){ return s.id === id; })[0]);
      });
    });
  }

  // ---- Stage state machine ----
  var stageIds = ["stageIdle","stageReview","stageConnecting","stageActive","stageEnded"];
  function showStage(id){
    stageIds.forEach(function(sid){ qs(sid).classList.toggle("active", sid === id); });
  }
  var statusPill = qs("statusPill");
  var stageHint = qs("stageHint");
  var brandSub = qs("brandSub");
  var mainLayout = qs("mainLayout");
  var rightHalfStack = qs("rightHalfStack");

  function selectSprint(sprint){
    selectedSprint = sprint;
    state = "review";
    qs("reviewTopic").textContent = sprint.topic;
    qs("reviewMeta").textContent = sprint.duration + " min · Hosted by " + sprint.host;
    var reqList = qs("reviewReqList");
    reqList.innerHTML = "";
    sprint.requirements.forEach(function(r){
      var li = document.createElement("li");
      li.textContent = r;
      reqList.appendChild(li);
    });
    showStage("stageReview");
    statusPill.textContent = "Reviewing";
    stageHint.textContent = "Confirm to join this sprint";
    renderSprintList();
  }

  qs("cancelReviewBtn").addEventListener("click", function(){
    state = "idle"; selectedSprint = null;
    showStage("stageIdle");
    statusPill.textContent = "Browsing";
    stageHint.textContent = "Pick a sprint from the list on the left";
    renderSprintList();
  });

  qs("confirmJoinBtn").addEventListener("click", function(){
    state = "connecting";
    showStage("stageConnecting");
    qs("connectingName").textContent = "Connecting to " + selectedSprint.host + "…";
    statusPill.textContent = "Connecting";
    renderSprintList();
    setTimeout(function(){
      state = "active";
      sprintStartedAt = Date.now();
      qs("partnerAvatar").textContent = selectedSprint.initial;
      qs("partnerNameLabel").textContent = selectedSprint.host;
      qs("partnerStatus").textContent = "Live";
      brandSub.textContent = selectedSprint.topic + " — Peer Sprint";
      qs("practiceTitle").textContent = selectedSprint.topic + " — Practice";
      qs("practiceDiff").textContent = selectedSprint.difficulty;
      qs("practiceDiff").className = "diff-tag";
      
      // Activate 50/50 Split Layout Mode
      mainLayout.classList.add("active-sprint-mode");
      rightHalfStack.classList.add("active");

      showStage("stageActive");
      statusPill.textContent = "Live";
      statusPill.classList.add("live");
      stageHint.textContent = "Session in progress";
      secondsLeft = selectedSprint.duration * 60;
      qs("timerDisplay").textContent = formatTime(secondsLeft);
      startTimer();
      addChatMessage("system", "You're now connected with " + selectedSprint.host + ". Happy sprinting!");
      renderSprintList();
    }, 1600);
  });

  qs("hangupBtn").addEventListener("click", endSprint);

  function endSprint(){
    clearInterval(timerHandle);
    var elapsedMin = sprintStartedAt ? Math.max(1, Math.round((Date.now() - sprintStartedAt) / 60000)) : 0;
    qs("endedSummary").textContent = "You studied for " + elapsedMin + " minute" + (elapsedMin === 1 ? "" : "s") + " with " + selectedSprint.host + ".";
    state = "ended";
    
    // Deactivate 50/50 split layout
    mainLayout.classList.remove("active-sprint-mode");
    rightHalfStack.classList.remove("active");

    showStage("stageEnded");
    statusPill.textContent = "Ended";
    statusPill.classList.remove("live");
    stageHint.textContent = "Sprint finished";
    renderSprintList();
  }

  qs("backToListBtn").addEventListener("click", function(){
    state = "idle"; selectedSprint = null;
    showStage("stageIdle");
    statusPill.textContent = "Browsing";
    stageHint.textContent = "Pick a sprint from the list on the left";
    brandSub.textContent = "Browse sprints and pick one to begin";
    qs("timerDisplay").textContent = "--:--";
    renderSprintList();
  });

  // ---- Timer ----
  function formatTime(s){
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (sec < 10 ? "0" + sec : sec);
  }
  function startTimer(){
    clearInterval(timerHandle);
    timerHandle = setInterval(function(){
      secondsLeft--;
      qs("timerDisplay").textContent = formatTime(Math.max(0, secondsLeft));
      if (secondsLeft <= 0){ clearInterval(timerHandle); endSprint(); }
    }, 1000);
  }

  // ---- Mic / cam / hand / share toggles ----
  qs("micBtn").addEventListener("click", function(){
    this.classList.toggle("off");
    qs("youStatus").textContent = this.classList.contains("off") ? "Microphone muted" : "Camera ready";
  });
  qs("camBtn").addEventListener("click", function(){ this.classList.toggle("off"); });
  qs("handBtn").addEventListener("click", function(){
    var raised = this.classList.toggle("on-alt");
    if (raised) addChatMessage("system", "You raised your hand.");
  });
  qs("shareBtn").addEventListener("click", function(){
    var sharing = this.classList.toggle("on-alt");
    addChatMessage("system", sharing ? "You started sharing your screen." : "You stopped sharing your screen.");
  });

  // ---- Tabs & Expanded Code Window Logic ----
  var codeOverlay = qs("codeOverlay");
  var modalCodeArea = qs("modalCodeArea");
  var codeArea = qs("codeArea");
  var modalLangSelect = qs("modalLangSelect");
  var langSelect = qs("langSelect");

  // Copies the selected language (HTML option value) from one dropdown to the other.
  // If the target has no such option, it is added so the value never becomes empty.
  function syncLang(from, to){
    var val = from.value;
    var exists = Array.prototype.some.call(to.options, function(o){ return o.value === val; });
    if (!exists){
      var src = from.options[from.selectedIndex];
      var opt = document.createElement("option");
      opt.value = val;
      opt.textContent = src ? src.textContent : val;
      to.appendChild(opt);
    }
    to.value = val;
  }

  function openCodeModal(){
    modalCodeArea.value = codeArea.value;
    syncLang(langSelect, modalLangSelect);
    codeOverlay.hidden = false;
  }

  qs("codeTabBtn").addEventListener("click", openCodeModal);
  qs("expandCodeBtn").addEventListener("click", openCodeModal);

  qs("closeCodeModalBtn").addEventListener("click", function(){
    codeArea.value = modalCodeArea.value;
    syncLang(modalLangSelect, langSelect);
    codeOverlay.hidden = true;
  });

  modalLangSelect.addEventListener("change", function(){
    syncLang(modalLangSelect, langSelect);
  });

  var tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function(btn){
    btn.addEventListener("click", function(){
      tabButtons.forEach(function(b){ b.classList.remove("active"); });
      document.querySelectorAll(".tab-content").forEach(function(c){ c.classList.remove("active"); });
      btn.classList.add("active");
      qs("tab-" + btn.getAttribute("data-tab")).classList.add("active");
    });
  });

// ---- Code Execution Logic ----

async function executeCode(
    sourceCode,
    lang,
    inputValue,
    outputEl
)
{
    sourceCode = sourceCode.trim();

    inputValue = inputValue || "";

    if (!sourceCode)
    {
        outputEl.textContent =
            "Please write some code first.";

        return;
    }

    outputEl.textContent =
        "Running code...";

   try
{
    const response =
        await fetch("/Execution",
        {
            method: "POST",

            headers:
            {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify(
            {
                code: sourceCode,
                language: lang,
                input: inputValue
            })
        });


    const data =
        await response.json();


    // ====================================================
    // Backend / API error
    // ====================================================

    if (!response.ok)
    {
        outputEl.textContent =
            data.message ||
            data.error ||
            "Code execution request failed.";

        return;
    }


    // ====================================================
    // Program compilation / runtime result
    // ====================================================

    let result = "";


    // Normal program output
    if (data.stdout)
    {
        result += data.stdout;
    }


    // Compilation / runtime error
    if (data.stderr)
    {
        if (result)
        {
            result += "\n\n";
        }

        result += data.stderr;
    }


    // Exception
    if (data.exception)
    {
        if (result)
        {
            result += "\n\n";
        }

        result += data.exception;
    }


    // ====================================================
    // Nothing received
    // ====================================================

    if (!result)
    {
        if (data.status)
        {
            result =
                "Execution status: " +
                data.status;
        }
        else
        {
            result =
                "No output received.";
        }
    }


    outputEl.textContent = result;
}
catch (error)
{
    console.error(
        "Execution Error:",
        error
    );

    outputEl.textContent =
        "Unable to connect to execution server.";
}
}


// ============================================================
// Normal code window
// ============================================================

qs("runBtn").addEventListener(
    "click",
    function()
    {
        executeCode(
            codeArea.value,
            langSelect.value,
            "",
            qs("outputBox")
        );
    }
);


// ============================================================
// Expanded / modal code window
// ============================================================

qs("modalRunBtn").addEventListener(
    "click",
    function()
    {
        executeCode(
            modalCodeArea.value,
            modalLangSelect.value,
            qs("modalInputArea").value,
            qs("modalOutputBox")
        );
    }
);


  // ---- Notes ----
  var notesArea = qs("notesArea");
  try { var savedNotes = localStorage.getItem("sprintroom_notes"); if (savedNotes) notesArea.value = savedNotes; } catch(e) {}
  function updateWordCount(){
    var words = notesArea.value.trim().length ? notesArea.value.trim().split(/\s+/).length : 0;
    qs("wordCount").textContent = words + " word" + (words === 1 ? "" : "s");
  }
  notesArea.addEventListener("input", updateWordCount);
  updateWordCount();
  qs("saveNotesBtn").addEventListener("click", function(){
    try { localStorage.setItem("sprintroom_notes", notesArea.value); } catch(e) {}
    var flag = qs("saveFlag");
    flag.classList.add("show");
    setTimeout(function(){ flag.classList.remove("show"); }, 1600);
  });

  // ---- Practice ----
  var attempted = false;
  qs("attemptBtn").addEventListener("click", function(){
    attempted = !attempted;
    qs("attemptStamp").classList.toggle("show", attempted);
    this.textContent = attempted ? "Undo attempt mark" : "Mark as attempted";
  });

  // ---- Browser search ----
  qs("browserForm").addEventListener("submit", function(e){
    e.preventDefault();
    var q = qs("browserQuery").value.trim();
    if (!q) return;
    window.open("https://www.google.com/search?q=" + encodeURIComponent(q), "_blank", "noopener");
  });

  // ---- Chat ----
  var chatScroll = qs("chatScroll");
  var chatReplies = [
    "Sounds good, let's try that approach.",
    "Can you share your screen for a second?",
    "I think there's an edge case with empty input.",
    "Nice, that makes sense now.",
    "Let's move to the next part of the problem."
  ];
  function addChatMessage(kind, text){
    var div = document.createElement("div");
    div.className = "msg " + kind;
    div.textContent = text;
    chatScroll.appendChild(div);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }
  function sendChat(){
    var input = qs("chatInput");
    var text = input.value.trim();
    if (!text) return;
    addChatMessage("me", text);
    input.value = "";
    if (state === "active"){
      setTimeout(function(){ addChatMessage("them", pick(chatReplies)); }, 700 + Math.random() * 900);
    }
  }
  qs("chatSendBtn").addEventListener("click", sendChat);
  qs("chatInput").addEventListener("keydown", function(e){ if (e.key === "Enter") sendChat(); });

  // ---- Cursor AI ----
  var aiScroll = qs("aiScroll");
  function addAiMessage(kind, text){
    var div = document.createElement("div");
    div.className = "msg " + kind;
    div.textContent = text;
    aiScroll.appendChild(div);
    aiScroll.scrollTop = aiScroll.scrollHeight;
  }
  function getAiReply(msg){
    var m = msg.toLowerCase();
    if (m.indexOf("hint") !== -1) return "Try a simple brute-force approach first, then optimize.";
    if (m.indexOf("error") !== -1 || m.indexOf("bug") !== -1) return "Check your base cases and loop bounds first.";
    return "Good question — try breaking it down into smaller steps with your partner.";
  }
  function sendAi(){
    var input = qs("aiInput");
    var text = input.value.trim();
    if (!text) return;
    addAiMessage("me", text);
    input.value = "";
    setTimeout(function(){ addAiMessage("ai", getAiReply(text)); }, 500 + Math.random() * 500);
  }
  qs("aiSendBtn").addEventListener("click", sendAi);
  qs("aiInput").addEventListener("keydown", function(e){ if (e.key === "Enter") sendAi(); });

  // ---- Goals checklist ----
  var goalBoxes = document.querySelectorAll(".goal-item input");
  function updateGoals(){
    var done = 0;
    goalBoxes.forEach(function(box){
      box.closest(".goal-item").classList.toggle("done", box.checked);
      if (box.checked) done++;
    });
    qs("goalProgress").textContent = done + " of " + goalBoxes.length + " complete";
  }
  goalBoxes.forEach(function(box){ box.addEventListener("change", updateGoals); });
  updateGoals();

  // ---- Focus sound ----
  var audioCtx, oscA, oscB, filterNode, gainNode, focusOn = false;
  qs("focusToggle").addEventListener("click", function(){
    var btn = this;
    try {
      if (!focusOn){
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        oscA = audioCtx.createOscillator(); oscA.type = "sine"; oscA.frequency.value = 110;
        oscB = audioCtx.createOscillator(); oscB.type = "sine"; oscB.frequency.value = 114.5;
        filterNode = audioCtx.createBiquadFilter(); filterNode.type = "lowpass"; filterNode.frequency.value = 500;
        gainNode = audioCtx.createGain(); gainNode.gain.value = 0.0001;
        oscA.connect(filterNode); oscB.connect(filterNode); filterNode.connect(gainNode); gainNode.connect(audioCtx.destination);
        oscA.start(); oscB.start();
        gainNode.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + 1.2);
        focusOn = true;
        btn.classList.add("on");
        qs("focusState").textContent = "On";
      } else {
        if (gainNode) gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
        var a = oscA, b = oscB;
        setTimeout(function(){ try { a.stop(); b.stop(); } catch(e){} }, 700);
        focusOn = false;
        btn.classList.remove("on");
        qs("focusState").textContent = "Off";
      }
    } catch(e){
      showToast("Focus sound isn't supported in this browser.");
    }
  });

  // ---- Report modal ----
  var reportOverlay = qs("reportOverlay");
  qs("reportBtn").addEventListener("click", function(){ reportOverlay.hidden = false; });
  qs("reportCancelBtn").addEventListener("click", function(){ reportOverlay.hidden = true; });
  qs("reportSubmitBtn").addEventListener("click", function(){
    reportOverlay.hidden = true;
    qs("reportDetails").value = "";
    showToast("Report submitted successfully.");
  });

  // ---- Toast ----
  var toastEl = qs("toast");
  var toastTimer = null;
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove("show"); }, 2400);
  }

  renderSprintList();
})();