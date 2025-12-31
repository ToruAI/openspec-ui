import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { SpecsView } from './components/SpecsView';
import { DetailModal } from './components/DetailModal';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSSE, useChanges, useSpecs, useSources } from './hooks/useApi';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Change } from './types';
import './App.css';

type View = 'kanban' | 'specs';

const SHOW_ARCHIVED_KEY = 'openspec-show-archived';

function App() {
  const [currentView, setCurrentView] = useState<View>('kanban');
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(() => {
    const stored = localStorage.getItem(SHOW_ARCHIVED_KEY);
    return stored === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist showArchived preference
  useEffect(() => {
    localStorage.setItem(SHOW_ARCHIVED_KEY, String(showArchived));
  }, [showArchived]);

  const { sources, refetch: refetchSources } = useSources();
  const { refetch: refetchChanges } = useChanges();
  const { refetch: refetchSpecs } = useSpecs();

  // Connect to SSE for real-time updates
  const handleUpdate = useCallback(() => {
    refetchChanges();
    refetchSpecs();
    refetchSources();
  }, [refetchChanges, refetchSpecs, refetchSources]);

  useSSE(handleUpdate);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    '/': () => {
      // Focus on search - this will require ref forwarding in future
      console.log('Search shortcut - implement focus on search input');
    },
    'escape': () => {
      setSelectedChange(null);
      setSettingsOpen(false);
    },
  });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background overflow-x-hidden max-w-full">
        <Header
          currentView={currentView}
          onViewChange={setCurrentView}
          sources={sources}
          selectedSourceId={selectedSourceId}
          onSourceChange={setSelectedSourceId}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className={currentView === 'kanban' ? "px-4 pt-4 md:pt-6" : "max-w-7xl mx-auto px-4 pt-4 md:pt-6"}>
          {currentView === 'kanban' ? (
            <KanbanBoard
              onCardClick={setSelectedChange}
              selectedSourceId={selectedSourceId}
              showArchived={showArchived}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <SpecsView selectedSourceId={selectedSourceId} />
          )}
        </main>
        {selectedChange && (
          <DetailModal
            change={selectedChange}
            onClose={() => setSelectedChange(null)}
          />
        )}
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;




