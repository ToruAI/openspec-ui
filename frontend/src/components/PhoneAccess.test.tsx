import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PhoneAccess } from './PhoneAccess';

describe('PhoneAccess', () => {
  it('gives the address to open when the server listens on the network', () => {
    render(<PhoneAccess lanUrl="http://192.168.1.20:3000" host="0.0.0.0" port={3000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open on your phone' }));
    expect(screen.getByText('http://192.168.1.20:3000')).toBeInTheDocument();
  });

  it('says how to reach the board from a phone when it only answers locally', () => {
    render(<PhoneAccess lanUrl={null} host="127.0.0.1" port={3000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open on your phone' }));
    expect(screen.getByText('openspec-ui --host 0.0.0.0')).toBeInTheDocument();
  });
});
