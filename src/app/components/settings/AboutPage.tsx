import { CaretRight, Info } from '@phosphor-icons/react';

export function AboutPage() {
  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        About
      </h1>

      <div className="space-y-6">
        <section>
          <div className="rounded-lg border border-line bg-surface-2">
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Help Center
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Quick start, FAQ, and security
                </p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </a>
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
      </div>
    </>
  );
}
