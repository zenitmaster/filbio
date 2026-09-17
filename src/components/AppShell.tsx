"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { useAppStore, type ThemeChoice } from "@/lib/store";
import { cn } from "./ui";

const NAV: Array<{ href: string; label: MessageKey }> = [
  { href: "/", label: "nav.case" },
  { href: "/informe", label: "nav.report" },
  { href: "/poblaciones", label: "nav.populations" },
  { href: "/metodo", label: "nav.method" },
  { href: "/ajustes", label: "nav.settings" },
];

const THEMES: ThemeChoice[] = ["system", "light", "dark"];

/** Reads the saved state once in the browser, then keeps <html> in step with it. */
function useBrowserState() {
  const hydrated = useAppStore((state) => state.hydrated);
  const theme = useAppStore((state) => state.settings.theme);
  const locale = useAppStore((state) => state.settings.locale);

  useEffect(() => {
    void Promise.resolve(useAppStore.persist.rehydrate()).then(() =>
      useAppStore.setState({ hydrated: true }),
    );
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, theme]);

  useEffect(() => {
    if (hydrated) document.documentElement.lang = locale;
  }, [hydrated, locale]);

  return hydrated;
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const hydrated = useBrowserState();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const nextTheme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <BrandMark />
            <span className="font-serif text-xl font-semibold tracking-tight">{t("app.name")}</span>
          </Link>

          <nav aria-label="Principal" className="order-last -mx-1 flex w-full gap-0.5 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none",
                    active ? "bg-sunken text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div role="group" aria-label={t("nav.language")} className="flex rounded-md border border-line-strong p-0.5 text-sm">
              {(["es", "en"] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  aria-pressed={settings.locale === locale}
                  onClick={() => updateSettings({ locale })}
                  className={cn(
                    "rounded-[5px] px-2 py-0.5 font-medium uppercase",
                    settings.locale === locale ? "bg-ink text-surface" : "text-muted hover:text-ink",
                  )}
                >
                  {locale}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ theme: nextTheme })}
              title={`${t("nav.theme")}: ${t(`theme.${settings.theme}`)}`}
              aria-label={`${t("nav.theme")}: ${t(`theme.${settings.theme}`)}`}
              className="inline-flex size-8 items-center justify-center rounded-md border border-line-strong text-muted hover:text-ink"
            >
              <ThemeIcon theme={settings.theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6 print:max-w-none print:p-0">
        {/* Saved work is read after mount; holding the page back avoids flashing an empty case. */}
        {hydrated ? children : <div className="h-64 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" aria-hidden="true" />}
      </main>

      <footer className="border-t border-line print:hidden">
        <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-1 px-4 py-4 text-sm text-muted sm:px-6">
          <p className="text-text">{t("app.privacy")}</p>
          <p>{t("app.disclaimer")}</p>
        </div>
      </footer>
    </div>
  );
}

/** Two peaks on a baseline: a heterozygote, as the instrument draws it. */
function BrandMark() {
  return (
    <svg viewBox="0 0 28 24" className="h-6 w-7" aria-hidden="true">
      <path d="M1 20h26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path
        d="M3 20c3.2 0 3.6-14 6-14s2.8 14 6 14"
        fill="var(--dye-blue)"
        fillOpacity="0.2"
        stroke="var(--dye-blue)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M13 20c3.2 0 3.6-10 6-10s2.8 10 6 10"
        fill="var(--dye-green)"
        fillOpacity="0.2"
        stroke="var(--dye-green)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <path {...common} strokeLinejoin="round" d="M16.5 11.8A7 7 0 0 1 8.2 3.5a7 7 0 1 0 8.3 8.3Z" />
      </svg>
    );
  }
  if (theme === "light") {
    return (
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <circle {...common} cx="10" cy="10" r="3.4" />
        <path {...common} d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <rect {...common} x="2.8" y="4" width="14.4" height="9.5" rx="1.5" />
      <path {...common} d="M7.5 16.5h5" />
    </svg>
  );
}
