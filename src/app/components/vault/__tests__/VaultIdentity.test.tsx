/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VaultIdentity } from '../VaultIdentity';

describe('VaultIdentity', () => {
  it('hides a file name that only repeats the name plus .keya', () => {
    render(<VaultIdentity name="vault-1" fileName="vault-1.keya" />);
    expect(screen.queryByText('vault-1.keya')).toBeNull();
  });

  it('shows the file name for a named vault', () => {
    render(<VaultIdentity name="Work" fileName="vault-1.keya" />);
    expect(screen.getByText('vault-1.keya')).toBeTruthy();
  });

  it('keeps the file line when the caller asks for a fixed layout', () => {
    render(
      <VaultIdentity name="vault-1" fileName="vault-1.keya" fileLine="always" />
    );
    expect(screen.getByText('vault-1.keya')).toBeTruthy();
  });

  it('renders the footnote below the file line', () => {
    render(
      <VaultIdentity
        name="Work"
        fileName="vault-1.keya"
        fileLine="always"
        footnote="in KeyaDB"
      />
    );
    expect(screen.getByText('vault-1.keya')).toBeTruthy();
    expect(screen.getByText('in KeyaDB')).toBeTruthy();
  });
});
