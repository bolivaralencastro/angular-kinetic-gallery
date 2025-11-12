import { DOCUMENT } from '@angular/common';
import { Injectable, Inject, effect, signal, computed } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

export interface ContextMenuPalette {
  background: string;
  border: string;
  itemHover: string;
  heading: string;
  divider: string;
  text: string;
  icon: string;
}

export interface DialogPalette {
  surface: string;
  border: string;
  title: string;
  text: string;
  muted: string;
  icon: string;
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  focusRing: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  disabledBg: string;
  disabledText: string;
  timerActiveBg: string;
  timerInactiveBg: string;
  timerInactiveText: string;
}

interface ThemePalette {
  name: ThemeMode;
  bodyBackground: string;
  bodyText: string;
  scrim: string;
  contextMenu: ContextMenuPalette;
  dialog: DialogPalette;
  metaThemeColor: string;
}

const STORAGE_KEY = 'angular-kinetic-gallery:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly palettes: Record<ThemeMode, ThemePalette> = {
    dark: {
      name: 'dark',
      bodyBackground: '#000000',
      bodyText: '#e5e7eb',
      scrim: 'rgba(0, 0, 0, 0.7)',
      contextMenu: {
        background: 'rgba(30, 30, 30, 0.95)',
        border: 'rgb(50, 50, 50)',
        itemHover: 'rgb(60, 60, 60)',
        heading: '#9ca3af',
        divider: 'rgba(255, 255, 255, 0.08)',
        text: '#e5e7eb',
        icon: '#9ca3af',
      },
      dialog: {
        surface: 'rgba(30, 30, 30, 0.95)',
        border: 'rgb(50, 50, 50)',
        title: '#e5e7eb',
        text: '#d1d5db',
        muted: '#9ca3af',
        icon: '#b4b4b4',
        inputBackground: 'rgb(38, 38, 38)',
        inputText: '#e5e7eb',
        inputBorder: 'rgb(60, 60, 60)',
        focusRing: 'rgba(148, 163, 184, 0.35)',
        buttonPrimaryBg: 'rgb(60, 60, 60)',
        buttonPrimaryText: '#ffffff',
        buttonSecondaryBg: 'rgb(60, 60, 60)',
        buttonSecondaryText: '#ffffff',
        disabledBg: 'rgb(38, 38, 38)',
        disabledText: 'rgb(150, 150, 150)',
        timerActiveBg: 'rgb(80, 80, 80)',
        timerInactiveBg: 'rgb(38, 38, 38)',
        timerInactiveText: 'rgb(180, 180, 180)',
      },
      metaThemeColor: '#000000',
    },
    light: {
      name: 'light',
      bodyBackground: '#f8fafc',
      bodyText: '#0f172a',
      scrim: 'rgba(15, 23, 42, 0.45)',
      contextMenu: {
        background: 'rgba(255, 255, 255, 0.98)',
        border: 'rgba(148, 163, 184, 0.5)',
        itemHover: 'rgba(226, 232, 240, 0.9)',
        heading: '#475569',
        divider: 'rgba(148, 163, 184, 0.35)',
        text: '#0f172a',
        icon: '#475569',
      },
      dialog: {
        surface: 'rgba(255, 255, 255, 0.98)',
        border: 'rgba(148, 163, 184, 0.5)',
        title: '#0f172a',
        text: '#1e293b',
        muted: '#475569',
        icon: '#475569',
        inputBackground: 'rgba(241, 245, 249, 0.9)',
        inputText: '#0f172a',
        inputBorder: 'rgba(148, 163, 184, 0.6)',
        focusRing: 'rgba(148, 163, 184, 0.35)',
        buttonPrimaryBg: '#0f172a',
        buttonPrimaryText: '#f8fafc',
        buttonSecondaryBg: 'rgba(148, 163, 184, 0.25)',
        buttonSecondaryText: '#0f172a',
        disabledBg: 'rgba(226, 232, 240, 0.9)',
        disabledText: 'rgba(148, 163, 184, 0.9)',
        timerActiveBg: '#0f172a',
        timerInactiveBg: 'rgba(148, 163, 184, 0.25)',
        timerInactiveText: '#475569',
      },
      metaThemeColor: '#f8fafc',
    },
  };

  private readonly storedTheme = this.readStoredTheme();
  private readonly themeSignal = signal<ThemeMode>(this.storedTheme ?? 'dark');

  readonly theme = computed(() => this.themeSignal());
  readonly contextMenuPalette = computed(() => this.palettes[this.themeSignal()].contextMenu);
  readonly dialogPalette = computed(() => this.palettes[this.themeSignal()].dialog);
  readonly scrimColor = computed(() => this.palettes[this.themeSignal()].scrim);
  readonly bodyBackground = computed(() => this.palettes[this.themeSignal()].bodyBackground);
  readonly bodyText = computed(() => this.palettes[this.themeSignal()].bodyText);

  constructor(@Inject(DOCUMENT) private readonly documentRef: Document) {
    effect(() => {
      const currentTheme = this.themeSignal();
      this.applyToDocument(currentTheme);
      this.persistTheme(currentTheme);
    });
  }

  toggleTheme(): void {
    this.setTheme(this.themeSignal() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.themeSignal.set(theme);
  }

  isDark(): boolean {
    return this.themeSignal() === 'dark';
  }

  isLight(): boolean {
    return this.themeSignal() === 'light';
  }

  private applyToDocument(theme: ThemeMode): void {
    const palette = this.palettes[theme];
    const body = this.documentRef.body;
    body.dataset.theme = theme;
    body.classList.remove('theme-dark', 'theme-light');
    body.classList.add(`theme-${theme}`);

    body.classList.remove('bg-black', 'text-gray-300', 'bg-zinc-50', 'text-slate-900');
    if (theme === 'dark') {
      body.classList.add('bg-black', 'text-gray-300');
    } else {
      body.classList.add('bg-zinc-50', 'text-slate-900');
    }

    body.style.backgroundColor = palette.bodyBackground;
    body.style.color = palette.bodyText;

    const metaTheme = this.documentRef.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', palette.metaThemeColor);
    }
  }

  private persistTheme(theme: ThemeMode): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Não foi possível salvar o tema preferido.', error);
    }
  }

  private readStoredTheme(): ThemeMode | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch (error) {
      console.warn('Não foi possível ler o tema salvo.', error);
    }

    return null;
  }
}
