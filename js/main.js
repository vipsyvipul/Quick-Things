(function () {
  // ── Journey: switch scenes as copy steps cross the viewport center ──
  const journey = document.querySelector('.journey');
  const steps   = Array.from(document.querySelectorAll('.j-step'));
  const scenes  = Array.from(document.querySelectorAll('.scene'));

  if (journey && steps.length === scenes.length) {
    let active = 0;

    function setStage(i) {
      if (i === active) return;
      active = i;
      journey.dataset.stage = String(i + 1);
      scenes.forEach((scene, idx) => {
        scene.classList.toggle('is-active', idx === i);
        scene.classList.toggle('is-past', idx < i);
      });
    }

    const stepObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setStage(steps.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    steps.forEach((s) => stepObs.observe(s));
  }

  // ── Reveals ──
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));
})();
