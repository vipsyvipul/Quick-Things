document.addEventListener('DOMContentLoaded', () => {
  initReveals();
  initPipeline();
  initSubnav();
});

function initReveals() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function initPipeline() {
  const path = document.getElementById('pipePath');
  if (!path) return;

  const len = path.getTotalLength();
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;

  const obs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)';
      path.style.strokeDashoffset = '0';
      obs.disconnect();
    }
  }, { threshold: 0.3 });

  const pipeline = document.querySelector('.pipeline');
  if (pipeline) obs.observe(pipeline);
}

function initSubnav() {
  const subnav = document.getElementById('subnav');
  const hero   = document.getElementById('hero');
  if (!subnav || !hero) return;

  // Show after hero scrolls out
  const heroObs = new IntersectionObserver(([entry]) => {
    subnav.classList.toggle('subnav-visible', !entry.isIntersecting);
  }, { threshold: 0.05 });
  heroObs.observe(hero);

  // Track active product section
  const sections = document.querySelectorAll('[data-section]');
  const tabs     = document.querySelectorAll('.subnav-tab');

  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.dataset.section;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.section === id));
      }
    });
  }, { rootMargin: '-35% 0px -35% 0px' });

  sections.forEach(s => sectionObs.observe(s));
}
