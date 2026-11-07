/* Native adaptations of Animate UI patterns; see MOTION.md for the mapping. */
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const active = new Set();
const channels = new WeakMap();
const finishers = new Set();
let preference;
try { preference = localStorage.getItem('resume-motion'); } catch {}
let enabled = preference ? preference === 'on' : !reduced.matches;
root.dataset.motion = enabled ? 'on' : 'off';

function play(el, frames, options = {}, key = 'default') {
  let slots = channels.get(el);
  if (!slots) channels.set(el, slots = new Map());
  slots.get(key)?.cancel();
  if (!enabled || !el.animate) return Promise.resolve(true);
  const animation = el.animate(frames, {duration:480, easing:'cubic-bezier(.22,.72,.22,1)', fill:'both', ...options});
  slots.set(key, animation); active.add(animation);
  return animation.finished.then(() => true, () => false).then(finished => {
    active.delete(animation);
    if (slots.get(key) === animation) slots.delete(key);
    animation.cancel();
    return finished;
  });
}

function spring(stiffness = 300, damping = 30) {
  const omega = Math.sqrt(stiffness), zeta = damping / (2 * omega);
  const points = [];
  for (let i=0; i<=80; i++) {
    const t=i/80*.9;
    let p;
    if(zeta < 1) { const wd=omega*Math.sqrt(1-zeta*zeta); p=1-Math.exp(-zeta*omega*t)*(Math.cos(wd*t)+zeta*omega/wd*Math.sin(wd*t)); }
    else if(Math.abs(zeta-1)<.0001) p=1-(1+omega*t)*Math.exp(-omega*t);
    else { const r=Math.sqrt(damping*damping-4*stiffness), a=(-damping+r)/2, b=(-damping-r)/2; p=1-(b*Math.exp(a*t)-a*Math.exp(b*t))/(b-a); }
    points.push(i===80 ? 1 : p);
  }
  return points;
}
const heightSpring = spring(300,30), highlightSpring = spring(500,40);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

function reveal(el, delay = 0, distance = 22) {
  return play(el,[{opacity:0,transform:`translateY(${distance}px)`,filter:'blur(5px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:650,delay},'reveal');
}

// A single surface springs between items, matching Highlight's parent mode.
function highlight(group, selector, current) {
  const surface = document.createElement('span');
  surface.className='motion-highlight'; surface.setAttribute('aria-hidden','true'); group.prepend(surface);
  let previous;
  function update(item = current()) {
    if(!item) { surface.hidden=true; return; }
    surface.hidden=false;
    const a=group.getBoundingClientRect(), b=item.getBoundingClientRect();
    const rect={x:b.left-a.left+group.scrollLeft-group.clientLeft,y:b.top-a.top-group.clientTop,w:b.width,h:b.height};
    surface.style.cssText=`width:${rect.w}px;height:${rect.h}px;transform:translate(${rect.x}px,${rect.y}px)`;
    if(previous) {
      const start=previous;
      play(surface,highlightSpring.map(p=>({transform:`translate(${start.x+(rect.x-start.x)*p}px,${start.y+(rect.y-start.y)*p}px)`,width:`${start.w+(rect.w-start.w)*p}px`,height:`${start.h+(rect.h-start.h)*p}px`})),{duration:700,easing:'linear'},'highlight');
    }
    previous=rect;
  }
  group.addEventListener('pointerover',e=>{ if(fine.matches) { const item=e.target.closest(selector); if(item) update(item); } });
  group.addEventListener('pointerleave',()=>update());
  group.addEventListener('focusin',e=>{ const item=e.target.closest(selector); if(item) update(item); });
  group.addEventListener('focusout',()=>setTimeout(()=>{if(!group.contains(document.activeElement))update();},0));
  new MutationObserver(()=>update()).observe(group,{subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
  new ResizeObserver(()=>update()).observe(group);
  document.fonts?.ready.then(()=>update());
  update(); return update;
}

const nav=$('.nav-links');
highlight(nav,'a',()=>$('a.active',nav));
new MutationObserver(()=>{
  const item=$('a.active',nav);if(!item)return;
  const b=item.getBoundingClientRect(),g=nav.getBoundingClientRect();
  if(b.left<g.left||b.right>g.right)nav.scrollTo({left:nav.scrollLeft+b.left-g.left-(nav.clientWidth-b.width)/2,behavior:enabled?'smooth':'instant'});
}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
highlight($('.signal-tabs'),'button',()=>$('button[aria-pressed="true"]',$('.signal-tabs')));

// The original data and links stay in index.html; motion has one owner here.
const entrance = new IntersectionObserver(entries=>{
  for(const entry of entries) if(entry.isIntersecting) {
    const section=entry.target; section.dataset.inView='true'; entrance.unobserve(section);
    $$('.section-badge,.section-title',section).forEach((el,i)=>reveal(el,i*65,15));
    const cards=$$('.hl-card,.ai-card,.project-card,.tl-item,.fitnote-main,.fitnote-ai,.contact-item,.edu-card,.travel-feature',section);
    if(!cards.length) $$(':scope > div',section).forEach(el=>reveal(el,100));
  }
},{threshold:.07});
$$('.section').forEach(el=>entrance.observe(el));
const cardObserver=new IntersectionObserver(entries=>{
  entries.filter(entry=>entry.isIntersecting).forEach(({target},i)=>{
    cardObserver.unobserve(target);target.dataset.motionEntered='true';reveal(target,Math.min(i,5)*80);
  });
},{threshold:.1,rootMargin:'0px 0px -12px 0px'});
$$('.hl-card,.ai-card,.project-card,.tl-item,.fitnote-main,.fitnote-ai,.contact-item,.edu-card,.travel-feature').forEach(el=>cardObserver.observe(el));

const headline=$('.hero h1');
const originalName=headline.innerText.replace(/\s+/g,' ').trim();
headline.setAttribute('aria-label',originalName);
const lines=headline.innerHTML.split(/<br\s*\/?>/i); headline.replaceChildren();
let letterIndex=0;
for(const line of lines) {
  const holder=document.createElement('span'); holder.className='name-line'; holder.setAttribute('aria-hidden','true');
  const decoded=document.createElement('span'); decoded.innerHTML=line;
  for(const character of Array.from(decoded.textContent.trim())) {
    const letter=document.createElement('span'); letter.className='name-letter'; letter.textContent=character; holder.append(letter);
    reveal(letter,180+letterIndex++*42,26);
  }
  headline.append(holder);
}
$$('.school-badge,.subtitle,.major-tag,.typewriter-wrap,.hero-actions').forEach((el,i)=>reveal(el,80+i*100,15));
reveal($('.signal-console'),650,10);

// Rotating/Swapping Text: complete phrases, never a half-deleted sentence.
const phrases=['从电路板到神经网络','信号处理 × 机器学习','嵌入式 + AI = 无限可能','硬件是骨，智能是魂'];
let phraseIndex=0, phraseTimer;
const phrase=$('#typewriter'); phrase.textContent=phrases[0]; phrase.setAttribute('aria-live','off');
function rotatePhrase() {
  clearTimeout(phraseTimer);
  if(!enabled || document.hidden) return;
  phraseTimer=setTimeout(async()=>{
    if(!enabled || document.hidden) return;
    const done=await play(phrase,[{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:'translateY(-7px)',filter:'blur(5px)'}],{duration:260},'phrase');
    if(!done || !enabled) return;
    phraseIndex=(phraseIndex+1)%phrases.length; phrase.textContent=phrases[phraseIndex];
    await play(phrase,[{opacity:0,transform:'translateY(8px)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:430},'phrase');
    rotatePhrase();
  },3400);
}
rotatePhrase();

// Counting Number and spring progress, with explicit final values on pause.
const numbers = new IntersectionObserver(entries=>entries.forEach(({target, isIntersecting})=>{
  if(!isIntersecting) return; numbers.unobserve(target);
  const to=Number(target.dataset.count); target.setAttribute('aria-label',String(to));
  const inner=document.createElement('span'); inner.setAttribute('aria-hidden','true'); target.replaceChildren(inner);
  let start,raf;
  const finish=()=>{cancelAnimationFrame(raf);inner.textContent=String(to);}; finishers.add(finish);
  const step=now=>{ if(!enabled){finish();return;} start??=now; const p=clamp((now-start)/1200,0,1);inner.textContent=String(Math.round((1-(1-p)**3)*to)); if(p<1)raf=requestAnimationFrame(step); else finishers.delete(finish); };
  if(enabled) raf=requestAnimationFrame(step); else finish();
}),{threshold:.5});
$$('[data-count]').forEach(el=>numbers.observe(el));

const skills=$('#skills'); let skillsSeen=false, radarProgress=0, radarFocus=-1, radarRAF;
const radar=$('#radar-canvas'); radar.setAttribute('role','img'); radar.setAttribute('aria-label','技能自评图谱：C/C++、嵌入式、MATLAB、AI/ML、电路、信号处理');
const caption=document.createElement('p'); caption.className='radar-caption'; caption.textContent='技能自评 · 移动指针探索图谱'; $('.skills-radar').append(caption);
function drawRadar() {
  const ctx=radar.getContext('2d'), w=320,h=320,r=110,cx=w/2,cy=h/2;
  const dpr=Math.min(devicePixelRatio||1,2); if(radar.width!==w*dpr){radar.width=w*dpr;radar.height=h*dpr;radar.style.width='100%';radar.style.height='auto';}
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const color=getComputedStyle(root), line=color.getPropertyValue('--border').trim(), ink=color.getPropertyValue('--text2').trim(), blue=color.getPropertyValue('--accent2').trim(), gold=color.getPropertyValue('--gold-light').trim();
  const names=['C/C++','嵌入式','MATLAB','AI/ML','电路','信号处理'], values=[.85,.75,.8,.55,.8,.78];
  const point=(i,radius)=>{const a=i*Math.PI/3-Math.PI/2;return [cx+Math.cos(a)*radius,cy+Math.sin(a)*radius];};
  ctx.lineWidth=1;
  for(let level=1;level<=5;level++){ctx.beginPath();for(let i=0;i<=6;i++){const [x,y]=point(i%6,r*level/5);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.strokeStyle=line;ctx.stroke();}
  for(let i=0;i<6;i++){const [x,y]=point(i,r);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.strokeStyle=line;ctx.stroke();const [tx,ty]=point(i,r+22);ctx.fillStyle=i===radarFocus?gold:ink;ctx.font=(i===radarFocus?'600 ':'')+'11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(names[i],tx,ty);}
  ctx.beginPath(); values.forEach((v,i)=>{const [x,y]=point(i,r*v*radarProgress);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.globalAlpha=.17;ctx.fillStyle=blue;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=blue;ctx.lineWidth=1.6;ctx.stroke();
  values.forEach((v,i)=>{const [x,y]=point(i,r*v*radarProgress);ctx.beginPath();ctx.arc(x,y,i===radarFocus?6:3.5,0,Math.PI*2);ctx.fillStyle=i===radarFocus?gold:blue;ctx.fill();if(i===radarFocus){ctx.globalAlpha=.15;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}});
  radar.dataset.focus=String(radarFocus);
}
function focusRadar(index) { radarFocus=index; drawRadar(); }
const barToRadar=[0,2,1,3,4];
$$('.skill-bar-item').forEach((el,i)=>{el.tabIndex=0;el.addEventListener('pointerenter',()=>focusRadar(barToRadar[i]));el.addEventListener('pointerleave',()=>focusRadar(-1));el.addEventListener('focus',()=>focusRadar(barToRadar[i]));el.addEventListener('blur',()=>focusRadar(-1));});
radar.addEventListener('pointermove',e=>{const b=radar.getBoundingClientRect(),a=Math.atan2(e.clientY-b.top-b.height/2,e.clientX-b.left-b.width/2)+Math.PI/2;focusRadar((Math.round(a/(Math.PI/3))+6)%6);});
radar.addEventListener('pointerleave',()=>focusRadar(-1));
const skillObserver=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting||skillsSeen)return;skillsSeen=true;skillObserver.disconnect();
  $$('.bar-fill').forEach((bar,i)=>{const end=Number(bar.dataset.width)/100;bar.style.transform=`scaleX(${end})`;play(bar,heightSpring.map(p=>({transform:`scaleX(${end*p})`})),{duration:1000,delay:i*85,easing:'linear'},'bar');});
  let start;const finish=()=>{cancelAnimationFrame(radarRAF);radarProgress=1;drawRadar();};finishers.add(finish);
  function grow(t){start??=t;radarProgress=enabled?1-(1-clamp((t-start)/1100,0,1))**3:1;drawRadar();if(radarProgress<1)radarRAF=requestAnimationFrame(grow);else finishers.delete(finish);}radarRAF=requestAnimationFrame(grow);
},{threshold:.15}); skillObserver.observe(skills);drawRadar();

// Auto Height: measure the inner content, handle resize, cancel rapid reversals.
function collapsible(host, inner, trigger, expanded) {
  let serial=0, last=inner.getBoundingClientRect().height;
  function resize(from) {
    const open=expanded(), to=open?inner.getBoundingClientRect().height:0, current=from??host.getBoundingClientRect().height, version=++serial;
    host.style.height=to+'px';host.classList.add('resume-height-running');host.inert=!open;host.setAttribute('aria-hidden',String(!open)); trigger.setAttribute('aria-expanded',String(open));
    if(open) $$('li,.course-tag',inner).forEach((el,i)=>reveal(el,Math.min(i,7)*26,9));
    play(host,heightSpring.map(p=>({height:Math.max(0,current+(to-current)*p)+'px'})),{duration:700,easing:'linear'},'height').then(()=>{
      if(version!==serial)return;host.classList.remove('resume-height-running');host.style.height=open?'auto':'0px';
    });
    last=to;
  }
  host.inert=!expanded();host.style.height=expanded()?'auto':'0px';host.setAttribute('aria-hidden',String(!expanded()));trigger.setAttribute('aria-expanded',String(expanded()));
  new ResizeObserver(()=>{if(expanded()){const next=inner.getBoundingClientRect().height;if(Math.abs(next-last)>.5)resize(last);}}).observe(inner);
  return resize;
}
$$('.tl-item[data-expand]').forEach((card,i)=>{
  const host=$('.tl-detail',card), inner=document.createElement('div');inner.className='tl-detail-inner';inner.append(...host.childNodes);host.append(inner);host.id='experience-detail-'+i;
  card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-controls',host.id);
  const update=collapsible(host,inner,card,()=>card.classList.contains('expanded'));
  const toggle=()=>{card.classList.toggle('expanded');$('.tl-expand-hint > span',card).textContent=card.classList.contains('expanded')?'收起详情':'点击展开详情';update();};
  card.addEventListener('click',e=>{if(!e.target.closest('a'))toggle();});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
});
const edu=$('#edu-card'), eduTrigger=$('#edu-toggle'), eduHost=$('.edu-body');eduHost.id='education-details';eduTrigger.setAttribute('aria-controls',eduHost.id);
const resizeEdu=collapsible(eduHost,$('.edu-body-inner'),eduTrigger,()=>edu.classList.contains('open'));
eduTrigger.addEventListener('click',()=>{edu.classList.toggle('open');resizeEdu();});

// Tilt on inner surfaces preserves card entry transforms and click targets.
$$('.project-card,.hl-card,.ai-card').forEach(card=>{
  const body=document.createElement('div');body.className='resume-card-body';body.append(...card.childNodes);card.append(body);
  card.removeAttribute('onmousemove');
  card.addEventListener('pointermove',e=>{if(!fine.matches||!enabled)return;const b=card.getBoundingClientRect(),x=(e.clientX-b.left)/b.width,y=(e.clientY-b.top)/b.height;card.style.setProperty('--mx',(x*100)+'%');card.style.setProperty('--my',(y*100)+'%');body.style.setProperty('--tilt-x',((.5-y)*7)+'deg');body.style.setProperty('--tilt-y',((x-.5)*7)+'deg');});
  card.addEventListener('pointerleave',()=>{body.style.setProperty('--tilt-x','0deg');body.style.setProperty('--tilt-y','0deg');});
});
$$('.project-card').forEach(card=>{card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-haspopup','dialog');card.setAttribute('aria-label','查看'+$('h3',card).textContent+'详情');card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});});

// Magnetic actions, Shine, Ripple and press feedback.
$$('.hero-action,.travel-primary,.school-badge').forEach(el=>el.classList.add('motion-shine'));
$$('.hero-action').forEach(button=>{
  button.addEventListener('pointermove',e=>{if(!enabled||!fine.matches)return;const b=button.getBoundingClientRect();button.style.translate=`${clamp((e.clientX-b.left-b.width/2)*.12,-7,7)}px ${clamp((e.clientY-b.top-b.height/2)*.18,-5,5)}px`;});
  button.addEventListener('pointerleave',()=>button.style.translate='0px 0px');
});
document.addEventListener('pointerdown',e=>{const button=e.target.closest('button,.hero-action,.travel-primary,.m-demo-btn,.m-link');if(!button||button.disabled||!enabled)return;button.classList.add('has-ripple');const b=button.getBoundingClientRect(),size=Math.max(b.width,b.height)*2;const ripple=document.createElement('span');ripple.className='motion-ripple';ripple.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-b.left-size/2}px;top:${e.clientY-b.top-size/2}px`;button.append(ripple);play(ripple,[{scale:0,opacity:.22},{scale:1,opacity:0}],{duration:620},'ripple').then(()=>ripple.remove());play(button,[{scale:1},{scale:.96},{scale:1}],{duration:300},'press');});

// Accessible Dialog: a spring entry, real exit, focus trap and restored focus.
const overlay=$('#modal-overlay'), modal=$('#modal');let modalVersion=0, previousFocus, inerted=[];
overlay.inert=true;overlay.setAttribute('aria-hidden','true');
function openModal(){
  const already=overlay.classList.contains('open');++modalVersion;
  if(!already){previousFocus=document.activeElement;inerted=$$('body > nav,body > section,body > .footer,body > button').map(el=>[el,el.inert]);inerted.forEach(([el])=>el.inert=true);}
  overlay.inert=false;overlay.setAttribute('aria-hidden','false');overlay.classList.add('open');document.body.style.overflow='hidden';
  const title=$('h3',$('#modal-content'));if(title){title.id='modal-title';modal.setAttribute('aria-labelledby',title.id);}
  play(overlay,[{opacity:0},{opacity:1}],{duration:230},'dialog');
  play(modal,heightSpring.map(p=>({transform:`translateY(${26*(1-p)}px) scale(${.94+.06*p})`,filter:`blur(${Math.max(0,5*(1-p))}px)`})),{duration:650,easing:'linear'},'dialog');
  $$('#modal-content > h3,#modal-content > p,#modal-content li').forEach((el,i)=>reveal(el,Math.min(i,8)*35,10));
  $('#modal-close').focus({preventScroll:true});
}
async function closeModal(){
  if(!overlay.classList.contains('open'))return;const version=++modalVersion;
  $$('video',modal).forEach(video=>video.pause());
  await Promise.all([play(overlay,[{opacity:getComputedStyle(overlay).opacity},{opacity:0}],{duration:220},'dialog'),play(modal,[{transform:getComputedStyle(modal).transform},{transform:'translateY(15px) scale(.97)'}],{duration:220},'dialog')]);
  if(version!==modalVersion)return;overlay.classList.remove('open');overlay.inert=true;overlay.setAttribute('aria-hidden','true');document.body.style.overflow='';inerted.forEach(([el,value])=>el.inert=value);inerted=[];if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
}
window.ResumeMotion={openModal,closeModal};
if(overlay.classList.contains('open')) { overlay.classList.remove('open');openModal(); }
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||!overlay.classList.contains('open'))return;const all=$$('button,a[href],video[controls],[tabindex="0"]',modal).filter(el=>el.getClientRects().length);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});

// Tooltips are shown for deliberate hover/keyboard focus, not automatic focus.
const tip=document.createElement('div');tip.className='resume-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.append(tip);let tipTimer;
function hideTip(){clearTimeout(tipTimer);tip.hidden=true;}
function showTip(el){hideTip();tipTimer=setTimeout(()=>{tip.textContent=el.dataset.motionTip;tip.hidden=false;const b=el.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=clamp(b.left+b.width/2-t.width/2,10,innerWidth-t.width-10)+'px';tip.style.top=(b.bottom+9)+'px';reveal(tip,0,4);},400);}
$$('[data-motion-tip]').forEach(el=>{el.addEventListener('pointerenter',()=>{if(fine.matches)showTip(el);});el.addEventListener('pointerleave',hideTip);el.addEventListener('focus',()=>{if(el.matches(':focus-visible'))showTip(el);});el.addEventListener('blur',hideTip);});
const toast=$('#copied-toast');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');new MutationObserver(()=>{if(toast.classList.contains('show'))play(toast,[{opacity:0,translate:'0 9px',filter:'blur(4px)'},{opacity:1,translate:'0 0',filter:'blur(0)'}],{duration:320},'toast');}).observe(toast,{attributes:true,attributeFilter:['class']});
$$('[data-copy]').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click();}});});

// Scroll Progress and the education/experience circuit trace.
let scrollTick=false;
function updateScroll(){
  const range=document.documentElement.scrollHeight-innerHeight;
  $('#scroll-progress').style.transform=`scaleX(${range>0?clamp(scrollY/range,0,1):0})`;
  $('#back-to-top').classList.toggle('visible',scrollY>innerHeight);
  const timeline=$('.timeline'), b=timeline.getBoundingClientRect();timeline.style.setProperty('--timeline-progress',clamp((innerHeight*.75-b.top)/b.height,0,1));
  scrollTick=false;
}
addEventListener('scroll',()=>{hideTip();if(!scrollTick){scrollTick=true;requestAnimationFrame(updateScroll);}},{passive:true});addEventListener('resize',updateScroll);updateScroll();

// Signal / Circuit / Network: a single DPR-capped canvas, maximum 30 paints/s.
const canvas=$('#engineering-canvas'), ctx=canvas.getContext('2d');let width=innerWidth,height=innerHeight,dpr=1,frame,lastPaint=0,scene='signal',tempo=.85,clock=0,lastTime=0;
const pointer={x:.5,y:.5,targetX:.5,targetY:.5};const bursts=[];
function resizeCanvas(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);drawScene();}
function drawScene(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const dark=root.dataset.theme!=='light',blue=dark?'55,151,239':'0,91,172',gold=dark?'224,184,96':'170,116,34';
  const px=(pointer.x-.5)*18,py=(pointer.y-.5)*13,unit=width<760?52:64;
  ctx.lineWidth=.7;
  ctx.strokeStyle=`rgba(${blue},${dark?.065:.075})`;
  for(let x=20+px;x<width;x+=unit){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
  for(let y=15+py;y<height;y+=unit){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  const glow=ctx.createRadialGradient(pointer.x*width,pointer.y*height,0,pointer.x*width,pointer.y*height,Math.min(width,650));glow.addColorStop(0,`rgba(${blue},.065)`);glow.addColorStop(1,`rgba(${blue},0)`);ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  function line(points,color,alpha=1){ctx.strokeStyle=`rgba(${color},${alpha})`;ctx.lineWidth=1.1;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function dot(x,y,r,color,alpha=1){ctx.fillStyle=`rgba(${color},${alpha})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  if(scene==='signal'){
    for(const [start,end,base,sign] of [[-.05,.38,.61,1],[.61,1.08,.29,-1]]){
      for(let j=0;j<4;j++){const points=[];for(let i=0;i<=130;i++){const p=i/130,x=(start+(end-start)*p)*width,y=height*base+Math.sin(p*Math.PI*(4+j*.75)+clock*sign)*height*(.045+j*.008)*Math.sin(p*Math.PI)+py;points.push([x,y]);}line(points,j===0?gold:blue,j===0?.52:.26-j*.035);}
    }
    for(let i=0;i<16;i++){const x=width*(.045+i*.013),a=(.5+.5*Math.sin(i*.7+clock))*height*.08;line([[x,height*.3-a],[x,height*.3+a]],blue,.15);}
  }else if(scene==='circuit'){
    for(const side of [-1,1]) for(let i=0;i<6;i++){
      const x=side<0?width*(.04+i*.036):width*(.96-i*.036), y=height*(.18+i*.105),endX=side<0?width*.31:width*.69;
      const points=[[side<0?-10:width+10,y],[x,y],[x,y+45],[endX,y+45]];line(points,i%3===0?gold:blue,.26);dot(endX,y+45,3,blue,.4);
      const p=(clock*.11+i*.17)%1;dot(x+(endX-x)*p,y+45,2.7,i%3===0?gold:blue,.85);
    }
    for(const [x,y] of [[width*.19,height*.39],[width*.81,height*.65]]){
      ctx.strokeStyle=`rgba(${gold},.38)`;ctx.strokeRect(x-24,y-24,48,48);
      for(let i=0;i<5;i++){const offset=-16+i*8;line([[x+offset,y-33],[x+offset,y-24]],blue,.4);line([[x+offset,y+24],[x+offset,y+33]],blue,.4);}
      dot(x,y,4,blue,.5+.2*Math.sin(clock));
    }
  }else{
    for(const side of [-1,1]){
      const nodes=Array.from({length:10},(_,i)=>{const a=i*.71+side*.4;return [width*(side<0?.17:.83)+Math.cos(a+Math.sin(clock*.15+i)*.06)*Math.min(width*.16,195)+px,height*.49+Math.sin(a)*height*.31+py];});
      nodes.forEach(([x,y],i)=>{for(let j=i+1;j<nodes.length;j++)if((i+j)%3===0){line([[x,y],nodes[j]],blue,.17);const p=(clock*.1+i*.13)%1;dot(x+(nodes[j][0]-x)*p,y+(nodes[j][1]-y)*p,1.7,gold,.7);}dot(x,y,i%3===0?4:2.5,i%3===0?gold:blue,.5);});
    }
  }
  for(let i=bursts.length-1;i>=0;i--){const burst=bursts[i],p=(performance.now()-burst.time)/1000;if(p>1){bursts.splice(i,1);continue;}ctx.strokeStyle=`rgba(${gold},${(1-p)*.5})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(burst.x,burst.y,12+p*95,0,Math.PI*2);ctx.stroke();}
  canvas.dataset.scene=scene;
}
function loop(now){frame=null;if(!enabled||document.hidden)return;if(now-lastPaint>=32){const dt=lastTime?Math.min((now-lastTime)/1000,.06):0;clock+=dt*tempo;lastTime=now;pointer.x+=(pointer.targetX-pointer.x)*.08;pointer.y+=(pointer.targetY-pointer.y)*.08;drawScene();lastPaint=now;}frame=requestAnimationFrame(loop);}
function resumeCanvas(){cancelAnimationFrame(frame);lastTime=0;if(enabled&&!document.hidden)frame=requestAnimationFrame(loop);else drawScene();}
document.addEventListener('pointermove',e=>{pointer.targetX=e.clientX/width;pointer.targetY=e.clientY/height;},{passive:true});
document.addEventListener('pointerdown',e=>{if(enabled&&!e.target.closest('a,button,input,.project-card,.tl-item,.skill-bar-item')){bursts.push({x:e.clientX,y:e.clientY,time:performance.now()});if(bursts.length>5)bursts.shift();}});
$$('.signal-tabs button').forEach(button=>button.addEventListener('click',()=>{scene=button.dataset.scene;$$('.signal-tabs button').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));play(canvas,[{opacity:.15},{opacity:1}],{duration:450},'scene');drawScene();}));
$('#signal-tempo').addEventListener('input',e=>{tempo=Number(e.target.value);$('#tempo-value').value=tempo.toFixed(2)+'×';});
addEventListener('resize',resizeCanvas);resizeCanvas();resumeCanvas();

const control=$('#motion-control');
function updateMotion(){
  root.dataset.motion=enabled?'on':'off';control.setAttribute('aria-pressed',String(enabled));control.setAttribute('aria-label',enabled?'暂停所有装饰动效':'开启动效');$('.motion-label',control).textContent=enabled?'动效 开':'动效 关';
  if(!enabled){for(const animation of active){try{animation.finish();}catch{animation.cancel();}}finishers.forEach(f=>f());finishers.clear();$$('.hero-action').forEach(el=>el.style.translate='0 0');bursts.length=0;}
  rotatePhrase();resumeCanvas();
}
control.addEventListener('click',()=>{enabled=!enabled;preference=enabled?'on':'off';try{localStorage.setItem('resume-motion',preference);}catch{}updateMotion();});
reduced.addEventListener('change',()=>{if(!preference){enabled=!reduced.matches;updateMotion();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(phraseTimer);cancelAnimationFrame(frame);for(const animation of active){try{animation.finish();}catch{}}}else{rotatePhrase();resumeCanvas();}});
new MutationObserver(()=>{drawRadar();drawScene();play($('#theme-toggle'),[{rotate:'-60deg',scale:.7},{rotate:'0deg',scale:1}],{duration:420},'theme');}).observe(root,{attributes:true,attributeFilter:['data-theme']});
updateMotion();
