// ECO-3 AI Studio v1.0093 — Full Application
// 3 AI агента · 3 режима · 19 езика · 4 бюджета
// NO DEMO MODE — connects to real backend API + SQLite DB
const { useState, useRef, useEffect, useCallback } = React;

const API = (window.ECO3_CONFIG?.API_BASE || '/api/eco3/');

// ═══ CONFIG ═══
const CATS = [
  { id:"analytic", name:"Аналитичен", icon:"📊", color:"#4ecdc4",
    desc:"Събира реални данни от множество източници и ги представя структурирано",
    topics:["Войната в Украйна — поглед от 10 държави","Крипто пазарът последния месец",
      "AI революцията 2025","SpaceX новини","Климатични промени","Енергийната криза в Европа",
      "Инфлация по държави","Световни избори 2025","Петролът и газът",
      "Температури по света — 50 години","Автомобилен пазар 2025","Световни конфликти"]},
  { id:"generative", name:"Генеративен", icon:"🎬", color:"#a78bfa",
    desc:"Създава от нулата — истории, сценарии, етюди, приказки",
    topics:["Детективска история — убийство в провинцията","Sci-fi: първият контакт с извънземни",
      "Романтична история в стария Пловдив","Хорър — самотна къща в Родопите",
      "Комедия — български програмист в Силиконовата долина",
      "Фентъзи — последният магьосник на Балканите","Трилър — хакерска атака срещу банка",
      "Приказка за деца — магическата гора","Драма — три поколения в една къща"]},
  { id:"curated", name:"Кюраторски", icon:"✂️", color:"#ff6b6b",
    desc:"Взима готово от уеб, реже излишното, представя есенцията сгъстено",
    topics:["Крипто новини — топ YouTube канали","TED talks за AI — ключови идеи",
      "YouTube: Световна икономика тази седмица","Най-гледани tech ревюта този месец",
      "Документални за космоса","Подкасти за бизнес — ключови моменти",
      "YouTube: Геополитика — топ анализи","Фитнес YouTube — какво работи",
      "Кулинарни видеа — най-доброто от седмицата"]},
];

const LANGS = [
  {v:"bg",l:"🇧🇬 BG",f:"Bulgarian",tts:"bg-BG"},{v:"ru",l:"🇷🇺 RU",f:"Russian",tts:"ru-RU"},
  {v:"en",l:"🇬🇧 EN",f:"English",tts:"en-US"},{v:"it",l:"🇮🇹 IT",f:"Italian",tts:"it-IT"},
  {v:"es",l:"🇪🇸 ES",f:"Spanish",tts:"es-ES"},{v:"pt",l:"🇵🇹 PT",f:"Portuguese",tts:"pt-PT"},
  {v:"mx",l:"🇲🇽 MX",f:"Mexican Spanish",tts:"es-MX"},{v:"ng",l:"🇳🇬 NG",f:"Nigerian English",tts:"en-NG"},
  {v:"zh",l:"🇨🇳 ZH",f:"Chinese",tts:"zh-CN"},{v:"ja",l:"🇯🇵 JA",f:"Japanese",tts:"ja-JP"},
  {v:"fr",l:"🇫🇷 FR",f:"French",tts:"fr-FR"},{v:"de",l:"🇩🇪 DE",f:"German",tts:"de-DE"},
  {v:"ku",l:"🏴 KU",f:"Kurdish",tts:"ku"},{v:"tr",l:"🇹🇷 TR",f:"Turkish",tts:"tr-TR"},
  {v:"kk",l:"🇰🇿 KK",f:"Kazakh",tts:"kk-KZ"},{v:"ky",l:"🇰🇬 KY",f:"Kyrgyz",tts:"ky-KG"},
  {v:"az",l:"🇦🇿 AZ",f:"Azerbaijani",tts:"az-AZ"},{v:"ka",l:"🇬🇪 KA",f:"Georgian",tts:"ka-GE"},
  {v:"mn",l:"🇲🇳 MN",f:"Mongolian",tts:"mn-MN"},
];

const TONES = [
  {v:"original",l:"🎭 Оригинален"},{v:"dramatic",l:"🎬 Драматичен"},
  {v:"humorous",l:"😄 Хумористичен"},{v:"love",l:"❤️ Любовен"},{v:"polite",l:"🙏 Вежлив"},
];

const BUDGETS = {
  economy:  {l:"🥉 Икономичен",base:2.99,pm:0.10,src:"3-5",uniq:100,langs:"own",
    desc:"до 100 уникални · само избрания език · произволна подредба"},
  standard: {l:"🥈 Стандарт",base:4.99,pm:0.15,src:"8-15",uniq:150,langs:"own",
    desc:"до 150 уникални · само избрания език · по-добър глас"},
  premium:  {l:"🥇 Премиум",base:9.99,pm:0.25,src:"20-40",uniq:200,langs:"own+2",mix:0.5,
    desc:"до 200 уникални · +руски/английски · HD глас · word-mix 50%"},
  enterprise:{l:"💎 Ентърпрайз",base:49.99,pm:0.50,src:"50+",uniq:500,langs:"all",mix:0.5,
    desc:"до 500 уникални · всички 19 езика · word-mix"},
};

var CENSOR_KIDS = ["убийство","самоубийство","секс","пошлост","голота","алкохол","наркотик","дрога","проститу","порно","оръжие","кръв","насилие","псувн","мръсн"];
var CENSOR_SENIOR = ["смърт","болест","заболяван","старост","умиран","рак","деменция","инфаркт","инсулт"];

// ═══ HELPERS ═══
function filterContent(text, aud) {
  if (!text || aud === "adult" || aud === "none") return text;
  var list = aud === "kids" ? CENSOR_KIDS : CENSOR_SENIOR;
  var r = text;
  list.forEach(function(w) { r = r.replace(new RegExp(w, "gi"), function(m) { return m[0] + "***"; }); });
  return r;
}
function getSearchLangs(bud, uLang) {
  if (bud === "economy" || bud === "standard") return [uLang];
  if (bud === "premium") return (uLang === "ru" || uLang === "en") ? [uLang,"de","fr"] : [uLang,"ru","en"];
  return LANGS.map(function(l) { return l.v; });
}
function mixWords(text, chance) {
  if (Math.random() > chance) return text;
  var w = text.split(/\s+/);
  for (var i = w.length-1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var t=w[i]; w[i]=w[j]; w[j]=t; }
  return w.join(" ");
}
function isResetWarn() { return new Date().getUTCHours() >= 22; }
function fmtD(ts) { return new Date(ts).toLocaleString("bg-BG",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }

// API helpers
function apiGet(path) { return fetch(API + path).then(function(r) { return r.json(); }); }
function apiPost(path, body) {
  return fetch(API + path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) })
    .then(function(r) { return r.json(); });
}

// ═══ MAIN APP ═══
function ECO3() {
  var _a = useState(0), catIdx = _a[0], setCatIdx = _a[1];
  var _b = useState(""), topic = _b[0], setTopic = _b[1];
  var _c = useState(false), showTopics = _c[0], setShowTopics = _c[1];
  var _d = useState("none"), audience = _d[0], setAudience = _d[1];
  var _e = useState("original"), tone = _e[0], setTone = _e[1];
  var _f = useState("economy"), budget = _f[0], setBudget = _f[1];
  var _g = useState("bg"), lang = _g[0], setLang = _g[1];
  var _h = useState(10), duration = _h[0], setDuration = _h[1];
  var _i = useState("setup"), phase = _i[0], setPhase = _i[1];
  var _j = useState([]), logs = _j[0], setLogs = _j[1];
  var _k = useState(null), result = _k[0], setResult = _k[1];
  var _l = useState(false), speaking = _l[0], setSpeaking = _l[1];
  var _m = useState(false), showHist = _m[0], setShowHist = _m[1];
  var _n = useState([]), history = _n[0], setHistory = _n[1];
  var _o = useState([]), results = _o[0], setResults = _o[1];
  var _p = useState(0), uniqCount = _p[0], setUniqCount = _p[1];
  var _q = useState(null), serverStatus = _q[0], setServerStatus = _q[1];
  var _r = useState(null), error = _r[0], setError = _r[1];

  var cat = CATS[catIdx];
  var B = BUDGETS[budget];
  var canSearch = audience !== "none" && topic.trim().length > 0;

  // Load data from server on mount
  useEffect(function() {
    // Check server health
    apiGet("health").then(function(d) {
      setServerStatus(d);
    }).catch(function() {
      setServerStatus({ ok: false, error: "ECO-3 backend не е достъпен" });
    });
    // Load uniqueness count
    apiGet("uniqueness/count").then(function(d) { setUniqCount(d.count || 0); }).catch(function(){});
  }, []);

  // Load history + results when category changes
  useEffect(function() {
    apiGet("history?category=" + cat.id + "&limit=20").then(function(d) {
      setHistory(d.history || []);
    }).catch(function(){setHistory([]);});
    apiGet("results?category=" + cat.id + "&limit=10").then(function(d) {
      setResults(d.results || []);
    }).catch(function(){setResults([]);});
  }, [catIdx]);

  function addLog(role, msg) { setLogs(function(p) { return p.concat([{role:role,msg:msg,time:new Date().toLocaleTimeString("bg-BG")}]); }); }

  // Load cached result from DB (full content)
  function loadCached(r) {
    apiGet("results/" + r.id).then(function(full) {
      setResult({ topic:full.topic, cat:full.category, catName:cat.name, lang:full.language,
        budget:full.budget_tier, duration:full.duration_min,
        dirResult:full.director_output, archResult:full.architect_output, execResult:full.executor_output,
        time:full.created_at });
      setPhase("result");
      setTopic(full.topic);
    }).catch(function(err) { setError("Грешка при зареждане: " + err.message); });
  }

  // ── REAL SEARCH — 3 agents via Anthropic API ──
  function startSearch() {
    if (!canSearch) return;
    setPhase("running"); setLogs([]); setResult(null); setError(null);
    var searchTopic = B.mix ? mixWords(topic, B.mix) : topic;
    var sLangs = getSearchLangs(budget, lang);
    var langLabel = "Bulgarian"; LANGS.forEach(function(l) { if (l.v === lang) langLabel = l.f; });

    addLog("system", "Режим: "+cat.icon+" "+cat.name+" · "+B.l+" · Езици: "+sLangs.join(",")+" · "+duration+"м");
    if (B.mix && searchTopic !== topic) addLog("system", "Word-mix: \""+topic+"\" → \""+searchTopic+"\"");

    // Save to history (server DB)
    apiPost("history", { topic:topic, category:cat.id, language:lang, budget_tier:budget,
      duration_min:duration, audience:audience, tone:tone }).catch(function(){});

    // ── DIRECTOR ──
    addLog("director", "Търся информация и планирам структурата...");
    apiPost("generate", {
      system: "You are the DIRECTOR agent of ECO-3. Mode: "+cat.id+". Topic: \""+searchTopic+"\". Duration: "+duration+" min. Languages to search: "+sLangs.join(",")+". Plan the structure: how many parts, what sources, what regions. Respond in "+langLabel+". Be concise.",
      messages: [{role:"user", content:"Plan: \""+searchTopic+"\" ("+duration+" min, "+cat.name+" mode)"}],
      max_tokens: 2000
    }).then(function(d) {
      if (d.error) throw new Error(d.error);
      var dirText = (d.content||[]).map(function(b){return b.text||"";}).join("") || "No response";
      addLog("director", dirText.substring(0, 500));

      // ── ARCHITECT ──
      addLog("architect", "Разпределям задачите и времената...");
      return apiPost("generate", {
        system: "You are the ARCHITECT agent of ECO-3. Based on the director's plan, create detailed executable tasks with time allocation, quotas per country/source, and presentation format. Respond in "+langLabel+". Be specific.",
        messages: [{role:"user", content:"Director plan:\n"+dirText+"\n\nCreate detailed tasks for the executor."}],
        max_tokens: 2000
      }).then(function(d2) {
        if (d2.error) throw new Error(d2.error);
        var archText = (d2.content||[]).map(function(b){return b.text||"";}).join("");
        addLog("architect", archText.substring(0, 500));

        // ── EXECUTOR ──
        addLog("executor", "Изпълнявам задачите...");
        var tp = cat.id === "generative" && tone !== "original" ? "Apply tone: "+tone+". " : "";
        return apiPost("generate", {
          system: "You are the EXECUTOR agent of ECO-3. "+tp+"Execute the architect's tasks and produce the FINAL content for the audience. Duration target: "+duration+" min reading time. Present as structured, readable text with sections. Respond ENTIRELY in "+langLabel+". Do NOT include English if the language is not English.",
          messages: [{role:"user", content:"Architect tasks:\n"+archText+"\n\nExecute all tasks and produce final content."}],
          max_tokens: 4000
        }).then(function(d3) {
          if (d3.error) throw new Error(d3.error);
          var execText = (d3.content||[]).map(function(b){return b.text||"";}).join("");
          addLog("executor", "✅ Готово!");

          var filtered = filterContent(execText, audience);
          var entry = { topic:topic, cat:cat.id, catName:cat.name, lang:lang, budget:budget, duration:duration,
            dirResult:dirText, archResult:archText, execResult:filtered, time:Date.now() };

          // Save result to server DB
          apiPost("results", {
            topic:topic, category:cat.id, director_output:dirText, architect_output:archText,
            executor_output:filtered, language:lang, budget_tier:budget, duration_min:duration,
            audience:audience, tone:tone
          }).catch(function(){});

          // Update uniqueness
          apiPost("uniqueness/add", { title:topic, source:"eco3-search" }).then(function(d) {
            setUniqCount(d.todayCount || 0);
          }).catch(function(){});

          setResult(entry); setPhase("result");
        });
      });
    }).catch(function(err) {
      addLog("error", "❌ "+err.message);
      setError(err.message);
      // Stay on running phase so user can see logs + error
    });
  }

  // ── TTS ──
  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text.replace(/[▸•📊🎬✂️\[\]]/g,""));
    var tl = "bg-BG"; LANGS.forEach(function(l){if(l.v===lang)tl=l.tts;});
    u.lang = tl; u.rate = 0.9;
    u.onend = function(){ setSpeaking(false); };
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() { if(window.speechSynthesis) window.speechSynthesis.cancel(); setSpeaking(false); }

  // ═══ STYLES ═══
  var S = {
    wrap:{minHeight:"100vh",background:"#0a0a0f",color:"#e1e4e8",fontFamily:"'JetBrains Mono',monospace",padding:"0 0 60px"},
    hdr:{padding:"30px 20px 20px",textAlign:"center",borderBottom:"1px solid rgba(255,255,255,.06)"},
    ttl:{fontSize:36,fontWeight:700,background:"linear-gradient(135deg,#00ff88,#00b4d8,#9b5de5)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontFamily:"'Crimson Pro',serif"},
    sub:{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:6},
    mn:{maxWidth:800,margin:"0 auto",padding:"20px"},
    cd:{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:16},
    lb:{fontSize:11,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:8},
    rw:{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"},
    inp:{width:"100%",padding:"10px 14px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#fff",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"},
    warn:{background:"rgba(255,200,0,.08)",border:"1px solid rgba(255,200,0,.3)",borderRadius:8,padding:"10px 14px",fontSize:11,color:"#ffd700",marginBottom:12,textAlign:"center"},
    errBox:{background:"rgba(248,81,73,.08)",border:"1px solid rgba(248,81,73,.3)",borderRadius:8,padding:"10px 14px",fontSize:11,color:"#f85149",marginBottom:12,textAlign:"center"},
  };
  function pill(a,c){return{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .2s",border:"1px solid "+(a?(c||"#00ff88"):"rgba(255,255,255,.1)"),background:a?(c||"#00ff88")+"18":"transparent",color:a?(c||"#00ff88"):"rgba(255,255,255,.5)"};}
  function btn(ok){return{padding:"12px 30px",borderRadius:25,border:"none",cursor:ok?"pointer":"default",fontSize:14,fontWeight:700,fontFamily:"'Crimson Pro',serif",background:ok?"linear-gradient(135deg,#00ff88,#00b4d8)":"rgba(255,255,255,.05)",color:ok?"#0a0a0f":"rgba(255,255,255,.2)",opacity:ok?1:0.5};}
  function logLn(role){var c=role==="director"?"#ff6b6b":role==="architect"?"#4ecdc4":role==="executor"?"#ffe66d":role==="error"?"#f85149":"#58a6ff";return{padding:"6px 10px",fontSize:11,borderLeft:"3px solid "+c,marginBottom:4,lineHeight:1.5,color:"rgba(255,255,255,.7)",background:"rgba(255,255,255,.02)",borderRadius:"0 6px 6px 0"};}
  var roleName = {system:"Система",director:"Директор",architect:"Архитект",executor:"Изпълнител",error:"Грешка"};

  // ═══ SETUP ═══
  if (phase === "setup") return React.createElement("div",{style:S.wrap},
    React.createElement("div",{style:S.hdr},
      React.createElement("div",{style:S.ttl},"ECO-3"),
      React.createElement("div",{style:{fontSize:13,color:"rgba(255,255,255,.35)",fontFamily:"'Crimson Pro',serif",letterSpacing:2,marginTop:4}},"INTELLIGENT CONTENT SEARCH ENGINE"),
      React.createElement("div",{style:S.sub},"3 AI агента · 19 езика · KCY Ecosystem"+(serverStatus&&serverStatus.mode==="test"?" · 🧪 TEST MODE":""))
    ),
    React.createElement("div",{style:S.mn},

      // Server status
      serverStatus && !serverStatus.ok && React.createElement("div",{style:S.errBox},
        "⚠️ Backend: "+(serverStatus.error || "не е достъпен")+" — проверете дали kcy-eco3 service работи"
      ),
      serverStatus && serverStatus.ok && serverStatus.mode === "test" && React.createElement("div",{style:S.warn},
        "🧪 TEST MODE — безплатно, mock данни. За реални заявки: ECO3_MODE=production в .env"
      ),
      serverStatus && serverStatus.ok && serverStatus.mode !== "test" && !serverStatus.anthropic?.configured && React.createElement("div",{style:S.errBox},
        "⚠️ Anthropic API ключ не е конфигуриран в .env — търсенето няма да работи"
      ),
      error && React.createElement("div",{style:S.errBox}, error),
      isResetWarn() && React.createElement("div",{style:S.warn},"⚠️ Ако желаете уникалност, изчакайте до 00:00 UTC преди ново търсене."),

      // Category
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Режим"),
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:20,margin:"16px 0"}},
          React.createElement("div",{style:{fontSize:24,cursor:"pointer",padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#fff",userSelect:"none"},onClick:function(){setCatIdx(function(i){return i===0?CATS.length-1:i-1;})}},"←"),
          React.createElement("div",{style:{textAlign:"center",minWidth:200}},
            React.createElement("div",{style:{fontSize:32}},cat.icon),
            React.createElement("div",{style:{fontSize:18,fontWeight:700,color:cat.color,margin:"4px 0"}},cat.name),
            React.createElement("div",{style:{fontSize:11,color:"rgba(255,255,255,.4)"}},cat.desc)
          ),
          React.createElement("div",{style:{fontSize:24,cursor:"pointer",padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#fff",userSelect:"none"},onClick:function(){setCatIdx(function(i){return i===CATS.length-1?0:i+1;})}},"→")
        )
      ),

      // Cached results from DB
      results.length > 0 && React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"📦 Предишни резултати — зареди без търсене"),
        results.slice(0,5).map(function(r,i){
          return React.createElement("div",{key:i,onClick:function(){loadCached(r);},style:{padding:"8px 12px",borderRadius:8,cursor:"pointer",fontSize:12,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",display:"flex",justifyContent:"space-between",marginBottom:4}},
            React.createElement("span",{style:{color:"rgba(255,255,255,.7)"}},r.topic),
            React.createElement("span",{style:{color:"rgba(255,255,255,.3)",fontSize:10}},fmtD(r.created_at)+" · "+r.duration_min+"м")
          );
        })
      ),

      // Topic
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Тема"),
        React.createElement("input",{style:S.inp,value:topic,onChange:function(e){setTopic(e.target.value);},placeholder:"Въведи тема или избери от списъка..."}),
        React.createElement("div",{style:{marginTop:8}},
          React.createElement("span",{style:Object.assign({},pill(false),{fontSize:10}),onClick:function(){setShowTopics(!showTopics);}},showTopics?"▲ Скрий":"▼ Пълен списък"),
          history.length > 0 && React.createElement("span",{style:Object.assign({},pill(false),{fontSize:10,marginLeft:6}),onClick:function(){setShowHist(!showHist);}},"🕐 История ("+history.length+")")
        ),
        showTopics && React.createElement("div",{style:{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}},
          cat.topics.map(function(t){return React.createElement("span",{key:t,onClick:function(){setTopic(t);setShowTopics(false);},style:Object.assign({},pill(topic===t,cat.color),{fontSize:11})},t);})
        ),
        showHist && React.createElement("div",{style:{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}},
          history.slice(0,20).map(function(h,i){return React.createElement("span",{key:i,onClick:function(){setTopic(h.topic);setShowHist(false);},style:Object.assign({},pill(false,"#ffd700"),{fontSize:10})},"🕐 "+h.topic);})
        )
      ),

      // Audience
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Аудитория "+(audience==="none"?"⚠️ ЗАДЪЛЖИТЕЛНО":"")),
        React.createElement("div",{style:S.rw},
          [{v:"none",l:"❓ Неопределена"},{v:"kids",l:"🧒 Деца (0-20)"},{v:"adult",l:"👔 Възрастни"},{v:"senior",l:"📖 60+"}].map(function(a){return React.createElement("span",{key:a.v,onClick:function(){setAudience(a.v);},style:pill(audience===a.v,a.v==="none"?"#f85149":"#00ff88")},a.l);})
        ),
        audience==="none" && React.createElement("div",{style:{fontSize:10,color:"#f85149",marginTop:6}},"🔒 Изберете аудитория за да отключите търсенето")
      ),

      // Tone (generative only)
      cat.id==="generative" && React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Тон (само за генеративен)"),
        React.createElement("div",{style:S.rw},TONES.map(function(t){return React.createElement("span",{key:t.v,onClick:function(){setTone(t.v);},style:pill(tone===t.v,"#a78bfa")},t.l);}))
      ),

      // Budget
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Бюджет"),
        React.createElement("div",{style:S.rw},Object.keys(BUDGETS).map(function(k){return React.createElement("span",{key:k,onClick:function(){setBudget(k);},style:pill(budget===k,"#ffe66d")},BUDGETS[k].l);})),
        React.createElement("div",{style:{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:6}},B.desc+" · €"+B.base+" + €"+B.pm+"/мин · "+B.src+" източника"),
        React.createElement("div",{style:{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2}},"Уникалност: "+uniqCount+"/"+B.uniq+" днес")
      ),

      // Language
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Език"),
        React.createElement("div",{style:Object.assign({},S.rw,{gap:4})},LANGS.map(function(l){return React.createElement("span",{key:l.v,onClick:function(){setLang(l.v);},style:Object.assign({},pill(lang===l.v,"#00b4d8"),{padding:"4px 8px",fontSize:11})},l.l);}))
      ),

      // Duration
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Продължителност: "+duration+" мин"),
        React.createElement("input",{type:"range",min:1,max:120,value:duration,onChange:function(e){setDuration(+e.target.value);},style:{width:"100%",accentColor:"#00ff88"}}),
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,.2)"}},
          React.createElement("span",null,"1м"),React.createElement("span",null,"30м"),React.createElement("span",null,"60м"),React.createElement("span",null,"120м")
        ),
        React.createElement("div",{style:{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:4}},"Цена: €"+(B.base+duration*B.pm).toFixed(2))
      ),

      // Start
      React.createElement("div",{style:{textAlign:"center",marginTop:20}},
        React.createElement("button",{style:btn(canSearch),onClick:canSearch?startSearch:undefined},
          audience==="none"?"🔒 Изберете аудитория":topic?"🚀 Старт — "+cat.icon+" "+cat.name:"Въведете тема")
      )
    )
  );

  // ═══ RUNNING ═══
  if (phase === "running") return React.createElement("div",{style:S.wrap},
    React.createElement("div",{style:S.hdr},
      React.createElement("div",{style:Object.assign({},S.ttl,{fontSize:24})},error?"❌ Грешка":"⏳ Обработка..."),
      React.createElement("div",{style:S.sub},cat.icon+" "+cat.name+" · \""+topic+"\" · "+duration+"м")
    ),
    React.createElement("div",{style:S.mn},
      error && React.createElement("div",{style:S.errBox},error),
      React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"Лог на агентите"),
        logs.map(function(l,i){return React.createElement("div",{key:i,style:logLn(l.role)},
          React.createElement("span",{style:{color:"rgba(255,255,255,.3)",marginRight:8}},l.time),
          React.createElement("strong",{style:{color:l.role==="director"?"#ff6b6b":l.role==="architect"?"#4ecdc4":l.role==="executor"?"#ffe66d":"#58a6ff"}},"["+(roleName[l.role]||l.role)+"]"),
          " "+l.msg
        );}),
        !error && React.createElement("div",{style:{textAlign:"center",padding:20}},
          React.createElement("div",{style:{width:30,height:30,border:"3px solid rgba(0,255,136,.15)",borderTopColor:"#00ff88",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto"}})
        )
      ),
      error && React.createElement("div",{style:{textAlign:"center",marginTop:20}},
        React.createElement("button",{onClick:function(){setPhase("setup");setError(null);setLogs([]);},style:Object.assign({},btn(true),{background:"rgba(255,255,255,.08)",color:"#00ff88"})},"← Назад")
      )
    ),
    React.createElement("style",null,"@keyframes spin{to{transform:rotate(360deg);}}")
  );

  // ═══ RESULT ═══
  return React.createElement("div",{style:S.wrap},
    React.createElement("div",{style:S.hdr},
      React.createElement("div",{style:Object.assign({},S.ttl,{fontSize:24})},"✅ Резултат"),
      React.createElement("div",{style:S.sub},(result?result.catName:cat.name)+" · \""+(result?result.topic:topic)+"\" · "+(result?result.duration:duration)+"м")
    ),
    React.createElement("div",{style:S.mn},
      result&&result.dirResult && React.createElement("div",{style:Object.assign({},S.cd,{borderLeft:"3px solid #ff6b6b"})},
        React.createElement("div",{style:Object.assign({},S.lb,{color:"#ff6b6b"})},"🎯 Директор"),
        React.createElement("div",{style:{fontSize:12,color:"rgba(255,255,255,.6)",whiteSpace:"pre-wrap",lineHeight:1.6}},result.dirResult)
      ),
      result&&result.archResult && React.createElement("div",{style:Object.assign({},S.cd,{borderLeft:"3px solid #4ecdc4"})},
        React.createElement("div",{style:Object.assign({},S.lb,{color:"#4ecdc4"})},"🏗️ Архитект"),
        React.createElement("div",{style:{fontSize:12,color:"rgba(255,255,255,.6)",whiteSpace:"pre-wrap",lineHeight:1.6}},result.archResult)
      ),
      React.createElement("div",{style:Object.assign({},S.cd,{borderLeft:"3px solid #ffe66d"})},
        React.createElement("div",{style:Object.assign({},S.lb,{color:"#ffe66d"})},"⚡ Съдържание"),
        React.createElement("div",{style:{fontSize:13,color:"rgba(255,255,255,.8)",whiteSpace:"pre-wrap",lineHeight:1.8}},result?result.execResult:"Няма")
      ),
      // TTS
      React.createElement("div",{style:Object.assign({},S.cd,{textAlign:"center"})},
        React.createElement("div",{style:S.lb},"🔊 Аудио"),
        React.createElement("div",{style:{display:"flex",gap:10,justifyContent:"center",marginTop:8}},
          React.createElement("button",{onClick:function(){speak(result?result.execResult:"");},disabled:speaking,style:Object.assign({},btn(!speaking),{fontSize:12,padding:"8px 20px"})},speaking?"⏳ Говори...":"▶ Възпроизведи"),
          speaking && React.createElement("button",{onClick:stopSpeak,style:Object.assign({},btn(true),{fontSize:12,padding:"8px 20px",background:"rgba(248,81,73,.2)",color:"#f85149"})},"⏹ Спри")
        )
      ),
      // Logs
      logs.length > 0 && React.createElement("div",{style:S.cd},
        React.createElement("div",{style:S.lb},"📋 Лог на агентите"),
        logs.map(function(l,i){return React.createElement("div",{key:i,style:logLn(l.role)},
          React.createElement("span",{style:{color:"rgba(255,255,255,.3)",marginRight:6,fontSize:10}},l.time),
          React.createElement("strong",{style:{color:l.role==="director"?"#ff6b6b":l.role==="architect"?"#4ecdc4":l.role==="executor"?"#ffe66d":"#58a6ff",fontSize:10}},"["+(roleName[l.role]||l.role)+"]"),
          React.createElement("span",{style:{fontSize:10}}," "+l.msg.substring(0,300)+(l.msg.length>300?"...":""))
        );})
      ),
      // Back
      React.createElement("div",{style:{textAlign:"center",marginTop:20}},
        React.createElement("button",{onClick:function(){setPhase("setup");setResult(null);setLogs([]);},style:Object.assign({},btn(true),{background:"rgba(255,255,255,.08)",color:"#00ff88"})},"← Ново търсене")
      )
    )
  );
}

window.ECO3 = ECO3;
