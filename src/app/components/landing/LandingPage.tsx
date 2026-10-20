import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  ClockCountdown,
  Code,
  FileLock,
  FolderSimple,
  GithubLogo,
  Key,
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
import { KeyaLogo } from '@/components/ui/keya-logo';
import { useStore } from '@/app/store/useStore';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

const featureCards = [
  {
    icon: FileLock,
    title: 'Encrypted by default',
    caption: 'Argon2id and XChaCha20-Poly1305 protect every vault.',
  },
  {
    icon: FolderSimple,
    title: 'Your files, your control',
    caption:
      'Keep separate work, personal, and client vaults wherever you choose.',
  },
  {
    icon: Pulse,
    title: 'Know before it breaks',
    caption: 'Check reachability, latency, and key status from one place.',
  },
  {
    icon: ClockCountdown,
    title: 'Never miss an expiry',
    caption: 'A quiet inbox surfaces expiring, expired, and stale credentials.',
  },
];

const workflowItems = [
  'Choose a folder you already trust',
  'Create a vault for each context',
  'Add credentials, endpoints, and expiry dates',
  'Test, back up, and sync with your own provider',
];

export function LandingPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useStore();
  const CurrentIcon =
    themeOptions.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <div className="relative h-full overflow-y-auto bg-canvas-deepest text-ink-primary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(94,106,210,0.22),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />

      <header className="relative z-10 px-5 py-5 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <KeyaLogo className="size-6" />
            <span className="text-sm font-semibold tracking-tight">Keya</span>
          </a>
          <nav
            className="flex items-center gap-1.5"
            aria-label="Main navigation"
          >
            <a
              href="#why-keya"
              className="hidden rounded-md px-3 py-2 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary sm:inline-flex"
            >
              Why Keya
            </a>
            <a
              href="/docs"
              className="rounded-md px-3 py-2 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
            >
              Docs
            </a>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
              aria-label="View Keya on GitHub"
            >
              <GithubLogo className="size-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex size-8 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                aria-label="Change theme"
              >
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
          </nav>
        </div>
      </header>

      <main className="relative z-10 px-5 sm:px-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 pb-20 pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-ink-tertiary">
              <span className="size-1.5 rounded-full bg-success-bright shadow-[0_0_10px_rgba(16,185,129,.7)]" />
              Open source · local-first · no account
            </div>
            <h1 className="mt-7 max-w-2xl text-5xl font-semibold leading-[1.06] tracking-display text-ink-primary sm:text-6xl lg:text-[4.25rem]">
              Your API keys.
              <br />
              <span className="text-accent-bright">Your files.</span>
              <br />
              Your control.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-secondary sm:text-lg">
              Keya is a calm, encrypted workspace for the credentials that power
              your work. No SaaS account. No backend. Just vault files you can
              inspect, back up, and sync yourself.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate({ to: '/start' })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-white shadow-[0_8px_28px_rgba(94,106,210,.25)] transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Create your first vault <ArrowRight className="size-4" />
              </button>
              <a
                href="/docs"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface-3 px-5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-5 hover:text-ink-primary"
              >
                See how it works
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-quaternary">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success-bright" />
                No telemetry
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success-bright" />
                MIT licensed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success-bright" />
                Cloud sync ready
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mt-4">
            <div className="absolute -inset-8 rounded-full bg-accent/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-xl border border-line bg-canvas-panel shadow-[0_24px_80px_rgba(0,0,0,.35)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="size-2 rounded-full bg-danger/70" />
                  <span className="size-2 rounded-full bg-yellow-400/70" />
                  <span className="size-2 rounded-full bg-success-bright/70" />
                </div>
                <span className="ml-2 font-mono text-[10px] text-ink-quaternary">
                  work.keya
                </span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-success-bright">
                  <ShieldCheck className="size-3" />
                  encrypted
                </span>
              </div>
              <div className="grid min-h-[310px] grid-cols-[145px_1fr] sm:grid-cols-[175px_1fr]">
                <div className="border-r border-line p-3">
                  <div className="mb-4 flex items-center gap-2 text-[10px] text-ink-quaternary">
                    <FolderSimple className="size-3.5" />
                    VAULTS
                  </div>
                  {['Overview', 'All keys', 'Expiring soon'].map((item, i) => (
                    <div
                      key={item}
                      className={`mb-1 rounded px-2.5 py-2 text-[11px] ${i === 1 ? 'bg-accent/15 text-accent-bright' : 'text-ink-quaternary'}`}
                    >
                      {item}
                    </div>
                  ))}
                  <div className="mt-6 border-t border-line pt-4 text-[10px] text-ink-quaternary">
                    WORKSPACE
                    <br />
                    <span className="mt-1 inline-block text-ink-tertiary">
                      4 providers · 12 keys
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-ink-quaternary">
                        WORK VAULT
                      </div>
                      <div className="mt-1 text-lg font-medium">All keys</div>
                    </div>
                    <div className="rounded border border-line bg-surface-3 p-2 text-accent-bright">
                      <Key className="size-4" />
                    </div>
                  </div>
                  <div className="mt-6 space-y-2">
                    {[
                      ['OpenAI', 'sk-prod••••••8F2A', 'Healthy'],
                      ['GitHub', 'ghp_••••••••91C', 'Healthy'],
                      ['Stripe', 'sk_live••••••3D7', 'Expires in 12d'],
                    ].map(([name, value, state]) => (
                      <div
                        key={name}
                        className="flex items-center gap-3 rounded-lg border border-line-subtle bg-surface-2 px-3 py-3"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-surface-4 text-xs font-semibold text-ink-secondary">
                          {name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-ink-primary">{name}</div>
                          <div className="truncate font-mono text-[10px] text-ink-quaternary">
                            {value}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] ${state === 'Healthy' ? 'text-success-bright' : 'text-yellow-400'}`}
                        >
                          {state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="why-keya"
          className="mx-auto max-w-6xl border-t border-line-subtle py-16 sm:py-20"
        >
          <div className="mb-9 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[.18em] text-accent-bright">
              Built for real workflows
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-heading sm:text-3xl">
              Less hunting. More shipping.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-tertiary">
              A focused tool for developers who are tired of scattered .env
              files, browser tabs, and credential dashboards they do not
              control.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 border-t border-line-subtle py-16 sm:py-20 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-xl border border-line bg-surface-2 p-6 sm:p-8">
            <Tray className="size-5 text-accent-bright" />
            <h2 className="mt-5 text-2xl font-medium tracking-heading">
              A simple path to safer keys.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-tertiary">
              Your storage provider handles sync. Keya handles the structure,
              encryption, and reminders.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/start' })}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent-bright hover:text-accent-hover"
            >
              Get started <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="grid gap-2">
            {workflowItems.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-lg border border-line-subtle bg-surface-1 px-4 py-4"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-xs text-accent-bright">
                  0{index + 1}
                </span>
                <span className="text-sm text-ink-secondary">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20 text-center sm:pb-28">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-6 py-12 sm:px-10">
            <Code className="mx-auto size-6 text-accent-bright" />
            <h2 className="mt-4 text-2xl font-medium tracking-heading sm:text-3xl">
              Make credentials boring again.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-tertiary">
              Start with one vault. Keep it local. Let Keya do the remembering.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/start' })}
              className="mt-7 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Create a vault <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line-subtle px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[11px] text-ink-quaternary">
            Keya · local-first API credential vault
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://coryso.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary hover:text-ink-tertiary"
            >
              Built by Coryso Studio
            </a>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-ink-quaternary hover:text-ink-tertiary"
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
    <article className="bg-canvas-deepest p-5 transition-colors hover:bg-surface-2">
      <div className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface-3">
        <Icon className="size-4 text-accent-bright" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-ink-primary">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-ink-quaternary">{caption}</p>
    </article>
  );
}
