/* Full terrain-to-city viewer: stage rail, play/pause, previous/next, legend and labels. */
import { createTerrainCity, legendFor, STAGES } from './terrain-city.js';
const root = document.querySelector('.tc-viewer');
if (root) {
  const canvas = root.querySelector('canvas'), labels = root.querySelector('.tc-labels');
  const rail = root.querySelector('.tc-rail'), legend = root.querySelector('.tc-legend'), chip = root.querySelector('.tc-stage');
  const playBtn = root.querySelector('[data-act="play"]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  rail.innerHTML = STAGES.map((s, i) => `<button type="button" data-i="${i}" aria-label="Stage ${i + 1}: ${s.label}" aria-pressed="false"><b>${String(i + 1).padStart(2, '0')}</b><span>${s.short}</span></button>`).join('');
  const btns = [...rail.querySelectorAll('button')];
  const show = (i, st) => {
    chip.textContent = `Stage ${i + 1} of 12: ${st.label}`;
    btns.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    legend.innerHTML = legendFor(i).map(([c, t]) => `<li><i style="background:${c}"></i>${t}</li>`).join('');
  };
  const low = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  const bg = () => getComputedStyle(root).getPropertyValue('--tc-bg').trim() || '#ffffff';
  const tc = createTerrainCity({ canvas, labels, mode: 'viewer', quality: low ? 'low' : 'medium', maxDpr: 1.75, background: bg(), zoom: 1.12, stageSeconds: 7, onStage: show });
  root.classList.add('is-live');
  const setPlay = (p) => { playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play'); playBtn.querySelector('span').textContent = p ? 'Pause' : 'Play'; };
  const go = (i) => { tc.pause(); tc.stopLoop(); setPlay(false); tc.setStage(i); };
  btns.forEach((b, i) => b.addEventListener('click', () => go(i)));
  root.querySelector('[data-act="prev"]').addEventListener('click', () => go((tc.stage + 11) % 12));
  root.querySelector('[data-act="next"]').addEventListener('click', () => go((tc.stage + 1) % 12));
  playBtn.addEventListener('click', () => { if (tc.playing) { tc.pause(); tc.stopLoop(); setPlay(false); } else { tc.resumeLoop(); tc.play(); setPlay(true); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go((tc.stage + 1) % 12); e.preventDefault(); } if (e.key === 'ArrowLeft') { go((tc.stage + 11) % 12); e.preventDefault(); } });
  new MutationObserver(() => tc.setBackground(bg())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) tc.stopLoop(); else if (tc.playing) tc.resumeLoop(); });
  tc.setStage(0);
  if (!reduce) { tc.play(); setPlay(true); } else setPlay(false);
}
