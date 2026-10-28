/*
  Shared behavior for every page on the site:
  1. Footer year that stays current automatically
  2. Typing animation for the name on the home page
  3. Typewriter reveal for text as it scrolls into view
  4. Tab underline that slides from the last page's tab to this one
*/

// Runs first so the typewriter types the current year, not the fallback
// written in the HTML (which only shows if JavaScript is off).
document.querySelectorAll('.year').forEach(function(el){
  el.textContent = new Date().getFullYear();
});

(function(){
  var el = document.getElementById('hero-name');
  if(!el) return;
  var fullText = el.textContent;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(reduceMotion){
    return; // leave the static text as-is
  }

  el.textContent = '';
  var cursor = document.createElement('span');
  cursor.className = 'type-cursor';
  el.appendChild(cursor);

  var typed = false;
  function typeIt(){
    if(typed) return;
    typed = true;
    var i = 0;
    var speed = 90; // ms per character (half speed)
    var interval = setInterval(function(){
      if(i < fullText.length){
        el.insertBefore(document.createTextNode(fullText[i]), cursor);
        i++;
      } else {
        clearInterval(interval);
        cursor.remove();
      }
    }, speed);
  }

  if('IntersectionObserver' in window){
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          typeIt();
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });
    observer.observe(el);
  } else {
    typeIt();
  }
})();

(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;

  // Builds an ordered queue of {node, char} pairs by walking el's original
  // markup and clearing each text node - preserves nested tags (e.g. <strong>)
  // in their correct position. Characters are grown back into their real,
  // original text nodes (never wrapped in spans), so the browser can kern
  // and shape them normally instead of treating each letter as an isolated
  // inline box - that per-span isolation was what caused the "tightening"
  // snap after typing finished.
  function buildQueue(el){
    var queue = [];
    function walk(node){
      if(node.nodeType === 3){
        var text = node.textContent;
        if(text.length){
          for(var i = 0; i < text.length; i++){
            queue.push({ node: node, char: text[i] });
          }
          node.textContent = '';
        }
      } else if(node.nodeType === 1){
        Array.prototype.slice.call(node.childNodes).forEach(walk);
      }
    }
    walk(el);
    return queue;
  }

  function prepareOriginal(el){
    if(el.dataset.twOriginal === undefined){
      el.dataset.twOriginal = el.innerHTML;
    }
  }

  function typeElement(el){
    return new Promise(function(resolve){
      prepareOriginal(el);
      el.innerHTML = el.dataset.twOriginal; // reset to full original markup
      var queue = buildQueue(el); // clears text nodes, records what to re-grow
      el.style.opacity = '1'; // reveal the container now that it's ready to animate in
      var n = queue.length;
      if(n === 0){ resolve(); return; }
      var duration = Math.min(2200, Math.max(440, n * 28)); // half speed
      var tick = 16;
      var totalTicks = Math.max(1, Math.round(duration / tick));
      var perTick = Math.max(1, Math.ceil(n / totalTicks));
      var idx = 0;
      var timer = setInterval(function(){
        for(var k = 0; k < perTick && idx < n; k++, idx++){
          queue[idx].node.textContent += queue[idx].char;
        }
        if(idx >= n){
          clearInterval(timer);
          resolve();
        }
      }, tick);
    });
  }

  // Keep this list in sync with the ".js ..." opacity:0 list in style.css
  var selector = [
    '.status-line span:last-child',
    '.role',
    '.hero-lede',
    '.about-text p',
    'h2',
    '.section-lede',
    '.expertise-group h3',
    '.expertise-list span',
    '.expertise-list a',
    '.timeline-when',
    '.timeline-role',
    '.timeline-org',
    '.case-id',
    '.case-title',
    '.contact-buttons a',
    'footer .wrap'
  ].join(', ');

  var elements = Array.prototype.slice.call(document.querySelectorAll(selector));

  if('IntersectionObserver' in window && elements.length){
    var visibleResolvers = [];
    var visiblePromises = elements.map(function(el, i){
      return new Promise(function(resolve){ visibleResolvers[i] = resolve; });
    });

    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var i = elements.indexOf(entry.target);
        if(i > -1 && entry.isIntersecting){
          visibleResolvers[i]();
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    elements.forEach(function(el){ obs.observe(el); });

    // Sequential runner: element i+1 doesn't start until element i has
    // both become visible AND finished typing.
    (function runQueue(i){
      if(i >= elements.length) return;
      visiblePromises[i].then(function(){
        return typeElement(elements[i]);
      }).then(function(){
        runQueue(i + 1);
      });
    })(0);
  } else {
    // No IntersectionObserver support: just reveal everything as plain text.
    elements.forEach(function(el){ el.style.opacity = '1'; });
  }

  // Project descriptions re-type every time their dropdown opens
  document.querySelectorAll('.case').forEach(function(details){
    details.addEventListener('toggle', function(){
      if(details.open){
        var body = details.querySelector('.case-body');
        if(body) typeElement(body);
      }
    });
  });
})();

(function(){
  var indicator = document.getElementById('tab-indicator');
  if(!indicator) return;
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs a'));
  var current = document.querySelector('.tabs a[aria-current="page"]');
  if(!current) return;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORAGE_KEY = 'mk-last-tab';

  function moveIndicator(el){
    indicator.style.left = el.offsetLeft + 'px';
    indicator.style.width = el.offsetWidth + 'px';
  }

  // Which tab were we on before this page loaded? (only a nicety -
  // storage can be blocked, so everything still works without it)
  var previous = null;
  try{
    var lastHref = sessionStorage.getItem(STORAGE_KEY);
    previous = tabs.filter(function(a){ return a.getAttribute('href') === lastHref; })[0] || null;
    sessionStorage.setItem(STORAGE_KEY, current.getAttribute('href'));
  }catch(e){}

  // Start under the previous tab (no animation), then slide to this page's tab
  moveIndicator(previous && !reduceMotion ? previous : current);
  void indicator.offsetWidth; // force layout so the starting spot sticks
  if(!reduceMotion) indicator.classList.add('animate');
  requestAnimationFrame(function(){ moveIndicator(current); });

  // Web fonts can change tab widths after load - re-measure once they're in
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){ moveIndicator(current); });
  }
  window.addEventListener('resize', function(){ moveIndicator(current); });
})();
