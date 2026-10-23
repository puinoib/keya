import { Link } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Fingerprint,
  FolderSimple,
  GithubLogo,
  Key,
  LockSimple,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react';
import { KeyaLogo } from '@/components/ui/keya-logo';
import './landing.css';

const navItems = [
  { href: '#why-keya', label: 'Why Keya' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

const heroProof = ['Free & MIT licensed', 'Argon2id + XChaCha20', 'No account'];

const specRows = [
  ['Container', '.keya · v2'],
  ['Key derivation', 'Argon2id · 64 MiB · 10 passes'],
  ['Cipher', 'XChaCha20-Poly1305'],
  ['Preamble', '54 bytes · public'],
  ['Storage', 'A folder you choose'],
  ['Sync', 'Your storage provider'],
  ['Export', '.keya · JSON (plaintext)'],
  ['License', 'MIT'],
];

const comparisonRows = [
  ['Where keys live', "A vendor's servers", 'A folder you choose'],
  ['Account', 'Required', 'None'],
  ['Backend', 'A vendor service', 'None'],
  ['Sync', "The vendor's cloud", 'Your cloud drive'],
  ['Export', 'Whatever they allow', '.keya or JSON'],
  ['Source', 'Closed', 'MIT, on GitHub'],
];

const faqs = [
  {
    question: 'Do I need an account?',
    answer:
      'No. Keya is a static web app with no account system and no backend. There is nothing to sign up for, and no Keya service holding your data.',
  },
  {
    question: 'Where do my keys live?',
    answer:
      'In .keya files inside a folder you choose. Each file is a complete, encrypted vault. The browser also keeps device-local metadata — the folder handle, vault names, check results, approvals and preferences — but never a plaintext copy of your secrets.',
  },
  {
    question: 'Can I put the folder in iCloud, Dropbox, or Drive?',
    answer:
      'Yes. Keya does not run its own sync. Your storage provider moves the files. Use one device at a time per vault and keep versioned backups: a cloud drive is not a distributed lock.',
  },
  {
    question: 'What happens if I forget my master password?',
    answer:
      'There is no recovery service and no reset link. The password derives the file key, and it is discarded once that key exists. Keep the password in a password manager you trust.',
  },
  {
    question: 'Is Keya independently audited?',
    answer:
      'No. The encryption is real and the format is documented, but this project has not been independently audited. Local encryption protects the file, not an unlocked app on a compromised browser or device.',
  },
  {
    question: 'Can I export my data?',
    answer:
      "Yes. You can write an encrypted .keya copy or a plaintext JSON export. The JSON file is a secret, and deleting it is the only protection it has. There is no importer: to use a vault elsewhere, copy the .keya file into that device's folder and open it with its password.",
  },
];

export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      <a className="kl-skip" href="#main">
        Skip to content
      </a>

      <header className="kl-nav">
        <div className="kl-wrap kl-nav-inner">
          <Link to="/home" className="kl-brand" aria-label="Keya home">
            <KeyaLogo className="kl-brand-mark" />
            <span>Keya</span>
          </Link>

          <nav className="kl-nav-links" aria-label="Main navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="kl-nav-actions">
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="kl-nav-icon"
              aria-label="View Keya on GitHub"
            >
              <GithubLogo className="size-[17px]" />
            </a>
            <Link to="/start" className="kl-button kl-button-nav">
              Open Keya
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="kl-hero" aria-labelledby="hero-title">
          <div className="kl-stage">
            <div className="kl-mesh" aria-hidden="true">
              <span className="kl-blob kl-blob-a" />
              <span className="kl-blob kl-blob-b" />
              <span className="kl-blob kl-blob-c" />
              <span className="kl-blob kl-blob-d" />
              <span className="kl-blob kl-blob-e" />
              <span className="kl-veil" />
            </div>
            <div className="kl-grain" aria-hidden="true" />
            <div className="kl-grid" aria-hidden="true" />

            <span className="kl-reg kl-reg-tl" aria-hidden="true" />
            <span className="kl-reg kl-reg-tr" aria-hidden="true" />

            <div className="kl-wrap kl-hero-inner">
              <div className="kl-hero-copy">
                <p className="kl-kicker">
                  <span className="kl-live-dot" aria-hidden="true" />
                  keya.one · local-first credentials
                </p>
                <h1 id="hero-title">
                  Keep every key
                  <span>close to home.</span>
                </h1>
                <p className="kl-lede">
                  A quiet, encrypted home for the API keys and tokens your work
                  depends on. No account. No backend. Just a folder you own.
                </p>
                <div className="kl-cta-row">
                  <Link to="/start" className="kl-button kl-button-primary">
                    Create your first vault
                    <ArrowUpRight className="size-4" />
                  </Link>
                  <a href="#why-keya" className="kl-button kl-button-outline">
                    See how it works
                    <ArrowDown className="size-4" />
                  </a>
                </div>
                <ul className="kl-proof" aria-label="Keya at a glance">
                  {heroProof.map((item) => (
                    <li key={item}>
                      <Check className="size-3.5" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="kl-hero-object" aria-hidden="true">
                <div className="kl-orbit">
                  <span className="kl-orbit-ring" />
                  <span className="kl-orbit-ring kl-orbit-ring-2" />
                  <span className="kl-orbit-node kl-orbit-node-a" />
                  <span className="kl-orbit-node kl-orbit-node-b" />
                  <span className="kl-orbit-caption">KEYA / VAULT 01</span>
                </div>
                <div className="kl-keycard">
                  <span className="kl-keycard-hole" />
                  <div className="kl-keycard-head">
                    <span className="kl-keycard-brand">
                      <KeyaLogo className="kl-keycard-mark" />
                      KEYA
                    </span>
                    <span className="kl-keycard-state">
                      <LockSimple className="size-3" />
                      sealed
                    </span>
                  </div>
                  <div className="kl-keycard-body">
                    <p className="kl-keycard-file">work.keya</p>
                    <p className="kl-keycard-meta">12 credentials · 4 groups</p>
                  </div>
                  <Fingerprint
                    className="kl-keycard-print"
                    weight="thin"
                    aria-hidden="true"
                  />
                  <div className="kl-keycard-foot">
                    <span>LOCAL / V2</span>
                    <span>ARGON2ID</span>
                  </div>
                </div>
                <p className="kl-object-caption">
                  FIG. 01 — A vault, not an account.
                </p>
              </div>
            </div>

            <div className="kl-wordmark" aria-hidden="true">
              Keya
            </div>
          </div>

          <div className="kl-hero-caption">
            <span>FIG. 01 — LOCAL-FIRST CREDENTIAL VAULT</span>
            <span className="kl-hero-caption-mid">
              ARGON2ID · XCHACHA20-POLY1305
            </span>
            <a href="#why-keya">
              Scroll to read
              <ArrowDown className="size-3" />
            </a>
          </div>
        </section>

        <section id="why-keya" className="kl-section kl-thesis">
          <div className="kl-wrap">
            <div className="kl-construct" aria-hidden="true">
              <span className="kl-reg kl-reg-left" />
              <span className="kl-reg kl-reg-right" />
            </div>
            <div className="kl-thesis-grid">
              <p className="kl-label">01 — What it is</p>
              <div>
                <h2>
                  Most tools put your keys behind an account. Keya puts them in{' '}
                  <span className="kl-inline-pill">
                    <FolderSimple className="size-[.55em]" aria-hidden="true" />
                    one folder
                  </span>{' '}
                  you own.
                </h2>
                <p className="kl-thesis-copy">
                  A local-first vault for the API keys and tokens your work
                  depends on — AI, payments, cloud, scraping, or your own
                  internal APIs. Encrypted on disk, organized by context, and
                  ready to sync with the drive you already trust.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="kl-section kl-features"
          aria-labelledby="features-title"
        >
          <div className="kl-wrap">
            <h2 id="features-title" className="sr-only">
              What is inside Keya
            </h2>
            <div className="kl-bento">
              <article className="kl-card kl-card-dark kl-card-vault kl-span-2x2">
                <span className="kl-tag">Vaults</span>
                <h3>
                  One folder.
                  <br />
                  Every context.
                </h3>
                <p>
                  Work, personal, client — each .keya is a complete vault, not a
                  row in someone else&apos;s database.
                </p>
                <div className="kl-mini">
                  <div className="kl-mini-head">
                    <span>
                      <FolderSimple className="size-3.5" />
                      workspace
                    </span>
                    <span>3 vaults</span>
                  </div>
                  <div className="kl-mini-body">
                    <div className="kl-mini-side">
                      <span className="kl-mini-label">Vaults</span>
                      <span className="kl-mini-file is-active">
                        <Key className="size-3" />
                        work.keya
                        <em>12</em>
                      </span>
                      <span className="kl-mini-file">
                        personal.keya
                        <em>8</em>
                      </span>
                      <span className="kl-mini-file">
                        client.keya
                        <em>5</em>
                      </span>
                      <span className="kl-mini-label kl-mini-label-bottom">
                        Local only
                      </span>
                    </div>
                    <div className="kl-mini-main">
                      <div className="kl-mini-main-head">
                        <span>All keys</span>
                        <span>12</span>
                      </div>
                      <div className="kl-mini-key is-active">
                        <span className="kl-status-dot is-ok" />
                        <span className="kl-mini-key-text">
                          <b>OpenAI</b>
                          <small>Production · sk-prod••••8F2A</small>
                        </span>
                        <span className="kl-mini-key-state">healthy</span>
                      </div>
                      <div className="kl-mini-key">
                        <span className="kl-status-dot is-warn" />
                        <span className="kl-mini-key-text">
                          <b>Stripe</b>
                          <small>Billing · sk_live••••3D7</small>
                        </span>
                        <span className="kl-mini-key-state is-warn">12d</span>
                      </div>
                      <div className="kl-mini-key">
                        <span className="kl-status-dot is-ok" />
                        <span className="kl-mini-key-text">
                          <b>GitHub</b>
                          <small>Personal · ghp_••••91C</small>
                        </span>
                        <span className="kl-mini-key-state">healthy</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="kl-card kl-card-image kl-card-sealed">
                <span className="kl-tag">At rest</span>
                <LockSimple
                  className="kl-card-glyph"
                  weight="thin"
                  aria-hidden="true"
                />
                <h3>Sealed before disk.</h3>
                <p>Secrets are encrypted before a single byte is written.</p>
              </article>

              <article className="kl-card kl-card-dotted kl-card-crypto">
                <span className="kl-tag">Crypto</span>
                <div className="kl-card-number">256</div>
                <h3>XChaCha20-Poly1305</h3>
                <p>One authenticated message. Argon2id derives the key.</p>
              </article>

              <article className="kl-card kl-card-check">
                <span className="kl-tag">Checks</span>
                <h3>Checks that show their work.</h3>
                <div className="kl-check-line">
                  <span className="kl-method">GET</span>
                  <span className="kl-endpoint">api.openai.com/v1/models</span>
                  <span className="kl-code-ok">200</span>
                </div>
                <p>The exact destination is shown before anything is sent.</p>
              </article>

              <article className="kl-card kl-card-inbox">
                <span className="kl-tag">Inbox</span>
                <h3>A memory for expiries.</h3>
                <ul className="kl-alert-list">
                  <li>
                    <WarningCircle
                      className="size-3.5 is-warn"
                      weight="fill"
                      aria-hidden="true"
                    />
                    Stripe · expires in 12 days
                  </li>
                  <li>
                    <WarningCircle
                      className="size-3.5 is-danger"
                      weight="fill"
                      aria-hidden="true"
                    />
                    GitHub · credential rejected
                  </li>
                </ul>
                <p>Expired keys and rejected credentials, ranked by urgency.</p>
              </article>

              <article className="kl-card kl-card-image kl-card-presets kl-span-2">
                <span className="kl-tag">Presets</span>
                <h3>For the APIs you actually use.</h3>
                <ul className="kl-chips" aria-label="Example provider presets">
                  {[
                    'OpenAI',
                    'Anthropic',
                    'GitHub',
                    'Stripe',
                    'Vercel',
                    'Exa',
                    'Firecrawl',
                    'Cloudflare',
                  ].map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                  <li className="kl-chip-custom">+ any custom API</li>
                </ul>
              </article>

              <article className="kl-card kl-card-zero">
                <span className="kl-tag">No account</span>
                <div className="kl-card-number">0</div>
                <h3>Accounts to create.</h3>
                <p>No sign-up, no backend, no service to shut down.</p>
              </article>

              <a
                className="kl-card kl-card-dark kl-card-link"
                href="https://github.com/puinoib/keya"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="kl-tag">Open source</span>
                <GithubLogo
                  className="kl-card-glyph"
                  weight="thin"
                  aria-hidden="true"
                />
                <h3>MIT, in the open.</h3>
                <span className="kl-code-line">
                  <span className="kl-code-url">github.com/puinoib/keya</span>
                  <ArrowUpRight className="size-3.5" />
                </span>
                <p>Read the source, file an issue, or run it yourself.</p>
              </a>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="kl-section kl-sheet-wrap"
          aria-labelledby="sheet-title"
        >
          <div className="kl-wrap">
            <div className="kl-sheet">
              <span className="kl-reg kl-reg-sheet-tl" aria-hidden="true" />
              <span className="kl-reg kl-reg-sheet-tr" aria-hidden="true" />
              <span className="kl-reg kl-reg-sheet-bl" aria-hidden="true" />
              <span className="kl-reg kl-reg-sheet-br" aria-hidden="true" />

              <div className="kl-sheet-bar">
                <span>KEYA.ONE / LOCAL VAULT</span>
                <span>02 — Under the hood</span>
                <span>FIELD NOTES · V0.1</span>
              </div>

              <div className="kl-sheet-body">
                <div className="kl-sheet-left">
                  <div className="kl-sheet-head">
                    <p className="kl-label">Your workspace</p>
                    <h2 id="sheet-title">
                      One folder.
                      <br />
                      Zero accounts.
                    </h2>
                    <p>
                      Choose a folder you already trust. Every{' '}
                      <code>.keya</code> file inside it is a complete vault. The
                      browser reads and writes files directly; there is no Keya
                      server in between.
                    </p>
                  </div>
                  <div className="kl-cells">
                    <div>
                      <span className="kl-label">Key derivation</span>
                      <b>Argon2id</b>
                      <p>64 MiB, 10 passes by default.</p>
                    </div>
                    <div>
                      <span className="kl-label">Cipher</span>
                      <b>XChaCha20</b>
                      <p>Poly1305 authenticated encryption.</p>
                    </div>
                    <div>
                      <span className="kl-label">Storage</span>
                      <b>Your folder</b>
                      <p>File System Access API.</p>
                    </div>
                    <div>
                      <span className="kl-label">Sync</span>
                      <b>Your drive</b>
                      <p>iCloud, Dropbox, Drive — or none.</p>
                    </div>
                  </div>
                </div>

                <div
                  className="kl-anatomy"
                  role="img"
                  aria-label="A .keya file is a public 54-byte preamble followed by one encrypted AEAD message. Plaintext is never written to disk."
                >
                  <div className="kl-anatomy-top">
                    <span>FIG. 02 / FILE ANATOMY</span>
                    <span>.KEYA · V2</span>
                  </div>

                  <div className="kl-folder-strip" aria-hidden="true">
                    <span className="kl-folder-chip">
                      <FolderSimple className="size-3.5" />
                      your-folder/
                    </span>
                    <span className="kl-file-chip">work.keya</span>
                    <span className="kl-file-chip">personal.keya</span>
                    <span className="kl-file-chip">client.keya</span>
                  </div>

                  <div className="kl-file-card" aria-hidden="true">
                    <div className="kl-file-card-head">
                      <span>
                        <LockSimple className="size-3.5" />
                        work.keya
                      </span>
                      <span className="kl-file-state">sealed</span>
                    </div>
                    <div className="kl-byte-block is-public">
                      <div className="kl-byte-head">
                        <span>PREAMBLE</span>
                        <span>54 B</span>
                      </div>
                      <div className="kl-byte-bar">
                        <i style={{ width: '11%' }} />
                        <i style={{ width: '6%' }} />
                        <i style={{ width: '8%' }} />
                        <i style={{ width: '18%' }} />
                      </div>
                      <p>magic · version · KDF · salt · nonce</p>
                    </div>
                    <div className="kl-byte-block is-sealed">
                      <div className="kl-byte-head">
                        <span>CIPHERTEXT</span>
                        <span>ONE AEAD MESSAGE</span>
                      </div>
                      <div className="kl-byte-dots" aria-hidden="true">
                        {Array.from({ length: 72 }).map((_, index) => (
                          <i key={index} />
                        ))}
                      </div>
                      <p>keys · groups · providers · endpoints · expiry</p>
                    </div>
                    <div className="kl-file-card-foot">
                      <ShieldCheck className="size-3.5" />
                      plaintext is never written to disk
                    </div>
                  </div>

                  <div className="kl-anatomy-notes" aria-hidden="true">
                    <p>
                      <b>01</b> Salt and nonce are public. The password is not.
                    </p>
                    <p>
                      <b>02</b> The password derives the file key, then it is
                      discarded.
                    </p>
                    <p>
                      <b>03</b> A changed or truncated byte fails
                      authentication.
                    </p>
                  </div>
                </div>
              </div>

              <div className="kl-sheet-foot">
                <div className="kl-spec-wrap">
                  <table className="kl-spec">
                    <thead>
                      <tr>
                        <th scope="col">Spec</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specRows.map(([label, value]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="kl-code-wrap">
                  <pre className="kl-code">
                    <code>
                      <span className="kl-code-comment">
                        # a folder, not an account
                      </span>
                      {'\n'}your-folder/{'\n'}
                      <span className="kl-code-tree">├──</span> work.keya
                      {'      '}
                      <span className="kl-code-comment">
                        # 12 keys · 4 groups
                      </span>
                      {'\n'}
                      <span className="kl-code-tree">├──</span> personal.keya
                      {'  '}
                      <span className="kl-code-comment"># 8 keys</span>
                      {'\n'}
                      <span className="kl-code-tree">└──</span> client.keya
                      {'    '}
                      <span className="kl-code-comment"># 5 keys</span>
                      {'\n\n'}
                      <span className="kl-code-comment">
                        # every file opens with
                      </span>
                      {'\n'}argon2id → xchacha20-poly1305
                    </code>
                  </pre>
                  <div className="kl-code-foot">
                    <span>NO KEYA SERVER</span>
                    <span>YOUR FOLDER · YOUR DRIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="security"
          className="kl-section kl-ledger"
          aria-labelledby="security-title"
        >
          <div className="kl-wrap">
            <div className="kl-ledger-head">
              <div>
                <p className="kl-label">03 — The trade-off</p>
                <h2 id="security-title">
                  Local by default.
                  <br />
                  <em>Careful by design.</em>
                </h2>
              </div>
              <p className="kl-ledger-intro">
                Keya is not a cloud service with a local mode. It is a file
                format, a browser, and a folder you choose. That changes what
                you have to trust — and what you have to protect.
              </p>
            </div>

            <div className="kl-compare-wrap">
              <table className="kl-compare">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Attribute</span>
                    </th>
                    <th scope="col">The usual way</th>
                    <th scope="col">Keya</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(([label, usual, keya]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{usual}</td>
                      <td className="kl-compare-keya">
                        <Check className="size-3.5" aria-hidden="true" />
                        {keya}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kl-caveats">
              <article className="kl-caveat kl-caveat-dark">
                <span className="kl-label">No recovery</span>
                <p>
                  There is no reset link. Your master password is the only way
                  into a vault, so keep it somewhere safe.
                </p>
              </article>
              <article className="kl-caveat">
                <span className="kl-label">No force field</span>
                <p>
                  Encryption protects the file, not an unlocked app on a
                  compromised browser or device. Keya has not been independently
                  audited.
                </p>
              </article>
              <article className="kl-caveat">
                <span className="kl-label">One writer</span>
                <p>
                  A cloud folder is not a distributed lock. Use one device at a
                  time per vault, and keep versioned backups.
                </p>
              </article>
            </div>

            <div className="kl-ledger-actions">
              <a href="/docs/security" className="kl-text-link">
                Read the security notes
                <ArrowUpRight className="size-3.5" />
              </a>
              <a
                href="https://github.com/puinoib/keya"
                target="_blank"
                rel="noopener noreferrer"
                className="kl-text-link"
              >
                Inspect the source
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="kl-section kl-faq"
          aria-labelledby="faq-title"
        >
          <div className="kl-wrap kl-faq-grid">
            <div>
              <p className="kl-label">04 — Questions</p>
              <h2 id="faq-title">Questions.</h2>
              <p className="kl-faq-support">
                Found a bug or want to ask something else?{' '}
                <a
                  href="https://github.com/puinoib/keya/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open an issue
                </a>
                .
              </p>
            </div>
            <div className="kl-faq-list">
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0}>
                  <summary>{faq.question}</summary>
                  <div className="kl-faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="kl-footer">
        <div className="kl-footer-card">
          <div className="kl-footer-top">
            <div className="kl-footer-cta">
              <p className="kl-label">Ready when you are</p>
              <h2>
                Give every key
                <br />a quieter home.
              </h2>
              <p className="kl-footer-note">
                No account. No backend. Just a folder you control.
              </p>
              <Link to="/start" className="kl-button kl-button-primary">
                Create your first vault
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            <nav aria-label="Product">
              <h3>Product</h3>
              <a href="/start">Open Keya</a>
              <a href="/docs">Docs</a>
              <a href="/docs/quick-start">Quick start</a>
              <a href="#security">Security</a>
            </nav>

            <nav aria-label="Project">
              <h3>Project</h3>
              <a
                href="https://github.com/puinoib/keya"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://github.com/puinoib/keya/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                Issues
              </a>
              <a
                href="https://github.com/puinoib/keya/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT license
              </a>
              <a
                href="https://coryso.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Coryso Studio
              </a>
            </nav>
          </div>

          <div className="kl-footer-word" aria-hidden="true">
            Keya
          </div>

          <div className="kl-footer-legal">
            <span>© {year} Keya · MIT licensed</span>
            <span>keya.one · local-first, by design.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
