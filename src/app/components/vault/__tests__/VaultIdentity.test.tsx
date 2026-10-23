/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VaultIdentity } from '../VaultIdentity';

describe('VaultIdentity', () => {
  it('shows the file name only when it adds information', () => {
    render(<VaultIdentity name="vault-1" fileName="vault-1.keya" />);
    expect(screen.queryByText('vault-1.keya')).toBeNull();
  });

  it('shows the file name for a named vault', () => {
    render(<VaultIdentity name="Work" fileName="vault-1.keya" />);
    expect(screen.getByText('vault-1.keya')).toBeTruthy();
  });

  it('renders the badge and footnote beside the name', () => {
    render(
      <VaultIdentity
        name="Work"
        badge={<span>Unlocked</span>}
        footnote="in Keya"
      />
    );
    expect(screen.getByText('Unlocked')).toBeTruthy();
    expect(screen.getByText('in Keya')).toBeTruthy();
  });
});
