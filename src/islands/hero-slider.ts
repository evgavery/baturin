// Слайдер парка в hero (ТЗ §5.1 п.1). Прокрутка — нативная, со scroll-snap: свайп на мобиле
// достаётся бесплатно, стрелки и точки просто зовут scrollTo. Автопрокрутка вежливая:
// не стартует при prefers-reduced-motion, спит в фоновой вкладке, встаёт на паузу при наведении
// и фокусе и полностью выключается после первого действия пользователя.
const AUTOPLAY_MS = 6000;

function initSlider(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('[data-track]');
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
  const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-dot]'));
  if (!track || slides.length === 0) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer = 0;
  let stopped = false;

  const markActive = (index: number): void => {
    current = index;
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const goTo = (index: number): void => {
    const target = (index + slides.length) % slides.length;
    track.scrollTo({
      left: track.clientWidth * target,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
    markActive(target);
  };

  const pause = (): void => {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };

  const play = (): void => {
    if (stopped || timer || reducedMotion.matches || document.hidden) return;
    timer = window.setInterval(() => goTo(current + 1), AUTOPLAY_MS);
  };

  /** Пользователь взял управление на себя — дальше слайдер не двигается сам. */
  const stop = (): void => {
    stopped = true;
    pause();
  };

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      stop();
      goTo(index);
    });
  });
  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    stop();
    goTo(current - 1);
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    stop();
    goTo(current + 1);
  });
  root.addEventListener('pointerdown', stop);

  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', play);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', play);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  // Активная точка следует за реальным положением трека — в том числе после свайпа.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) markActive(slides.indexOf(entry.target as HTMLElement));
      }
    },
    { root: track, threshold: 0.6 },
  );
  slides.forEach((slide) => observer.observe(slide));

  markActive(0);
  play();
}

const slider = document.getElementById('hero-slider');
if (slider) initSlider(slider);
