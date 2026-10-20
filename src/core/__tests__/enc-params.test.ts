import { describe, expect, it } from 'vitest';
import { parseEncParams } from '../schema';

function makeParams(
  options: {
    ops?: number;
    mem?: number;
    saltLength?: number;
    nonceLength?: number;
  } = {}
): Uint8Array {
  const {
    ops = 10,
    mem = 64 * 1024 * 1024,
    saltLength = 16,
    nonceLength = 24,
  } = options;
  const buf = new Uint8Array(96);
  const dv = new DataView(buf.buffer);
  let offset = 0;

  dv.setUint16(offset, 0x0001, true);
  offset += 2;
  dv.setUint32(offset, ops, true);
  offset += 4;
  dv.setUint32(offset, mem, true);
  offset += 4;
  dv.setUint16(offset, saltLength, true);
  offset += 2;
  offset += saltLength;
  dv.setUint16(offset, nonceLength, true);
  offset += 2;
  offset += nonceLength;
  dv.setUint16(offset, 0x0001, true);

  return buf;
}

describe('parseEncParams bounds', () => {
  it('accepts the current defaults', () => {
    const params = parseEncParams(makeParams());
    expect(params.ops).toBe(10);
    expect(params.mem).toBe(64 * 1024 * 1024);
  });

  it('rejects excessive Argon2id cost from an untrusted file', () => {
    expect(() => parseEncParams(makeParams({ ops: 1000 }))).toThrow(
      /operations limit/
    );
    expect(() =>
      parseEncParams(makeParams({ mem: 1024 * 1024 * 1024 }))
    ).toThrow(/memory limit/);
  });

  it('rejects unexpected salt and nonce lengths', () => {
    expect(() => parseEncParams(makeParams({ saltLength: 8 }))).toThrow(
      /salt length/
    );
    expect(() => parseEncParams(makeParams({ nonceLength: 8 }))).toThrow(
      /nonce length/
    );
  });
});
