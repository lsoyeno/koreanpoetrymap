/* =====================================================================
   분석 엔진과 화면 — 데이터는 js/data.js (EMOS, LEX, POEMS, SCENE_KO, SCENE)
   ===================================================================== */
/* ---------- 4. 분석 엔진 ---------- */
/* 사전 매칭: 모든 시어를 긴 것부터 정렬해 하나의 정규식으로 (기술명세서 5.2) */
const KW=[];
EMOS.forEach((e,i)=>LEX[e.k].forEach(w=>KW.push({w,i})));
(typeof STOP!=='undefined'?STOP:[]).forEach(w=>KW.push({w,i:-1}));  // i=-1: 예외어(세지 않음)
KW.sort((a,b)=>b.w.length-a.w.length);
const KWMAP=new Map(KW.map(o=>[o.w,o.i]));
const KWRE=new RegExp(KW.map(o=>o.w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
const sum=a=>a.reduce((s,x)=>s+x,0);
const norm=a=>{const s=sum(a);return s?a.map(x=>x/s):a.map(()=>0)};
function lexAnalyze(text){
  const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
  const total=Array(EMOS.length).fill(0);const words=new Map();
  const L=lines.map(t=>{
    const c=Array(EMOS.length).fill(0);const hits=[];
    for(const m of t.matchAll(KWRE)){const i=KWMAP.get(m[0]);if(i<0)continue;c[i]++;total[i]++;hits.push(m[0]);
      const o=words.get(m[0])||{w:m[0],i,n:0};o.n++;words.set(m[0],o);}
    return {t,c,hits};
  });
  return {lines:L,total,vec:norm(total),words:[...words.values()].sort((a,b)=>b.n-a.n||b.w.length-a.w.length)};
}
POEMS.forEach(p=>{p.lex=lexAnalyze(p.text);p.cur=norm(EMOS.map(e=>p.profile[e.k]||0));});
let W=.4,custom=null,selId=POEMS[0].id;
const all=()=>custom?[...POEMS,custom]:POEMS;
const finalVec=p=>p.cur?norm(p.cur.map((v,i)=>v*(1-W)+p.lex.vec[i]*W)):p.lex.vec;
function cosine(a,b){let d=0,x=0,y=0;a.forEach((v,i)=>{d+=v*b[i];x+=v*v;y+=b[i]*b[i]});return x&&y?d/Math.sqrt(x*y):0}
const topIdx=v=>v.map((x,i)=>[x,i]).sort((a,b)=>b[0]-a[0]).map(o=>o[1]);
const pct=x=>Math.round(x*100);
/* 최대 잔여법: 표시용 정수 %의 합이 정확히 100이 되도록 반올림 (T-02) */
function pctList(v){const s=sum(v);if(!s)return v.map(()=>0);
  const raw=v.map(x=>x/s*100),fl=raw.map(Math.floor);let left=100-sum(fl);
  raw.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([_,i])=>{if(left>0){fl[i]++;left--}});return fl}
const isEmpty=v=>!sum(v);
const emptyMsg=t=>`<p class="empty">${t}</p>`;

/* ---------- 5. 공통 도구 ---------- */
const $=id=>document.getElementById(id);
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tip=$('tip');
function showTip(ev,html){tip.innerHTML=html;tip.classList.add('on');moveTip(ev)}
function moveTip(ev){const r=tip.getBoundingClientRect();let x=ev.clientX+14,y=ev.clientY+14;
  if(x+r.width>innerWidth-8)x=ev.clientX-r.width-14; if(y+r.height>innerHeight-8)y=ev.clientY-r.height-14;
  tip.style.left=Math.max(8,x)+'px';tip.style.top=Math.max(8,y)+'px'}
function hideTip(){tip.classList.remove('on')}
function bindTips(root){root.querySelectorAll('[data-tip]').forEach(el=>{
  el.addEventListener('mouseenter',e=>showTip(e,el.dataset.tip));el.addEventListener('mousemove',moveTip);el.addEventListener('mouseleave',hideTip);
  el.addEventListener('focus',()=>{const r=el.getBoundingClientRect();showTip({clientX:r.right,clientY:r.top},el.dataset.tip)});el.addEventListener('blur',hideTip);});}
function wrapText(s,n){const out=[];let cur='';for(const w of s.split(' ')){if((cur+' '+w).trim().length>n&&cur){out.push(cur);cur=w}else cur=(cur+' '+w).trim()}if(cur)out.push(cur);return out}
const legendHTML=idx=>idx.map(i=>`<span><i style="background:${EMOS[i].c}"></i>${EMOS[i].name}</span>`).join('');

/* ---------- 6. 렌더링 ---------- */
function renderShelf(){
  $('shelf').innerHTML=all().map(p=>{const fv=finalVec(p);const d=topIdx(fv)[0];
    return `<li><button type="button" data-id="${p.id}" aria-current="${p.id===selId}"><span class="dot" style="background:${isEmpty(fv)?'var(--line)':EMOS[d].c}"></span><span class="t">${esc(p.title)}<span class="p">${esc(p.poet)}${p.year?' · '+p.year:''}</span></span></button></li>`}).join('');
  $('shelf').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.id));
}
function renderPoem(p){
  $('ptitle').textContent=p.title;
  $('pmeta').innerHTML=`${esc(p.poet)}${p.year?' · '+esc(p.year)+'년 발표':''}${p.poetDeath?` · 시인 ${p.poetDeath}년 사망`:''}`+(p.source?`<span class="src">출처: ${esc(p.source)}</span>`:'');
  const stanzas=p.text.split(/\n\s*\n/);
  $('ptext').innerHTML=stanzas.map(s=>'<p>'+s.split('\n').map(l=>{
    const h=esc(l.trim()).replace(KWRE,m=>{const i=KWMAP.get(m);if(i<0)return m;return `<mark class="kw" style="--c:${EMOS[i].c}" tabindex="0" data-tip="<b>${m}</b> → ${EMOS[i].name}">${m}</mark>`});
    return `<span class="ln">${h}</span>`}).join('')+'</p>').join('');
  const used=[...new Set(p.lex.words.map(w=>w.i))].sort((a,b)=>a-b);
  $('kwlegend').innerHTML=used.length?'<span style="color:var(--muted)">밑줄 시어:</span>'+legendHTML(used):'<span>감정 사전과 일치하는 시어가 없습니다.</span>';
  bindTips($('ptext'));
}
function renderSummary(p,v,recs){
  const t=topIdx(v);const d=t[0];const P=pctList(v);
  if(isEmpty(v)){
    $('dominant').innerHTML=`<span class="big" style="color:var(--muted)">감지 없음</span>`;
    $('bars').innerHTML=emptyMsg('감정 사전과 일치하는 시어가 없어 비율을 계산할 수 없습니다.');
  }else{
  $('dominant').innerHTML=`<span class="big">${EMOS[d].name}</span><span class="chip"><i style="background:${EMOS[d].c}"></i>${P[d]}%</span>`+
    (v[t[1]]>0?`<span class="chip"><i style="background:${EMOS[t[1]].c}"></i>${EMOS[t[1]].name} ${P[t[1]]}%</span>`:'');
  const max=Math.max(...v)||1;
  $('bars').innerHTML=t.filter(i=>P[i]>0).map(i=>`<span tabindex="0" data-tip="<b>${EMOS[i].name}</b><br>${esc(EMOS[i].def)}">${EMOS[i].name}</span><div class="track"><div class="fill" style="width:${v[i]/max*100}%;background:${EMOS[i].c}"></div></div><span class="v">${P[i]}%</span>`).join('')+
    `<span class="total">합계</span><span></span><span class="v total">${sum(P)}%</span>`;
  bindTips($('bars'));
  }
  let theme=p.theme,speaker=p.speaker,devices=p.devices,interp=p.interp,key=p.key;
  if(!p.cur){
    const tops=t.filter(i=>v[i]>0).slice(0,2);
    const ws=p.lex.words.slice(0,5).map(w=>`‘${w.w}’`).join(', ');
    theme=tops.length?tops.map(i=>EMOS[i].name).join('과 ')+'의 정서':'뚜렷한 정서 없음';
    speaker='직접 입력한 시 (사전 기반 분석)';devices='—';
    interp=tops.length?`감정 사전으로 분석하면 이 시는 ‘${EMOS[tops[0]].name}’(${pct(v[tops[0]])}%)`+(tops[1]!==undefined?`와 ‘${EMOS[tops[1]].name}’(${pct(v[tops[1]])}%)`:'')+`의 정서가 두드러집니다. 판단의 근거가 된 시어는 ${ws}입니다. 수록 작품 ${POEMS.length}편 가운데 감정 구성이 가장 비슷한 시는 「${recs[0].p.title}」(${recs[0].p.poet})이며 유사도는 ${pct(recs[0].s)}%입니다. 사전 기반 분석은 반어나 역설을 읽지 못하므로, 해석은 시어의 문맥과 함께 확인해야 합니다.`:'감정 사전과 일치하는 시어를 찾지 못했습니다. 다른 시를 입력하거나 사전에 시어를 추가해 보세요.';
    const best=p.lex.lines.map(l=>[sum(l.c),l.t]).sort((a,b)=>b[0]-a[0])[0];key=best&&best[0]?best[1]:'';
  }
  $('facts').innerHTML=`<dt>주제</dt><dd>${esc(theme)}</dd><dt>화자</dt><dd>${esc(speaker)}</dd><dt>표현</dt><dd>${esc(devices)}</dd>`;
  $('interp').textContent=interp;
  $('keyline').textContent=key;$('keyline').hidden=!key;
}
function renderRadar(p,v,rec){
  if(isEmpty(v)){$('radar').innerHTML=emptyMsg('감지된 정서가 없어 프로필을 그릴 수 없습니다.');$('radarLegend').innerHTML='';return}
  const S=380,cx=S/2,cy=S/2+4,R=128,n=EMOS.length;
  const b=rec?finalVec(rec.p):null;
  const mx=Math.max(...v,...(b||[0]));const top=Math.max(20,Math.ceil(mx*100/10)*10)/100;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const pt=(i,r)=>[cx+Math.cos(ang(i))*r,cy+Math.sin(ang(i))*r];
  let g='';
  for(let k=1;k<=4;k++){const r=R*k/4;g+=`<polygon points="${EMOS.map((_,i)=>pt(i,r).join(',')).join(' ')}" style="fill:none;stroke:var(--line)" stroke-width="1"/>`;
    g+=`<text x="${cx+4}" y="${cy-r+11}" font-size="10" style="fill:var(--muted)">${Math.round(top*100*k/4)}%</text>`}
  EMOS.forEach((e,i)=>{const [x,y]=pt(i,R);g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" style="stroke:var(--line)"/>`;
    const [lx,ly]=pt(i,R+22);const anchor=Math.abs(lx-cx)<8?'middle':lx>cx?'start':'end';
    g+=`<circle cx="${anchor==='end'?lx+7:anchor==='start'?lx-7:lx}" cy="${ly-(anchor==='middle'?14:4)}" r="4" style="fill:${e.c}"/>`;
    g+=`<text x="${lx}" y="${ly+(anchor==='middle'?(ly<cy?-2:8):0)}" text-anchor="${anchor}" font-size="12" style="fill:var(--ink-2)">${e.name}</text>`});
  const poly=(vec,cls)=>vec.map((x,i)=>pt(i,R*Math.min(x/top,1)).join(',')).join(' ');
  if(b)g+=`<polygon points="${poly(b)}" style="fill:none;stroke:var(--muted)" stroke-width="2" stroke-dasharray="5 4"/>`;
  g+=`<polygon points="${poly(v)}" style="fill:color-mix(in oklab,var(--accent) 16%,transparent);stroke:var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  v.forEach((x,i)=>{const [px,py]=pt(i,R*Math.min(x/top,1));
    g+=`<circle cx="${px}" cy="${py}" r="4.5" style="fill:var(--accent);stroke:var(--surface)" stroke-width="2"/>`;
    g+=`<circle cx="${px}" cy="${py}" r="13" style="fill:transparent" tabindex="0" data-tip="<b>${EMOS[i].name}</b><br>「${esc(p.title)}」 ${pct(x)}%${b?`<br>「${esc(rec.p.title)}」 ${pct(b[i])}%`:''}"/>`});
  $('radar').innerHTML=`<svg viewBox="-36 0 ${S+72} ${S}" role="img" aria-label="${esc(p.title)} 감정 프로필 레이더 차트">${g}</svg>`;
  $('radarLegend').innerHTML=`<span><i class="line" style="background:var(--accent)"></i>「${esc(p.title)}」</span>`+(b?`<span><i class="dash"></i>추천 1위 「${esc(rec.p.title)}」</span>`:'');
  bindTips($('radar'));
}
function renderFlow(p){
  if(isEmpty(p.lex.total)){$('flow').innerHTML=emptyMsg('어느 행에서도 감정 사전 시어가 감지되지 않았습니다. 행별 흐름은 사전 시어가 하나 이상 있어야 그릴 수 있습니다.');$('flowLegend').innerHTML='';return}
  const L=p.lex.lines,n=L.length;const Wd=620,H=260,m={l:34,r:10,t:14,b:30};
  const pw=Wd-m.l-m.r,ph=H-m.t-m.b;const mx=Math.max(2,...L.map(l=>sum(l.c)));
  const step=pw/n,bw=Math.max(4,Math.min(26,step*.68));const y=v=>m.t+ph-v/mx*ph;
  let g='';
  for(let k=0;k<=mx;k+=mx>6?2:1){g+=`<line x1="${m.l}" x2="${Wd-m.r}" y1="${y(k)}" y2="${y(k)}" style="stroke:${k?'var(--line)':'var(--muted)'}" stroke-width="1"/><text x="${m.l-8}" y="${y(k)+4}" text-anchor="end" font-size="10.5" style="fill:var(--muted)">${k}</text>`}
  const every=Math.ceil(n/16);
  L.forEach((l,j)=>{const x=m.l+step*j+(step-bw)/2;let acc=0;
    l.c.forEach((c,i)=>{if(!c)return;const y0=y(acc),y1=y(acc+c);g+=`<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(1,y0-y1-2)}" rx="2" style="fill:${EMOS[i].c}"/>`;acc+=c});
    if(!acc)g+=`<rect x="${x}" y="${y(0)-2}" width="${bw}" height="2" style="fill:var(--line)"/>`;
    if(j%every===0)g+=`<text x="${x+bw/2}" y="${H-m.b+16}" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">${j+1}</text>`;
    const br=l.c.map((c,i)=>c?`${EMOS[i].name} ${c}`:'').filter(Boolean).join(' · ')||'감지된 시어 없음';
    g+=`<rect x="${m.l+step*j}" y="${m.t}" width="${step}" height="${ph}" style="fill:transparent" tabindex="0" data-tip="<b>${j+1}행</b> ${esc(l.t)}<br>${br}${l.hits.length?'<br>시어: '+l.hits.join(', '):''}"/>`});
  g+=`<text x="${Wd-m.r}" y="${H-4}" text-anchor="end" font-size="10.5" style="fill:var(--muted)">행 번호</text>`;
  $('flow').innerHTML=`<svg viewBox="0 0 ${Wd} ${H}" style="min-width:420px" role="img" aria-label="행별 감정 흐름 누적 막대">${g}</svg>`;
  const used=[...new Set(p.lex.words.map(w=>w.i))].sort((a,b)=>a-b);
  $('flowLegend').innerHTML=legendHTML(used);
  bindTips($('flow'));
}
function renderSankey(p,v){
  const emoTop=topIdx(v).filter(i=>v[i]>=.04).slice(0,4);
  const words=p.lex.words.filter(w=>emoTop.includes(w.i)).slice(0,8);
  const Wd=780,rowH=36,H=Math.max(320,words.length*rowH+60);
  const xW=150,xE=330,eW=16,xT=520,tW=240,top=30,bot=H-30;
  let g='';
  g+=`<text x="${xW}" y="16" text-anchor="end" font-size="11" letter-spacing="1.5" style="fill:var(--muted)">핵심 시어</text>`;
  g+=`<text x="${xE+eW/2}" y="16" text-anchor="middle" font-size="11" letter-spacing="1.5" style="fill:var(--muted)">정서</text>`;
  g+=`<text x="${xT}" y="16" font-size="11" letter-spacing="1.5" style="fill:var(--muted)">주제</text>`;
  const sTop=sum(emoTop.map(i=>v[i]))||1;const gap=14;const avail=bot-top-gap*(emoTop.length-1);
  let cy=top;const eNode={};
  emoTop.forEach(i=>{const h=Math.max(26,v[i]/sTop*avail);eNode[i]={y:cy,h,used:0};cy+=h+gap});
  const scale=(bot-top)/(cy-gap-top);Object.values(eNode).forEach(o=>{o.y=top+(o.y-top)*scale;o.h*=scale});
  const wy=j=>top+((bot-top)/(Math.max(words.length,1)))*(j+.5);
  words.forEach((w,j)=>{const e=eNode[w.i];const y1=wy(j);const cnt=words.filter(x=>x.i===w.i).length;
    const y2=e.y+e.h*(e.used+.5)/cnt;e.used++;
    g+=`<path d="M${xW+8},${y1} C${(xW+xE)/2},${y1} ${(xW+xE)/2},${y2} ${xE},${y2}" style="fill:none;stroke:${EMOS[w.i].c}" stroke-opacity=".55" stroke-width="${Math.min(8,1.5+w.n*1.2)}"/>`;
    g+=`<text x="${xW}" y="${y1+5}" text-anchor="end" font-size="15" style="fill:var(--ink);font-family:var(--f-poem)" tabindex="0" data-tip="<b>${w.w}</b> → ${EMOS[w.i].name}<br>${w.n}회 등장">${w.w}<tspan font-size="11" style="fill:var(--muted)"> ×${w.n}</tspan></text>`});
  const tTop=top+10,tH=bot-top-20;
  emoTop.forEach(i=>{const e=eNode[i];const ty1=tTop+tH*0.15+(tH*0.7)*((e.y-top)/(bot-top)),ty2=tTop+tH*0.15+(tH*0.7)*((e.y+e.h-top)/(bot-top));
    g+=`<path d="M${xE+eW},${e.y} C${(xE+xT)/2},${e.y} ${(xE+xT)/2},${ty1} ${xT},${ty1} L${xT},${ty2} C${(xE+xT)/2},${ty2} ${(xE+xT)/2},${e.y+e.h} ${xE+eW},${e.y+e.h} Z" style="fill:${EMOS[i].c}" fill-opacity=".22"/>`;
    g+=`<rect x="${xE}" y="${e.y}" width="${eW}" height="${e.h}" rx="3" style="fill:${EMOS[i].c}" tabindex="0" data-tip="<b>${EMOS[i].name}</b> ${pct(v[i])}%"/>`;
    g+=`<text x="${xE+eW+8}" y="${e.y+e.h/2-2}" font-size="13" font-weight="600" style="fill:var(--ink)">${EMOS[i].name}</text><text x="${xE+eW+8}" y="${e.y+e.h/2+14}" font-size="11.5" style="fill:var(--ink-2)">${pct(v[i])}%</text>`});
  if(!words.length)g+=`<text x="${xW}" y="${H/2}" text-anchor="end" font-size="13" style="fill:var(--muted)">일치 시어 없음</text>`;
  const theme=p.cur?p.theme:(emoTop.map(i=>EMOS[i].name).slice(0,2).join('과 ')+'의 정서');
  g+=`<rect x="${xT}" y="${tTop}" width="${tW}" height="${tH}" rx="10" style="fill:var(--bg);stroke:var(--line)"/>`;
  let ty=tTop+34;
  wrapText(theme,13).forEach(l=>{g+=`<text x="${xT+18}" y="${ty}" font-size="19" style="fill:var(--ink);font-family:var(--f-display)">${esc(l)}</text>`;ty+=26});
  ty+=8;g+=`<line x1="${xT+18}" x2="${xT+tW-18}" y1="${ty}" y2="${ty}" style="stroke:var(--line)"/>`;ty+=22;
  const d=emoTop[0];
  if(d!==undefined){g+=`<text x="${xT+18}" y="${ty}" font-size="12" style="fill:var(--muted)">지배 정서</text><circle cx="${xT+88}" cy="${ty-4}" r="5" style="fill:${EMOS[d].c}"/><text x="${xT+98}" y="${ty}" font-size="13" font-weight="600" style="fill:var(--ink)">${EMOS[d].name} ${pct(v[d])}%</text>`;ty+=24}
  if(p.devices&&p.cur){g+=`<text x="${xT+18}" y="${ty}" font-size="12" style="fill:var(--muted)">표현</text>`;ty+=18;
    wrapText(p.devices,18).slice(0,3).forEach(l=>{g+=`<text x="${xT+18}" y="${ty}" font-size="12.5" style="fill:var(--ink-2)">${esc(l)}</text>`;ty+=18})}
  $('sankey').innerHTML=`<svg viewBox="0 0 ${Wd} ${H}" style="min-width:640px" role="img" aria-label="시어에서 감정, 주제로 이어지는 분석 다이어그램">${g}</svg>`;
  bindTips($('sankey'));
}
function getRecs(p){const v=finalVec(p);return POEMS.filter(q=>q.id!==p.id).map(q=>({p:q,s:cosine(v,finalVec(q))})).sort((a,b)=>b.s-a.s).slice(0,3)}
function renderRecs(p,recs){
  if(isEmpty(finalVec(p))){$('recs').innerHTML=emptyMsg('감정 벡터가 비어 있어 유사도를 계산할 수 없습니다. 감정 시어가 들어간 시를 입력해 보세요.');return}
  const v=finalVec(p);const tv=topIdx(v).slice(0,3);
  $('recs').innerHTML=recs.map((r,k)=>{const q=finalVec(r.p);const shared=topIdx(q).slice(0,3).filter(i=>tv.includes(i)&&q[i]>.05&&v[i]>.05);
    const why=shared.length?`공통 정서: ${shared.map(i=>EMOS[i].name).join(', ')}`:'정서 구성이 부분적으로 겹칩니다';
    return `<button type="button" class="rec" data-id="${r.p.id}"><span class="rank">추천 ${k+1}</span><span class="t">${esc(r.p.title)}</span><span class="why">${esc(r.p.poet)} · ${esc(r.p.theme)}</span><span class="pct">유사도 ${pct(r.s)}%</span><span class="meter"><b style="width:${pct(r.s)}%"></b></span><span class="why">${why}</span></button>`}).join('');
  $('recs').querySelectorAll('.rec').forEach(b=>b.onclick=()=>{select(b.dataset.id);window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
}
function pca2(X){const n=X.length,d=X[0].length;const mean=Array(d).fill(0);X.forEach(r=>r.forEach((x,j)=>mean[j]+=x/n));
  const C=X.map(r=>r.map((x,j)=>x-mean[j]));
  const cov=Array.from({length:d},(_,a)=>Array.from({length:d},(_,b)=>C.reduce((s,r)=>s+r[a]*r[b],0)));
  const comps=[],eig=[];for(let c=0;c<2;c++){let v=Array.from({length:d},(_,i)=>Math.sin(i+1+c*3)),lam=0;
    for(let it=0;it<300;it++){let w=cov.map(row=>row.reduce((s,x,j)=>s+x*v[j],0));
      comps.forEach(u=>{const dt=w.reduce((s,x,j)=>s+x*u[j],0);w=w.map((x,j)=>x-dt*u[j])});const nr=Math.hypot(...w)||1;v=w.map(x=>x/nr);lam=nr}
    const k=v.reduce((b,x,i)=>Math.abs(x)>Math.abs(v[b])?i:b,0);if(v[k]<0)v=v.map(x=>-x);
    comps.push(v);eig.push(lam)}
  const tr=cov.reduce((s,r,i)=>s+r[i],0)||1;
  return {P:C.map(r=>comps.map(u=>r.reduce((s,x,j)=>s+x*u[j],0))),comps,ratio:eig.map(e=>e/tr)}}
function axisEnds(u){const o=u.map((x,i)=>[x,i]);
  const pick=(arr)=>arr.slice(0,2).map(a=>EMOS[a[1]].name).join('·')||'—';
  return {pos:pick(o.filter(a=>a[0]>.15).sort((a,b)=>b[0]-a[0])),neg:pick(o.filter(a=>a[0]<-.15).sort((a,b)=>a[0]-b[0]))}}
function renderMap(p,recs){
  const ps=all();const V=ps.map(finalVec);const {P,comps,ratio}=pca2(V);
  const ax=axisEnds(comps[0]),ay=axisEnds(comps[1]);
  const Wd=560,H=420,L=40,R=Wd-40,T=44,B=H-60;const xs=P.map(o=>o[0]),ys=P.map(o=>o[1]);
  const x0r=Math.min(0,...xs),x1r=Math.max(0,...xs),y0r=Math.min(0,...ys),y1r=Math.max(0,...ys);
  const sx=x=>L+(x-x0r)/((x1r-x0r)||1)*(R-90-L);
  const sy=y=>B-(y-y0r)/((y1r-y0r)||1)*(B-T);
  const pts=ps.map((q,k)=>({q,x:sx(P[k][0]),y:sy(P[k][1]),d:topIdx(V[k])[0]}));
  const lab=pts.map(o=>({o,x:o.x+11,y:o.y+4,w:o.q.title.length*13}));
  for(let it=0;it<40;it++)for(let a=0;a<lab.length;a++)for(let b=a+1;b<lab.length;b++){const A=lab[a],B=lab[b];
    if(Math.abs(A.y-B.y)<15&&A.x<B.x+B.w&&B.x<A.x+A.w){const s=(15-Math.abs(A.y-B.y))/2+.5;if(A.y<B.y){A.y-=s;B.y+=s}else{A.y+=s;B.y-=s}}}
  let g='';
  const cx0=sx(0),cy0=sy(0);const halo='paint-order:stroke;stroke:var(--surface);stroke-width:4px';
  g+=`<rect x="${L}" y="${T}" width="${R-L}" height="${B-T}" rx="6" style="fill:none;stroke:var(--line)"/>`;
  g+=`<line x1="${L}" x2="${R}" y1="${cy0}" y2="${cy0}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>`;
  g+=`<line x1="${cx0}" x2="${cx0}" y1="${T}" y2="${B}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>`;
  g+=`<polygon points="${R},${cy0} ${R-7},${cy0-4} ${R-7},${cy0+4}" style="fill:var(--muted)"/><polygon points="${L},${cy0} ${L+7},${cy0-4} ${L+7},${cy0+4}" style="fill:var(--muted)"/>`;
  g+=`<polygon points="${cx0},${T} ${cx0-4},${T+7} ${cx0+4},${T+7}" style="fill:var(--muted)"/><polygon points="${cx0},${B} ${cx0-4},${B-7} ${cx0+4},${B-7}" style="fill:var(--muted)"/>`;
  g+=`<text x="${R-4}" y="${cy0-8}" text-anchor="end" font-size="11.5" font-weight="600" style="fill:var(--ink-2);${halo}">${ax.pos} →</text>`;
  g+=`<text x="${L+4}" y="${cy0-8}" font-size="11.5" font-weight="600" style="fill:var(--ink-2);${halo}">← ${ax.neg}</text>`;
  g+=`<text x="${cx0}" y="${T-10}" text-anchor="middle" font-size="11.5" font-weight="600" style="fill:var(--ink-2)">↑ ${ay.pos}</text>`;
  g+=`<text x="${cx0}" y="${B+18}" text-anchor="middle" font-size="11.5" font-weight="600" style="fill:var(--ink-2)">↓ ${ay.neg}</text>`;
  g+=`<text x="${L}" y="${H-12}" font-size="11" style="fill:var(--muted)">가로축 주성분 1 · 설명력 ${pct(ratio[0])}%</text>`;
  g+=`<text x="${R}" y="${H-12}" text-anchor="end" font-size="11" style="fill:var(--muted)">세로축 주성분 2 · 설명력 ${pct(ratio[1])}%</text>`;
  const me=pts.find(o=>o.q.id===p.id);
  recs.forEach((r,k)=>{const t=pts.find(o=>o.q.id===r.p.id);g+=`<line x1="${me.x}" y1="${me.y}" x2="${t.x}" y2="${t.y}" style="stroke:var(--accent)" stroke-width="${2.5-k*.6}" stroke-opacity="${.85-k*.2}"/>`;
    g+=`<text x="${(me.x+t.x)/2}" y="${(me.y+t.y)/2-4}" text-anchor="middle" font-size="10.5" style="fill:var(--accent);paint-order:stroke;stroke:var(--surface);stroke-width:3px">${pct(r.s)}%</text>`});
  pts.forEach((o,k)=>{const sel=o.q.id===p.id;
    g+=`<circle cx="${o.x}" cy="${o.y}" r="${sel?10:7}" style="fill:${EMOS[o.d].c};stroke:${sel?'var(--ink)':'var(--surface)'}" stroke-width="2"/>`;
    g+=`<text x="${lab[k].x}" y="${lab[k].y}" font-size="13" font-weight="${sel?700:400}" style="fill:${sel?'var(--ink)':'var(--ink-2)'};font-family:var(--f-poem);paint-order:stroke;stroke:var(--surface);stroke-width:3px">${esc(o.q.title)}</text>`;
    g+=`<circle cx="${o.x}" cy="${o.y}" r="16" style="fill:transparent;cursor:pointer" data-id="${o.q.id}" tabindex="0" data-tip="<b>${esc(o.q.title)}</b> · ${esc(o.q.poet)}<br>지배 정서: ${EMOS[o.d].name} ${pct(V[k][o.d])}%${sel?'':`<br>「${esc(p.title)}」과의 유사도 ${pct(cosine(V[k],finalVec(p)))}%`}"/>`});
  $('map').innerHTML=`<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="시 감성 지도">${g}</svg>`;
  $('map').querySelectorAll('[data-id]').forEach(c=>{c.addEventListener('click',()=>select(c.dataset.id));c.addEventListener('keydown',e=>{if(e.key==='Enter')select(c.dataset.id)})});
  const used=[...new Set(pts.map(o=>o.d))].sort((a,b)=>a-b);
  $('mapLegend').innerHTML='<span style="color:var(--muted)">점 색 = 지배 정서</span>'+legendHTML(used)+'<span><i class="line" style="background:var(--accent)"></i>추천 연결</span>';
  const load=u=>topIdx(u.map(Math.abs)).filter(i=>Math.abs(u[i])>.15).slice(0,4).map(i=>`<span class="ld"><i style="background:${EMOS[i].c}"></i>${EMOS[i].name} ${u[i]>0?'+':'−'}${Math.abs(u[i]).toFixed(2)}</span>`).join('');
  $('mapGuide').innerHTML=`<dt>가로축</dt><dd><b>왼쪽 ← ${ax.neg}</b> · <b>${ax.pos} → 오른쪽</b><br><span class="sub">주성분 1, 시들 사이 감정 차이의 ${pct(ratio[0])}%를 설명</span><div class="lds">${load(comps[0])}</div></dd>`+
    `<dt>세로축</dt><dd><b>아래 ↓ ${ay.neg}</b> · <b>${ay.pos} ↑ 위</b><br><span class="sub">주성분 2, 추가로 ${pct(ratio[1])}%를 설명</span><div class="lds">${load(comps[1])}</div></dd>`+
    `<dt>읽는 법</dt><dd>점이 가까울수록 감정 구성이 비슷합니다. 점선 교차점은 ${ps.length}편의 평균 감정이고, 축 끝에 적힌 정서가 강한 시일수록 그쪽으로 놓입니다. 숫자는 각 정서가 축에 기여하는 정도(적재값)입니다. 가중치를 바꾸거나 시를 직접 입력하면 축도 다시 계산됩니다.</dd>`;
  bindTips($('map'));
}
function renderHeat(p){
  const ps=all();let h='<thead><tr><th></th>'+EMOS.map(e=>`<th><i style="background:${e.c}"></i>${e.name}</th>`).join('')+'</tr></thead><tbody>';
  ps.forEach(q=>{const v=finalVec(q);h+=`<tr data-id="${q.id}" class="${q.id===p.id?'sel':''}"><th class="rowh" scope="row">${esc(q.title)}</th>`+
    v.map((x,i)=>{const s=Math.min(100,Math.round(x/.45*100));const dark=s>55;
      return `<td style="background:color-mix(in oklab,var(--seq) ${s}%,var(--surface));color:${dark?'#fff':'var(--ink-2)'}" data-tip="<b>${esc(q.title)}</b> · ${EMOS[i].name} ${pct(x)}%">${pct(x)}</td>`}).join('')+'</tr>'});
  $('heat').innerHTML=h+'</tbody>';
  $('heat').querySelectorAll('tbody tr').forEach(r=>r.onclick=()=>select(r.dataset.id));
  bindTips($('heat'));
}
/* ---------- 7. 감정 이미지 ---------- */
const PIG={sad:'#3d5a80',joy:'#e8a23a',calm:'#6f9c94',hope:'#e07a5f',love:'#c9577a',shame:'#6b7a45',long:'#7b6aa8',anger:'#9b2d30'};
const MOTIFS=[
  {k:'moon',name:'달',re:/달이|달빛|달 가듯/},
  {k:'star',name:'별',re:/(?<!이)별/},
  {k:'flower',name:'꽃',re:/꽃|진달래|모란|매화/},
  {k:'bird',name:'새',re:/작은 새|산새|날개|까마귀/},
  {k:'path',name:'길',re:/길[을은이]|가실 길|걸음|강나루/},
  {k:'water',name:'물',re:/강물|강변|강나루|물결|우물|실개천|바다|이슬|물 먹은/},
  {k:'snow',name:'눈',re:/눈 내리|서리/},
  {k:'wind',name:'바람',re:/바람|미풍/},
  {k:'sun',name:'해·노을',re:/붉은 해|해는|놀|햇살|서산/},
  {k:'cloud',name:'구름',re:/구름/},
  {k:'window',name:'유리창',re:/유리/},
  {k:'figure',name:'사람',re:/사나이|나그네|님은|그대|사람|아버지|초인|누이|아내|엄마/},
  {k:'mountain',name:'산',re:/산/}
];
const MOTIF_EN={moon:'a pale moon',star:'scattered stars',flower:'flowers and falling petals',bird:'small birds',path:'a winding path',water:'still water',snow:'falling snow',wind:'wind-blown grass',sun:'a red setting sun',cloud:'drifting clouds',window:'a frosted window at night',figure:'a small solitary figure',mountain:'layered mountains'};
const EMO_EN={sad:'sorrow',joy:'joy',calm:'serene stillness',hope:'hope and quiet resolve',love:'devotion',shame:'introspection',long:'longing',anger:'resentment'};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
const motifsOf=p=>new Set(MOTIFS.filter(m=>m.re.test(p.text)).map(m=>m.k));
let artSeed=0,imgMode='art',fontsReady=false,promptFor='';
const ink=a=>`rgba(28,36,40,${a})`;
function blob(c,r,x,y,rad,col){const n=22,pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const k=.65+r()*.55;pts.push([Math.cos(a)*rad*k,Math.sin(a)*rad*k*.75])}
  for(let l=0;l<7;l++){c.beginPath();pts.forEach(([px,py],i)=>{const j=1+(r()-.5)*.3;i?c.lineTo(x+px*j,y+py*j):c.moveTo(x+px*j,y+py*j)});c.closePath();c.fillStyle=rgba(col,.035);c.fill()}}
function paintArt(p,v){
  const cv=$('art'),c=cv.getContext('2d'),Wc=900,Hc=1200,r=rng(hashStr(p.title)+artSeed*7919);
  const E=Object.fromEntries(EMOS.map((e,i)=>[e.k,v[i]]));
  const em=EMOS.map((e,i)=>({k:e.k,v:v[i],col:PIG[e.k]})).sort((a,b)=>b.v-a.v);
  const M=motifsOf(p);M.add('mountain');const rules=[];
  const hz=Hc*(.56+r()*.08);
  c.globalAlpha=1;c.fillStyle='#f2ede1';c.fillRect(0,0,Wc,Hc);
  for(let i=0;i<3000;i++){c.fillStyle=`rgba(120,100,70,${r()*.05})`;c.fillRect(r()*Wc,r()*Hc,1+r()*3,1)}
  const sky=c.createLinearGradient(0,0,0,hz);sky.addColorStop(0,rgba(em[0].col,.30));sky.addColorStop(.7,rgba(em[1].col,.14));sky.addColorStop(1,'rgba(242,237,225,0)');
  c.fillStyle=sky;c.fillRect(0,0,Wc,hz);
  em.forEach(e=>{const n=Math.round(e.v*16);for(let b=0;b<n;b++)blob(c,r,r()*Wc,r()*Hc*.9,90+r()*220,e.col)});
  rules.push(`색의 양 = 감정 비율 (${em.slice(0,3).filter(e=>e.v>0).map(e=>EMOS.find(x=>x.k===e.k).name).join(' > ')})`);
  if(E.hope>.12){const g=c.createRadialGradient(Wc/2,hz,10,Wc/2,hz,Wc*.75);g.addColorStop(0,'rgba(255,226,170,.55)');g.addColorStop(1,'rgba(255,226,170,0)');c.fillStyle=g;c.fillRect(0,0,Wc,Hc);rules.push('희망·의지 → 지평선에서 번지는 빛')}
  if(M.has('star')){for(let i=0;i<70;i++){const x=r()*Wc,y=r()*hz*.75,s=r()*2.2+.6;c.fillStyle=`rgba(255,252,235,${.5+r()*.5})`;c.beginPath();c.arc(x,y,s,0,7);c.fill()}
    for(let i=0;i<4;i++){const x=80+r()*(Wc-160),y=60+r()*hz*.5;c.strokeStyle='rgba(255,250,225,.9)';c.lineWidth=1.5;c.beginPath();c.moveTo(x-12,y);c.lineTo(x+12,y);c.moveTo(x,y-12);c.lineTo(x,y+12);c.stroke()}}
  const moonX=Wc*(.2+r()*.5),moonY=150+r()*120;
  if(M.has('moon')){const g=c.createRadialGradient(moonX,moonY,40,moonX,moonY,170);g.addColorStop(0,'rgba(255,248,225,.6)');g.addColorStop(1,'rgba(255,248,225,0)');c.fillStyle=g;c.fillRect(0,0,Wc,hz);
    c.fillStyle='rgba(253,248,232,.95)';c.beginPath();c.arc(moonX,moonY,52,0,7);c.fill();c.strokeStyle=ink(.18);c.lineWidth=1.5;c.stroke()}
  if(M.has('sun')){c.fillStyle=rgba('#b8332e',.62);c.beginPath();c.arc(Wc*(.62+r()*.2),hz-90,64,0,7);c.fill()}
  if(M.has('cloud')){for(let i=0;i<5;i++){const x=r()*Wc,y=80+r()*hz*.55;const g=c.createRadialGradient(x,y,5,x,y,160);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.save();c.translate(x,y);c.scale(1,.28);c.translate(-x,-y);c.fillStyle=g;c.fillRect(x-170,y-170,340,340);c.restore()}}
  const layers=3+(E.calm+E.long>.3?1:0),amp=M.has('mountain')?1.25:.8;
  for(let k=0;k<layers;k++){
    const base=hz-110+k*(80/layers)*1.6,A=(150-k*22)*amp,ph=[r()*6,r()*6,r()*6],f=[.004+r()*.003,.011+r()*.005,.03+r()*.01];
    const alpha=.14+k*(.55/layers);c.beginPath();c.moveTo(0,Hc);
    for(let x=0;x<=Wc;x+=6){const y=base-A*(.55*Math.sin(x*f[0]+ph[0])+.3*Math.sin(x*f[1]+ph[1])+.15*Math.sin(x*f[2]+ph[2])+.5)*.8-(r()*3);c.lineTo(x,y)}
    c.lineTo(Wc,Hc);c.closePath();
    const g=c.createLinearGradient(0,base-A,0,base+160);g.addColorStop(0,k===0?rgba(PIG.long,alpha):ink(alpha));g.addColorStop(1,ink(0));c.fillStyle=g;c.fill();
    if(E.calm+E.long>.25){const mg=c.createLinearGradient(0,base-10,0,base+70);mg.addColorStop(0,'rgba(242,237,225,0)');mg.addColorStop(.5,'rgba(242,237,225,.75)');mg.addColorStop(1,'rgba(242,237,225,0)');c.fillStyle=mg;c.fillRect(0,base-10,Wc,80)}}
  if(E.calm+E.long>.25)rules.push('평온·그리움 → 산 사이의 안개, 먼 산');
  const groundY=hz+70;
  if(M.has('water')){for(let i=0;i<46;i++){const y=groundY+20+i*7+r()*4,x=r()*Wc,w=40+r()*200;c.strokeStyle=ink(.08+r()*.14);c.lineWidth=1+r()*1.5;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+w/2,y-2,x+w,y);c.stroke()}
    if(M.has('moon')){for(let i=0;i<10;i++){const y=groundY+40+i*16;c.strokeStyle='rgba(253,248,232,.7)';c.lineWidth=3;c.beginPath();c.moveTo(moonX-30+r()*20,y);c.lineTo(moonX+20+r()*20,y);c.stroke()}}}
  const pathPts=[];
  if(M.has('path')){const x0=Wc*(.4+r()*.2),A=90+r()*80,ph=r()*6,N=40;c.lineCap='round';
    for(let s=0;s<=N;s++){const t=s/N;pathPts.push([x0+A*Math.sin(t*4.2+ph)*(1-t*.7),Hc-(Hc-groundY+30)*Math.pow(t,.8)])}
    for(let s=0;s<N;s++){const w=70*(1-s/N)+4;c.strokeStyle='rgba(246,241,228,.55)';c.lineWidth=w;c.beginPath();c.moveTo(...pathPts[s]);c.lineTo(...pathPts[s+1]);c.stroke()}
    pathPts.splice(0,pathPts.length,...pathPts.filter((_,i)=>i%3===0))}
  if(M.has('figure')){const [fx,fy]=pathPts[6]||[Wc*(.3+r()*.4),groundY+120];c.fillStyle=ink(.85);c.beginPath();c.arc(fx,fy-58,8,0,7);c.fill();
    c.beginPath();c.moveTo(fx-4,fy-50);c.quadraticCurveTo(fx-14,fy-20,fx-12,fy);c.lineTo(fx+12,fy);c.quadraticCurveTo(fx+14,fy-20,fx+4,fy-50);c.closePath();c.fill()}
  if(M.has('flower')){const n=Math.round(40+(E.love+E.joy)*120);const pc=[PIG.love,'#e98aa2','#b8332e'];
    for(let i=0;i<n;i++){const onPath=pathPts.length&&r()<.4;const pt=onPath?pathPts[Math.floor(r()*pathPts.length)]:[r()*Wc,groundY-60+r()*(Hc-groundY)];
      c.save();c.translate(pt[0]+(r()-.5)*40,pt[1]+(r()-.5)*30);c.rotate(r()*6.3);c.fillStyle=rgba(pc[Math.floor(r()*3)],.55+r()*.35);c.beginPath();c.ellipse(0,0,4+r()*7,2+r()*4,0,0,7);c.fill();c.restore()}
    rules.push('사랑·기쁨 → 꽃잎의 양')}
  if(M.has('snow')){for(let i=0;i<320;i++){c.fillStyle=`rgba(255,255,255,${.6+r()*.4})`;c.beginPath();c.arc(r()*Wc,r()*Hc,1+r()*2.6,0,7);c.fill()}}
  if(M.has('wind')){c.lineCap='round';for(let i=0;i<6;i++){const y=100+r()*(Hc-300),x=r()*Wc*.4;c.strokeStyle=ink(.1+r()*.1);c.lineWidth=1.5+r()*2;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+150,y-40,x+300,y+40,x+460,y-10);c.stroke()}}
  if(M.has('bird')){for(let i=0;i<3+Math.floor(r()*3);i++){const x=Wc*.15+r()*Wc*.7,y=hz*.25+r()*hz*.45,s=10+r()*10;c.strokeStyle=ink(.75);c.lineWidth=2.4;c.beginPath();c.moveTo(x-s,y-s*.4);c.quadraticCurveTo(x-s*.4,y-s*.5,x,y);c.quadraticCurveTo(x+s*.4,y-s*.5,x+s,y-s*.4);c.stroke()}}
  if(E.sad>.25){c.lineCap='butt';for(let i=0;i<170;i++){const x=r()*Wc,y=r()*Hc,l=30+r()*70;c.strokeStyle=rgba(PIG.sad,.06+r()*.08);c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-l*.12,y+l);c.stroke()}rules.push('슬픔 → 푸른 빗줄기')}
  if(E.anger>.1){c.lineCap='round';for(let i=0;i<3;i++){const x=r()*Wc,y=hz+r()*300;c.strokeStyle=rgba(PIG.anger,.35);c.lineWidth=6+r()*8;c.beginPath();c.moveTo(x,y);c.lineTo(x+120+r()*120,y-60-r()*80);c.stroke()}rules.push('원망·미움 → 붉은 붓 자국')}
  const gg=c.createLinearGradient(0,Hc-260,0,Hc);gg.addColorStop(0,ink(0));gg.addColorStop(1,ink(.35));c.fillStyle=gg;c.fillRect(0,Hc-260,Wc,260);
  const vg=c.createRadialGradient(Wc/2,Hc/2,Hc*.35,Wc/2,Hc/2,Hc*.8);vg.addColorStop(0,ink(0));vg.addColorStop(1,ink(.12+E.shame*.6));c.fillStyle=vg;c.fillRect(0,0,Wc,Hc);
  if(E.shame>.08)rules.push('성찰·부끄러움 → 가장자리의 어둠');
  if(M.has('window')){c.fillStyle='rgba(235,240,245,.18)';c.fillRect(0,0,Wc,Hc);c.strokeStyle=ink(.82);c.lineWidth=34;c.strokeRect(17,17,Wc-34,Hc-34);c.lineWidth=18;c.beginPath();c.moveTo(Wc/2,0);c.lineTo(Wc/2,Hc);c.moveTo(0,Hc*.48);c.lineTo(Wc,Hc*.48);c.stroke();
    for(let i=0;i<6;i++){const x=r()*Wc,y=r()*Hc,g=c.createRadialGradient(x,y,4,x,y,120);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-120,y-120,240,240)}}
  // 글씨: 핵심 구절 세로쓰기 + 제목 + 낙관
  const key=(p.key||p.lex.lines[0]?.t||'').replace(/\s+/g,' ');
  c.fillStyle='rgba(248,244,234,.0)';
  const fs=34,lh=42,colMax=Math.floor((Hc-360)/lh);let col=0,row=0;c.font=`${fs}px "Gowun Batang", serif`;c.textAlign='center';c.textBaseline='middle';
  for(const ch of key){if(ch===' '){row+=.5}else{c.fillStyle=ink(.85);c.shadowColor='rgba(248,244,234,.9)';c.shadowBlur=8;c.fillText(ch,Wc-84-col*52,96+row*lh);row++}
    if(row>=colMax){row=0;col++}}
  c.shadowBlur=0;c.textAlign='left';c.textBaseline='alphabetic';
  c.fillStyle='rgba(250,246,236,.95)';c.font=`44px "Song Myung", serif`;c.fillText(`「${p.title}」`,58,Hc-92);
  c.font=`24px "Gowun Batang", serif`;c.fillStyle='rgba(250,246,236,.85)';const pn=p.poet;c.fillText(pn,70,Hc-52);
  const sw=c.measureText(pn).width;const sx0=70+sw+16,sy0=Hc-78;c.fillStyle='#b8332e';c.fillRect(sx0,sy0,34,34);c.fillStyle='#f6efe2';c.font=`22px "Song Myung", serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.title[0],sx0+17,sy0+18);c.textAlign='left';c.textBaseline='alphabetic';
  const names=[...M].map(k=>MOTIFS.find(m=>m.k===k).name);
  $('artFacts').innerHTML=`<dt>색</dt><dd>${em.filter(e=>e.v>.04).slice(0,4).map(e=>`<span class="chip" style="margin:0 4px 4px 0"><i style="background:${PIG[e.k]}"></i>${EMOS.find(x=>x.k===e.k).name} ${pct(e.v)}%</span>`).join('')}</dd>`+
    `<dt>소재</dt><dd>${names.join(', ')}</dd><dt>규칙</dt><dd>${rules.map(esc).join('<br>')}</dd><dt>글씨</dt><dd>핵심 구절을 세로로 썼습니다</dd>`;
}
function buildPromptKo(p,v){
  const t=topIdx(v).filter(i=>v[i]>.05).slice(0,3);
  const names=[...motifsOf(p)].map(k=>MOTIFS.find(m=>m.k===k).name);
  const scene=SCENE_KO[p.id]||`시에 나오는 소재(${names.join(', ')||'자연'})가 어우러진 서정적인 풍경`;
  const key=p.key||(p.lex.lines.map(l=>[sum(l.c),l.t]).sort((a,b)=>b[0]-a[0])[0]||[0,''])[1];
  return [`한국 시 「${p.title}」(${p.poet})의 정서를 담은 그림을 그려 주세요.`,
    `- 장면: ${scene}`,
    key?`- 핵심 구절: “${key}”`:'',
    t.length?`- 정서: ${t.map(i=>`${EMOS[i].name} ${pct(v[i])}%`).join(', ')}. 가장 강한 정서인 ‘${EMOS[t[0]].name}’이 화면 전체의 색과 빛을 정하게 해 주세요.`:'- 정서: 뚜렷하게 감지된 정서가 없으니 고요하고 담담한 분위기로 그려 주세요.',
    names.length?`- 꼭 넣을 소재: ${names.join(', ')}`:'',
    `- 화풍: 한지 위에 그린 수묵 담채화, 절제된 색, 넉넉한 여백`,
    `- 세로 3:4 비율. 그림 안에 글자, 서명, 낙관은 넣지 마세요.`].filter(Boolean).join('\n');
}
function buildPrompt(p,v){const t=topIdx(v).filter(i=>v[i]>.05).slice(0,3).map(i=>EMO_EN[EMOS[i].k]);
  const scene=SCENE[p.id]||('a poetic Korean landscape with '+[...motifsOf(p)].map(k=>MOTIF_EN[k]).join(', '));
  return `Korean ink wash painting (sumukhwa) with soft watercolor on hanji paper: ${scene}. Mood: ${t.join(', ')||'quiet stillness'}. Muted earthy colors, poetic, generous empty space, no text, no letters.`}
const framed=(()=>{try{return window.self!==window.top}catch(e){return true}})();
function setMode(m){imgMode=m;$('tabArt').setAttribute('aria-selected',m==='art');$('tabAI').setAttribute('aria-selected',m==='ai');
  $('artPanel').hidden=m!=='art';$('aiPanel').hidden=m!=='ai';$('art').hidden=m!=='art';
  const has=$('aiImg').dataset.loaded==='1';$('aiImg').hidden=m!=='ai'||!has;
  const st=$('aiState');if(m==='ai'&&!has&&!st.dataset.busy){st.hidden=false;if(!st.textContent)st.textContent='Gemini에서 만든 그림을 ‘이미지 불러오기’로 가져오면 이 자리에 나타납니다.'}else if(m!=='ai')st.hidden=true}
function renderImage(p,v){
  if(promptFor!==p.id){promptFor=p.id;$('prompt').value=buildPromptKo(p,v);const img=$('aiImg');img.dataset.loaded='';img.hidden=true;$('aiState').textContent='';$('aiLink').textContent='';}
  const draw=()=>paintArt(p,v);
  if(fontsReady)draw();else{draw();Promise.all([document.fonts.load('44px "Song Myung"'),document.fonts.load('34px "Gowun Batang"')]).then(()=>{fontsReady=true;draw()}).catch(()=>{fontsReady=true})}
  setMode(imgMode);
}
$('tabArt').onclick=()=>setMode('art');$('tabAI').onclick=()=>setMode('ai');
$('redraw').onclick=()=>{artSeed++;const p=all().find(q=>q.id===selId);paintArt(p,finalVec(p))};
if(framed){$('saveArt').hidden=true}
$('saveArt').onclick=()=>{$('art').toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);const p=all().find(q=>q.id===selId);a.download=`${p.title}_감정수묵화.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)},'image/png')};
$('copyPrompt').onclick=async()=>{const b=$('copyPrompt');try{await navigator.clipboard.writeText($('prompt').value);b.textContent='복사됨'}catch(e){$('prompt').select();b.textContent='선택됨 · Ctrl+C'}setTimeout(()=>b.textContent='프롬프트만 복사',1800)};
$('openGemini').addEventListener('click',()=>{const n=$('aiLink');
  navigator.clipboard.writeText($('prompt').value).then(()=>{n.textContent='프롬프트를 복사했습니다. Gemini 입력창에 붙여 넣으세요(Ctrl+V).'},()=>{$('prompt').select();n.textContent='자동 복사가 막혔습니다. 선택된 프롬프트를 Ctrl+C로 복사해 Gemini에 붙여 넣으세요.'})});
$('upImg').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{const img=$('aiImg');img.onload=null;img.onerror=null;img.src=rd.result;img.dataset.loaded='1';$('aiState').hidden=true;if(imgMode==='ai')img.hidden=false;
    $('aiLink').textContent=`불러온 이미지: ${f.name}`};rd.readAsDataURL(f);e.target.value=''});
$('upImg').previousElementSibling.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('upImg').click()}});
$('genAI').onclick=()=>{
  const cp=all().find(q=>q.id===selId);const prompt=buildPrompt(cp,finalVec(cp));
  const seed=Math.floor(Math.random()*1e6);const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&seed=${seed}&nologo=true`;
  const img=$('aiImg'),st=$('aiState'),b=$('genAI');b.disabled=true;b.textContent='생성 중…';st.dataset.busy='1';st.hidden=false;img.hidden=true;
  st.textContent='그림을 그리는 중입니다. 10–40초쯤 걸립니다.';$('aiLink').textContent='';
  let done=false;const finish=()=>{done=true;b.disabled=false;b.textContent='빠른 생성 (Pollinations · 품질 낮음)';delete st.dataset.busy};
  const to=setTimeout(()=>{if(done)return;finish();img.src='';st.textContent='응답이 너무 늦습니다. 잠시 뒤 다시 누르거나, 프롬프트를 복사해 다른 무료 도구에서 만들어 보세요.'},70000);
  img.onload=()=>{if(done)return;clearTimeout(to);finish();img.dataset.loaded='1';st.hidden=true;if(imgMode==='ai')img.hidden=false;
    $('aiLink').innerHTML=`<a href="${url}" target="_blank" rel="noopener">원본 이미지 새 탭에서 열기</a> · 이미지 제공: Pollinations.ai`};
  img.onerror=()=>{if(done)return;clearTimeout(to);finish();
    st.textContent=framed?'이 미리보기 화면에서는 외부 이미지가 차단됩니다. GitHub Pages 배포판에서 사용하거나, 프롬프트를 복사해 무료 이미지 생성 도구에 붙여 넣으세요.':'AI 이미지 서비스에 연결하지 못했습니다. 잠시 뒤 다시 시도하거나, 프롬프트를 복사해 다른 무료 도구에서 만들어 보세요.'};
  img.src=url;
};

function render(){
  const p=all().find(q=>q.id===selId)||POEMS[0];const v=finalVec(p);const recs=getRecs(p);
  renderShelf();renderPoem(p);renderSummary(p,v,recs);renderRadar(p,v,recs[0]);renderFlow(p);renderSankey(p,v);renderImage(p,v);renderRecs(p,recs);renderMap(p,recs);renderHeat(p);renderCompare(p);
}
function select(id){selId=id;hideTip();render()}

$('w').addEventListener('input',e=>{W=e.target.value/100;$('wv').textContent=e.target.value+'%';render()});
$('mine').addEventListener('submit',e=>{e.preventDefault();const text=$('mtext').value.trim();const msg=$('mineMsg');
  if(!text){msg.textContent='시 본문을 입력한 뒤 분석하기를 눌러 주세요.';msg.hidden=false;$('mtext').focus();return}
  msg.hidden=true;
  const title=$('mtitle').value.trim()||'내가 입력한 시';
  custom={id:'custom',title,poet:'직접 입력',year:'',text,lex:lexAnalyze(text),cur:null};selId='custom';render();
  window.scrollTo({top:0,behavior:'auto'})});

/* ---------- 8. 분석 방법 비교 (검증용) ---------- */
function renderCompare(p){
  const box=$('compare');
  if(!p.cur){box.innerHTML=emptyMsg('직접 입력한 시는 해석 프로필이 없어 감정 사전 결과만 있습니다. 수록 작품을 고르면 두 방법을 비교할 수 있습니다.');$('cmpNote').textContent='';return}
  const L=p.lex.vec,I=p.cur,F=finalVec(p);const PL=pctList(L),PI=pctList(I),PF=pctList(F);
  let h='<table class="cmp"><thead><tr><th scope="col">정서</th><th scope="col">사전만 (w=100%)</th><th scope="col">해석만 (w=0%)</th><th scope="col">현재 (w='+Math.round(W*100)+'%)</th><th scope="col">차이</th></tr></thead><tbody>';
  EMOS.forEach((e,i)=>{const d=PL[i]-PI[i];const big=Math.abs(d)>=15;
    h+=`<tr class="${big?'gap':''}"><th scope="row"><i style="background:${e.c}"></i>${e.name}</th><td>${PL[i]}%</td><td>${PI[i]}%</td><td>${PF[i]}%</td><td>${d>0?'+':''}${d}${big?' ⚑':''}</td></tr>`});
  box.innerHTML=h+'</tbody></table>';
  const order=EMOS.map((e,i)=>[Math.abs(PL[i]-PI[i]),i]).sort((a,b)=>b[0]-a[0]);const [gap,gi]=order[0];
  const hits=p.lex.words.filter(w=>w.i===gi).map(w=>`‘${w.w}’×${w.n}`).join(', ');
  const dl=topIdx(L)[0],di=topIdx(I)[0];
  $('cmpNote').innerHTML=`사전만 쓰면 지배 정서는 <b>${isEmpty(L)?'없음':EMOS[dl].name}</b>, 해석만 쓰면 <b>${EMOS[di].name}</b>입니다. `+
    `두 방법의 차이가 가장 큰 정서는 <b>${EMOS[gi].name}</b>(${gap}%p)이며, `+
    (PL[gi]>PI[gi]?`사전이 더 높게 잡았습니다. 근거 시어: ${hits||'—'}. 이 시어들이 문맥상 정말 ${EMOS[gi].name}을 뜻하는지 확인해 보세요.`
                   :`해석이 더 높게 봤습니다. 사전에서 잡힌 시어는 ${hits||'없음'}으로, 반어·역설이나 시어 없이 장면으로 전달되는 정서를 사전이 놓친 경우입니다.`)+
    ` ⚑ 표시는 차이가 15%p 이상인 정서로, README의 검증 사례 후보입니다.`;
}
/* ---------- 9. 감정 범주 정의 · 결과 내보내기 · 출처 ---------- */
function renderStatic(){
  $('emodefs').innerHTML=EMOS.map(e=>`<div class="def"><dt><i style="background:${e.c}"></i>${e.name} <code>${e.k}</code></dt><dd>${esc(e.def)}<span class="sub">사전 시어 ${LEX[e.k].length}개 · ${LEX[e.k].slice(0,6).map(esc).join(', ')} …</span></dd></div>`).join('');
  $('sources').innerHTML=POEMS.map(p=>`<li>「${esc(p.title)}」 ${esc(p.poet)}(${p.poetDeath}년 사망) — ${esc(p.source)}</li>`).join('');
  document.querySelectorAll('[data-count]').forEach(el=>el.textContent=POEMS.length);
}
function buildResults(){
  const method=W>=1?'lexicon':'hybrid';
  return {generated:new Date().toISOString(),weight:W,emotions:EMOS.map(e=>e.k),
    results:POEMS.map(p=>{const v=finalVec(p);return {id:p.id,title:p.title,
      vec:v.map(x=>+x.toFixed(4)),dominant:EMOS[topIdx(v)[0]].k,
      lines:p.lex.lines.map((l,j)=>({no:j+1,text:l.t,counts:l.c,hits:l.hits})),method}})};
}
$('exportJson').onclick=()=>{const b=new Blob([JSON.stringify(buildResults(),null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='results.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
renderStatic();
render();
