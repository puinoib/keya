import { describe, expect, it, vi } from 'vitest';
import { makeProvider } from '../../../core/__tests__/fixtures';
import { ApiTester } from '../api-tester';

describe('draft checks', () => {
  it('asks for the resolved destination before sending a draft secret', async () => {
    const provider = makeProvider();
    const confirm = vi.fn(async () => false);

    const result = await ApiTester.testDraft({
      providerId: provider.id,
      endpoint: 'https://edge.example.com/v1',
      secret: 'sk-synthetic-draft',
      providers: [provider],
      confirmDestination: confirm,
    });

    expect(confirm).toHaveBeenCalledWith('https://edge.example.com/v1/models');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Destination approval was declined.');
  });
});
