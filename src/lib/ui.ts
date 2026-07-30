// Повторяющиеся рецепты классов витрины — единственный источник. Правка кнопки или бокса
// здесь меняет их на всех страницах сразу; локальные копии в разметке недопустимы.
export const boxClass = 'rounded-box border border-line bg-surface';

export const primaryButton =
  'flex min-h-[48px] items-center justify-center rounded-full bg-accent px-7 text-[15.5px] font-semibold text-white transition-[background-color,box-shadow] duration-200 hover:bg-accent-soft hover:shadow-glow-md active:bg-accent-press';

export const secondaryButton =
  'flex min-h-[48px] items-center justify-center rounded-full border border-line-strong px-7 text-[15.5px] font-medium text-screen transition-colors duration-200 hover:border-line-on-strong';

export const fieldLabel = 'mb-2 block font-mono text-[11px] tracking-[0.1em] text-dim uppercase';

export const fieldInput =
  'w-full min-h-[48px] rounded-sm border border-line-strong bg-bg-deep px-4 py-3 text-[15px] text-screen placeholder:text-dim focus:border-accent';
