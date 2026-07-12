/* Shared portfolio interactions — ported from the homepage. */

// Scroll reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Frost the top nav once the page scrolls, so content shows through it
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Mobile sheet open/close
const sheet = document.getElementById('sheet');
function openSheet() { if (sheet) sheet.classList.add('open'); }
function closeSheet() { if (sheet) sheet.classList.remove('open'); }
document.querySelectorAll('[data-sheet-open]').forEach(b => b.addEventListener('click', openSheet));
document.querySelectorAll('[data-sheet-close]').forEach(b => b.addEventListener('click', closeSheet));

// "Keep exploring" peek carousel — drag, arrows, and pagination dots.
document.querySelectorAll('.related__viewport').forEach(viewport => {
  const track = viewport.querySelector('.related__grid');
  if (!track) return;
  const cards = [...track.querySelectorAll('.rcard')];
  const prev = viewport.querySelector('.related__arrow--prev');
  const next = viewport.querySelector('.related__arrow--next');
  const dotsWrap = viewport.parentElement.querySelector('.related__dots');

  const inset = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;

  // Align a card's left edge to the content inset
  const centerOn = i => {
    const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - inset(), behavior: 'smooth' });
  };

  // Which card is currently snapped (nearest to the left inset)
  const currentIndex = () => {
    const target = track.scrollLeft + inset();
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - target);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  // Dots paginate the track by viewport-widths, not by card: with five cards
  // and ~2.8 visible, there are two screens to scroll through, so two dots.
  const maxScroll = () => track.scrollWidth - track.clientWidth;
  const pageCount = () => (maxScroll() <= 2 ? 1 : Math.ceil(track.scrollWidth / track.clientWidth));
  const pageStep = () => (pageCount() > 1 ? maxScroll() / (pageCount() - 1) : 0);
  const currentPage = () => (pageStep() ? Math.round(track.scrollLeft / pageStep()) : 0);

  let dots = [];
  const buildDots = () => {
    if (!dotsWrap) return;
    const n = pageCount() > 1 ? pageCount() : 0; // nothing to paginate: no dots
    if (dots.length === n) return;
    dotsWrap.innerHTML = '';
    dots = Array.from({ length: n }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'related__dot';
      b.setAttribute('aria-label', `Go to slide ${i + 1} of ${n}`);
      b.addEventListener('click', () => track.scrollTo({ left: i * pageStep(), behavior: 'smooth' }));
      dotsWrap.appendChild(b);
      return b;
    });
  };

  const sync = () => {
    buildDots();
    const p = currentPage();
    dots.forEach((d, di) => d.classList.toggle('active', di === p));
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    if (prev) prev.toggleAttribute('disabled', atStart);
    if (next) next.toggleAttribute('disabled', atEnd);
    // fade the content-edge only when there's more track to scroll that way
    viewport.classList.toggle('fade-left', !atStart);
    viewport.classList.toggle('fade-right', !atEnd);
  };

  if (prev) prev.addEventListener('click', () => centerOn(currentIndex() - 1));
  if (next) next.addEventListener('click', () => centerOn(currentIndex() + 1));

  let raf = null;
  track.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; sync(); }); }, { passive: true });
  window.addEventListener('resize', sync);
  sync();

  // Click-and-drag for mouse users (touch/trackpad scroll natively).
  // NOTE: no setPointerCapture — capturing on pointerdown retargets the
  // click to the track and swallows the card link's navigation. We track
  // the drag on window instead, and only treat it as a drag past a small
  // threshold, so a plain click on a card still opens its page.
  let down = false, startX = 0, startScroll = 0, moved = 0, dragging = false;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    down = true; moved = 0; dragging = false;
    startX = e.clientX; startScroll = track.scrollLeft;
  });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 6) {
      dragging = true;
      track.style.cursor = 'grabbing';
      track.scrollLeft = startScroll - dx;
      e.preventDefault();
    }
  });
  const end = () => { if (!down) return; down = false; track.style.cursor = ''; if (dragging) centerOn(currentIndex()); };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  // Only cancel the card's navigation when the pointer was actually dragged.
  track.addEventListener('click', e => { if (dragging) { e.preventDefault(); e.stopPropagation(); } }, true);
});

/* Email icons (nav + footer): copy the address on click. The mailto: link is
   never followed — on iOS without Apple Mail it triggers a "Restore Mail?"
   App Store dialog — so we always copy and show the tooltip instead. */
document.querySelectorAll('[data-email-copy]').forEach(link => {
  const tip = link.querySelector('.copy-tip');
  const email = (link.getAttribute('href') || '').replace(/^mailto:/, '').split('?')[0] || 'shreyaseechand@gmail.com';
  let hideTimer;
  const showTip = () => {
    if (tip) tip.textContent = 'Copied email address!';
    link.classList.add('is-copied');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => link.classList.remove('is-copied'), 2600);
  };
  const copyEmail = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(email); }
      else {
        const ta = document.createElement('textarea');
        ta.value = email; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
    } catch (e) {}
  };
  link.addEventListener('click', (e) => {
    e.preventDefault();
    copyEmail();
    showTip();
  });
});
