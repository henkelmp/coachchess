"use strict";
const F="abcdefgh",U={wK:"♚",wQ:"♛",wR:"♜",wB:"♝",wN:"♞",wP:"♟",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"},V={P:100,N:320,B:330,R:500,Q:900,K:20000};
let S,H=[],sel=null,T=[],flip=false,busy=false,deferredPrompt=null;
let sfWorker=null,sfReady=false,sfBusy=false,sfQueue=[],sfInitTimer=null;
const APP_VERSION="2.2.0";
const SF_SCRIPT="engine.js";
const SF_WASM="engine.wasm";

function engineLabel(text){
  const el=document.getElementById("engineStatus");
  if(el)el.textContent=text;
}
function engineDiagnostic(lines){
  const el=document.getElementById("engineDiagnostic");
  if(el)el.innerHTML=lines.join("<br>");
}
async function resourceCheck(path){
  try{
    const response=await fetch(path+"?v="+APP_VERSION,{cache:"reload"});
    return {ok:response.ok,status:response.status,type:response.headers.get("content-type")||"unbekannt"};
  }catch(error){
    return {ok:false,status:0,type:String(error.message||error)};
  }
}
async function initStockfish(){
  const diagnostics=["✓ Oberfläche und Schachregeln geladen"];
  engineLabel("Stockfish wird geprüft …");
  engineDiagnostic(diagnostics);

  const jsCheck=await resourceCheck(SF_SCRIPT);
  diagnostics.push(jsCheck.ok?"✓ Engine-Datei gefunden":"✗ Engine-Datei nicht erreichbar (HTTP "+(jsCheck.status||"Fehler")+")");
  engineDiagnostic(diagnostics);

  const wasmCheck=await resourceCheck(SF_WASM);
  diagnostics.push(wasmCheck.ok?"✓ WebAssembly-Datei gefunden":"✗ WebAssembly-Datei nicht erreichbar (HTTP "+(wasmCheck.status||"Fehler")+")");
  engineDiagnostic(diagnostics);

  if(!jsCheck.ok||!wasmCheck.ok){
    engineLabel("Ersatz-Engine aktiv · Dateien fehlen");
    return;
  }

  try{
    const baseURL=new URL("./",location.href);const workerURL=new URL(SF_SCRIPT+"?v="+APP_VERSION,baseURL).href;sfWorker=new Worker(workerURL);
    diagnostics.push("✓ Stockfish-Prozess gestartet");
    engineDiagnostic(diagnostics);

    sfWorker.onmessage=event=>{
      const line=String(event.data||"").trim();
      if(line==="uciok"){
        diagnostics.push("✓ UCI-Verbindung hergestellt");
        engineDiagnostic(diagnostics);
        sfWorker.postMessage("isready");
        return;
      }
      if(line==="readyok"){
        clearTimeout(sfInitTimer);
        sfReady=true;
        diagnostics.push("✓ Stockfish 18 ist spielbereit");
        engineDiagnostic(diagnostics);
        engineLabel("Stockfish 18 bereit");
        return;
      }
      if(line.startsWith("bestmove ")){
        const item=sfQueue.shift();
        sfBusy=false;
        if(item)item.resolve(line.split(/\s+/)[1]);
      }
    };
    sfWorker.onerror=event=>{
      clearTimeout(sfInitTimer);
      sfReady=false;sfBusy=false;
      diagnostics.push("✗ Worker-Fehler: "+(event.message||"unbekannt"));
      engineDiagnostic(diagnostics);
      engineLabel("Ersatz-Engine aktiv · Startfehler");
    };
    sfWorker.postMessage("uci");
    sfInitTimer=setTimeout(()=>{
      if(!sfReady){
        diagnostics.push("✗ Stockfish antwortet nicht innerhalb von 12 Sekunden");
        engineDiagnostic(diagnostics);
        engineLabel("Ersatz-Engine aktiv · Zeitüberschreitung");
      }
    },12000);
  }catch(error){
    diagnostics.push("✗ Browserfehler: "+String(error.message||error));
    engineDiagnostic(diagnostics);
    engineLabel("Ersatz-Engine aktiv · Browserfehler");
  }
}
function uciMoveToLegal(uci,s){
  if(!uci||uci==="(none)")return null;
  const from=ix(F.indexOf(uci[0]),8-Number(uci[1]));
  const to=ix(F.indexOf(uci[2]),8-Number(uci[3]));
  const promotion=uci[4]?uci[4].toUpperCase():null;
  return legal(s).find(m=>m.from===from&&m.to===to&&(!promotion||m.promotion===promotion))||null;
}
function stockfishBestMove(s,depth=10){
  return new Promise((resolve,reject)=>{
    if(!sfReady||!sfWorker||sfBusy){reject(new Error("Stockfish nicht bereit"));return}
    sfBusy=true;sfQueue.push({resolve,reject});
    sfWorker.postMessage("position fen "+fen(s));
    sfWorker.postMessage("go depth "+depth);
    setTimeout(()=>{if(sfBusy){try{sfWorker.postMessage("stop")}catch{}}},7000);
  });
}

const xy=i=>[i%8,Math.floor(i/8)],ix=(x,y)=>y*8+x,ins=(x,y)=>x>=0&&x<8&&y>=0&&y<8,foe=c=>c==="w"?"b":"w",nm=i=>{let[x,y]=xy(i);return F[x]+(8-y)};
function init(){let b=Array(64).fill(null),q=["R","N","B","Q","K","B","N","R"];for(let x=0;x<8;x++){b[x]={c:"b",t:q[x]};b[8+x]={c:"b",t:"P"};b[48+x]={c:"w",t:"P"};b[56+x]={c:"w",t:q[x]}}return{b,turn:"w",cas:{wK:1,wQ:1,bK:1,bQ:1},ep:-1,half:0,full:1,last:null}}
function cp(s){return{b:s.b.map(p=>p?{...p}:null),turn:s.turn,cas:{...s.cas},ep:s.ep,half:s.half,full:s.full,last:s.last?{...s.last}:null}}
function at(s,x,y){return ins(x,y)?s.b[ix(x,y)]:null}
function atk(s,z,c){let[x,y]=xy(z),pd=c==="w"?-1:1;for(let dx of[-1,1]){let p=at(s,x+dx,y-pd);if(p&&p.c===c&&p.t==="P")return 1}
for(let[a,b]of[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]){let p=at(s,x+a,y+b);if(p&&p.c===c&&p.t==="N")return 1}
for(let[a,b,t]of[[1,0,"RQ"],[-1,0,"RQ"],[0,1,"RQ"],[0,-1,"RQ"],[1,1,"BQ"],[1,-1,"BQ"],[-1,1,"BQ"],[-1,-1,"BQ"]]){let X=x+a,Y=y+b;while(ins(X,Y)){let p=at(s,X,Y);if(p){if(p.c===c&&t.includes(p.t))return 1;break}X+=a;Y+=b}}
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(a||b){let p=at(s,x+a,y+b);if(p&&p.c===c&&p.t==="K")return 1}return 0}
function king(s,c){return s.b.findIndex(p=>p&&p.c===c&&p.t==="K")}function chk(s,c){return atk(s,king(s,c),foe(c))}
function pseudo(s,f){let p=s.b[f];if(!p)return[];let[x,y]=xy(f),o=[],add=(to,e={})=>o.push({from:f,to,...e});
if(p.t==="P"){let d=p.c==="w"?-1:1,st=p.c==="w"?6:1,pr=p.c==="w"?0:7;if(ins(x,y+d)&&!at(s,x,y+d)){add(ix(x,y+d),{promotion:y+d===pr?"Q":null});if(y===st&&!at(s,x,y+2*d))add(ix(x,y+2*d),{double:1})}for(let dx of[-1,1])if(ins(x+dx,y+d)){let to=ix(x+dx,y+d),q=s.b[to];if(q&&q.c!==p.c)add(to,{promotion:y+d===pr?"Q":null});else if(to===s.ep)add(to,{ep:1})}}
if(p.t==="N")for(let[a,b]of[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]])if(ins(x+a,y+b)){let q=at(s,x+a,y+b);if(!q||q.c!==p.c)add(ix(x+a,y+b))}
if("BRQ".includes(p.t)){let ds=[];if("RQ".includes(p.t))ds.push([1,0],[-1,0],[0,1],[0,-1]);if("BQ".includes(p.t))ds.push([1,1],[1,-1],[-1,1],[-1,-1]);for(let[a,b]of ds){let X=x+a,Y=y+b;while(ins(X,Y)){let q=at(s,X,Y);if(!q)add(ix(X,Y));else{if(q.c!==p.c)add(ix(X,Y));break}X+=a;Y+=b}}}
if(p.t==="K"){for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(a||b)if(ins(x+a,y+b)){let q=at(s,x+a,y+b);if(!q||q.c!==p.c)add(ix(x+a,y+b))}
let r=p.c==="w"?7:0,e=foe(p.c);if(y===r&&x===4&&!chk(s,p.c)){if(s.cas[p.c+"K"]&&!s.b[ix(5,r)]&&!s.b[ix(6,r)]&&s.b[ix(7,r)]?.t==="R"&&!atk(s,ix(5,r),e)&&!atk(s,ix(6,r),e))add(ix(6,r),{castle:"K"});if(s.cas[p.c+"Q"]&&!s.b[ix(1,r)]&&!s.b[ix(2,r)]&&!s.b[ix(3,r)]&&s.b[ix(0,r)]?.t==="R"&&!atk(s,ix(3,r),e)&&!atk(s,ix(2,r),e))add(ix(2,r),{castle:"Q"})}}
return o}
function apply(s,m){let n=cp(s),p=n.b[m.from],cap=n.b[m.to];n.last={from:m.from,to:m.to};n.b[m.to]=p;n.b[m.from]=null;if(m.ep){let[x,y]=xy(m.to);n.b[ix(x,y+(p.c==="w"?1:-1))]=null}if(m.castle){let r=p.c==="w"?7:0;if(m.castle==="K"){n.b[ix(5,r)]=n.b[ix(7,r)];n.b[ix(7,r)]=null}else{n.b[ix(3,r)]=n.b[ix(0,r)];n.b[ix(0,r)]=null}}if(m.promotion)p.t=m.promotion;if(p.t==="K"){n.cas[p.c+"K"]=0;n.cas[p.c+"Q"]=0}if(p.t==="R"){if(m.from===63)n.cas.wK=0;if(m.from===56)n.cas.wQ=0;if(m.from===7)n.cas.bK=0;if(m.from===0)n.cas.bQ=0}if(cap&&cap.t==="R"){if(m.to===63)n.cas.wK=0;if(m.to===56)n.cas.wQ=0;if(m.to===7)n.cas.bK=0;if(m.to===0)n.cas.bQ=0}n.ep=-1;if(p.t==="P"&&Math.abs(m.to-m.from)===16)n.ep=(m.to+m.from)/2;n.half=(p.t==="P"||cap||m.ep)?0:n.half+1;if(s.turn==="b")n.full++;n.turn=foe(s.turn);return n}
function legal(s,only=null){let o=[];for(let i=0;i<64;i++){let p=s.b[i];if(!p||p.c!==s.turn||(only!==null&&i!==only))continue;for(let m of pseudo(s,i)){let n=apply(s,m);if(!chk(n,p.c))o.push(m)}}return o}
function san(s,m){let p=s.b[m.from],cap=!!s.b[m.to]||m.ep;if(m.castle)return m.castle==="K"?"O-O":"O-O-O";let t=p.t==="P"?"":p.t;if(p.t==="P"&&cap)t+=F[xy(m.from)[0]];else if(p.t!=="P"){let same=legal(s).filter(z=>z.to===m.to&&z.from!==m.from&&s.b[z.from]?.t===p.t);if(same.length){let[fx,fy]=xy(m.from);t+=!same.some(z=>xy(z.from)[0]===fx)?F[fx]:(8-fy)}}if(cap)t+="x";t+=nm(m.to);if(m.promotion)t+="="+m.promotion;let n=apply(s,m),r=legal(n);if(chk(n,n.turn))t+=r.length?"+":"#";return t}
function ev(s){let z=0;for(let i=0;i<64;i++){let p=s.b[i];if(!p)continue;let v=V[p.t],[x,y]=xy(i),c=(3.5-Math.abs(3.5-x))+(3.5-Math.abs(3.5-y));if(p.t==="N"||p.t==="B")v+=c*4;if(p.t==="P")v+=(p.c==="w"?6-y:y-1)*6;z+=(p.c==="w"?1:-1)*v}return z}
function ord(s){return legal(s).sort((a,b)=>(s.b[b.to]?V[s.b[b.to].t]:0)-(s.b[a.to]?V[s.b[a.to].t]:0))}
function mm(s,d,a,b){let ms=ord(s);if(!ms.length)return chk(s,s.turn)?(s.turn==="w"?-999999:999999):0;if(!d)return ev(s);if(s.turn==="w"){let q=-1e9;for(let m of ms){q=Math.max(q,mm(apply(s,m),d-1,a,b));a=Math.max(a,q);if(b<=a)break}return q}else{let q=1e9;for(let m of ms){q=Math.min(q,mm(apply(s,m),d-1,a,b));b=Math.min(b,q);if(b<=a)break}return q}}
function fallbackAI(){let lv=+document.getElementById("level").value,ms=ord(S);if(!ms.length)return null;if(lv===1)return ms[Math.floor(Math.random()*ms.length)];let d=lv===2?2:3,best=[],bs=1e9;for(let m of ms){let z=mm(apply(S,m),d-1,-1e9,1e9);if(z<bs){bs=z;best=[m]}else if(z===bs)best.push(m)}return best[Math.floor(Math.random()*best.length)]}
async function chooseComputerMove(){
  const level=+document.getElementById("level").value;
  const depth=level===1?5:level===2?9:12;
  try{
    const uci=await stockfishBestMove(S,depth);
    const move=uciMoveToLegal(uci,S);
    if(move)return move;
  }catch(e){}
  engineLabel(sfReady?"Stockfish bereit · Ersatzsuche verwendet":"Ersatz-Engine aktiv");
  return fallbackAI();
}

function save(){localStorage.setItem("coachchess-pwa",JSON.stringify({S,H}))}function load(){try{let x=JSON.parse(localStorage.getItem("coachchess-pwa"));if(x?.S?.b?.length===64){S=x.S;H=x.H||[];return}}catch{}S=init()}
function play(m,bot=0){let n=san(S,m),before=cp(S);H.push({before,n,m:{...m}});S=apply(S,m);sel=null;T=[];save();render();if(!bot&&S.turn==="b"&&legal(S).length){busy=1;status();setTimeout(async()=>{let q=await chooseComputerMove();if(q)play(q,1);busy=0;coach(n,q?H.at(-1).n:"");render()},150)}}
function click(i){if(busy||S.turn!=="w"||!legal(S).length)return;let m=T.find(x=>x.to===i);if(m){if(m.promotion){let q=(prompt("Umwandlung: Q, R, B oder N","Q")||"Q").toUpperCase();m.promotion=["Q","R","B","N"].includes(q)?q:"Q"}play(m);return}let p=S.b[i];if(p&&p.c==="w"){sel=i;T=legal(S,i)}else{sel=null;T=[]}render()}
function render(){let b=document.getElementById("board");b.innerHTML="";let O=[];for(let ry=0;ry<8;ry++)for(let rx=0;rx<8;rx++){let x=flip?7-rx:rx,y=flip?7-ry:ry;O.push(ix(x,y))}for(let i of O){let[x,y]=xy(i),q=document.createElement("button");q.className="sq "+((x+y)%2?"d":"l");if(S.last&&(i===S.last.from||i===S.last.to))q.classList.add("last");if(i===sel)q.classList.add("sel");let lm=T.find(m=>m.to===i);if(lm)q.classList.add(S.b[i]||lm.ep?"capture":"legal");let p=S.b[i];if(p){q.textContent=U[p.c+p.t];q.classList.add(p.c)}let f=document.createElement("span");f.className="coord file";f.textContent=F[x];let r=document.createElement("span");r.className="coord rank";r.textContent=8-y;q.append(f,r);q.onclick=()=>click(i);b.appendChild(q)}moves();status();document.getElementById("fen").value=fen(S);document.getElementById("undo").disabled=!H.length||busy}
function moves(){let b=document.getElementById("moves");b.innerHTML="";for(let i=0;i<H.length;i+=2){let r=document.createElement("div");r.className="row";r.innerHTML=`<span>${i/2+1}.</span><span>${H[i]?.n||""}</span><span>${H[i+1]?.n||""}</span>`;b.appendChild(r)}b.scrollTop=b.scrollHeight}
function status(){let s=document.getElementById("status"),d=document.getElementById("detail"),ms=legal(S);if(busy){s.textContent="Schwarz denkt …";d.textContent="Dein Zug wurde geprüft und gespeichert.";return}if(!ms.length){s.textContent=chk(S,S.turn)?(S.turn==="w"?"Schachmatt – Schwarz gewinnt":"Schachmatt – Weiß gewinnt"):"Remis durch Patt";d.textContent="Partie beendet.";return}s.textContent=S.turn==="w"?"Weiß am Zug":"Schwarz am Zug";d.textContent=chk(S,S.turn)?"Schach!":`Zug ${S.full}`}
function fen(s){let rs=[];for(let y=0;y<8;y++){let r="",e=0;for(let x=0;x<8;x++){let p=s.b[ix(x,y)];if(!p)e++;else{if(e){r+=e;e=0}r+=p.c==="w"?p.t:p.t.toLowerCase()}}if(e)r+=e;rs.push(r)}let c="";if(s.cas.wK)c+="K";if(s.cas.wQ)c+="Q";if(s.cas.bK)c+="k";if(s.cas.bQ)c+="q";return`${rs.join("/")} ${s.turn} ${c||"-"} ${s.ep>=0?nm(s.ep):"-"} ${s.half} ${s.full}`}
function coach(w,b){let f=document.getElementById("coach"),rec=H.length>=2?H[H.length-2]:null,p=rec?rec.before.b[rec.m.from]:null,msg=`Du hast <b>${w}</b> gespielt. Schwarz antwortet mit <b>${b}</b>. `;if(p?.t==="N"||p?.t==="B")msg+="Du entwickelst eine Leichtfigur – in der Eröffnung meist sinnvoll.";else if(p?.t==="P"){let[x]=xy(rec.m.to);msg+=(x===3||x===4)?"Du kämpfst direkt um das Zentrum.":"Vermeide zu viele Randbauernzüge vor der Entwicklung."}else if(p?.t==="Q")msg+="Frühe Damenzüge können Tempo kosten.";else if(p?.t==="K"&&rec.m.castle)msg+="Gute Rochade: Königssicherheit und Turmaktivierung.";f.innerHTML=msg}
document.getElementById("new").onclick=()=>{if(confirm("Neue Partie beginnen?")){S=init();H=[];sel=null;T=[];save();render()}};
document.getElementById("undo").onclick=()=>{if(busy||!H.length)return;let n=S.turn==="w"?2:1;while(n--&&H.length)S=H.pop().before;sel=null;T=[];save();render()};
document.getElementById("flip").onclick=()=>{flip=!flip;render()};
document.getElementById("hint").onclick=async()=>{
  if(S.turn!=="w"||busy)return;
  const coachEl=document.getElementById("coach");
  coachEl.textContent="Stockfish prüft die Stellung …";
  let best=null;
  try{
    const uci=await stockfishBestMove(S,10);
    best=uciMoveToLegal(uci,S);
  }catch(e){}
  if(!best){
    let ms=ord(S),bs=-1e9;
    for(let m of ms){let z=mm(apply(S,m),1,-1e9,1e9);if(z>bs){bs=z;best=m}}
  }
  coachEl.innerHTML=best
    ?`Stockfish empfiehlt <b>${san(S,best)}</b>. Prüfe vor dem Zug gegnerische Drohungen, Entwicklung, Zentrum und Königssicherheit.`
    :"Keine legalen Züge.";
};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("install").style.display="block"});
document.getElementById("install").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("install").style.display="none"}};
if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("sw.js?v="+APP_VERSION,{updateViaCache:"none"});
      await registration.update();
    }catch(error){console.warn("Service Worker:",error)}
  });
}
load();initStockfish();render();