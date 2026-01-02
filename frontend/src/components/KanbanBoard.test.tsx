import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanBoard } from './KanbanBoard';
import type { Change, Idea, Source } from '../types';

describe('KanbanBoard', () => {
  const mockChanges: Change[] = [
    {
      id: '1',
      name: 'Test Change',
      sourceId: 'test-source',
      status: 'todo',
      taskStats: { done: 0, total: 5 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockIdeas: Idea[] = [
    {
      id: '1',
      title: 'Test Idea',
      description: 'Test description',
      sourceId: 'test-source',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSources: Source[] = [
    {
      id: 'test-source',
      name: 'Test Source',
      path: '/test/path',
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
    // Should render skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
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
    expect(screen.getByText('No OpenSpec sources configured')).toBeInTheDocument();
  });
});
