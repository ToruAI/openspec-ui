import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Change, ChangeDetail } from '../types';

const detail: ChangeDetail = {
  id: 'repo/research-split',
  name: 'research-split',
  sourceId: 'repo',
  status: 'in_progress',
  proposal: null,
  design: null,
  specs: [],
  tasks: { raw: '- [x] api\n- [ ] db', stats: { done: 1, total: 2 } },
  schema: 'research-first',
  artifacts: [],
  isPlanningComplete: false,
  error: null,
  warnings: [],
  documents: [
    { artifactId: 'research', files: [{ path: 'research.md', content: '# Findings' }] },
    { artifactId: 'tasks', files: [{ path: 'tasks/backend.md', content: '- [x] api\n- [ ] db' }] },
  ],
};

vi.mock('../hooks/useApi', () => ({
  useChange: () => ({ change: detail, loading: false, error: null }),
}));
vi.mock('../hooks/useMediaQuery', () => ({ useIsMobile: () => false }));

const { DetailModal } = await import('./DetailModal');

describe('DetailModal', () => {
  const change: Change = {
    id: 'repo/research-split',
    name: 'research-split',
    sourceId: 'repo',
    status: 'in_progress',
    hasProposal: false,
    hasSpecs: false,
    hasTasks: true,
    hasDesign: false,
    taskStats: { done: 1, total: 2 },
    schema: 'research-first',
    artifacts: [
      { id: 'research', outputPath: 'research.md', status: 'done', requires: [], missingDeps: [] },
      { id: 'proposal', outputPath: 'proposal.md', status: 'ready', requires: ['research'], missingDeps: [] },
      { id: 'tasks', outputPath: 'tasks/*.md', status: 'done', requires: ['research'], missingDeps: [] },
    ],
    isPlanningComplete: false,
    applyRequires: ['tasks'],
    error: null,
    warnings: [],
  };

  it('shows one tab per artifact in chain order, written or not, and the schema', () => {
    render(<DetailModal change={change} onClose={vi.fn()} />);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Research', 'Proposalnext', 'Tasks']);
    expect(screen.getByText('research-first')).toBeInTheDocument();
  });

  it('renders tasks as a checklist rather than raw [x] markers', () => {
    render(<DetailModal change={change} onClose={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Tasks/ }));
    expect(screen.getByText('Done:')).toBeInTheDocument();
    expect(screen.queryByText(/\[x\]/)).not.toBeInTheDocument();
  });

  it('says what an artifact that is not written yet is waiting for', () => {
    render(
      <DetailModal
        change={{
          ...change,
          artifacts: [
            ...change.artifacts,
            { id: 'plan', outputPath: 'plan.md', status: 'blocked', requires: ['proposal'], missingDeps: ['proposal'] },
          ],
        }}
        onClose={vi.fn()}
      />
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Proposal/ }));
    expect(screen.getByText(/next artifact to write/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Plan/ }));
    expect(screen.getByText(/waits for proposal/)).toBeInTheDocument();
  });

  it('shows the files an artifact wrote, wherever its schema puts them', () => {
    detail.documents = [{ artifactId: 'design', files: [{ path: 'design/api.md', content: '# API' }] }];
    render(
      <DetailModal
        change={{
          ...change,
          artifacts: [{ id: 'design', outputPath: 'design/*.md', status: 'done', requires: [], missingDeps: [] }],
        }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Design']);
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('shows the error instead of the chain when OpenSpec cannot read the change', () => {
    render(<DetailModal change={{ ...change, artifacts: [], error: 'Invalid .openspec.yaml: schema is required' }} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('schema is required');
  });
});
