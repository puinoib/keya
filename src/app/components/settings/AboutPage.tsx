import { CaretRight, Info } from '@phosphor-icons/react';

const LINKS = [
  {
    href: '/docs',
    title: 'Help Center',
    description: 'Quick start, FAQ, and backup',
  },
  {
    href: '/docs/security',
    title: 'Security & Privacy',
    description:
      'What is encrypted, what leaves this device, and what the browser cannot protect',
  },
  {
    href: '/home',
    title: 'Product Homepage',
    description: 'Secure local storage for developer API keys and tokens',
  },
  {
    href: 'https://github.com/puinoib/keya',
    title: 'Source Code',
    description: 'The app, the file format, and the runtime rules',
  },
];

export function AboutPage() {
  return (
    <div className="space-y-6">
      <section>
        <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  {link.title}
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  {link.description}
                </p>
              </div>
              <CaretRight className="size-3.5 shrink-0 text-ink-quaternary" />
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Info className="size-3.5 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-secondary">
            Application
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
          <div className="flex items-center justify-between p-3">
            <p className="text-xs text-ink-secondary">Version</p>
            <p className="text-xs text-ink-quaternary">{__APP_VERSION__}</p>
          </div>
          <div className="flex items-center justify-between p-3">
            <p className="text-xs text-ink-secondary">License</p>
            <a
              href="https://opensource.org/licenses/MIT"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              MIT
            </a>
          </div>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-ink-quaternary">
        Keya has no account system and no application backend. The deployed site
        loads Cloudflare Web Analytics, which is injected at the edge and can be
        switched off in the Cloudflare dashboard; see Security &amp; Privacy.
      </p>
    </div>
  );
}
