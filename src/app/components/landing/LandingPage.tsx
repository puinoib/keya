import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  Cloud,
  GithubLogo,
  LockKey,
  Monitor,
  Moon,
  Pulse,
  ShieldCheck,
  Sun,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileStorage } from '@/app/lib/storage';
import { hasSession } from '@/app/lib/session';
import { useStore } from '@/app/store/useStore';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

const features = [
  {
    icon: LockKey,
    title: 'Encrypted',
    caption: 'Argon2id KDF and XChaCha20-Poly1305 keep every vault local and sealed.',
  },
  {
    icon: Pulse,
    title: 'Health-tested',
    caption: 'Track endpoint reachability, latency, and key status without extra tooling.',
  },
  {
    icon: Cloud,
    title: 'Zero backend',
    caption: 'Store `.keya` files in folders you already sync with iCloud, Dropbox, or Nutstore.',
  },
];

const principles = ['Local-first', 'Open source', 'Multi-vault', 'Offline-capable'];

export function LandingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const { theme, setTheme } = useStore();
  const CurrentIcon =
    themeOptions.find((option) => option.value === theme)?.icon ?? Monitor;

  // Redirect returning users before rendering the landing page.
  useEffect(() => {
    const check = async () => {
      if (hasSession()) {
        navigate({ to: '/keys', replace: true });
        return;
      }
      const hasWorkspace = await FileStorage.hasWorkspace();
      const metas = await FileStorage.getCachedVaultMetas();
      if (hasWorkspace || metas.length > 0) {
        navigate({ to: '/start', replace: true });
        return;
      }
      setChecking(false);
    };
    check();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-deepest" />
    );
  }

  return (
    <div className="relative min-h-screen overflow-y-auto bg-canvas-deepest text-ink-primary">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_-10%,rgba(94,106,210,0.16),transparent_54%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 32%, transparent 78%)',
        }}
      />

      <header className="relative z-10 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="Keya" className="icon-theme size-5" />
            <div>
              <div className="text-sm font-medium tracking-tight text-ink-primary">
                Keya
              </div>
              <div className="text-[11px] text-ink-quaternary">
                Local-first AI API key manager
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label="GitHub"
            >
              <GithubLogo className="size-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                <CurrentIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {themeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className="text-xs"
                  >
                    <option.icon className="size-3.5" />
                    <span>{option.label}</span>
                    {theme === option.value && (
                      <Check className="ml-auto size-3.5 text-accent-bright" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 sm:px-10">
        <section className="mx-auto max-w-3xl pb-14 pt-18 text-center sm:pb-18 sm:pt-24">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1">
            <span className="size-1 rounded-full bg-success-bright" />
            <span className="text-[11px] tracking-wide text-ink-tertiary">
              Open source · Zero backend
            </span>
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-display text-ink-primary sm:text-6xl">
            Keya
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary sm:text-lg">
            A clean, local-first home for your AI API keys.
            <br className="hidden sm:block" />
            <span className="text-ink-tertiary">
              Encrypted vaults, simple organization, and no service to trust.
            </span>
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate({ to: '/start' })}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Start using Keya
              <ArrowRight className="size-3.5" />
            </button>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface-3 px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-5 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              View on GitHub
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-4xl pb-12">
          <div className="rounded-xl border border-line bg-surface-1/80 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle sm:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl pb-16 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {principles.map((item) => (
              <span
                key={item}
                className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-ink-tertiary"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-1.5 text-ink-quaternary">
            <ShieldCheck className="size-3.5 text-accent-bright/80" />
            <span className="text-xs">
              End-to-end encrypted. Your keys never leave your device.
            </span>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line-subtle px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-[11px] text-ink-quaternary">
            Built by Coryso Studio
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://coryso.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary transition-colors hover:text-ink-tertiary"
            >
              Coryso Studio
            </a>
            <a
              href="https://x.com/intent/follow?screen_name=puinoib_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary transition-colors hover:text-ink-tertiary"
            >
              X
            </a>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary transition-colors hover:text-ink-tertiary"
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
  icon: typeof LockKey;
  title: string;
  caption: string;
}) {
  return (
    <article className="bg-canvas-deepest p-5 text-left">
      <div className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface-3">
        <Icon className="size-4 text-accent-bright" />
      </div>
      <h2 className="mt-3 text-sm font-medium text-ink-primary">{title}</h2>
      <p className="mt-1 text-xs leading-6 text-ink-quaternary">{caption}</p>
    </article>
  );
}
