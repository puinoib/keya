import { describe, expect, it } from 'vitest';
import { makeProvider } from '../../../core/__tests__/fixtures';
import { draftToProvider, providerToDraft } from '../providers';

describe('provider drafts', () => {
  it('round-trips the description instead of erasing it', () => {
    const provider = makeProvider();
    const saved = draftToProvider(providerToDraft(provider), provider.id);

    expect(saved.description).toBe(provider.description);
    expect(saved.probe).toEqual(provider.probe);
  });
});
