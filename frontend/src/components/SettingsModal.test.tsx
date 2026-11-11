import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ConfigResponse } from '../hooks/useApi';

const getConfig = vi.fn<() => Promise<ConfigResponse>>();
vi.mock('../hooks/useApi', () => ({
  getConfig: () => getConfig(),
  updateSources: vi.fn(),
}));

const { SettingsModal } = await import('./SettingsModal');

const config = (extra: Partial<ConfigResponse>): ConfigResponse => ({
  sources: [{ name: 'api', path: '/code/api/openspec' }],
  port: 3000,
  mode: 'discovered',
  configPath: null,
  roots: ['/code'],
  persistent: false,
  ...extra,
});

describe('SettingsModal', () => {
  beforeEach(() => getConfig.mockReset());

  it('lets a browser on this machine edit the sources', async () => {
    getConfig.mockResolvedValue(config({ sourcesEditable: true }));
    render(<SettingsModal open onOpenChange={() => {}} />);
    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(screen.getByLabelText('Path')).not.toBeDisabled();
  });

  it('is read-only on another device, and says where to change sources', async () => {
    getConfig.mockResolvedValue(config({ sourcesEditable: false }));
    render(<SettingsModal open onOpenChange={() => {}} />);
    expect(await screen.findByText(/only in a browser on the computer openspec-ui runs on/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Path')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });

  it('treats an older server without the flag as editable', async () => {
    getConfig.mockResolvedValue(config({}));
    render(<SettingsModal open onOpenChange={() => {}} />);
    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(screen.getByLabelText('Path')).not.toBeDisabled();
  });
});
