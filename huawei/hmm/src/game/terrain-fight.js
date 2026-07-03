// Version: 1.0001
// AUTO-GENERATED от scripts/build-terrain-bg.js (източник: patch/FIGHT_ON_PLACE_1920x2560.html).
// НЕ редактирай ръчно — промени патча/скрипта и пусни: node scripts/build-terrain-bg.js
(function(){
/* ============================================================
   Painterly fantasy engine v2  (browser + node-canvas)
   detailed leaves+branches, multi-color foliage, animals
   ============================================================ */
function _mk(w,h){ const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function lerp(a,b,t){return a+(b-a)*t;}
function _rgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function _hex(c){return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function lighten(h,a){return _hex(_rgb(h).map(v=>v+(255-v)*a));}
function darken(h,a){return _hex(_rgb(h).map(v=>v*(1-a)));}

const LEAFSETS={
  green:['#3a6b2e','#4a7d36','#5e9440','#2f5828','#6ba046'],
  yellow:['#bf9a2e','#d6b842','#b08326','#e3cf60','#caa838'],
  orange:['#b3651f','#c8762c','#9a4c1c','#d98a38','#a85a22'],
  brown:['#86592c','#9a6a34','#6f4420','#ad7a3c','#7d5527'],
  red:['#9a3a26','#b85030','#7a2a1c','#a8412a']
};
const MOODS=[
  ['green','green','green','green','yellow'],
  ['green','green','yellow','orange','green'],
  ['yellow','orange','brown','yellow','green'],
  ['orange','brown','red','orange','yellow'],
  ['brown','brown','yellow','orange','green']
];

function buildNoise(size){
  const s=_mk(size/8,size/8),sc=s.getContext('2d');let id=sc.createImageData(s.width,s.height);
  for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255|0;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}
  sc.putImageData(id,0,0);const b=_mk(size,size),bc=b.getContext('2d');bc.imageSmoothingEnabled=true;bc.drawImage(s,0,0,size,size);
  const s2=_mk(size/3,size/3),s2c=s2.getContext('2d');id=s2c.createImageData(s2.width,s2.height);
  for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255|0;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}
  s2c.putImageData(id,0,0);bc.globalAlpha=0.5;bc.drawImage(s2,0,0,size,size);bc.globalAlpha=1;return b;
}

/* ---------- leaf ---------- */
function drawLeaf(ctx,x,y,s,ang,col){
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  ctx.fillStyle=col;
  ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*0.62,-s*0.15,0,s);ctx.quadraticCurveTo(-s*0.62,-s*0.15,0,-s);ctx.fill();
  ctx.fillStyle=lighten(col,0.35);ctx.globalAlpha=0.55;
  ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*0.5,-s*0.15,0,s*0.45);ctx.quadraticCurveTo(s*0.12,-s*0.15,0,-s);ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.lineWidth=Math.max(0.4,s*0.07);
  ctx.beginPath();ctx.moveTo(0,-s*0.85);ctx.lineTo(0,s*0.85);ctx.stroke();
  ctx.restore();
}

/* ---------- generate a tree (geometry baked later) ---------- */
function genTree(rng,x,baseY,scale,depth){
  const h=lerp(165,300,rng())*scale, trunkW=lerp(11,19,rng())*scale;
  const topX=x, topY=baseY-h;
  const bark=['#3c2817','#46301c','#523a22','#5c4128'][Math.floor(rng()*4)];
  const segs=[{x0:x,y0:baseY,cx:x+lerp(-6,6,rng()),cy:(baseY+topY)/2,x1:topX,y1:topY,w:trunkW}];
  const tips=[];
  function branch(x0,y0,ang,len,w,d){
    const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;
    const cx=x0+Math.cos(ang)*len*0.5+Math.cos(ang+1.57)*len*lerp(-0.12,0.12,rng());
    const cy=y0+Math.sin(ang)*len*0.5+Math.sin(ang+1.57)*len*lerp(-0.12,0.12,rng());
    segs.push({x0,y0,cx,cy,x1,y1,w});
    if(d<=0){tips.push({x:x1,y:y1});return;}
    const n=2+(rng()<0.4?1:0);
    for(let i=0;i<n;i++)branch(x1,y1,ang+lerp(-0.65,0.65,rng()),len*lerp(0.55,0.78,rng()),w*0.6,d-1);
    if(rng()<0.5)tips.push({x:x1,y:y1});
  }
  const mainN=Math.floor(lerp(3,5,rng()));
  for(let i=0;i<mainN;i++)branch(topX,topY+lerp(0,h*0.1,rng()),-Math.PI/2+lerp(-1.0,1.0,rng()),h*lerp(0.34,0.52,rng()),trunkW*0.66,2);
  const mood=MOODS[Math.floor(rng()*MOODS.length)];
  const canR=lerp(0.9,1.2,rng())*h*0.32, cYc=topY+h*0.08;
  const count=Math.floor(lerp(300,460,rng())*scale*scale);
  const leaves=[];
  for(let i=0;i<count;i++){
    let bx,by;const u=rng();
    if(tips.length&&u<0.55){const tp=tips[Math.floor(rng()*tips.length)];bx=tp.x+lerp(-canR*0.42,canR*0.42,rng());by=tp.y+lerp(-canR*0.42,canR*0.38,rng());}
    else if(u<0.78&&segs.length>1){const sg=segs[1+Math.floor(rng()*(segs.length-1))];const tt=rng();bx=lerp(sg.x0,sg.x1,tt)+lerp(-canR*0.3,canR*0.3,rng());by=lerp(sg.y0,sg.y1,tt)+lerp(-canR*0.3,canR*0.3,rng());}
    else{const a=rng()*6.283,rr=Math.sqrt(rng())*canR;bx=topX+Math.cos(a)*rr;by=cYc+Math.sin(a)*rr*0.95;}
    const set=LEAFSETS[mood[Math.floor(rng()*mood.length)]];
    leaves.push({x:bx,y:by,s:lerp(4.5,9,rng())*scale,ang:rng()*6.283,col:set[Math.floor(rng()*set.length)],ph:rng()*6.283});
  }
  leaves.sort((a,b)=>a.y-b.y);
  const baseDark=darken(LEAFSETS[mood[Math.min(2,mood.length-1)]][1],0.42);
  return {kind:'tree',x,baseY,h,topX,topY,segs,tips,leaves,canR,cYc,bark,baseDark,
          swayAmp:lerp(6,12,rng())*depth,depth,sprite:null};
}

/* ---------- generate a bush ---------- */
function genBush(rng,x,y,scale,greenBias){
  const r=lerp(30,56,rng())*scale;
  const bark='#4a3a26';
  const segs=[]; const baseY=y;
  const tn=Math.floor(lerp(2,4,rng()));
  for(let i=0;i<tn;i++){const ang=-Math.PI/2+lerp(-0.7,0.7,rng());const len=r*lerp(0.7,1.0,rng());
    segs.push({x0:x+lerp(-r*0.2,r*0.2,rng()),y0:baseY,cx:x,cy:baseY-len*0.5,x1:x+Math.cos(ang)*len,y1:baseY+Math.sin(ang)*len,w:lerp(2.5,4.5,rng())*scale});}
  const moodPool=greenBias?['green','green','green','yellow','brown']:MOODS[Math.floor(rng()*MOODS.length)];
  const cYc=baseY-r*0.55, count=Math.floor(lerp(130,210,rng())*scale*scale);
  const leaves=[];
  for(let i=0;i<count;i++){
    const a=rng()*6.283, rr=Math.sqrt(rng())*r;
    const bx=x+Math.cos(a)*rr, by=cYc+Math.sin(a)*rr*0.8;
    const set=LEAFSETS[moodPool[Math.floor(rng()*moodPool.length)]];
    leaves.push({x:bx,y:by,s:lerp(3.4,6.8,rng())*scale,ang:rng()*6.283,col:set[Math.floor(rng()*set.length)],ph:rng()*6.283});
  }
  leaves.sort((a,b)=>a.y-b.y);
  const baseDark=darken('#3a6b2e',0.42);
  return {kind:'bush',x,y,r,cYc,segs,leaves,bark,baseDark,swayAmp:lerp(4,8,rng())*scale,depth:scale,sprite:null};
}

/* ---------- draw foliage geometry (used for baking) ---------- */
function drawFoliage(ctx,o){
  // dark canopy mass behind leaves (so no see-through to sky)
  ctx.save();
  const cy=o.kind==='tree'?o.cYc:o.cYc, R=o.kind==='tree'?o.canR:o.r;
  const cx=o.kind==='tree'?o.topX:o.x;
  const g=ctx.createRadialGradient(cx,cy,2,cx,cy,R*0.92);
  g.addColorStop(0,o.baseDark);g.addColorStop(0.6,o.baseDark);g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=0.55;ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,R*0.92,R*0.85,0,0,6.283);ctx.fill();
  if(o.tips)for(const tp of o.tips){const gg=ctx.createRadialGradient(tp.x,tp.y,1,tp.x,tp.y,R*0.4);gg.addColorStop(0,o.baseDark);gg.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=0.5;ctx.fillStyle=gg;ctx.beginPath();ctx.arc(tp.x,tp.y,R*0.4,0,6.283);ctx.fill();}
  ctx.globalAlpha=1;ctx.restore();
  // branches / trunk
  ctx.lineCap='round';
  for(const s of o.segs){
    ctx.strokeStyle=o.bark;ctx.lineWidth=s.w;
    ctx.beginPath();ctx.moveTo(s.x0,s.y0);ctx.quadraticCurveTo(s.cx,s.cy,s.x1,s.y1);ctx.stroke();
    ctx.strokeStyle=lighten(o.bark,0.3);ctx.lineWidth=Math.max(0.6,s.w*0.32);
    ctx.beginPath();ctx.moveTo(s.x0-s.w*0.18,s.y0);ctx.quadraticCurveTo(s.cx-s.w*0.18,s.cy,s.x1-s.w*0.18,s.y1);ctx.stroke();
  }
  // leaves
  for(const l of o.leaves) drawLeaf(ctx,l.x,l.y,l.s,l.ang,l.col);
  // soft warm top-left light over the leaves
  ctx.save();
  const tl=ctx.createLinearGradient(cx-R,cy-R,cx+R*0.4,cy+R*0.4);
  tl.addColorStop(0,'rgba(255,235,170,0.16)');tl.addColorStop(0.5,'rgba(255,235,170,0)');
  ctx.globalCompositeOperation='screen';ctx.fillStyle=tl;ctx.beginPath();ctx.ellipse(cx,cy,R*1.1,R*1.05,0,0,6.283);ctx.fill();
  ctx.restore();
}
function bake(o){
  let minx,miny,maxx,maxy;
  if(o.kind==='tree'){minx=o.topX-o.canR*1.4;maxx=o.topX+o.canR*1.4;miny=o.cYc-o.canR*1.4;maxy=o.baseY+4;}
  else{minx=o.x-o.r*1.4;maxx=o.x+o.r*1.4;miny=o.cYc-o.r*1.4;maxy=o.y+6;}
  // include branch extents
  for(const s of o.segs){minx=Math.min(minx,s.x0,s.x1,s.cx);maxx=Math.max(maxx,s.x0,s.x1,s.cx);miny=Math.min(miny,s.y0,s.y1,s.cy);maxy=Math.max(maxy,s.y0,s.y1,s.cy);}
  for(const l of o.leaves){minx=Math.min(minx,l.x-l.s*2);maxx=Math.max(maxx,l.x+l.s*2);miny=Math.min(miny,l.y-l.s*2);maxy=Math.max(maxy,l.y+l.s*2);}
  const w=Math.ceil(maxx-minx)+4,h=Math.ceil(maxy-miny)+4;
  const cn=_mk(w,h),c=cn.getContext('2d');c.translate(-minx+2,-miny+2);
  drawFoliage(c,o);
  o.sprite=cn;o.sx=minx-2;o.sy=miny-2;
}
function drawFoliageShadow(ctx,o){
  const fx=o.kind==='tree'?o.x:o.x, fy=o.baseY||o.y, R=o.kind==='tree'?o.canR:o.r;
  ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle='rgba(8,12,6,1)';
  ctx.beginPath();ctx.ellipse(fx,fy+3,R*0.9,R*0.28,0,0,6.283);ctx.fill();ctx.restore();
}

/* ---------- rays + motes ---------- */
function drawRays(ctx,rays,t){ctx.save();ctx.globalCompositeOperation='screen';
  for(const r of rays){const sh=Math.sin(t*0.0006+r.ph)*0.25+0.75;ctx.save();ctx.translate(r.ox,-40);ctx.rotate(r.a);
    const g=ctx.createLinearGradient(0,0,0,r.len);g.addColorStop(0,'rgba(255,238,190,'+(0.16*sh).toFixed(3)+')');g.addColorStop(0.6,'rgba(255,226,150,'+(0.07*sh).toFixed(3)+')');g.addColorStop(1,'rgba(255,226,150,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-r.w/2,0);ctx.lineTo(r.w/2,0);ctx.lineTo(r.w*1.4,r.len);ctx.lineTo(-r.w*1.4,r.len);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();}
function drawMotes(ctx,motes,t){ctx.save();ctx.globalCompositeOperation='screen';
  for(const m of motes){const x=m.x+Math.sin(t*0.0007*m.sp+m.ph)*m.amp;let y=m.y-(t*0.012*m.sp);y=((y%(m.H+60))+m.H+60)%(m.H+60)-30;
    const a=(Math.sin(t*0.003*m.sp+m.ph)*0.4+0.6)*m.bright;ctx.fillStyle='rgba(255,235,170,'+a.toFixed(3)+')';ctx.beginPath();ctx.arc(x,y,m.r,0,6.283);ctx.fill();}
  ctx.restore();}

/* ============================================================
   ANIMALS
   ============================================================ */
function shadow(ctx,w){ctx.save();ctx.globalAlpha=0.28;ctx.fillStyle='#0a0d06';ctx.beginPath();ctx.ellipse(0,2,w,w*0.3,0,0,6.283);ctx.fill();ctx.restore();}
function aRabbit(ctx,t,ph){const fur='#9b8b76',furD=darken(fur,0.25),furL=lighten(fur,0.25);
  shadow(ctx,16);const bob=Math.abs(Math.sin(t*0.004+ph))*2;ctx.translate(0,-bob);
  ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(-2,-9,12,10,0,0,6.283);ctx.fill();           // body
  ctx.fillStyle=furL;ctx.beginPath();ctx.arc(8,-15,7,0,6.283);ctx.fill();                      // head
  const et=Math.sin(t*0.003+ph)*0.18;
  ctx.fillStyle=fur;ctx.save();ctx.translate(8,-20);ctx.rotate(-0.2+et);ctx.beginPath();ctx.ellipse(0,-6,2.4,8,0,0,6.283);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(11,-20);ctx.rotate(0.15-et);ctx.beginPath();ctx.ellipse(0,-6,2.4,8,0,0,6.283);ctx.fill();ctx.restore();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-12,-7,4,0,6.283);ctx.fill();                   // tail
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(11,-15,1.3,0,6.283);ctx.fill();                  // eye
  ctx.fillStyle='#d98a8a';ctx.beginPath();ctx.arc(14.5,-13,1,0,6.283);ctx.fill();}
function aDeer(ctx,t,ph){const fur='#a9794a',furL=lighten(fur,0.2),furD=darken(fur,0.3);
  shadow(ctx,20);ctx.strokeStyle=furD;ctx.lineWidth=3;ctx.lineCap='round';
  const lg=Math.sin(t*0.003+ph)*1.5;
  [[ -8,lg],[ -4,-lg],[8,-lg],[12,lg]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-16);ctx.lineTo(lx+o,0);ctx.stroke();});
  ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(2,-22,15,8,0,0,6.283);ctx.fill();               // body
  ctx.fillStyle=furL;ctx.save();ctx.translate(14,-26);ctx.rotate(-0.5);ctx.beginPath();ctx.ellipse(0,-6,4,9,0,0,6.283);ctx.fill();ctx.restore(); // neck
  ctx.beginPath();ctx.ellipse(20,-34,5,4,0.3,0,6.283);ctx.fill();                                // head
  ctx.strokeStyle=furD;ctx.lineWidth=1.6;                                                        // antlers
  ctx.beginPath();ctx.moveTo(20,-38);ctx.lineTo(19,-46);ctx.moveTo(19,-44);ctx.lineTo(16,-48);ctx.moveTo(19,-44);ctx.lineTo(22,-48);
  ctx.moveTo(22,-38);ctx.lineTo(24,-46);ctx.moveTo(23,-44);ctx.lineTo(26,-47);ctx.stroke();
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(22,-34,1.2,0,6.283);ctx.fill();}
function aFawn(ctx,t,ph){const fur='#b98a52',furL=lighten(fur,0.22);
  shadow(ctx,15);const lg=Math.sin(t*0.0035+ph)*1.2;
  ctx.strokeStyle=darken(fur,0.3);ctx.lineWidth=2.4;ctx.lineCap='round';
  [[-6,lg],[-2,-lg],[6,-lg],[9,lg]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-12);ctx.lineTo(lx+o,0);ctx.stroke();});
  ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(1,-16,11,6,0,0,6.283);ctx.fill();
  ctx.fillStyle=furL;ctx.save();ctx.translate(10,-19);ctx.rotate(-0.6);ctx.beginPath();ctx.ellipse(0,-4,3,6,0,0,6.283);ctx.fill();ctx.restore();
  ctx.beginPath();ctx.ellipse(14,-25,4,3.2,0.3,0,6.283);ctx.fill();
  ctx.fillStyle=fur;ctx.save();ctx.translate(15,-27);ctx.rotate(-0.4);ctx.beginPath();ctx.ellipse(0,-3,1.6,3,0,0,6.283);ctx.fill();ctx.restore(); // ear
  ctx.fillStyle='#fff8ec';[[ -2,-17],[3,-15],[-5,-15],[1,-19]].forEach(([sx,sy])=>{ctx.beginPath();ctx.arc(sx,sy,1.1,0,6.283);ctx.fill();}); // spots
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(15.5,-25,1,0,6.283);ctx.fill();}
function aBoar(ctx,t,ph){const fur='#4a3b2e',furL=lighten(fur,0.18);
  shadow(ctx,20);const lg=Math.sin(t*0.0028+ph)*1.2;
  ctx.strokeStyle=darken(fur,0.3);ctx.lineWidth=3.2;ctx.lineCap='round';
  [[-9,lg],[-5,-lg],[7,-lg],[11,lg]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-12);ctx.lineTo(lx+o,0);ctx.stroke();});
  ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(-1,-16,16,9,0,0,6.283);ctx.fill();                // bulky body
  // bristle back
  ctx.strokeStyle=darken(fur,0.4);ctx.lineWidth=1.4;for(let i=-12;i<8;i+=3){ctx.beginPath();ctx.moveTo(i,-24);ctx.lineTo(i+1,-29);ctx.stroke();}
  ctx.fillStyle=furL;ctx.beginPath();ctx.ellipse(16,-15,8,7,0,0,6.283);ctx.fill();                // head
  ctx.fillStyle=darken(fur,0.2);ctx.beginPath();ctx.ellipse(23,-13,4,3,0,0,6.283);ctx.fill();     // snout
  ctx.fillStyle='#e8e0d0';ctx.beginPath();ctx.moveTo(21,-11);ctx.lineTo(24,-9);ctx.lineTo(21,-9);ctx.fill(); // tusk
  ctx.fillStyle=fur;ctx.beginPath();ctx.moveTo(13,-22);ctx.lineTo(16,-26);ctx.lineTo(18,-21);ctx.fill();     // ear
  ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(18,-16,1.3,0,6.283);ctx.fill();}
function aPiglet(ctx,t,ph){const sk='#d29a8a',skD=darken(sk,0.18),skL=lighten(sk,0.2);
  shadow(ctx,13);const lg=Math.sin(t*0.005+ph)*1;
  ctx.strokeStyle=skD;ctx.lineWidth=2.4;ctx.lineCap='round';
  [[-6,lg],[-2,-lg],[5,-lg],[8,lg]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-9);ctx.lineTo(lx+o,0);ctx.stroke();});
  ctx.fillStyle=sk;ctx.beginPath();ctx.ellipse(0,-12,11,7,0,0,6.283);ctx.fill();
  ctx.strokeStyle=skD;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(-11,-13,3,-1.2,2.2);ctx.stroke();   // curly tail
  ctx.fillStyle=skL;ctx.beginPath();ctx.arc(11,-13,5.5,0,6.283);ctx.fill();                          // head
  ctx.fillStyle=skD;ctx.beginPath();ctx.ellipse(16,-12,2.6,2.2,0,0,6.283);ctx.fill();                // snout
  ctx.fillStyle='#7a4a44';ctx.beginPath();ctx.arc(15.3,-12,0.6,0,6.283);ctx.fill();ctx.beginPath();ctx.arc(16.7,-12,0.6,0,6.283);ctx.fill();
  ctx.fillStyle=sk;ctx.beginPath();ctx.moveTo(9,-17);ctx.lineTo(11,-21);ctx.lineTo(13,-17);ctx.fill(); // ear
  ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(12.5,-14,1,0,6.283);ctx.fill();}
function aLizard(ctx,t,ph){const sk='#5a7a3a',skL=lighten(sk,0.25),skD=darken(sk,0.3);
  shadow(ctx,14);const wig=Math.sin(t*0.006+ph);
  ctx.strokeStyle=skD;ctx.lineWidth=2;ctx.lineCap='round';
  [[-6,-1.5+wig],[-2,1.5-wig],[4,-1.5-wig],[8,1.5+wig]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-3);ctx.lineTo(lx+o*1.4,0.5);ctx.stroke();});
  ctx.fillStyle=sk;ctx.beginPath();ctx.ellipse(0,-3,11,4,0,0,6.283);ctx.fill();                       // body
  ctx.strokeStyle=sk;ctx.lineWidth=3.4;ctx.beginPath();ctx.moveTo(-10,-3);                              // tail
  ctx.quadraticCurveTo(-18,-3-wig*2,-24,-2+wig*3);ctx.stroke();
  ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-24,-2+wig*3);ctx.quadraticCurveTo(-28,-2,-31,-1+wig*2);ctx.stroke();
  ctx.fillStyle=skL;ctx.beginPath();ctx.ellipse(11,-4,5,3.2,0,0,6.283);ctx.fill();                     // head
  ctx.fillStyle=skD;for(let i=-8;i<10;i+=3){ctx.beginPath();ctx.arc(i,-5.5,0.8,0,6.283);ctx.fill();}    // back ridge
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(13,-5,1,0,6.283);ctx.fill();}
function aGiraffe(ctx,t,ph){const fur='#d8a84a',furL=lighten(fur,0.18),furD=darken(fur,0.32),sp='#9a6326';
  shadow(ctx,18);const lg=Math.sin(t*0.0024+ph)*1.5, nk=Math.sin(t*0.0016+ph)*0.06;
  ctx.strokeStyle=furD;ctx.lineWidth=3;ctx.lineCap='round';
  [[-7,lg],[-3,-lg],[6,-lg],[10,lg]].forEach(([lx,o])=>{ctx.beginPath();ctx.moveTo(lx,-24);ctx.lineTo(lx+o,0);ctx.stroke();});
  ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(0,-28,13,7.5,0,0,6.283);ctx.fill();
  ctx.save();ctx.translate(9,-32);ctx.rotate(-0.62+nk);
  ctx.fillStyle=furL;ctx.beginPath();ctx.ellipse(0,-17,4.5,19,0,0,6.283);ctx.fill();
  ctx.translate(0,-34);ctx.rotate(0.5);ctx.beginPath();ctx.ellipse(3,-1,6,4,0,0,6.283);ctx.fill();
  ctx.strokeStyle=furD;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(1,-4);ctx.lineTo(0,-8);ctx.moveTo(4,-4);ctx.lineTo(5,-8);ctx.stroke();
  ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(5,-2,1,0,6.283);ctx.fill();ctx.restore();
  ctx.fillStyle=sp;[[-7,-29],[-2,-31],[3,-28],[-4,-26],[6,-30]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(sx,sy,2.3,2,0,0,6.283);ctx.fill();});
}
function aTrex(ctx,t,ph){const sk='#5f6e3c',skL=lighten(sk,0.2),skD=darken(sk,0.32);
  shadow(ctx,22);const st=Math.sin(t*0.004+ph), jaw=Math.max(0,Math.sin(t*0.0015+ph))*2;
  ctx.strokeStyle=sk;ctx.lineWidth=7;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-6,-16);ctx.quadraticCurveTo(-22,-13-st*3,-34,-3+st*4);ctx.stroke();
  ctx.strokeStyle=skD;ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(2,-16);ctx.lineTo(2+st*2,0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(7,-16);ctx.lineTo(7-st*2,0);ctx.stroke();
  ctx.fillStyle=sk;ctx.beginPath();ctx.ellipse(2,-22,15,11,0,0,6.283);ctx.fill();
  ctx.strokeStyle=skD;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(8,-22);ctx.lineTo(12,-17);ctx.stroke();
  ctx.save();ctx.translate(13,-30);ctx.rotate(-0.2);
  ctx.fillStyle=skL;ctx.beginPath();ctx.ellipse(0,-3,5,7,0,0,6.283);ctx.fill();
  ctx.translate(2,-9);ctx.beginPath();ctx.ellipse(5,0,10,6,0,0,6.283);ctx.fill();
  ctx.fillStyle=skD;ctx.beginPath();ctx.moveTo(7,3+jaw);ctx.lineTo(16,4+jaw);ctx.lineTo(7,6+jaw);ctx.fill();
  ctx.fillStyle='#fff';for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(8+i*2,3);ctx.lineTo(9+i*2,5);ctx.lineTo(10+i*2,3);ctx.fill();}
  ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(6,-3,1.3,0,6.283);ctx.fill();ctx.restore();
}
const ANIMALS={rabbit:aRabbit,deer:aDeer,fawn:aFawn,boar:aBoar,piglet:aPiglet,lizard:aLizard,giraffe:aGiraffe,trex:aTrex};

function makeAnimalMgr(types,count,scale,placeFn,rng,Htime){
  const list=[];
  for(let i=0;i<count;i++) list.push(spawn(types,scale,placeFn,rng,-i*2600,Htime));
  return list;
}
function spawn(types,scale,placeFn,rng,bornBias,Htime){
  const type=types[Math.floor(rng()*types.length)];
  const p=placeFn(rng); const dir=rng()<0.5?1:-1;
  return {type,x:p.x,y:p.y,s:scale*lerp(0.9,1.25,rng()),dir,born:bornBias,ttl:lerp(5200,8200,rng()),ph:rng()*6.283,vx:dir*lerp(0.05,0.16,rng())};
}
function drawAnimals(ctx,mgr,t,types,scale,placeFn,rng){
  for(let i=0;i<mgr.length;i++){
    let a=mgr[i]; let age=t-a.born;
    if(age>a.ttl+1200){ mgr[i]=spawn(types,scale,placeFn,rng,t+lerp(200,1800,rng()),0); continue; }
    if(age<0) continue;
    const fin=Math.min(1,age/600), fout=Math.min(1,Math.max(0,(a.ttl+1000-age)/1000));
    const alpha=Math.max(0,Math.min(1,fin*fout)); if(alpha<=0) continue;
    a.x+=a.vx; // gentle wander
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(a.x,a.y);ctx.scale(a.dir*a.s,a.s);
    ANIMALS[a.type](ctx,t,a.ph);ctx.restore();
  }
}

/* ============================================================
   shared ground bg builder
   ============================================================ */
function paintGround(bx,W,H,x0,topFn,botFn,rng,noise){ /* generic not used; per-scene below */ }

function windFn(t){return Math.sin(t*0.00045)*0.6+Math.sin(t*0.0011+1.3)*0.3+Math.sin(t*0.0026+0.4)*0.12;}

/* ============================================================
   SCENE 1 — 1280x960 : forest over dry ground, bushes around
   ============================================================ */
function buildScene1(W,H,seed){
  const rng=mulberry32(seed),HOR=H*0.52,noise=buildNoise(256);
  const far=[];let fx=-40;while(fx<W+60){const w=lerp(60,130,rng());far.push({x:fx,w,h:lerp(70,150,rng())});fx+=w*0.6;}
  const trees=[];
  function mk(x,sc,dp){trees.push(genTree(rng,x,HOR+lerp(-4,16,rng()),sc,dp));}
  for(let i=0;i<7;i++)mk(lerp(-20,W+20,rng()),lerp(0.72,0.95,rng()),lerp(0.5,0.75,rng()));
  mk(lerp(10,90,rng()),1.18,1);mk(lerp(W-90,W-10,rng()),1.18,1);
  for(let i=0;i<3;i++)mk(lerp(120,W-120,rng()),1.0,0.95);
  trees.sort((a,b)=>a.depth-b.depth);
  const bushes=[];
  function mb(x,y,sc){bushes.push(genBush(rng,x,y,sc,rng()<0.55));}
  for(let i=0;i<5;i++)mb(lerp(30,W-30,rng()),HOR+lerp(12,26,rng()),lerp(0.7,1.0,rng()));
  for(let i=0;i<5;i++)mb(lerp(14,82,rng()),lerp(HOR+70,H-26,rng()),lerp(0.85,1.25,rng()));
  for(let i=0;i<5;i++)mb(lerp(W-82,W-14,rng()),lerp(HOR+70,H-26,rng()),lerp(0.85,1.25,rng()));
  for(let i=0;i<7;i++)mb(lerp(40,W-40,rng()),lerp(H-50,H-12,rng()),lerp(0.9,1.3,rng()));
  bushes.sort((a,b)=>a.y-b.y);
  trees.forEach(bake);bushes.forEach(bake);
  // cracks
  const cracks=[];
  function crack(x0,y0,ang,len,d){let x=x0,y=y0,a=ang;const pts=[[x,y]];const st=Math.floor(len/15);
    for(let i=0;i<st;i++){a+=lerp(-0.24,0.24,rng());x+=Math.cos(a)*15;y+=Math.sin(a)*15;if(y<HOR+6||y>H-2||x<2||x>W-2)break;pts.push([x,y]);if(d>0&&rng()<0.08)crack(x,y,a+(rng()<0.5?1:-1)*lerp(0.7,1.2,rng()),len*0.5,d-1);}cracks.push({pts,w:1+d*1.3});}
  for(let k=0;k<6;k++){const x0=lerp(W*0.08,W*0.92,(k+lerp(0,0.6,rng()))/6);crack(x0,lerp(HOR+20,HOR+70,rng()),Math.PI/2+lerp(-0.3,0.3,rng()),lerp(260,560,rng()),2);}
  for(let k=0;k<5;k++)crack(lerp(0,W,rng()),lerp(HOR+60,H-60,rng()),(rng()<0.5?0:Math.PI)+lerp(-0.3,0.3,rng()),lerp(150,330,rng()),1);
  const pebbles=[];for(let i=0;i<70;i++)pebbles.push({x:lerp(0,W,rng()),y:lerp(HOR+20,H-6,rng()),r:lerp(2,6,rng()),c:rng()<0.5?'#6e4c2a':'#caa472'});
  const tufts=[];for(let i=0;i<40;i++)tufts.push({x:lerp(0,W,rng()),y:lerp(HOR+30,H-4,rng()),h:lerp(6,16,rng()),ph:rng()*6.283});
  const rays=[];for(let i=0;i<6;i++)rays.push({ox:lerp(W*0.2,W*0.9,rng()),a:lerp(0.12,0.32,rng()),w:lerp(60,140,rng()),len:HOR+120,ph:rng()*6.283});
  const motes=[];for(let i=0;i<24;i++)motes.push({x:lerp(0,W,rng()),y:lerp(0,H,rng()),r:lerp(1,2.6,rng()),amp:lerp(8,26,rng()),sp:lerp(0.6,1.5,rng()),ph:rng()*6.283,bright:lerp(0.3,0.8,rng()),H});
  const dleaves=[];for(let i=0;i<22;i++)dleaves.push({x:lerp(0,W,rng()),y:lerp(0,H,rng()),s:lerp(4,8,rng()),rot:rng()*6.283,vr:lerp(-0.04,0.04,rng()),vy:lerp(0.2,0.6,rng()),sw:lerp(0.6,1.5,rng()),ph:rng()*6.283,col:['#6a8f3a','#c2a032','#a85a26','#88a046'][Math.floor(rng()*4)]});
  // background
  const bg=_mk(W,H),bx=bg.getContext('2d');
  const atmo=bx.createLinearGradient(0,0,0,HOR+40);atmo.addColorStop(0,'#20392f');atmo.addColorStop(0.5,'#5a6f4a');atmo.addColorStop(0.82,'#9fa766');atmo.addColorStop(1,'#d8c486');
  bx.fillStyle=atmo;bx.fillRect(0,0,W,HOR+40);
  for(const f of far){bx.fillStyle='#6c7a52';bx.beginPath();bx.moveTo(f.x,HOR+10);bx.quadraticCurveTo(f.x+f.w*0.5,HOR-f.h,f.x+f.w,HOR+10);bx.closePath();bx.fill();}
  const haze=bx.createLinearGradient(0,HOR-120,0,HOR+30);haze.addColorStop(0,'rgba(216,206,160,0)');haze.addColorStop(1,'rgba(222,212,168,0.7)');bx.fillStyle=haze;bx.fillRect(0,HOR-120,W,150);
  const gr=bx.createLinearGradient(0,HOR,0,H);gr.addColorStop(0,'#c89a60');gr.addColorStop(0.4,'#ad7c47');gr.addColorStop(1,'#7c5530');bx.fillStyle=gr;bx.fillRect(0,HOR,W,H-HOR);
  const ao=bx.createLinearGradient(0,HOR,0,HOR+90);ao.addColorStop(0,'rgba(30,20,8,0.55)');ao.addColorStop(1,'rgba(30,20,8,0)');bx.fillStyle=ao;bx.fillRect(0,HOR,W,90);
  for(let i=0;i<130;i++){const px=lerp(0,W,rng()),py=lerp(HOR,H,rng()),r=lerp(20,90,rng());bx.fillStyle='rgba('+(rng()<0.5?'80,52,26':'212,182,124')+','+lerp(0.03,0.09,rng()).toFixed(3)+')';bx.beginPath();bx.ellipse(px,py,r,r*0.45,0,0,6.283);bx.fill();}
  bx.globalCompositeOperation='soft-light';bx.globalAlpha=0.4;for(let i=0;i<46;i++){const s=lerp(220,440,rng());bx.drawImage(noise,lerp(-120,W-100,rng()),lerp(HOR-40,H-90,rng()),s,s);}bx.globalCompositeOperation='source-over';bx.globalAlpha=1;
  for(let i=0;i<1600;i++){const px=lerp(0,W,rng()),py=lerp(HOR,H,rng());bx.fillStyle='rgba('+(rng()<0.5?'66,42,20':'228,202,150')+','+lerp(0.05,0.16,rng()).toFixed(3)+')';bx.fillRect(px,py,lerp(1,2.5,rng()),lerp(1,2.5,rng()));}
  bx.lineCap='round';bx.lineJoin='round';
  for(const c of cracks){bx.strokeStyle='rgba(58,36,16,0.85)';bx.lineWidth=c.w+1.6;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0],p[1]):bx.moveTo(p[0],p[1]));bx.stroke();bx.strokeStyle='rgba(36,22,9,0.95)';bx.lineWidth=c.w*0.5;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0]+0.7,p[1]+0.7):bx.moveTo(p[0]+0.7,p[1]+0.7));bx.stroke();bx.strokeStyle='rgba(220,190,140,0.25)';bx.lineWidth=1;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0]-0.8,p[1]-0.8):bx.moveTo(p[0]-0.8,p[1]-0.8));bx.stroke();}
  for(const p of pebbles){bx.fillStyle=p.c;bx.beginPath();bx.ellipse(p.x,p.y,p.r,p.r*0.7,0,0,6.283);bx.fill();bx.fillStyle='rgba(0,0,0,0.25)';bx.beginPath();bx.ellipse(p.x+p.r*0.5,p.y+p.r*0.5,p.r*0.6,p.r*0.4,0,0,6.283);bx.fill();}
  const place=r=>({x:lerp(60,W-60,r()),y:lerp(HOR+60,H-40,r())});
  const animals=makeAnimalMgr(['rabbit','deer','lizard'],2,1.0,place,rng,H);
  return {W,H,HOR,noise,bg,trees,bushes,tufts,rays,motes,dleaves,animals,place,rng,
          aTypes:['rabbit','deer','lizard'],aScale:1.0};
}
function renderScene1(ctx,S,t){
  const {W,H,bg}=S,w=windFn(t);
  ctx.drawImage(bg,0,0);
  drawRays(ctx,S.rays,t);
  ctx.strokeStyle='rgba(40,52,24,0.7)';ctx.lineWidth=2;ctx.lineCap='round';
  for(const tf of S.tufts){const sw=w*5+Math.sin(t*0.003+tf.ph)*2;ctx.beginPath();ctx.moveTo(tf.x,tf.y);ctx.quadraticCurveTo(tf.x+sw*0.5,tf.y-tf.h*0.6,tf.x+sw,tf.y-tf.h);ctx.stroke();}
  for(const tr of S.trees){ctx.save();ctx.globalAlpha=lerp(0.6,1,tr.depth);ctx.translate(tr.x,tr.baseY);ctx.rotate(w*0.020*(0.4+tr.depth));ctx.drawImage(tr.sprite,tr.sx-tr.x,tr.sy-tr.baseY);ctx.restore();}
  for(const bu of S.bushes){drawFoliageShadow(ctx,bu);ctx.save();ctx.translate(bu.x,bu.y);ctx.rotate(w*0.026);ctx.drawImage(bu.sprite,bu.sx-bu.x,bu.sy-bu.y);ctx.restore();}
  drawAnimals(ctx,S.animals,t,S.aTypes,S.aScale,S.place,S.rng);
  for(const l of S.dleaves){l.x+=w*1.8*l.sw+Math.sin(t*0.002+l.ph)*0.4;l.y+=l.vy;l.rot+=l.vr;if(l.y>H+12){l.y=-12;l.x=lerp(0,W,Math.random());}if(l.x>W+12)l.x=-12;if(l.x<-12)l.x=W+12;ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rot+Math.sin(t*0.003+l.ph)*0.5);ctx.fillStyle=l.col;ctx.globalAlpha=0.85;ctx.beginPath();ctx.ellipse(0,0,l.s,l.s*0.42,0,0,6.283);ctx.fill();ctx.restore();}
  drawMotes(ctx,S.motes,t);
  ctx.save();ctx.globalCompositeOperation='multiply';const v=ctx.createRadialGradient(W/2,H*0.46,H*0.28,W/2,H*0.5,H*0.85);v.addColorStop(0,'rgba(255,250,235,1)');v.addColorStop(1,'rgba(120,96,60,1)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=0.1;const wm=ctx.createLinearGradient(0,0,0,H);wm.addColorStop(0,'#ffd98a');wm.addColorStop(1,'#1a2a18');ctx.fillStyle=wm;ctx.fillRect(0,0,W,H);ctx.restore();
}

/* ============================================================
   SCENE 2 — 1920x2560 : wide cracked path, foliage on SIDES only
   ============================================================ */
function buildScene2(W,H,seed){
  const rng=mulberry32(seed),noise=buildNoise(256);
  const PL=W*0.32,PR=W*0.68;
  const lE=y=>PL+Math.sin(y*0.004)*24+Math.sin(y*0.013+1)*12;
  const rE=y=>PR+Math.sin(y*0.0035+2)*24+Math.sin(y*0.012+3)*12;
  // SIDE foliage only (nothing between lE..rE)
  const trees=[],bushes=[];
  // trees toward outer edges, canopies may overhang inward
  for(let y=120;y<H;y+=lerp(360,520,rng())){
    trees.push(genTree(rng,lerp(20,PL*0.5,rng()),y,lerp(0.8,1.15,rng()),0.95));
    trees.push(genTree(rng,lerp(PR+(W-PR)*0.5,W-20,rng()),y+lerp(-120,120,rng()),lerp(0.8,1.15,rng()),0.95));
  }
  // bushes ONLY along the outer rim (far from the path) so the zone where heroes
  // stand, next to the path, stays clean
  for(let y=20;y<H;y+=lerp(80,135,rng())){
    bushes.push(genBush(rng,lerp(4,W*0.12,rng()), y+lerp(-30,30,rng()), lerp(0.85,1.3,rng()),rng()<0.5));    // left rim
    bushes.push(genBush(rng,lerp(W*0.88,W-4,rng()), y+lerp(-30,30,rng()), lerp(0.85,1.3,rng()),rng()<0.5));  // right rim
  }
  trees.sort((a,b)=>a.baseY-b.baseY);bushes.sort((a,b)=>a.y-b.y);
  trees.forEach(bake);bushes.forEach(bake);
  // cracks (dry-earth, distributed)
  const cracks=[];
  function crack(x0,y0,ang,len,d){let x=x0,y=y0,a=ang;const pts=[[x,y]];const st=Math.floor(len/16);
    for(let i=0;i<st;i++){a+=lerp(-0.22,0.22,rng());x+=Math.cos(a)*16;y+=Math.sin(a)*16;if(y<2||y>H-2)break;if(x<lE(y)+14||x>rE(y)-14)break;pts.push([x,y]);if(d>0&&rng()<0.09)crack(x,y,a+(rng()<0.5?1:-1)*lerp(0.7,1.2,rng()),len*0.5,d-1);}cracks.push({pts,w:1.2+d*1.6});}
  for(let k=0;k<7;k++){const y0=lerp(30,H-30,(k+lerp(0,0.7,rng()))/7);crack(lerp(PL+70,PR-70,rng()),y0,Math.PI/2*(rng()<0.5?1:-1)+lerp(-0.28,0.28,rng()),lerp(320,720,rng()),2);}
  for(let k=0;k<9;k++)crack(lerp(PL+40,PR-40,rng()),lerp(20,H-20,rng()),(rng()<0.5?0:Math.PI)+lerp(-0.3,0.3,rng()),lerp(120,320,rng()),1);
  const pebbles=[];for(let i=0;i<160;i++){const py=lerp(0,H,rng());pebbles.push({x:lerp(lE(py)+10,rE(py)-10,rng()),y:py,r:lerp(2,7,rng()),c:rng()<0.5?'#6e4c2a':'#caa472'});}
  const tufts=[];for(let i=0;i<60;i++){const y=lerp(0,H,rng());const onL=rng()<0.5;tufts.push({x:onL?lE(y)+lerp(-30,2,rng()):rE(y)+lerp(-2,30,rng()),y,h:lerp(8,20,rng()),ph:rng()*6.283});}
  const rays=[];for(let i=0;i<5;i++)rays.push({ox:lerp(W*0.2,W*0.8,rng()),a:lerp(0.05,0.2,rng()),w:lerp(120,260,rng()),len:H,ph:rng()*6.283});
  const motes=[];for(let i=0;i<40;i++)motes.push({x:lerp(0,W,rng()),y:lerp(0,H,rng()),r:lerp(1.2,3,rng()),amp:lerp(10,30,rng()),sp:lerp(0.6,1.4,rng()),ph:rng()*6.283,bright:lerp(0.3,0.8,rng()),H});
  // background
  const bg=_mk(W,H),bx=bg.getContext('2d');
  const sg=bx.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#33422a');sg.addColorStop(1,'#1f2c1a');bx.fillStyle=sg;bx.fillRect(0,0,W,H);
  bx.beginPath();for(let y=0;y<=H;y+=8)bx.lineTo(lE(y),y);for(let y=H;y>=0;y-=8)bx.lineTo(rE(y),y);bx.closePath();bx.save();bx.clip();
  const pv=bx.createLinearGradient(0,0,0,H);pv.addColorStop(0,'#c89a62');pv.addColorStop(0.5,'#b3814c');pv.addColorStop(1,'#9a6a3c');bx.fillStyle=pv;bx.fillRect(0,0,W,H);
  for(let i=0;i<280;i++){const px=lerp(PL-30,PR+30,rng()),py=lerp(0,H,rng()),r=lerp(30,120,rng());bx.fillStyle='rgba('+(rng()<0.5?'88,58,28':'216,186,128')+','+lerp(0.03,0.08,rng()).toFixed(3)+')';bx.beginPath();bx.ellipse(px,py,r,r*0.5,0,0,6.283);bx.fill();}
  bx.globalCompositeOperation='soft-light';bx.globalAlpha=0.38;for(let i=0;i<90;i++){const s=lerp(240,460,rng());bx.drawImage(noise,lerp(PL-160,PR,rng()),lerp(-100,H-100,rng()),s,s);}bx.globalCompositeOperation='source-over';bx.globalAlpha=1;
  for(let i=0;i<5000;i++){const py=lerp(0,H,rng()),px=lerp(lE(py),rE(py),rng());bx.fillStyle='rgba('+(rng()<0.5?'66,42,20':'230,204,154')+','+lerp(0.05,0.16,rng()).toFixed(3)+')';bx.fillRect(px,py,lerp(1,3,rng()),lerp(1,3,rng()));}
  bx.lineCap='round';bx.lineJoin='round';
  for(const c of cracks){bx.strokeStyle='rgba(56,34,15,0.85)';bx.lineWidth=c.w+1.8;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0],p[1]):bx.moveTo(p[0],p[1]));bx.stroke();bx.strokeStyle='rgba(34,20,8,0.95)';bx.lineWidth=c.w*0.5;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0]+0.8,p[1]+0.8):bx.moveTo(p[0]+0.8,p[1]+0.8));bx.stroke();bx.strokeStyle='rgba(222,192,142,0.22)';bx.lineWidth=1;bx.beginPath();c.pts.forEach((p,i)=>i?bx.lineTo(p[0]-0.9,p[1]-0.9):bx.moveTo(p[0]-0.9,p[1]-0.9));bx.stroke();}
  for(const p of pebbles){bx.fillStyle=p.c;bx.beginPath();bx.ellipse(p.x,p.y,p.r,p.r*0.7,0,0,6.283);bx.fill();bx.fillStyle='rgba(0,0,0,0.25)';bx.beginPath();bx.ellipse(p.x+p.r*0.5,p.y+p.r*0.5,p.r*0.6,p.r*0.4,0,0,6.283);bx.fill();}
  bx.restore();
  for(const ex of [{f:lE,d:1},{f:rE,d:-1}])for(let y=0;y<H;y+=6){const x=ex.f(y);const g=bx.createLinearGradient(x,0,x+ex.d*60,0);g.addColorStop(0,'rgba(20,28,14,0.5)');g.addColorStop(1,'rgba(20,28,14,0)');bx.fillStyle=g;bx.fillRect(Math.min(x,x+ex.d*60),y,60,7);}
  // животните се появяват В СТРАНИЧНИТЕ ГОРИ (не на пътя, където са героите)
  const place=r=>{const y=lerp(80,H-80,r());const left=r()<0.5;const x=left?lerp(W*0.05,lE(y)-30,r()):lerp(rE(y)+30,W*0.95,r());return{x,y};};
  const animals=makeAnimalMgr(['rabbit','deer','lizard','boar','giraffe','trex'],3,1.15,place,rng,H);
  return {W,H,PL,PR,lE,rE,noise,bg,trees,bushes,tufts,rays,motes,animals,place,rng,aTypes:['rabbit','deer','lizard','boar','giraffe','trex'],aScale:1.15};
}
function renderScene2(ctx,S,t){
  const {W,H,bg}=S,w=windFn(t);
  ctx.drawImage(bg,0,0);
  drawRays(ctx,S.rays,t);
  ctx.strokeStyle='rgba(40,52,24,0.7)';ctx.lineWidth=2.4;ctx.lineCap='round';
  for(const tf of S.tufts){const sw=w*6+Math.sin(t*0.003+tf.ph)*2.4;ctx.beginPath();ctx.moveTo(tf.x,tf.y);ctx.quadraticCurveTo(tf.x+sw*0.5,tf.y-tf.h*0.6,tf.x+sw,tf.y-tf.h);ctx.stroke();}
  // draw trees and bushes interleaved by y for depth
  const foliage=[...S.trees.map(o=>({o,y:o.baseY,kind:'t'})),...S.bushes.map(o=>({o,y:o.y,kind:'b'}))].sort((a,b)=>a.y-b.y);
  for(const f of foliage){const o=f.o;
    if(f.kind==='t'){ctx.save();ctx.globalAlpha=Math.min(1,0.65+o.depth*0.35);ctx.translate(o.x,o.baseY);ctx.rotate(w*0.020);ctx.drawImage(o.sprite,o.sx-o.x,o.sy-o.baseY);ctx.restore();}
    else{drawFoliageShadow(ctx,o);ctx.save();ctx.globalAlpha=Math.min(1,0.7+o.depth*0.3);ctx.translate(o.x,o.y);ctx.rotate(w*0.028);ctx.drawImage(o.sprite,o.sx-o.x,o.sy-o.y);ctx.restore();}}
  drawAnimals(ctx,S.animals,t,S.aTypes,S.aScale,S.place,S.rng);
  drawMotes(ctx,S.motes,t);
  ctx.save();ctx.globalCompositeOperation='multiply';const v=ctx.createRadialGradient(W/2,H/2,H*0.22,W/2,H/2,H*0.62);v.addColorStop(0,'rgba(255,250,235,1)');v.addColorStop(1,'rgba(110,88,56,1)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);ctx.restore();
}


// ── стартер: пуска СЦЕНА 2 на подадения canvas ──
function startTerrainBg(canvas){
  var ctx = canvas.getContext('2d');
  var S = buildScene2(canvas.width, canvas.height, 7);
  var start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  (function loop(now){ renderScene2(ctx, S, now - start); requestAnimationFrame(loop); })(start);
  return S;
}
if (typeof window !== 'undefined') window.startTerrainBg = startTerrainBg;

})();
