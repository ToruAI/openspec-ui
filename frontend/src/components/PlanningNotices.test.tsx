import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanningNotices } from './PlanningNotices';
import type { Source } from '../types';

const source = (id: string, planning: Source['planning']): Source => ({
  id,
  name: id,
  path: `/repos/${id}/openspec`,
  valid: true,
  planning,
});

describe('PlanningNotices', () => {
  it('says where a store-pointer repo keeps its changes', () => {
    render(
      <PlanningNotices
        selectedSourceId={null}
        sources={[
          source('web-app', { kind: 'store_pointer', storeId: 'team-plans', storePath: '/plans/team-plans/openspec', problem: null }),
          source('api', { kind: 'local', storeId: null, storePath: null, problem: null }),
        ]}
      />
    );
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('web-app plans in the OpenSpec store team-plans');
    expect(notice).toHaveTextContent('Add /plans/team-plans/openspec as a source');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('explains an unresolved store instead of suggesting a path', () => {
    render(
      <PlanningNotices
        selectedSourceId="web-app"
        sources={[source('web-app', { kind: 'store_pointer', storeId: 'team-plans', storePath: null, problem: "Store 'team-plans' is not registered on this machine." })]}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('not registered on this machine');
  });

  it('renders nothing for local sources, store checkouts, or older backends', () => {
    const { container } = render(
      <PlanningNotices
        selectedSourceId={null}
        sources={[
          source('a', { kind: 'local', storeId: null, storePath: null, problem: null }),
          source('b', { kind: 'store', storeId: 'team-plans', storePath: null, problem: null }),
          source('c', undefined),
        ]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
