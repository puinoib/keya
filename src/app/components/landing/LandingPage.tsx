import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  ClockCountdown,
  Code,
  Copy,
  DotsThree,
  FileLock,
  FolderOpen,
  FolderSimple,
  GithubLogo,
  Key,
  List,
  MagnifyingGlass,
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
import { useUi } from '@/app/store/ui-store';

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
  const { theme, setTheme } = useUi();
  const CurrentIcon =
    themeOptions.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <div className="relative h-full overflow-y-auto bg-canvas-deepest text-ink-primary">
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
            <div className="flex items-center gap-2 text-xs text-ink-tertiary">
              <span className="size-1.5 rounded-full bg-success-bright" />
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
            <div className="hidden" />
            <div className="relative overflow-hidden rounded-xl border border-line bg-canvas-panel">
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
              <div className="grid min-h-[330px] grid-cols-[135px_1fr] sm:grid-cols-[165px_1fr]">
                <div className="border-r border-line bg-canvas-deepest/30 p-2.5">
                  <div className="mb-3 flex items-center gap-2 px-2 text-[9px] font-medium uppercase tracking-wider text-ink-quaternary">
                    <FolderOpen className="size-3" />
                    Groups
                  </div>
                  <div className="mb-1 flex items-center gap-2 rounded-md bg-accent/20 px-2 py-1.5 text-[10px] text-accent-bright">
                    <List className="size-3" />
                    All Keys <span className="ml-auto text-[9px]">12</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] text-ink-quaternary">
                    <Tray className="size-3" />
                    Inbox{' '}
                    <span className="ml-auto rounded bg-yellow-400/15 px-1 text-[9px] text-yellow-400">
                      2
                    </span>
                  </div>
                  <div className="mt-4 pt-3 text-[9px] text-ink-quaternary">
                    Groups
                  </div>
                  {['Ungrouped', 'Production', 'Personal'].map((item) => (
                    <div
                      key={item}
                      className="mt-1 flex items-center gap-2 px-2 py-1 text-[10px] text-ink-tertiary"
                    >
                      <span className="size-1.5 rounded-full bg-ink-quaternary/40" />
                      {item}
                    </div>
                  ))}
                  <div className="mt-5 pt-3 text-[9px] text-ink-quaternary">
                    WORK.keya
                    <br />
                    <span className="text-ink-tertiary">
                      12 keys · 4 groups
                    </span>
                  </div>
                </div>
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-ink-quaternary">
                        <Key className="size-3" />
                        Keys
                      </div>
                      <div className="mt-1 text-base font-medium">
                        All Keys{' '}
                        <span className="text-xs font-normal text-ink-quaternary">
                          12
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Search keys"
                      className="rounded border border-line bg-surface-3 p-1.5 text-ink-quaternary"
                    >
                      <MagnifyingGlass className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 flex gap-1.5">
                    <span className="rounded border border-line bg-surface-3 px-2 py-1 text-[9px] text-ink-tertiary">
                      All Providers
                    </span>
                    <span className="rounded border border-line bg-surface-3 px-2 py-1 text-[9px] text-ink-tertiary">
                      All Results
                    </span>
                    <span className="hidden rounded border border-line bg-surface-3 px-2 py-1 text-[9px] text-ink-tertiary sm:inline">
                      All Expiry
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {[
                      ['OpenAI', 'sk-prod••••••8F2A', 'success'],
                      ['GitHub', 'ghp_••••••••91C', 'success'],
                      ['Stripe', 'sk_live••••••3D7', 'expiring'],
                    ].map(([name, value, state]) => (
                      <div
                        key={name}
                        className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2.5 ${name === 'OpenAI' ? 'border-line-2 bg-surface-4' : 'border-transparent'}`}
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${state === 'success' ? 'bg-success-bright' : 'bg-yellow-400'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-ink-primary">
                            {name}
                            <span className="ml-1.5 font-normal text-ink-quaternary">
                              ·{' '}
                              {name === 'Stripe' ? 'Expiring Soon' : 'Healthy'}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-quaternary">
                            <span>{name}</span>
                            <span>·</span>
                            <span className="truncate font-mono">{value}</span>
                          </div>
                        </div>
                        <div className="hidden items-center gap-1 text-ink-quaternary sm:flex">
                          <Copy className="size-3" />
                          <DotsThree className="size-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="why-keya" className="mx-auto max-w-6xl py-16 sm:py-20">
          <div className="mb-9 max-w-xl">
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

        <section className="mx-auto grid max-w-6xl gap-5 py-16 sm:py-20 lg:grid-cols-[.9fr_1.1fr]">
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
          <div className="border-y border-line-subtle px-6 py-12 sm:px-10">
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
