import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  ClockCountdown,
  FileLock,
  FolderSimple,
  GithubLogo,
  Monitor,
  Moon,
  Pulse,
  ShieldCheck,
  Sun,
  Tray,
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

const featureCards = [
  {
    icon: FileLock,
    title: 'Encrypted `.keya` vaults',
    caption:
      'Each vault is a local file protected with Argon2id and XChaCha20-Poly1305.',
  },
  {
    icon: FolderSimple,
    title: 'Multi-vault workspace',
    caption:
      'Separate work, personal, and client keys into independent vault files with their own passwords.',
  },
  {
    icon: Pulse,
    title: 'Provider-aware testing',
    caption:
      'Check endpoint reachability, latency, and key status without leaving the app.',
  },
  {
    icon: ClockCountdown,
    title: 'Expiry reminders',
    caption:
      'Inbox surfaces expiring, expired, and stale keys before they break your workflow.',
  },
];

const proofItems = [
  'Local-first',
  'Zero backend',
  'Open source',
  'Cloud sync ready',
];

const workflowItems = [
  'Pick a workspace folder you already trust',
  'Create separate vaults for each context',
  'Add provider, endpoint, expiry, and notes',
  'Test keys and keep an eye on reminders',
];

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
    <div className="relative h-full overflow-y-auto bg-canvas-deepest text-ink-primary">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_-10%,rgba(94,106,210,0.16),transparent_54%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 28%, transparent 78%)',
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
                Local-first AI API key vault
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
        <section className="mx-auto max-w-4xl pb-12 pt-18 text-center sm:pb-16 sm:pt-24">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1">
            <span className="size-1 rounded-full bg-success-bright" />
            <span className="text-[11px] tracking-wide text-ink-tertiary">
              Open source · No account · No backend
            </span>
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-display text-ink-primary sm:text-6xl">
            API key management for AI developers who want to keep the file.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
            Keya stores credentials in encrypted local vaults, keeps provider
            details structured, and helps you catch broken or expiring keys
            before they interrupt your work.
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

        <section className="mx-auto max-w-5xl pb-10">
          <div className="rounded-xl border border-line bg-surface-1/80 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle md:grid-cols-2">
              {featureCards.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 pb-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-line bg-surface-2/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs text-ink-quaternary">
              <Tray className="size-3.5 text-accent-bright" />
              Typical workflow
            </div>
            <div className="mt-4 grid gap-3">
              {workflowItems.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-lg border border-line-subtle bg-canvas-deepest/70 px-3 py-3"
                >
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] text-ink-tertiary">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-ink-secondary">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/60 p-5 sm:p-6">
            <div className="text-xs text-ink-quaternary">Why it feels different</div>
            <h2 className="mt-2 text-lg font-medium text-ink-primary">
              Not a SaaS dashboard. Not a generic password manager.
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Keya is built around the way AI developers actually work with
              credentials: provider by provider, environment by environment,
              with local files they can back up and keep forever.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {proofItems.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-line bg-canvas-deepest px-2.5 py-1 text-[11px] text-ink-tertiary"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-ink-quaternary">
              <ShieldCheck className="size-3.5 text-accent-bright/80" />
              <span className="text-xs">
                End-to-end encrypted. Your keys never leave your device.
              </span>
            </div>
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
  icon: typeof FileLock;
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
