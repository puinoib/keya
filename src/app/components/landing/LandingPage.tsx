import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  GithubLogo,
  Lock,
  Pulse,
  Cloud,
  Sun,
  Moon,
  Monitor,
  Check,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { FileStorage } from '@/app/lib/storage';
import { hasSession } from '@/app/lib/session';
import { useStore } from '@/app/store/useStore';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const { theme, setTheme } = useStore();
  const CurrentIcon =
    themeOptions.find((o) => o.value === theme)?.icon ?? Monitor;

  // Auto-redirect known users to the right entry
  useEffect(() => {
    const check = async () => {
      if (hasSession()) {
        navigate({ to: '/keys', replace: true });
        return;
      }
      const hasWs = await FileStorage.hasWorkspace();
      const metas = await FileStorage.getCachedVaultMetas();
      if (hasWs || metas.length > 0) {
        navigate({ to: '/start', replace: true });
        return;
      }
      setChecking(false);
    };
    check();
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-canvas-deepest flex items-center justify-center" />
    );
  }

  return (
    <div className="relative min-h-screen bg-canvas-deepest overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_-20%,rgba(94,106,210,0.18),transparent_60%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Keya" className="icon-theme size-5" />
          <span className="text-sm font-medium tracking-tight text-ink-primary">
            Keya
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/puinoib/keya"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors"
            aria-label="GitHub"
          >
            <GithubLogo className="size-3.5" />
            <span>GitHub</span>
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors">
              <CurrentIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {themeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className="text-xs"
                >
                  <opt.icon className="size-3.5" />
                  <span>{opt.label}</span>
                  {theme === opt.value && (
                    <Check className="size-3.5 ml-auto text-accent-bright" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 px-6 sm:px-10">
        <section className="mx-auto max-w-2xl pt-20 sm:pt-28 pb-16 text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-line px-2.5 py-1 mb-6">
            <span className="size-1 rounded-full bg-success-bright" />
            <span className="text-[11px] text-ink-tertiary tracking-wide">
              Open source · v0.1
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-semibold tracking-display text-ink-primary">
            Keya
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ink-secondary leading-relaxed">
            Local-first AI API key manager.
            <br className="hidden sm:block" />
            <span className="text-ink-tertiary">
              Encrypted. Offline-capable. Yours forever.
            </span>
          </p>

          <div className="mt-10 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate({ to: '/start' })}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors"
            >
              Start using Keya
              <ArrowRight className="size-3.5" />
            </button>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 border border-line px-4 py-2.5 text-sm font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-5 transition-colors"
            >
              <GithubLogo className="size-3.5" />
              Star on GitHub
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-3xl pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line rounded-lg overflow-hidden border border-line">
            <FeatureCard
              icon={Lock}
              title="Encrypted"
              caption="XChaCha20-Poly1305 + Argon2id KDF"
            />
            <FeatureCard
              icon={Pulse}
              title="Health-tested"
              caption="Auto-check API reachability & expiry"
            />
            <FeatureCard
              icon={Cloud}
              title="Zero backend"
              caption="Sync via iCloud, Dropbox, Nutstore"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-10 py-8 border-t border-line-subtle">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-ink-quaternary">
            <Lock className="size-3 opacity-60" />
            <span className="text-[11px]">
              End-to-end encrypted. Your keys never leave your device.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://coryso.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              Coryso Studio
            </a>
            <a
              href="https://x.com/intent/follow?screen_name=puinoib_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              X
            </a>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  caption,
}: {
  icon: typeof Lock;
  title: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 bg-canvas-deepest p-5">
      <div className="inline-flex items-center justify-center size-7 rounded-md bg-surface-3 border border-line">
        <Icon className="size-3.5 text-accent-bright" weight="regular" />
      </div>
      <div>
        <div className="text-xs font-medium text-ink-primary">{title}</div>
        <div className="text-[11px] text-ink-quaternary mt-0.5 leading-relaxed">
          {caption}
        </div>
      </div>
    </div>
  );
}
