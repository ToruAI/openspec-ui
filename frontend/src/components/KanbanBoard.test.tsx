import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Change, Idea, Source } from '../types';

let mobile = true;
vi.mock('../hooks/useMediaQuery', () => ({ useIsMobile: () => mobile }));

const { KanbanBoard } = await import('./KanbanBoard');

describe('KanbanBoard', () => {
  const mockChanges: Change[] = [
    {
      id: '1',
      name: 'Test Change',
      sourceId: 'test-source',
      status: 'todo',
      taskStats: { done: 0, total: 5 },
      hasProposal: true,
      hasSpecs: true,
      hasTasks: true,
      hasDesign: false,
      schema: 'spec-driven',
      artifacts: [
        { id: 'proposal', outputPath: 'proposal.md', status: 'done', requires: [], missingDeps: [] },
        { id: 'specs', outputPath: 'specs/**/*.md', status: 'done', requires: ['proposal'], missingDeps: [] },
        { id: 'design', outputPath: 'design.md', status: 'ready', requires: ['proposal'], missingDeps: [] },
        { id: 'tasks', outputPath: 'tasks.md', status: 'done', requires: ['specs', 'design'], missingDeps: [] },
      ],
      isPlanningComplete: false,
      applyRequires: ['tasks'],
      error: null,
      warnings: [],
    },
  ];

  const mockIdeas: Idea[] = [
    {
      id: '1',
      title: 'Test Idea',
      description: 'Test description',
      sourceId: 'test-source',
      projectId: 'test-project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSources: Source[] = [
    {
      id: 'test-source',
      name: 'Test Source',
      path: '/test/path',
      valid: true,
    },
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <KanbanBoard
        changes={mockChanges}
        ideas={mockIdeas}
        sources={mockSources}
        onCardClick={vi.fn()}
        onIdeaClick={vi.fn()}
        selectedSourceId={null}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays loading state when loading is true', () => {
    render(
      <KanbanBoard
        changes={[]}
        ideas={[]}
        sources={mockSources}
        loading={true}
        onCardClick={vi.fn()}
        onIdeaClick={vi.fn()}
        selectedSourceId={null}
      />
    );
    // Should render skeleton loaders (uses animate-shimmer class)
    const skeletons = document.querySelectorAll('.before\\:animate-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays error state when error is provided', () => {
    const error = new Error('Test error');
    render(
      <KanbanBoard
        changes={[]}
        ideas={[]}
        sources={mockSources}
        error={error}
        onCardClick={vi.fn()}
        onIdeaClick={vi.fn()}
        selectedSourceId={null}
      />
    );
    expect(screen.getByText('Error loading changes')).toBeInTheDocument();
  });

  it('displays empty state when no items', () => {
    render(
      <KanbanBoard
        changes={[]}
        ideas={[]}
        sources={[]}
        onCardClick={vi.fn()}
        onIdeaClick={vi.fn()}
        selectedSourceId={null}
      />
    );
    expect(screen.getByText('No OpenSpec projects found')).toBeInTheDocument();
  });

  it('tells how to point it at repos when a search found nothing', () => {
    render(
      <KanbanBoard
        changes={[]}
        ideas={[]}
        sources={[]}
        onCardClick={vi.fn()}
        onIdeaClick={vi.fn()}
        selectedSourceId={null}
        searchedRoots={['/home/me/empty']}
      />
    );
    expect(screen.getByText('/home/me/empty')).toBeInTheDocument();
    expect(screen.getByText(/openspec-ui ~\/code/)).toBeInTheDocument();
    expect(screen.getByText(/openspec init/)).toBeInTheDocument();
  });

  describe('stages', () => {
    const draft: Change = {
      ...mockChanges[0],
      id: 'web/add-wishlist',
      name: 'add-wishlist',
      sourceId: 'web',
      status: 'draft',
      taskStats: null,
      summary: 'Share a wishlist by link',
      artifacts: [
        { id: 'proposal', outputPath: 'proposal.md', status: 'ready', requires: [], missingDeps: [] },
        { id: 'specs', outputPath: 'specs/**/*.md', status: 'blocked', requires: ['proposal'], missingDeps: ['proposal'] },
      ],
      isPlanningComplete: false,
    };
    const running: Change = {
      ...mockChanges[0],
      id: 'api/add-refunds',
      name: 'add-refunds',
      sourceId: 'api',
      status: 'in_progress',
      taskStats: { done: 2, total: 5 },
      artifacts: mockChanges[0].artifacts.map((a) => ({ ...a, status: 'done' as const })),
      isPlanningComplete: true,
    };
    const twoRepos: Source[] = [
      { id: 'web', name: 'web', path: '/code/web', valid: true },
      { id: 'api', name: 'api', path: '/code/api', valid: true },
    ];

    beforeEach(() => {
      mobile = false;
    });

    it('gives changes without tasks a Planning column, with what to write next', () => {
      render(
        <KanbanBoard changes={[draft, running]} ideas={[]} sources={twoRepos} onCardClick={vi.fn()} selectedSourceId={null} />
      );
      const planning = screen.getByRole('region', { name: 'Planning' });
      expect(within(planning).getByText('add-wishlist')).toBeInTheDocument();
      expect(within(planning).getByText('Share a wishlist by link')).toBeInTheDocument();
      expect(within(planning).getByText('next')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'In progress' })).getByText('add-refunds')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Ready to apply' })).toHaveTextContent('Nothing waiting to start');
    });

    it('summarises each repo and filters to one when its tile is pressed', () => {
      const onSourceChange = vi.fn();
      render(
        <KanbanBoard
          changes={[draft, running]}
          ideas={[]}
          sources={twoRepos}
          onCardClick={vi.fn()}
          selectedSourceId={null}
          onSourceChange={onSourceChange}
        />
      );
      const repos = screen.getByRole('group', { name: 'Repos' });
      const api = within(repos).getByRole('button', { name: /^api: 1 active \(1 in progress\); 2 of 5 tasks checked/ });
      fireEvent.click(api);
      expect(onSourceChange).toHaveBeenCalledWith('api');
      // Cards name their repo while the board mixes repos.
      expect(within(screen.getByRole('region', { name: 'Planning' })).getByText('web')).toBeInTheDocument();
    });

    it('shows no repo chrome for a single repo', () => {
      render(
        <KanbanBoard changes={[draft]} ideas={[]} sources={[twoRepos[0]]} onCardClick={vi.fn()} selectedSourceId={null} onSourceChange={vi.fn()} />
      );
      expect(screen.queryByRole('group', { name: 'Repos' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Board layout' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Planning' })).queryByText('web')).not.toBeInTheDocument();
    });

    it('keeps ideas folded into a narrow rail until asked, and hides them when there are none', () => {
      const { rerender } = render(
        <KanbanBoard changes={[draft]} ideas={mockIdeas.map((i) => ({ ...i, sourceId: 'web' }))} sources={[twoRepos[0]]} onCardClick={vi.fn()} selectedSourceId={null} />
      );
      expect(screen.queryByText('Test Idea')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Show ideas (1)' }));
      expect(screen.getByText('Test Idea')).toBeInTheDocument();
      rerender(<KanbanBoard changes={[draft]} ideas={[]} sources={[twoRepos[0]]} onCardClick={vi.fn()} selectedSourceId={null} />);
      expect(screen.queryByRole('region', { name: 'Ideas' })).not.toBeInTheDocument();
    });

    it('opens a phone on In progress with labelled stage tabs', () => {
      mobile = true;
      render(
        <KanbanBoard changes={[draft, running]} ideas={[]} sources={twoRepos} onCardClick={vi.fn()} selectedSourceId={null} onSourceChange={vi.fn()} />
      );
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual(['Planning1', 'Ready to apply0', 'In progress1', 'Complete0']);
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('In progress');
      expect(screen.getByText('add-refunds')).toBeInTheDocument();
      expect(screen.queryByText('add-wishlist')).not.toBeInTheDocument();
    });

    it('explains an empty repo instead of showing empty columns', () => {
      render(<KanbanBoard changes={[]} ideas={[]} sources={[twoRepos[0]]} onCardClick={vi.fn()} selectedSourceId={null} />);
      expect(screen.getByText('No changes in web yet')).toBeInTheDocument();
      expect(screen.getByText(/openspec new change/)).toBeInTheDocument();
    });
  });
});
