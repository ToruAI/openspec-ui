import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArtifactChain } from './ArtifactChain';
import { ChangeCard } from './ChangeCard';
import type { Artifact, Change } from '../types';

const artifact = (id: string, status: Artifact['status'], missingDeps: string[] = []): Artifact => ({
  id,
  outputPath: `${id}.md`,
  status,
  requires: missingDeps,
  missingDeps,
});

describe('ArtifactChain', () => {
  it('renders the chain in the order the backend sends it, including custom artifacts', () => {
    const { container } = render(
      <ArtifactChain
        artifacts={[
          artifact('research', 'done'),
          artifact('proposal', 'ready'),
          artifact('implementation-plan', 'blocked', ['proposal']),
        ]}
      />
    );
    const labels = [...container.querySelectorAll('[data-status]')].map((el) => el.textContent);
    // Status is spelled out for screen readers, not only shown by colour and icon.
    expect(labels).toEqual(['Research, written', 'Proposalnext', 'Implementation plan, waiting']);
    expect(screen.getByTitle('Waiting for proposal')).toBeInTheDocument();
  });

  it('marks only the first ready artifact as next, like `openspec status`', () => {
    render(
      <ArtifactChain
        artifacts={[artifact('proposal', 'done'), artifact('specs', 'ready'), artifact('design', 'ready')]}
      />
    );
    expect(screen.getAllByText('next')).toHaveLength(1);
    expect(screen.getByText('Specs').parentElement).toHaveTextContent('next');
  });

  it('shows skipped artifacts as skipped, not as missing', () => {
    const { container } = render(
      <ArtifactChain artifacts={[artifact('proposal', 'done'), artifact('specs', 'skipped'), artifact('tasks', 'ready')]} />
    );
    const specs = container.querySelector('[data-status="skipped"]');
    expect(specs).toHaveTextContent('Specs, skipped');
    expect(specs).toHaveAttribute('title', expect.stringContaining('skip_specs'));
  });

  it('replaces the chain with the reason when OpenSpec cannot read the change', () => {
    const { container } = render(
      <ArtifactChain artifacts={[]} error="Unknown schema 'nope'. Available: spec-driven" />
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Unknown schema 'nope'");
    expect(container.querySelectorAll('[data-status]')).toHaveLength(0);
  });
});

describe('ChangeCard', () => {
  const change: Change = {
    id: 'repo/add-login',
    name: 'add-login',
    sourceId: 'repo',
    status: 'in_progress',
    hasProposal: false,
    hasSpecs: false,
    hasTasks: true,
    hasDesign: false,
    taskStats: { done: 2, total: 3 },
    schema: 'research-first',
    artifacts: [artifact('research', 'done'), artifact('tasks', 'done')],
    isPlanningComplete: true,
    applyRequires: ['tasks'],
    error: null,
    warnings: [],
  };

  it('shows task progress and leaves out a chain that is fully written', () => {
    render(<ChangeCard change={change} onClick={vi.fn()} />);
    expect(screen.getByText('2/3 tasks')).toBeInTheDocument();
    expect(screen.queryByText('Research')).not.toBeInTheDocument();
  });

  it('keeps the chain on a card whose planning is not finished', () => {
    render(
      <ChangeCard
        change={{ ...change, isPlanningComplete: false, artifacts: [artifact('research', 'ready'), artifact('tasks', 'done')] }}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });

  it('leads with the summary and opens from a real button', async () => {
    const onClick = vi.fn();
    render(<ChangeCard change={{ ...change, summary: 'Let people sign in.' }} onClick={onClick} repo={{ name: 'web', color: 'bg-teal-500' }} />);
    expect(screen.getByText('Let people sign in.')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    screen.getByRole('button', { name: 'add-login' }).click();
    expect(onClick).toHaveBeenCalled();
  });

  it('drops the date prefix from an archived change and shows it as the archive date', () => {
    render(<ChangeCard change={{ ...change, name: '2026-08-12-add-login', status: 'archived' }} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'add-login' })).toBeInTheDocument();
    expect(screen.getByText('Archived 2026-08-12')).toBeInTheDocument();
  });
});
