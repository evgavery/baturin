// Слайдер парка в hero (ТЗ §5.1 п.1). Прокрутка — нативная, со scroll-snap: свайп на мобиле
// достаётся бесплатно, стрелки и точки просто зовут scrollTo. Автопрокрутка вежливая:
// не стартует при prefers-reduced-motion, спит в фоновой вкладке, встаёт на паузу при наведении
// и фокусе, выключается после первого действия пользователя; кнопка [data-pause] выключает и
// включает её явно (WCAG 2.2.2).
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
  // Индекс цели программного скролла; -1 — программный скролл не летит.
  let pendingTarget = -1;

  const markActive = (index: number): void => {
    current = index;
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const goTo = (index: number): void => {
    const target = (index + slides.length) % slides.length;
    const left = track.clientWidth * target;
    // Уже на месте — скролла не будет, наблюдатель не отработает, взведённый pendingTarget
    // заглушил бы его навсегда.
    pendingTarget = Math.abs(track.scrollLeft - left) < 2 ? -1 : target;
    track.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
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

  const pauseBtn = root.querySelector<HTMLElement>('[data-pause]');
  // Иконки — <svg>, у SVGElement нет свойства hidden: переключаем класс, а не атрибут.
  const iconPause = pauseBtn?.querySelector<SVGElement>('[data-icon-pause]');
  const iconPlay = pauseBtn?.querySelector<SVGElement>('[data-icon-play]');
  const syncPauseBtn = (): void => {
    if (!pauseBtn || !iconPause || !iconPlay) return;
    iconPause.classList.toggle('hidden', stopped);
    iconPlay.classList.toggle('hidden', !stopped);
    pauseBtn.setAttribute(
      'aria-label',
      stopped ? 'Запустить автопрокрутку' : 'Приостановить автопрокрутку',
    );
  };

  /** Пользователь взял управление на себя — дальше слайдер не двигается сам. */
  const stop = (): void => {
    stopped = true;
    pause();
    syncPauseBtn();
  };

  pauseBtn?.addEventListener('click', () => {
    if (stopped) {
      stopped = false;
      play();
      syncPauseBtn();
    } else {
      stop();
    }
  });

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
  // Пользователь взялся за трек (свайп/драг) — прервать программный полёт и вернуть
  // точки под управление наблюдателя, чтобы они следовали за пальцем.
  root.addEventListener('pointerdown', () => {
    pendingTarget = -1;
    stop();
  });
  track.addEventListener(
    'wheel',
    (event) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        pendingTarget = -1;
        stop();
      }
    },
    { passive: true },
  );

  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', play);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', play);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  // Активная точка следует за реальным положением трека — в том числе после свайпа.
  // Пока летит программный smooth-scroll (goTo через несколько слайдов), промежуточные
  // слайды пролетают порог видимости и без фильтра дёргали бы индикатор туда-обратно —
  // до приземления цели наблюдатель молчит.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = slides.indexOf(entry.target as HTMLElement);
        if (pendingTarget === -1) markActive(index);
        else if (index === pendingTarget) pendingTarget = -1;
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
