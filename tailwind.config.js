const safelist = [
  'bg-black/40','bg-black/50','bg-black/60','bg-black/70','bg-black/80','bg-black/85','bg-black/90',
  'bg-emerald-500/25','bg-red-500/10','bg-slate-200/80','bg-white/5','bg-white/10','bg-white/25','bg-white/80','bg-white/85','bg-zinc-900/60',
  'border-red-500/40','border-slate-200/80','border-slate-300/70','border-white/10','border-white/15','border-white/20','border-white/40',
  'focus-within:ring-white/30','focus:ring-slate-500/60','focus:ring-white/30','focus:ring-white/40','from-black/40',
  'group-hover:bg-white/20','group-hover:border-white/40','hover:bg-black/60','hover:bg-red-500/20','hover:bg-slate-200/60',
  'hover:bg-white/10','hover:border-white/20','hover:text-white/70','left-1/2','text-slate-800/90','text-slate-900/90',
  'text-white/40','text-white/70','text-white/85','text-white/90','top-1/2',
  '!shadow-[0_12px_24px_rgba(0,0,0,0.35)]','bg-[#1a1a1a]','from-[#4b5563]','from-[#6b7280]','from-[#d1d5db]',
  'group-active:shadow-[inset_0_4px_8px_rgba(0,0,0,0.25)]','group-active:shadow-[inset_0_6px_0_rgba(0,0,0,0.22)]',
  'group-hover:scale-[1.03]','inset-[22%]','inset-[46%]','left-[33.333%]','left-[66.666%]',
  'max-w-[10rem]','max-w-[26rem]','min-w-[220px]','rounded-[18px]','rounded-[22px]','rounded-[26px]',
  'shadow-[0_10px_40px_rgba(0,0,0,0.6)]','shadow-[0_18px_35px_rgba(0,0,0,0.45)]','shadow-[0_30px_90px_rgba(0,0,0,0.55)]',
  'shadow-[0_30px_90px_rgba(15,23,42,0.18)]','shadow-[0_6px_15px_rgba(0,0,0,0.25)]','shadow-[inset_0_-8px_0_rgba(0,0,0,0.18)]',
  'shadow-[inset_0_0_18px_rgba(255,255,255,0.05)]','shadow-[inset_0_4px_8px_rgba(0,0,0,0.25)]','shadow-[inset_0_6px_0_rgba(0,0,0,0.22)]',
  'text-[9px]','text-[10px]','text-[11px]','to-[#0f172a]','to-[#111827]','to-[#4b5563]',
  'top-[33.333%]','top-[66.666%]','tracking-[0.2em]','tracking-[0.24em]','tracking-[0.28em]',
  'tracking-[0.3em]','tracking-[0.32em]','tracking-[0.4em]','transition-[background-color,box-shadow,border-radius]',
  'transition-[box-shadow]','via-[#1f2937]','via-[#374151]','via-[#9ca3af]','z-[9999]','z-[10000]','z-[10001]'
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{html,ts}'],
  safelist,
  theme: {
    extend: {},
  },
  plugins: [],
};
