// Isoline — hero contour field. Marching squares over a smooth scalar field,
// drawn as thin isolines on a canvas. One marker: "you are here".
(function(){
  var cv=document.getElementById('field'); if(!cv) return;
  var ctx=cv.getContext('2d'), dpr=Math.min(window.devicePixelRatio||1,2);
  var W,H,cols,rows,cell=14,t=0,raf, reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ink=getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim()||'#8a8781';
  var accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#a5461f';
  var peaks=[
    {x:.72,y:.34,s:.19,a:1.0},
    {x:.30,y:.70,s:.26,a:.65},
    {x:.88,y:.82,s:.16,a:.55},
    {x:.12,y:.22,s:.22,a:.45},
    {x:.52,y:.55,s:.30,a:.35}
  ];
  function field(x,y,tt){
    var v=0;
    for(var i=0;i<peaks.length;i++){
      var p=peaks[i], px=p.x+Math.sin(tt*.13+i)*.012, py=p.y+Math.cos(tt*.11+i*1.7)*.012;
      var dx=x-px, dy=y-py; v+=p.a*Math.exp(-(dx*dx+dy*dy)/(2*p.s*p.s));
    }
    return v;
  }
  function resize(){
    var r=cv.parentElement.getBoundingClientRect();
    W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cell=W<700?12:14; cols=Math.ceil(W/cell)+1; rows=Math.ceil(H/cell)+1;
    draw();
  }
  function lerp(a,b,va,vb,iso){var d=(vb-va); return d===0?a:a+(b-a)*((iso-va)/d);}
  function draw(){
    ctx.clearRect(0,0,W,H);
    var g=new Float32Array(cols*rows);
    for(var j=0;j<rows;j++)for(var i=0;i<cols;i++)g[j*cols+i]=field(i*cell/W,j*cell/H,t);
    var levels=[.18,.3,.42,.54,.66,.78,.9,1.02,1.14];
    for(var L=0;L<levels.length;L++){
      var iso=levels[L];
      ctx.beginPath();
      for(var j=0;j<rows-1;j++)for(var i=0;i<cols-1;i++){
        var x0=i*cell,y0=j*cell,x1=x0+cell,y1=y0+cell;
        var a=g[j*cols+i],b=g[j*cols+i+1],c=g[(j+1)*cols+i+1],d=g[(j+1)*cols+i];
        var idx=(a>iso?8:0)|(b>iso?4:0)|(c>iso?2:0)|(d>iso?1:0);
        if(idx===0||idx===15) continue;
        var top=[lerp(x0,x1,a,b,iso),y0], right=[x1,lerp(y0,y1,b,c,iso)], bottom=[lerp(x0,x1,d,c,iso),y1], left=[x0,lerp(y0,y1,a,d,iso)];
        function seg(p,q){ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);}
        switch(idx){
          case 1:case 14:seg(left,bottom);break;
          case 2:case 13:seg(bottom,right);break;
          case 3:case 12:seg(left,right);break;
          case 4:case 11:seg(top,right);break;
          case 5:seg(top,left);seg(bottom,right);break;
          case 6:case 9:seg(top,bottom);break;
          case 7:case 8:seg(top,left);break;
          case 10:seg(top,right);seg(left,bottom);break;
        }
      }
      var major=(L%3===2);
      ctx.strokeStyle=major?accent:ink;
      ctx.globalAlpha=major?.55:.32;
      ctx.lineWidth=major?1.1:.7;
      ctx.stroke();
    }
    ctx.globalAlpha=1;
    // "you are here"
    var yx=W*.84, yy=H*.42;
    ctx.beginPath();ctx.arc(yx,yy,4.5,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();
    ctx.beginPath();ctx.arc(yx,yy,12,0,Math.PI*2);ctx.strokeStyle=accent;ctx.globalAlpha=.5;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
    ctx.font='11px "IBM Plex Mono", monospace';ctx.fillStyle=accent;ctx.textBaseline='middle';
    ctx.textAlign='right';ctx.fillText('YOU  ·  ELEVATION 58', yx-18, yy);ctx.textAlign='left';
    // summit label
    var sx=W*.72, sy=H*.34;
    ctx.fillStyle=ink;ctx.globalAlpha=.9;ctx.fillText('SUMMIT', sx+10, sy-10);ctx.globalAlpha=1;
  }
  function loop(){t+=.016;draw();raf=requestAnimationFrame(loop);}
  window.addEventListener('resize',resize,{passive:true});
  resize();
  if(!reduce){
    var io=new IntersectionObserver(function(e){ if(e[0].isIntersecting){ if(!raf) loop(); } else { cancelAnimationFrame(raf); raf=null; } });
    io.observe(cv);
  }
})();
// reveal on scroll
(function(){
  var els=document.querySelectorAll('.reveal'); if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return;}
  var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}})},{rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){io.observe(e)});
})();
