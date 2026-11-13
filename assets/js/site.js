(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s,c){return (c||document).querySelector(s)}
  function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))}

  // nav
  var nav=$('.nav'), burger=$('.burger'), menu=$('.menu');
  function onScroll(){ if(nav && !nav.classList.contains('always')) nav.classList.toggle('solid', window.scrollY>40); }
  onScroll(); window.addEventListener('scroll',onScroll,{passive:true});
  if(burger){ burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);}); 
    $$('a',menu).forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');});}); }

  // reveal (light, one-time)
  var rv=$$('.rv');
  if(reduce||!('IntersectionObserver' in window)){rv.forEach(function(e){e.classList.add('in')});}
  else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{rootMargin:'0px 0px -8% 0px'});rv.forEach(function(e){io.observe(e)});}

  // hero slideshow
  var hero=$('.hero');
  if(hero){
    var slides=$$('.slide',hero), dots=$$('.pager [data-i]',hero), cap=$('.hero-cap',hero), pp=$('.pp',hero), idx=0, timer=null, playing=!reduce;
    function show(i){idx=(i+slides.length)%slides.length;slides.forEach(function(s,k){s.classList.toggle('on',k===idx)});
      dots.forEach(function(d,k){d.setAttribute('aria-current',k===idx?'true':'false')});
      if(cap){cap.innerHTML='<b>'+slides[idx].getAttribute('data-title')+'</b><span>'+slides[idx].getAttribute('data-sub')+'</span>';}}
    function start(){stop();timer=setInterval(function(){show(idx+1)},7000);}
    function stop(){if(timer){clearInterval(timer);timer=null}}
    dots.forEach(function(d){d.addEventListener('click',function(){show(+d.getAttribute('data-i'))})});
    if(pp){pp.textContent=playing?'Pause':'Play';pp.addEventListener('click',function(){playing=!playing;pp.textContent=playing?'Pause':'Play';playing?start():stop();});}
    show(0); if(playing) start();
  }

  // lightbox
  var dlg=document.createElement('dialog'); dlg.className='lb'; dlg.setAttribute('aria-label','Image viewer');
  dlg.innerHTML='<button class="close" type="button">Close</button><figure><img alt=""><figcaption></figcaption></figure>';
  document.body.appendChild(dlg);
  var lbImg=$('img',dlg), lbCap=$('figcaption',dlg);
  function openLb(src,alt,cap){lbImg.src=src;lbImg.alt=alt||'';lbCap.innerHTML=cap||'';if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');}
  $('.close',dlg).addEventListener('click',function(){dlg.close&&dlg.close();});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-full]'); if(!b) return;
    var fig=b.closest('figure'); var cap=fig?$('figcaption',fig):null; var im=$('img',b);
    openLb(b.getAttribute('data-full'),im?im.alt:'',cap?cap.innerHTML:'');
  });

  // gallery filters
  $$('[data-filter-group]').forEach(function(g){
    var btns=$$('button',g), items=$$('.sheet[data-cat]',document.getElementById(g.getAttribute('data-filter-group')));
    btns.forEach(function(b){b.addEventListener('click',function(){
      btns.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
      var c=b.getAttribute('data-c'); items.forEach(function(it){it.hidden=!(c==='all'||it.getAttribute('data-cat').split(' ').indexOf(c)>-1)});
    });});
  });

  // compare slider
  $$('.cmp').forEach(function(c){
    var r=$('input',c), top=$('.top',c), h=$('.handle',c);
    function set(v){top.style.clipPath='inset(0 '+(100-v)+'% 0 0)';h.style.left=v+'%';}
    r.addEventListener('input',function(){set(+r.value)}); set(+r.value);
  });

  // timeline viewer (verified model output tables are embedded in the page as JSON)
  $$('.tv').forEach(function(tv){
    var data=JSON.parse($('script[type="application/json"]',tv).textContent);
    var yearsEl=$('.tv-years',tv), img=$('.tv-img',tv), title=$('.tv-title',tv), status=$('.tv-status',tv), bar=$('.bar',tv), list=$('.legend-list',tv), cap=$('.tv-cap',tv), full=$('.tv-full',tv);
    data.classes.forEach(function(c){var s=document.createElement('span');s.style.background=c.color;s.setAttribute('data-k',c.key);bar.appendChild(s);
      var li=document.createElement('li');li.innerHTML='<i style="background:'+c.color+'"></i><span>'+c.name+'</span><span class="v" data-k="'+c.key+'"></span>';list.appendChild(li);});
    function fmt(n){return n.toLocaleString('en-US',{maximumFractionDigits:1})}
    function sel(i){
      var s=data.states[i]; var total=0; data.classes.forEach(function(c){total+=s.ha[c.key]});
      $$('button',yearsEl).forEach(function(b,k){b.setAttribute('aria-pressed',k===i?'true':'false')});
      img.src=s.src; img.srcset=''; img.alt=data.alt+' '+s.label; title.textContent=s.label; status.textContent=s.status;
      full.setAttribute('data-full',s.full); cap.innerHTML='<b>'+s.label+'.</b> '+s.status+'. '+data.note;
      data.classes.forEach(function(c){var pct=s.ha[c.key]/total*100;
        $('span[data-k="'+c.key+'"]',bar).style.width=pct+'%';
        $('.v[data-k="'+c.key+'"]',list).innerHTML=fmt(s.ha[c.key])+' ha<span class="p">'+pct.toFixed(1)+'%</span>';});
    }
    data.states.forEach(function(s,i){var b=document.createElement('button');b.type='button';b.innerHTML=s.short+'<small>'+s.tag+'</small>';b.addEventListener('click',function(){sel(i)});yearsEl.appendChild(b);});
    sel(0);
  });

  // geobim layers
  $$('.layer-toggles input').forEach(function(cb){
    cb.addEventListener('change',function(){var el=document.getElementById(cb.getAttribute('data-layer'));if(el)el.style.opacity=cb.checked?1:0.06;});
  });

  var yr=$('#yr'); if(yr) yr.textContent=new Date().getFullYear();
})();
