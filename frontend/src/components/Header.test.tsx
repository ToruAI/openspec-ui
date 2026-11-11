import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

// useTheme touches localStorage, which is not usable in this test environment.
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}));

describe('Header', () => {
  const baseProps = {
    currentView: 'kanban' as const,
    onViewChange: vi.fn(),
    sources: [],
    selectedSourceId: null,
    onSourceChange: vi.fn(),
  };

  it('shows the running version linking to the changelog', () => {
    render(<Header {...baseProps} version="0.2.0" changelogUrl="https://example.test/CHANGELOG.md" />);
    const badge = screen.getByText('v0.2.0');
    expect(badge.closest('a')).toHaveAttribute('href', 'https://example.test/CHANGELOG.md');
  });

  it('shows no badge until the version is known', () => {
    render(<Header {...baseProps} />);
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });
});
