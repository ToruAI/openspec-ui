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
    expect(labels).toEqual(['Research', 'Proposalnext', 'Implementation plan']);
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
    expect(specs).toHaveTextContent('Specsskipped');
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

  it('renders a custom schema chain and task progress', () => {
    render(<ChangeCard change={change} onClick={vi.fn()} />);
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 tasks')).toBeInTheDocument();
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });
});
