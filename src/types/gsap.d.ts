interface GsapTicker {
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

interface GsapGlobal {
  set(targets: Element | Element[] | string, vars: Record<string, unknown>): unknown;
  to(targets: Element | Element[] | string, vars: Record<string, unknown>): unknown;
  fromTo(
    targets: Element | Element[] | string,
    fromVars: Record<string, unknown>,
    toVars: Record<string, unknown>
  ): unknown;
  registerPlugin(...plugins: unknown[]): void;
  ticker: GsapTicker;
}

declare const gsap: GsapGlobal;

interface CustomEaseGlobal {
  create(name: string, config: string): void;
}

declare const CustomEase: CustomEaseGlobal;
