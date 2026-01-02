import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { SpecsView } from './components/SpecsView';
import { DetailModal } from './components/DetailModal';
import { IdeaDetailModal } from './components/IdeaDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { IdeaCapture } from './components/IdeaCapture';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSSE, useChanges, useSpecs, useSources, useIdeas } from './hooks/useApi';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Change, Idea } from './types';
import './App.css';

type View = 'kanban' | 'specs';

const SHOW_ARCHIVED_KEY = 'openspec-show-archived';
const SELECTED_SOURCE_KEY = 'openspec-selected-source';

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    const stored = localStorage.getItem('openspec-view');
    if (stored === 'kanban' || stored === 'specs') {
      return stored;
    }
    return 'kanban';
  });
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_SOURCE_KEY);
  });
  const [showArchived, setShowArchived] = useState<boolean>(() => {
    const stored = localStorage.getItem(SHOW_ARCHIVED_KEY);
    return stored === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ideaCaptureOpen, setIdeaCaptureOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Persist view preference
  useEffect(() => {
    localStorage.setItem('openspec-view', currentView);
  }, [currentView]);

  // Persist showArchived preference
  useEffect(() => {
    localStorage.setItem(SHOW_ARCHIVED_KEY, String(showArchived));
  }, [showArchived]);

  // Persist selected source preference
  useEffect(() => {
    if (selectedSourceId) {
      localStorage.setItem(SELECTED_SOURCE_KEY, selectedSourceId);
    } else {
      localStorage.removeItem(SELECTED_SOURCE_KEY);
    }
  }, [selectedSourceId]);

  const { sources, refetch: refetchSources } = useSources();
  const { changes, loading: changesLoading, error: changesError, refetch: refetchChanges } = useChanges();
  const { refetch: refetchSpecs } = useSpecs();
  const { ideas, loading: ideasLoading, error: ideasError, refetch: refetchIdeas } = useIdeas();

  // Connect to SSE for real-time updates
  const handleUpdate = useCallback(() => {
    refetchChanges();
    refetchSpecs();
    refetchSources();
    refetchIdeas();
  }, [refetchChanges, refetchSpecs, refetchSources, refetchIdeas]);

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
          onOpenNewIdea={() => setIdeaCaptureOpen(true)}
        />
        <main className={currentView === 'kanban' ? "px-4 pt-4 md:pt-6" : "max-w-7xl mx-auto px-4 pt-4 md:pt-6"}>
          {currentView === 'kanban' ? (
            <KanbanBoard
              changes={changes}
              ideas={ideas}
              sources={sources}
              loading={changesLoading || ideasLoading}
              error={changesError || ideasError}
              onCardClick={setSelectedChange}
              onIdeaClick={setSelectedIdea}
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
        {selectedIdea && (
          <IdeaDetailModal
            idea={selectedIdea}
            onClose={() => setSelectedIdea(null)}
            onDeleted={refetchIdeas}
            onEdit={(idea) => {
              setEditingIdea(idea);
              setIdeaCaptureOpen(true);
            }}
          />
        )}
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
        <IdeaCapture
          open={ideaCaptureOpen}
          onOpenChange={(open) => {
            setIdeaCaptureOpen(open);
            if (!open) {
              setEditingIdea(null);
            }
          }}
          idea={editingIdea}
          onSuccess={() => {
            refetchIdeas();
            setEditingIdea(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;




