import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { KanbanBoard, SEARCH_INPUT_ID } from './components/KanbanBoard';
import { PlanningNotices } from './components/PlanningNotices';
import { SettingsModal } from './components/SettingsModal';
import { IdeaCapture } from './components/IdeaCapture';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GitHubIcon } from './components/Brand';
import { useSSE, useChanges, useSpecs, useSources, useIdeas, useServerInfo } from './hooks/useApi';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsMobile } from './hooks/useMediaQuery';
import { repoColor } from './lib/board';
import { OPENSPEC_URL, REPO_URL } from './lib/links';
import type { Idea } from './types';
import './App.css';

// Markdown rendering is only needed once something is opened.
const DetailModal = lazy(() => import('./components/DetailModal').then((m) => ({ default: m.DetailModal })));
const IdeaDetailModal = lazy(() => import('./components/IdeaDetailModal').then((m) => ({ default: m.IdeaDetailModal })));
const SpecsView = lazy(() => import('./components/SpecsView').then((m) => ({ default: m.SpecsView })));

type View = 'kanban' | 'specs';

const SHOW_ARCHIVED_KEY = 'openspec-show-archived';
const SELECTED_SOURCE_KEY = 'openspec-selected-source';
const VIEW_KEY = 'openspec-view';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: preferences last for this visit only.
  }
}

function Footer({ version }: { version?: string }) {
  return (
    <footer className="hidden md:flex shrink-0 items-center gap-2 border-t border-border/60 px-6 py-2 text-[11px] text-muted-foreground">
      <span>
        OpenSpec UI{version ? ` v${version}` : ''} is an independent, read-only community board for{' '}
        <a href={OPENSPEC_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          OpenSpec
        </a>
        . Not affiliated with the OpenSpec project.
      </span>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
      >
        <GitHubIcon className="h-3 w-3" />
        Source, issues and stars on GitHub
      </a>
    </footer>
  );
}

function App() {
  const [currentView, setCurrentView] = useState<View>(() => (read(VIEW_KEY) === 'specs' ? 'specs' : 'kanban'));
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(() => read(SELECTED_SOURCE_KEY));
  const [showArchived, setShowArchived] = useState<boolean>(() => read(SHOW_ARCHIVED_KEY) === 'true');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ideaCaptureOpen, setIdeaCaptureOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => write(VIEW_KEY, currentView), [currentView]);
  useEffect(() => write(SHOW_ARCHIVED_KEY, String(showArchived)), [showArchived]);
  useEffect(() => write(SELECTED_SOURCE_KEY, selectedSourceId), [selectedSourceId]);

  const { sources, refetch: refetchSources } = useSources();
  const serverInfo = useServerInfo();

  // The stored selection is shared by every board served on this origin
  // (e.g. another folder on the same port). Ignore it when it does not match
  // a current source instead of showing an empty board.
  const effectiveSourceId =
    selectedSourceId && sources.some((s) => s.id === selectedSourceId) ? selectedSourceId : null;
  const { changes, loading: changesLoading, error: changesError, refetch: refetchChanges } = useChanges();
  const { specs, loading: specsLoading, error: specsError, refetch: refetchSpecs } = useSpecs();
  const { ideas, loading: ideasLoading, error: ideasError, refetch: refetchIdeas } = useIdeas();

  // Live updates refetch everything; only the very first load shows skeletons,
  // so the board does not blink every time a file is saved.
  const [loadedOnce, setLoadedOnce] = useState(false);
  const initialLoading = !loadedOnce && (changesLoading || ideasLoading);
  if (!loadedOnce && !changesLoading && !ideasLoading) setLoadedOnce(true);

  const handleUpdate = useCallback(() => {
    refetchChanges();
    refetchSpecs();
    refetchSources();
    refetchIdeas();
  }, [refetchChanges, refetchSpecs, refetchSources, refetchIdeas]);

  useSSE(handleUpdate);

  useKeyboardShortcuts({
    '/': () => {
      if (currentView !== 'kanban') setCurrentView('kanban');
      requestAnimationFrame(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
    },
  });

  // Look the open change up by id, so live updates reach the open modal.
  const selectedChange = selectedChangeId ? (changes.find((c) => c.id === selectedChangeId) ?? null) : null;
  const multiRepo = sources.length > 1;
  const repoLabel =
    selectedChange && multiRepo
      ? {
          name: sources.find((s) => s.id === selectedChange.sourceId)?.name ?? selectedChange.sourceId,
          color: repoColor(sources, selectedChange.sourceId),
        }
      : null;

  const fullHeight = !isMobile;

  return (
    <ErrorBoundary>
      <div className={fullHeight ? 'flex h-dvh flex-col overflow-hidden bg-background' : 'min-h-dvh bg-background'}>
        <Header
          currentView={currentView}
          onViewChange={setCurrentView}
          sources={sources}
          selectedSourceId={effectiveSourceId}
          onSourceChange={setSelectedSourceId}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenNewIdea={() => setIdeaCaptureOpen(true)}
          version={serverInfo?.version}
          changelogUrl={serverInfo?.changelog}
          network={serverInfo ? { lanUrl: serverInfo.lanUrl, host: serverInfo.host ?? '', port: serverInfo.port } : undefined}
        />
        <main className={fullHeight ? 'flex min-h-0 flex-1 flex-col px-6 pt-4' : 'px-4 pt-3'}>
          {currentView === 'kanban' ? (
            <>
              <PlanningNotices sources={sources} selectedSourceId={effectiveSourceId} />
              <div className={fullHeight ? 'min-h-0 flex-1' : undefined}>
                <KanbanBoard
                  changes={changes}
                  ideas={ideas}
                  sources={sources}
                  loading={initialLoading}
                  error={changesError || ideasError}
                  onCardClick={(change) => setSelectedChangeId(change.id)}
                  onIdeaClick={setSelectedIdea}
                  selectedSourceId={effectiveSourceId}
                  onSourceChange={setSelectedSourceId}
                  showArchived={showArchived}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onNewIdea={() => setIdeaCaptureOpen(true)}
                  searchedRoots={serverInfo?.mode === 'discovered' ? serverInfo.roots : undefined}
                />
              </div>
            </>
          ) : (
            <div className={fullHeight ? 'min-h-0 flex-1 pb-4' : undefined}>
              <Suspense fallback={null}>
                <SpecsView selectedSourceId={effectiveSourceId} specs={specs} loading={specsLoading && specs.length === 0} error={specsError} />
              </Suspense>
            </div>
          )}
        </main>
        <Footer version={serverInfo?.version} />
        <Suspense fallback={null}>
          {selectedChange && (
            <DetailModal change={selectedChange} repo={repoLabel} onClose={() => setSelectedChangeId(null)} />
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
        </Suspense>
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
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
