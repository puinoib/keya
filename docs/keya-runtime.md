# `.keya` Runtime Rules

> Status: final. The second half of the spec in [keya-format.md](keya-format.md), which covers file bytes, the payload model, validation, fingerprints, versions and tests 16.1–16.3. This file covers **§8–§13 and §16.4–16.8**. Section numbers run continuously across both documents: `§3.5` and `§7.2` are in the format file.
>
> Shared premise: what lives in the file is an asset; what happens on a device is a decision (format file, appendix D).

## 8. Edit transactions (class B)

Every write runs through one transaction, which owns timestamps and dirty state. These rules hold while editing only; opening a file infers nothing and back-fills nothing.

| Edit | Required effect |
|---|---|
| `secret` | Normalize per §8.1, then store. A normalized empty value → **reject the edit** with "the credential cannot be empty". Do not let the write path reject it later as class A: the user would see "saving keeps failing" with no visible cause. Update `key.content_updated_at` and `vault.content_updated_at` |
| `endpoint` | Normalize and store; update both timestamps. Touch no device state: the new value recomputes the `binding`, so old observations simply stop matching (§10.1) |
| `provider_id`, or the `probe` of a referenced provider | Update both timestamps. Same reason: the `binding` comparison invalidates old observations, not the transaction |
| `name` / `description` / `group_id` | Update both timestamps |
| `expiry` | Update both timestamps |
| Archive / restore | Write `archived_at`; update both timestamps; **keep** that Key's observations |
| Delete a Key | Update `vault.content_updated_at`; clear the device's observations only **after the file write succeeds**. Done the other way round, one failed save discards the local knowledge that the file still contains that Key |
| Provider / group fields | Update `vault.content_updated_at`; neither type has timestamps of its own (§5.1) |
| Delete a referenced custom provider | **Refused**; re-point or delete the references first |
| Delete a group | Set references to `null`; update the affected Keys' `content_updated_at` and `vault.content_updated_at` |
| Any edit | Normalize per §8.1, then apply class A's **field rules**. On failure → reject the edit, change no state, mark nothing dirty. Class A is the last gate, not the first |
| An edit that changes nothing | No file write, no timestamp change, no dirty state |

### 8.1 Normalization

| Category | Rule | On failure |
|---|---|---|
| Single-line text: `vault.name`, `groups[].name`, `providers[].name`, `keys[].name`, `endpoint`, `default_endpoint`, `probe.target`, `auth.name`, `auth.param`, `probe.headers[].name`, `probe.headers[].value`, `keys[].secret`, `icon` | Trim leading and trailing ASCII whitespace (`U+0020`, `\t`, `\r`, `\n`) | Trimmed value violates its field rules (empty included) → **reject the edit** |
| Multi-line text: `keys[].description`, `providers[].description` | No trimming; leading indentation may be intentional | Length only |
| UUIDs, enums, numbers, times, structured URLs | Not applicable | Rejected by class A |

- **Trimming happens at input, and the user sees it.** Stripping a pasted newline from a token is right; for `secret` it is a silent edit of credential bytes. In `basic` mode the password in a `user:password` really can start or end with a space, and a PEM's trailing `\n` can be content. So the field says "leading and trailing whitespace removed" the moment it happens, instead of changing bytes at save time and surfacing as an authentication failure later.
- **The reader never normalizes.** It accepts only canonical form and treats edge whitespace as a class A failure, consistent with "no guessing, no repair". Whitespace in a file can only come from hand editing or a foreign writer.
- One `normalize()` serves every entry point: create, edit, programmatic edit, and a future import (I14). Only the first three exist today; no importer is built (§14 of [keya-format.md](keya-format.md)). Skip one and the same credential yields different bytes depending on the path, which `observation_binding` is built to notice.
- After normalizing, apply the **C0 check** (§6.2): any `U+0000`–`U+001F` other than `\t`, `\n`, `\r` → **reject the edit** with "contains invisible control characters". Same reasoning as an empty `secret`: fail at edit time, not on the write path.

**An unexecutable recipe is not an edit error.** When an edit to `endpoint`, `provider_id` or `providers[].probe` leaves the recipe in one of §10.3's non-executable states (with `probe !== null`), **save normally** and show the cause with a fix entry point in the same frame the edit completes. The file is legal — runtime capability is not file validity (§6.1) — so it cannot enter class A or block the write. It must not be buried by "saved" either, only to surface the next time the user clicks check.

Two design decisions worth stating:

1. **Inbox facts are computed, never stored.** Expiry and rejection decisions come from the payload, the current time and this device's observations. There is no decision record to keep in sync, so the same file yields the same Inbox on every device and no edit has to clean up device state. A fact clears when the user fixes it (a new date, a successful check) or archives the Key — that is the only way an item leaves the Inbox (§10.3).
2. **Secret rotation needs no extra field surgery.** Observation invalidation comes from the computed `observation_binding`; `send_fingerprint` excluding the secret is what keeps the two independent.

## 9. Probing (class C)

### 9.1 Target resolution

Given `Key.endpoint` and `Probe.target`:

1. "Absolute" has exactly one test: `new URL(target)` parses without a base. Then `resolved = new URL(target)` and `endpoint` is ignored, **`null` included**. Do not test with a regex like "starts with http": that sends `//other.example/x` and `https:models` down different branches in different implementations.
2. Otherwise `endpoint` must be non-null:
   - `base = new URL(endpoint)`; if `base.pathname` does not end in `/`, append one (`https://example.com/v1` → `https://example.com/v1/`);
   - `resolved = new URL(target, base)`, following WHATWG semantics.
3. Require `resolved.protocol ∈ {http:, https:}` and no `userinfo`. Otherwise the recipe is not executable, which says nothing about file validity.
4. Serialize as `resolved_url = resolved.href`. Fingerprints and bindings accept only this string: not `origin + pathname`, no trailing-slash stripping, no hand-rebuilt query. `href` percent-encodes non-ASCII and spaces, and class A already forbids fragments, so it is unique.
5. The credential is injected **after** the fingerprint is computed. For `auth.mode === 'query'`, append with `url.searchParams.set(param, secret)`, touching only the outgoing request and never `resolved_url`.

**An edge case to compute rather than intuit:** `new URL('https:models')` does not throw. For a special scheme with a missing authority, the rest becomes the host, giving `https://models/` with `host === 'models'`. It is an executable absolute target.

That is a real UX surface: a typo really does send a credential to `https://models/`, and single-label hosts resolve to intranet machines on some networks. It is not a vulnerability — the approval screen shows the resolved host — but do not try to block it with "looks like a domain" heuristics, which are unverifiable rules. Show the resolved host explicitly instead.

| endpoint | target | resolved |
|---|---|---|
| `https://example.com/v1` | `models` | `https://example.com/v1/models` |
| `https://example.com/v1` | `/models` | `https://example.com/models` |
| `https://example.com/v1` | `../models` | `https://example.com/models` |
| `https://example.com/v1` | `//other.example/x` | `https://other.example/x` (cross-origin) |
| `https://example.com/v1` | `https://other.example/x` | `https://other.example/x` (cross-origin) |
| `null` | `https://other.example/x` | `https://other.example/x` (executable) |
| `null` | `models` | not executable |

A null `endpoint` blocks relative targets only.

### 9.2 Request policy

| Item | Value |
|---|---|
| Method | `GET` only. The recipe has no `method` or `body`: arbitrary POST turns checking into calling |
| Static headers | Verbatim per §6.2. No template substitution, no variables, no user data beyond the credential |
| Preflight | Only non-safelisted headers trigger CORS preflight. `Authorization` and `x-api-key` always do; for static headers it depends on the name — `accept`, `accept-language`, `content-language` and the three safelisted `content-type` values do not. Use Fetch's CORS-safelisted list rather than a local one. A server that omits the header from `Access-Control-Allow-Headers` yields `network`, which is not a credential conclusion (§9.3); the copy must be able to say "the server may not allow this header" |
| Redirects | `redirect: 'error'`; follow nothing, including same-origin. A service that needs a hop gets its final address configured |
| Cookies | `credentials: 'omit'` |
| Cache | `cache: 'no-store'` |
| Referer | `referrerPolicy: 'no-referrer'` |
| Mode | `mode: 'cors'`, since the status code must be readable |
| Timeout | 10 s via `AbortController`, recorded as `timeout` |
| Response body | Unread by default; at most 64 KiB when semantics must be judged, and **never persisted** |
| Transport | `http:` targets need a confirmation before every request, and the prompt says they travel in clear text |

### 9.3 What an observation may claim

| Source | `kind` | Allowed outcomes |
|---|---|---|
| Custom recipe | `request` | `ok` (the request was accepted), `auth_failed`, `forbidden`, `rate_limited`, `server_error`, `failed`, `timeout`, `network` |
| Preset, implemented by the app and able to read provider semantics | `credential` | The same set, where `ok` means the credential was accepted |
| Presets that cannot be verified in a browser | no observation | Missing capability. The UI says so and **sends nothing** |

**2xx does not mean the credential is valid.** Only a preset checker with explicit authentication semantics may declare `credential/ok`; the generic executor tops out at `request/ok`.

`basic` is an encoding available to the generic executor (base64 of the secret's UTF-8 bytes in `Authorization`) and raises no conclusion level. Non-ASCII `user:password` is encoded as UTF-8; a server that reads Latin-1 simply cannot be expressed by this recipe and needs a preset or a manual test.

`network` covers CORS, DNS, TLS, offline and rejected redirects alike. The browser cannot separate them, so no speculative labels such as `blocked_by_browser` exist. Copy says "the request could not be completed" — never "invalid credential", never "CORS error".

Redirects deserve their own sentence: `redirect: 'error'` turns `301/302` into `network` and **loses the response, `Location` included**, so the app can neither follow nor report the hop. Copy may only offer the possibility: "the target may redirect; configure the final address as the target". `/v1/models` → `/v1/models/` is the most common 301, and without that hint users never work out why it always says "could not complete the request".

### 9.4 Presets and custom providers

- A preset's send policy is **data** (target, auth placement, static headers), and `send_fingerprint` comes from the resolved result. Any data change — adding `anthropic-version` to Anthropic, say — changes the request shape automatically, with no version bump.
- A preset's **interpretation semantics** (status code and response to `credential/ok`) carry a version scoped to that interpreter, folded into `observation_binding`: `custom/1`, `preset:<slug>/1`. Never one app-wide constant: that voids every observation on an unrelated release, the `tester_version` failure mode of §7.3 wearing a different hat.
- Bump that number only when interpretation changes. Send-policy changes travel through data into `send_fingerprint` and take effect by themselves.
- Custom providers only ever use the generic executor and can never produce `credential`.
- Slugs freeze at release. Preset checking may be added or removed with app versions; neither is authorization.
- **Preset data migrates from the existing implementation; it is not redesigned.** The current code holds experience the spec cannot replace: `UNSUPPORTED_PROVIDERS` (which providers cannot be verified in a browser, and why — AWS signatures, missing CORS headers), `TEST_ENDPOINTS` (which presets need a metadata endpoint: GitHub `/user`, Stripe `/v1/balance`, Stability `/v1/user/account`), the fact that `/models` is public across the OpenAI-compatible surface and only proves the request went through, and Azure's `api-version` constant. Carry these into the preset module as **data** rather than rediscovering them the hard way.
- **All 50 existing presets were compared between the old concatenation and §9.1's WHATWG resolution**, producing two data shapes that must change:
  1. `TEST_ENDPOINTS` values starting with `/` (`/key`, `/user`, `/v2/user`, `/v1/models`, `/v1/balance` …) meant "append after the endpoint" before, and are **root-relative** under §9.1. `openrouter` used to reach `https://openrouter.ai/api/v1/key` and now resolves to `https://openrouter.ai/key`, losing `/api/v1`. Migration must drop the leading `/` or use an absolute URL.
  2. `azure openai`'s `?api-version=…` belongs in `probe.target`'s query, which is exactly why §6.2 allows a query there. The current code appends it to the end of the URL, and the new model has nowhere else to put it.
- Evidence for the shape of all this: `anthropic` needs three headers (`x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`), which is why `probe.headers` exists and why a preset's send policy must be data. `google` uses `?key=` (`auth.mode: query`) while `azure openai` uses `?api-version=` (a constant target query, not a secret): two uses of a query that the implementation must keep apart.

## 10. Observations, authorization, Inbox facts

### 10.1 Observation records

```ts
interface Observation {
  observation_id: string;   // UUID, fresh per probe
  vault_id: string;
  key_id: string;
  binding: string;          // §7.2
  kind: 'credential' | 'request';
  outcome: 'ok' | 'auth_failed' | 'forbidden' | 'rate_limited'
         | 'server_error' | 'failed' | 'timeout' | 'network';
  detail_code: string | null;   // a controlled enum, never provider copy
  http_status: number | null;
  latency_ms: number | null;
  started_at: string;
  finished_at: string;          // drives staleness, not adoption order
}
```

`detail_code` is closed: only values derivable from the status code plus a known response shape (`scope_insufficient`, `plan_required`, `key_malformed`, `upstream_error`). Provider error text is never persisted — truncation is not redaction, and error text may echo a token prefix, an account name or a balance.

**Never persist** the full request, `Authorization`, a credential-bearing URL, a response body or provider copy. Copy across sessions is generated from `outcome` + `detail_code`. The logging, telemetry and clipboard bans of §2.4 belong to the same family of rules.

Adoption order, "the latest started wins":

1. At start, assign a `session_id` (random per unlock) and a session-monotonic `request_seq`, and capture `binding`.
2. On return, check in order: `session_id` is still current → the Key exists → it is not archived → `binding` matches. Any failure → **discard**, writing no cache and changing no UI.
3. For one Key accept only a `request_seq` greater than the adopted one; equal or lower is discarded. `finished_at` is not compared, so changing the system clock has no effect.
4. Across unlocks, results from an old `session_id` are discarded even if every identity field matches.
5. Keep the latest 10 per Key; delete them with the Key. Archiving keeps history but removes it from the Inbox.

Staleness: `finished_at` older than 30 days → the Key is offered a fresh check in the quiet device list. A mismatched `binding` → "not yet verified on this device", with the record kept so the UI can say the last check happened under a different configuration. Neither is an Inbox fact.

### 10.2 Network authorization

One kind of consent, and it never outlives the gesture that gave it.

| Kind | Form | Lifetime | Who may use it |
|---|---|---|---|
| **Single-use approval** | In-memory one-shot `{ fingerprint, session_id, key_id }`, never persisted | Consumed the moment the request goes out; a retry needs another click | Every probe and every usage query |

Rules:

- **No request without a single-use approval created by that same interaction (I7).**
- A probe or usage query produces **one** approval per gesture. The real recipient is shown before the request is built; the approval names that exact `fingerprint`, so a configuration change between the click and the send finds nothing to consume.
- An approval is not persisted and not replayable: one gesture, one `fetch()`, and any async retry needs another click. That is what reconciles "a click is an approval" with "every request needs prior authorization". The browser's CORS preflight counts as part of that `fetch()` and consumes nothing extra.
- `origin`, `path` and `vault_id` are display fields; matching uses `fingerprint` alone.
- **There is no standing permission.** A persisted grant used to let a daily sweep and an on-save check run unattended; both were removed with the settings page that switched them on, because nothing in the product needs to send without a click. Device storage therefore holds no network consent at all, and a copied file, a clone or a restored backup inherits none — there is none to inherit.
- **UI suggestion, not a format rule**: when editing static headers, hint "if this is a credential, move it to the authentication placement". A header value enters `send_fingerprint`, and a heuristic (warn when the value equals an existing `secret`) is optional convenience; class A cannot decide whether text is a secret, so this cannot become a validation rule.
- **Requests are per (key, URL).** Probing and usage are different URLs and `send_fingerprint` includes `resolved_url`, so one approval mathematically cannot cover both. Every request computes its own fingerprint and earns its own approval.
- **Usage and balance queries are preset-only.** The format has no `Provider.usage` (§17). Supporting them for custom providers later means adding that recipe and reusing this fingerprint mechanism.

### 10.3 Inbox facts, device verification, recipe states

The Inbox is a pure function of the payload, this device's observations, `now` and the device zone. Nothing is stored and nothing is announced; the sidebar count is the number of facts below, and it can reach zero.

| Fact | Trigger | Clears when |
|---|---|---|
| `expiry`, `phase: expired` | `expiry` set and past the expiry point (§5.3) | the date moves into the future, is cleared, or the Key is archived |
| `expiry`, `phase: due` | `expiry` set, ≤ 7 days away and not passed | same; a date past the window removes it immediately |
| `rejected` | the latest adopted observation under the current `binding` has `outcome ∈ {auth_failed, forbidden}` | a later check under the same `binding` succeeds, or the Key is archived |

- **One expiry fact per Key.** Phase, not rule, carries the difference; `days_left` is the calendar-day distance and goes negative once passed, so ordering and copy come from one number.
- **`rejected` excludes `rate_limited`, `server_error`, `failed`, `timeout` and `network`.** Those are not evidence about the credential (§9.3): they are shown on the Key as "could not verify" and never enter the Inbox. `request/ok` still does not prove validity.
- **Results match by `binding`.** A result recorded for an older secret or destination cannot ask for a decision about the current one.
- **A Key whose recipe cannot run produces no fact at all.** Nothing is reported as "failed" where no request could have been made.

**Priority.** `attentionPriority` is a pure function of the fact, two signals from the Key, and `now`:

| Fact | Base | Adjustments |
|---|---|---|
| `rejected` | 80 | +20 when the result is ≤ 7 days old |
| `expiry`, expired | 100 | + `min(10, |days_left|)` |
| `expiry`, due | 50 | +20 when ≤ 3 days away |

Both add +6 when the Key is grouped and +4 when its newest check succeeded. Ties fall back to the earliest expiry, then the newest rejection, then `key_id`, so the order is stable across devices. The order is an explicit judgement and must stay testable, never an artifact of insertion order.

**Device verification is not an Inbox fact.** For every Key whose recipe can run, the view exposes the newest observation under the current `binding`: `never_verified`, `days_since`, and `stale` (≥ 30 days). It appears as a quiet, collapsible list with "check all" — never as a sidebar count, never as a notification. It is expected to differ across devices: it says "this device has not asked lately", not "this credential is bad". `never_probed` and `probe_stale` are gone as rules because they were never facts the user could fix.

**Recipe states.** A Key's recipe sits in exactly one state, which decides whether the Inbox can report anything and what the Key says. "Not executable" is four states, not one: three are fixable by the user and one is not.

| State | Criterion | Inbox facts | Copy and entry point |
|---|---|---|---|
| **Not executable · no capability** | `probe === null`, or the preset is marked unverifiable in a browser | none | "This Provider does not support checking" / "This Provider cannot be verified in a browser" (§9.3). No edit entry point: the provider has no usable recipe |
| **Not executable · no address** | `probe !== null`, relative `target`, `Key.endpoint === null` | none | "**The recipe cannot run: this Key has no server address**"; fix: fill in `endpoint`, or make `target` absolute |
| **Not executable · bad target** | `probe !== null`, an absolute `target` that will not parse, a non-http(s) result, or `userinfo` | none | "**The recipe cannot run: the target address is invalid**"; fix: edit `target` |
| **Not executable · unknown preset** | `provider_id = preset:<slug>` the current version does not know | none | "**This version does not recognize this Provider**"; fix: update the app, or re-point to a custom provider |
| **Manual only** | executable, `resolved_url` is `http:` | expiry, rejected | "Plain http — approved one request at a time": the clear-text warning, shown before the click |
| **Checkable** | executable, `https:` | expiry, rejected | No standing warning: a check needs a click, and the prompt names the recipient |

Measured occupancy over the 41 presets: 38 auto-capable, 3 with no capability (`amazon bedrock`, `exa`, `typesafe`), 0 manual only. So "manual only" is reachable today only through a custom provider or a hand-typed `http:` endpoint, while "bad target" and "unknown preset" depend on the app version and cannot occur with the current preset table.

**A plaintext destination is a property, not a fact.** No consent is stored for any destination (§10.2), so the only standing statement a Key can make is the one about its own transport: an `http:` target shows that its requests travel in clear text, and the Inbox stays silent. Judging by the resolved request rather than `endpoint` alone is still required: `probe.target` may be an absolute `http:` URL while `endpoint` is `null` or `https:`, and the credential still leaves in the clear.

**"No address" and "bad target" are not "no capability."** Both arise from entirely legal edits — give a custom provider `target: "models"`, then create a Key without an `endpoint` — and the file passes class A while §8 happily saves. Calling them "this Provider does not support checking" produces a self-contradictory screen.

**No stored decisions.** Earlier revisions kept device-local dismissal records bound to a fact fingerprint (`condition` / `binding`). They are gone, for three reasons:

1. A decision that exists on one device makes the same file show different lists elsewhere, and every re-review on a second device is invisible.
2. A fact that is expected and permanent — an intranet `http:` destination — must not live in a todo list at all. It is a property of the Key, shown on the Key.
3. "I no longer care about this Key" already has an expression: `archived_at`.

Removing them also removes the whole class of revocation bugs: no record can be orphaned, replayed, or revived by reverting a value, because there is no record. The cost is deliberate and must be stated in copy: **the Inbox cannot be muted; it can only be fixed.**

## 11. Device-local state
## 11. Device-local state

Everything is namespaced by `vault_id` or `container_fingerprint`. Before unlock only `containers` is read.

| Data | Location | Key | Lifetime | Sensitive |
|---|---|---|---|---|
| Device key | IndexedDB `device` | singleton | Lost when site data is cleared | non-extractable HMAC `CryptoKey` |
| Container registrations | IndexedDB `containers` | `container_fingerprint` (§13.1) | Overwritten; after a password change write the new row and delete the old (§12.5) | name, icon, counts, timestamps only |
| Observations | IndexedDB `observations` | `observation_id`, indexed by `vault_id,key_id` | 10 per Key | structured, with an irreversible `binding` |
| Biometrics | IndexedDB `biometrics` | `container_fingerprint` | Deleted on unbind | a PRF-wrapped `file_key` |
| Preferences | `localStorage` | — | never expire | no: auto-lock, theme, filters, selection |
| Usage snapshots | `sessionStorage` | `vault_id + key_id` | current for 15 min, dropped after 24 h, cleared with the tab | quota numbers |

"Not in `.keya`" is not "safe to store in the clear". All of the above must be described in copy as data that clearing browser storage would destroy. The file owes them nothing.

Because none of this is in the file, it can also be dropped without touching the file. The app offers one per-vault action that deletes the vault's observations, its cached allowance snapshots and its biometric binding — everything above except the device key, preferences and the container registration. It is a device cleanup, not a delete: the file stays byte-identical and nothing is sent.

**Container fingerprint**, computable before unlock and the stable primary key for local state:

```
container_fingerprint = hexLowerCase(SHA-256("keya/container/1" ‖ salt))
```

It covers `salt` alone. The 16 random bytes are already unique and do not change with `version` — a version upgrade must not invalidate every registration. It survives renames and moves. A password change alters `salt`, so the app rewrites both records under the new fingerprint in the same transaction (new row first, old rows deleted after, §12.5), knowing `vault.id` by then. A hostile file can copy someone else's `salt` to force a fingerprint match, but the only outcome is a failed AEAD after PRF unwrapping — a safe failure.

Its boundaries, stated because this will otherwise be misread:

- `salt` is public (it is in the preamble), so anyone with the file can compute the fingerprint;
- it is therefore not a secret, not authentication, and not copy protection;
- its one job is **device-state indexing**: keeping the locked view and biometric binding valid across renames and moves;
- copying the file to another device leaves no row there, which is exactly the intent.

## 12. Saving, locking, password change

### 12.1 The write queue

- Exactly one queue. Each task takes **the current payload snapshot and the current container generation at execution time** and never enqueues a snapshot that may have gone stale. Coalescing follows: any number of pending changes produce one write.
- Edits enqueue after a 500 ms debounce. An edit arriving during a write only sets dirty and is enqueued once more when that write finishes.
- `flushSave()` cancels the debounce, enqueues one write and waits until not dirty, with bounded retries (at most 5).
- Dirty state has one source: the edit transaction of §8. Unlocking, browsing, crossing midnight, viewing the Inbox, probing, usage queries, preference changes and UI state changes never set it.
- Edits that change nothing do not write (compare business state, not bytes; the ciphertext differs every time).
- **State the cost plainly**: one AEAD message means every save rewrites the whole file — re-read to compute the digest (§12.2), re-encrypt, write back. A 26 MB vault costs about **52 MB of local IO per save**, and cloud clients usually re-upload the blob. This is deliberate: chunking brings back fragment consistency, revision numbers and partial writes, all of which conflict with the format's goals. Practical advice: raise the debounce for large vaults (2 s, say), and treat sync storms as a known cost rather than a bug.

### 12.2 Digest check

- On a successful open, record the SHA-256 of the whole file in memory.
- Before every write, inside `navigator.locks.request('keya-vault-writes')`, re-read the file and compare digests. On mismatch → refuse the write, keep the edits and the error, and offer the export paths.
- Update the digest after a successful write.
- This is not a distributed lock and provides no atomicity; it detects "something changed after I opened it".
- It also stops a tab running an older build from writing its stale payload over a newer file.

### 12.3 Durability

- From edit to disk: at most 500 ms plus one write round trip.
- Flush on `visibilitychange → hidden`; best effort on `pagehide`, where async writes may not finish.
- A crash loses at most the edits inside the last debounce window. **A failed save must be visible and must not discard the edits**, and both the encrypted and plaintext exports must be offered.
- Debounce should be inversely related to file size; rewriting a 26 MB vault every 500 ms saturates local disk and sync bandwidth. That is a known product cost, not an implementation detail.
- `createWritable()` → `write()` → `close()` is the only commit point. No fsync promise. A `.bak` before writing is an app choice and not part of the format.

### 12.4 Locking

1. `flushSave()`.
2. Failure → **cancel the lock**, stay unlocked, show the error. In-memory edits outrank locking. Automatic and manual locking follow the same path with the same semantics.
3. Success → abort every in-flight network request (probes, usage queries) with `AbortController.abort()`. Late results would be discarded anyway on a stale `session_id` (§10.1), but aborting matters: otherwise credentials keep going out after the user asked to stop.
4. Drop references to the plaintext payload, `file_key`, and this session's observations and usage display. No claim about erasing JS heap copies.
5. The password is not dropped here; it was dropped right after unlock (§3.3, I16). Locking drops `file_key` and the plaintext. A lock that still had a password to drop means the password outlived the whole session, which is an I16 violation.

### 12.5 Password change

| Stage | State |
|---|---|
| 1 | Derive the new `file_key` from the new `salt` in a Worker; the old key is still active |
| 2 | `flushSave()` writes all pending edits with the **old** container |
| 3 | Rewrite the whole file with the new container (new `salt`, new `nonce`); payload and `content_updated_at` unchanged |
| 4 | Write succeeded → switch the active generation; write the container registration under the **new** fingerprint |
| 5 | Wrap the **new** `file_key` with PRF and write the biometric record under the new fingerprint; on failure, write no row, unbind biometrics, require the password next time |
| 6 | Delete the two old-fingerprint rows |

- Edits made during stages 1–3 land in stage 3's snapshot, taken at execution time.
- If stage 3 fails, discard the derived new `file_key`.
- **Stages 4–6 are three local writes, not a migration**: `put` registration, wrap and `put` biometrics, `delete` the old rows. The order is forced — the biometric record *is* the wrapped `file_key`, so until stage 5 there is nothing to write — and write-before-delete means a failure mid-way leaves an extra row instead of losing the only one. Both operations are idempotent, so no migration state machine and no dual-fingerprint lookup.
- **No step rolls back a file already written** (that would revert the new password) and no step may break unlocking. Two residues are acceptable:
  - **Crash before stage 4**: the new fingerprint has no row → the next open misses it → the "unknown file" path of §13.1 registers it once. The cost is the biometric binding, which must be redone.
  - **New row written, old rows not deleted**: an orphan registration points at a fingerprint that will never recur. It is harmless. Optional cleanup: compute fingerprints from the 54-byte preamble of every `.keya` in the workspace and delete rows that are absent from that set and had an old `last_opened_at`. Do **not** delete by "not in the current directory", because a cloud directory may be unmounted.
- That is the price of deriving the fingerprint from `salt`, which buys keeping one registration across conflict copies and renames. It is written down rather than hidden in the code.
- **The old password is required** (I16): re-derive with the old password and the current `salt`, then compare with the current `file_key` in constant time. Never compare against a cached password as strings. A failed check follows the merging principle of §3.5 with no extra distinction. Biometric users must type the old password too; the UI says so and uses the moment to remind them that the password still exists and cannot be recovered. The new password follows §3.3.2.
- **Tell the user** that old copies in the cloud or in backups still open with the old password.
- Download mode: stage 3 means "a file using the new password was produced", not "disk updated". Mark the export complete only when the download finishes, and say that the old file in the current directory still uses the old password.

### 12.6 Multiple tabs

Unlocking the same file in two tabs is **not supported**: serialized writes plus the digest check make the later writer fail with an export prompt. That is not a bug, and it belongs in the copy. The KDF is serialized with `navigator.locks.request('keya-kdf')`; writes use `keya-vault-writes`.

## 13. Locked state and biometrics

### 13.1 Locked display

The file has no public vault identifier, so the locked view depends entirely on the device's `containers` table keyed by `container_fingerprint` (§11): a hit shows the registered name, icon, Key count and last-opened time; a miss shows "unknown file" and asks for one password unlock to register it.

Renaming or moving the file does not invalidate the registration, since the fingerprint depends only on `salt`. If the post-unlock `vault.id` differs from the registered one — the file was swapped — update the registration with the real value and say "this file used to be a different vault".

### 13.2 Biometric unlock

- WebAuthn PRF is mandatory. Browsers or authenticators without PRF **fall back to the password** and must never degrade to a stored AES key.
- The wrapped object is **`file_key`**, so the blast radius is one vault.
- The wrapping key derives from the PRF output, and the record's AAD contains **only `container_fingerprint`** (the only value available before unlock), so a record cannot be moved to another container. The record also stores `vault_id`, checked against the decrypted payload; a mismatch invalidates the record, deletes the binding and falls back to the password.
- The record lives on the device, keyed by `container_fingerprint`. A password change rewrites it at stage 4 and re-wraps at stage 5 with the new `file_key`; failure at either point unbinds and notifies.
- A lost PRF output or record means falling back to the password. There is no second unlock path.

## 16. Test checklist (16.4–16.8)

> 16.1–16.3 are in [keya-format.md](keya-format.md) §16.

### 16.4 Fingerprints and authorization

42. Rotate `secret` → `send_fingerprint` unchanged, `observation_binding` changes.
43. Change `endpoint` → both change.
44. Change `target` without changing the resolution → neither changes.
45. Change `target` and the resolution → both change.
46. Copy a Key (new id) → `send_fingerprint` changes, so the copy carries no authorization.
47. ~~Merge import~~ **Unbuilt path** (§14.2 of keya-format.md): no importer exists, so there is nothing to assert.
48. ~~Import with the same `vault.id`~~ Same as 47.
49. `http:` target → a single-use approval every time, and the prompt names the clear-text transport.
50. Static headers: add, remove, change value, rename → `send_fingerprint` changes; reordering only → unchanged.
51. Changing a static header also changes `observation_binding` (not just `send_fingerprint`): one case each for add, remove, value change, asserting the old observation immediately reads as "not yet checked on this device".
52. `basic` golden vector: fixed `secret` containing `:` → assert the fingerprint and the base64 request header.
53. Compare every frozen vector of appendix C: A/B/C/D, `container_fingerprint`, both `observation_binding` values, and C's negative vector. A single drift in `container_fingerprint` invalidates every vault's locked display and biometric binding at once, so it ranks with `send_fingerprint`.
54. Clone → the two files' `salt` and `container_fingerprint` differ; `containers` holds two rows; binding one does not affect the other, proving nothing did "copy the container, change `vault.id`".
55. Cloning keeps `keys[].id`, so `send_fingerprint` is unchanged. Authorization is unaffected because none is stored: a clone sends nothing until someone clicks.
56. Export two encrypted copies of one vault → identical `container_fingerprint` (same vault, shared registration and biometrics) but different `nonce` and ciphertext; a clone differs. The counterpart of the previous item.
57. `resolved_url` golden vectors: one per row of the §9.1 table, plus `https:models` → **`https://models/`** and `//other.example/x`. Also assert the serialized form is `href`: `https://Example.COM:443/v1/../v1/models` → `https://example.com/v1/models`, lowercased, default port dropped, `..` normalized — not origin+pathname and no trailing-slash stripping.
58. Interpreter scoping: bumping the `custom` interpreter version changes custom providers' `observation_binding` but not `send_fingerprint`; bumping `preset:x` leaves `preset:y`'s observations alone.
59. No stored consent: nothing in `localStorage` or IndexedDB names a destination, and unlocking never sends anything on its own.
60. Keys with `http:` targets show "manual checks only (plaintext transport)"; every other checkable key shows no standing authorization warning.
61. Single-use approval: one gesture sends one request and a second is refused; the approval never appears in storage; it dies on lock.

### 16.5 Observations and privacy

62. Persisted records contain no raw URL, request headers, response body or provider copy.
63. After a refresh, rejected copy is generated entirely from `outcome` + `detail_code`.
64. A mismatched `binding` → UI says "not yet verified on this device", and the Key is neither rejected nor listed in the Inbox.
65. Clearing site data discards observations with no error.
66. Out-of-order concurrent returns → the larger `request_seq` wins; system clock changes do not matter.
67. Lock and unlock → late results from the previous session are discarded.
68. A custom recipe receiving 2xx → `request/ok` only, never `credential/ok`, `basic` mode included.
69. `timeout` and `network` copy never says "invalid credential" or "CORS error"; a static header whose preflight the server rejects is also `network`, with copy hinting the server may not allow that header.
70. Archive → no Inbox facts, history kept. Delete → observations cleared.
71. `probe: null` → no Inbox fact and no device row; copy is "this Provider does not support checking".
72. **Fixable and unfixable stay apart**: `probe !== null`, `endpoint === null`, relative `target` → no Inbox fact and no device row, copy says "the recipe cannot run: this Key has no server address", not "does not support checking". Filling in `endpoint` flips it to auto-capable with "needs re-authorization".
73. Two Keys under one custom provider, one with an `endpoint` and one without → different copy, so a Key-level problem is never described as a provider-level one.
74. `provider_id = preset:<unknown slug>` → "this version does not recognize this Provider", no Inbox fact, no "needs re-authorization".
75. An absolute `target` resolving to `ftp:`, or containing `userinfo` → "the target address is invalid", no Inbox fact.

### 16.6 Save discipline and lifecycle

76. Unlocking, browsing, crossing midnight, viewing the Inbox, probing and usage queries leave the digest unchanged.
77. ~~Plaintext JSON import above 32 MiB~~ **Unbuilt path** (§14.3): no importer, no size gate to test.
78. No-op edits (same name; a `secret` with added edge spaces) write nothing.
79. A failed save leaves the edits in memory with both exports available.
80. An externally modified file → the write is refused and an export is offered.
81. A failed password change → later saves use the old key and the file still opens.
82. After a successful change: the new fingerprint's row exists, the old one is gone, and the vault occupies one row.
83. **Stage 3 succeeds, stage 4 fails**: the file already opens with the new password; the next open misses the fingerprint and registers it as an unknown file once, losing the biometric binding (accepted); repeating put/delete is idempotent.
84. **No password survives unlock**: the session object holds no password or equivalent, and later saves and biometric re-wrapping complete given only `file_key`. A password change requires the old password and **must verify by re-deriving**; assert there is no code path comparing it against a cached copy as strings.
85. **Clone requires the password again**: cloning while unlocked prompts for it, and afterwards the session still holds no password or equivalent (the I16 assertion). A future "save a plaintext import as a new vault" would owe the same assertion.
86. Password policy for creation and change: 11 code points or zxcvbn score 2 → **reject** (not warn); 12 code points with score 3 → accept; four CJK characters (12 bytes, 4 code points) → **reject**; a non-ASCII-majority password under 16 code points → reject.
87. A password that is not well-formed UTF-16 → **reject**; and assert `"\uD800"` and `"\uFFFD"` cannot derive the same `file_key`.
88. Download mode: the UI separates "new-password file generated" from "disk updated".
89. Auto-lock hitting a save failure cancels the lock and shows the error.
90. Locking aborts in-flight requests: `AbortController` fires and a late response writes nothing and changes no UI.
91. `visibilitychange → hidden` flushes.
92. Two tabs unlocking at once → the later writer fails with a message instead of overwriting silently.

### 16.7 Inbox facts

93. Rejection → success → rejection shows again: the fact comes from the newest observation under the current `binding`, not from a stored decision.
94. **Nothing to revoke**: clearing `expiry`, moving it past the 7-day window, or archiving the Key removes the fact immediately; moving the date back re-derives it from the file, so the list is identical on every device.
95. An expired Key and a due Key never both appear; `phase` is the difference, and `days_left` orders the list.
96. `auth_failed` and `forbidden` are Inbox facts; `rate_limited`, `server_error`, `failed`, `timeout` and `network` are not — they show as "could not verify" on the Key.
97. A result recorded under an older `binding` is not a rejection; that Key is `never_verified` on this device and produces no Inbox fact.
98. `probe: null` and every non-executable recipe produce no Inbox fact and no device row, so "never verified" can never be a permanent complaint.
99. **Time-zone semantics of the `date` kind**: with `expiry = {kind:'date', value:'2026-03-01'}` and `now = 2026-03-01T20:00:00.000Z`, zone `Pacific/Kiritimati` (UTC+14, expiry point `03-01T10:00Z`) → expired; zone `Etc/GMT+12` (UTC−12, expiry point `03-02T12:00Z`) → not expired. Opposite verdicts for one `now` are the expected behavior. Under the same two zones an `instant` expiry gives the **same** verdict, proving it is device-independent.
100. Neither an expiry nor a rejection fact writes the file, consistent with the unchanged-digest assertion of §16.6.
101. **Priority is deterministic**: the same fact, signals and `now` produce the same score and the same order in two processes; a soon-expiring grouped Key outranks an ungrouped one with the same date.
102. **A plaintext destination is a property**: an intranet `http:` Key shows a standing warning on the Key and produces no Inbox fact, before and after a successful check.
103. **Cross-device equality**: two devices with the same file, the same `now` and the same zone produce byte-identical Inbox fact lists; only the device verification list may differ.

### 16.8 Locked state and biometrics

101. Renaming the file keeps the locked display and the biometric binding valid.
102. Replacing the file with another vault's file under the same name → AEAD fails after biometric unwrapping, the app falls back to the password, and no silent error appears.
103. An environment without PRF → password unlock only, and no "stored key" record is ever written.

---
