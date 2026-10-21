/**
 * The three derived keys of the format (§7).
 *
 * Nothing here is stored in the file. `send_fingerprint` decides whether a
 * network request still has consent; `observation_binding` decides whether a
 * stored check result still describes the current configuration;
 * `container_fingerprint` is the device-local identity of a container.
 *
 * All three are asynchronous because they use WebCrypto.
 */

import { CONTAINER_PREFIX, OBS_PREFIX, SEND_PREFIX } from '../format/constants';
import type { ProbeAuth, StaticHeader } from '../payload/types';
import { canonicalizeHeaders } from '../payload/headers';
import { utf8Length } from '../payload/text';

const encoder = new TextEncoder();

export type EncodeField = readonly [name: string, ...parts: string[]];

/**
 * Length-prefixed field encoding. Each field is `name ":" (len ":" value)...`
 * terminated by a newline, so multi-valued fields (sorted static headers) need
 * no separator and nothing can be ambiguous.
 */
export function encodeFields(fields: readonly EncodeField[]): Uint8Array {
  let text = '';
  for (const [name, ...parts] of fields) {
    text += `${name}:`;
    for (const part of parts) {
      text += `${utf8Length(part)}:${part}`;
    }
    text += '\n';
  }
  return encoder.encode(text);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** Where the credential goes, independent of which secret it carries. */
export interface AuthShape {
  carrier: 'header' | 'query';
  /** Header name (lowercased) or query parameter name. */
  target: string;
  encoding: 'bearer' | 'basic' | 'raw';
}

export function describeAuth(auth: ProbeAuth): AuthShape {
  switch (auth.mode) {
    case 'bearer':
      return {
        carrier: 'header',
        target: 'authorization',
        encoding: 'bearer',
      };
    case 'basic':
      return { carrier: 'header', target: 'authorization', encoding: 'basic' };
    case 'header':
      return {
        carrier: 'header',
        target: auth.name.toLowerCase(),
        encoding: 'raw',
      };
    case 'query':
      return { carrier: 'query', target: auth.param, encoding: 'raw' };
  }
}

export interface SendInput {
  keyId: string;
  /** `resolved.href` of §9.1 — never a re-assembled URL. */
  resolvedHref: string;
  auth: ProbeAuth;
  headers: readonly StaticHeader[];
}

/**
 * Fields describing *what leaves the browser and to whom*, deliberately without
 * the secret: rotating a credential must not require re-approval.
 */
function sendFields(input: SendInput): EncodeField[] {
  const shape = describeAuth(input.auth);
  const fields: EncodeField[] = [
    ['key', input.keyId],
    ['url', input.resolvedHref],
    ['method', 'GET'],
    ['carrier', shape.carrier],
    ['target', shape.target],
    ['encoding', shape.encoding],
  ];
  for (const header of canonicalizeHeaders(input.headers)) {
    fields.push(['header', header.name.toLowerCase(), header.value]);
  }
  return fields;
}

export async function sendFingerprint(input: SendInput): Promise<string> {
  const bytes = concat(
    encoder.encode(`${SEND_PREFIX}\n`),
    encodeFields(sendFields(input))
  );
  return sha256Hex(bytes);
}

export interface ObservationInput extends SendInput {
  secret: string;
  /** Scoped interpreter version, e.g. `custom/1` or `preset:openai/1`. */
  interpreterId: string;
}

/**
 * Binds a check result to what was actually sent, including the secret and the
 * interpreter version, so rotation invalidates it without any write-side rule.
 */
export async function observationBinding(
  deviceKey: CryptoKey,
  input: ObservationInput
): Promise<string> {
  const fields: EncodeField[] = [
    ...sendFields(input),
    ['secret', input.secret],
    ['engine', input.interpreterId],
  ];
  const bytes = concat(encoder.encode(`${OBS_PREFIX}\n`), encodeFields(fields));
  const signature = await crypto.subtle.sign(
    'HMAC',
    deviceKey,
    bytes as BufferSource
  );
  return toHex(signature);
}

/**
 * Device-local identity of a container: a function of the salt only, so it
 * survives renaming and cloud conflict copies but changes with the password.
 */
export async function containerFingerprint(salt: Uint8Array): Promise<string> {
  return sha256Hex(concat(encoder.encode(CONTAINER_PREFIX), salt));
}

/**
 * Import a raw HMAC key. Non-extractable by default: `binding` values must not
 * be verifiable after the key is exported elsewhere.
 */
export function importDeviceKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}
