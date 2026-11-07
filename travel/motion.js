(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.querySelector('#motion-toggle');
  const motionKey = 'travel-motion-paused';
  const animations = new Set();
  const openDetails = new WeakMap();
  let paused = false;
  try { paused = localStorage.getItem(motionKey) === 'true'; } catch { /* Storage is optional. */ }

  const enabled = () => !paused && !reduced.matches;

  function animate(node, frames, options = {}) {
    if (!node || !enabled() || !node.animate) return null;
    const animation = node.animate(frames, {duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)', ...options});
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }

  function entrance(node, delay = 0) {
    return animate(node, [
      {opacity: 0, transform: 'translateY(13px)', filter: 'blur(4px)'},
      {opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)'},
    ], {delay, fill: 'backwards'});
  }

  function reveal(node) {
    if (!node || node.hidden) return;
    animate(node, [{height: '0px', opacity: 0, overflow: 'hidden'},
      {height: `${node.getBoundingClientRect().height}px`, opacity: 1, overflow: 'hidden'}], {duration: 400});
  }

  function updatePreference() {
    root.dataset.motion = paused || reduced.matches ? 'paused' : 'active';
    toggle.textContent = paused || reduced.matches ? '动效已暂停' : '暂停动效';
    toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
    toggle.disabled = reduced.matches;
    toggle.title = reduced.matches ? '已遵循系统的减少动态效果设置' : '暂停或恢复页面动效';
    if (!enabled()) {
      for (const animation of animations) {
        try { animation.finish(); } catch { animation.cancel(); }
      }
    }
  }

  toggle.hidden = false;
  updatePreference();
  reduced.addEventListener('change', updatePreference);
  toggle.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(motionKey, String(paused)); } catch { /* The page still responds. */ }
    updatePreference();
  });

  function themeTransition(change, source) {
    if (!enabled() || !document.startViewTransition) { change(); return; }
    const rect = source.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(change);
    transition.ready.then(() => {
      animate(root, {clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]},
        {duration: 600, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)'});
    }).catch(() => { /* The theme has already updated if the transition is skipped. */ });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled || !enabled()) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-ink';
    ripple.setAttribute('aria-hidden', 'true');
    const x = event.detail ? event.clientX - rect.left : rect.width / 2;
    const y = event.detail ? event.clientY - rect.top : rect.height / 2;
    Object.assign(ripple.style, {width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px`});
    button.append(ripple);
    const animation = animate(ripple, [{transform: 'scale(0)', opacity: .24}, {transform: 'scale(1)', opacity: 0}], {duration: 620});
    if (animation) animation.finished.then(() => ripple.remove(), () => ripple.remove());
    else ripple.remove();
  });

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('summary');
    if (!summary || !enabled()) return;
    const details = summary.parentElement;
    if (details.tagName !== 'DETAILS') return;
    event.preventDefault();
    const current = openDetails.get(details);
    const opening = current ? !current.opening : !details.open;
    const start = details.getBoundingClientRect().height;
    if (current) { current.animation.onfinish = null; current.animation.cancel(); }
    details.open = true;
    details.style.height = '';
    const end = opening ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
    const animation = animate(details, [{height: `${start}px`, overflow: 'hidden'}, {height: `${end}px`, overflow: 'hidden'}], {duration: 360});
    if (!animation) { details.open = opening; return; }
    openDetails.set(details, {opening, animation});
    animation.onfinish = () => {
      details.open = opening;
      openDetails.delete(details);
    };
  });

  const nav = document.querySelector('.page-nav');
  const highlight = nav.querySelector('.nav-highlight');
  const navLinks = [...nav.querySelectorAll('a')];
  let selectedLink = navLinks[0];
  function selectLink(link) {
    selectedLink = link;
    for (const item of navLinks) item.dataset.active = String(item === link);
    highlight.style.width = `${link.offsetWidth}px`;
    highlight.style.transform = `translateX(${link.offsetLeft - 4}px)`;
  }
  for (const link of navLinks) link.addEventListener('click', () => selectLink(link));
  new ResizeObserver(() => selectLink(selectedLink)).observe(nav);

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entrance(entry.target);
      observer.unobserve(entry.target);
    }
  }, {threshold: .08});
  document.querySelectorAll('.panel, .engineering > .eyebrow, .engineering > h2, .design-grid article').forEach((node) => observer.observe(node));
  document.querySelectorAll('.intro .eyebrow, .intro h1, .intro-copy, .page-nav').forEach((node, index) => entrance(node, index * 75));
  document.querySelectorAll('.title-word').forEach((word, index) => entrance(word, 100 + index * 100));

  for (const card of document.querySelectorAll('.design-grid article')) {
    card.addEventListener('pointermove', (event) => {
      if (!enabled() || !finePointer.matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.transform = `perspective(850px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }

  let scrollFrame;
  function updateScroll() {
    scrollFrame = undefined;
    const max = document.documentElement.scrollHeight - innerHeight;
    root.style.setProperty('--reading-progress', max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0);
    const engineering = document.querySelector('#engineering').getBoundingClientRect().top;
    if (engineering < innerHeight * .45) selectLink(navLinks[2]);
    else if (selectedLink === navLinks[2]) selectLink(navLinks[0]);
  }
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, {passive: true});
  addEventListener('resize', updateScroll, {passive: true});
  updateScroll();

  function activity(active, planning) {
    document.querySelector('#request').classList.toggle('is-loading', active);
    document.querySelector('#generation-track').hidden = !active;
    document.querySelector('.itinerary').setAttribute('aria-busy', String(planning));
  }

  window.TravelMotion = {entrance, reveal, animate, themeTransition, activity};
})();
