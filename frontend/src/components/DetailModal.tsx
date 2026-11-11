import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useChange } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Artifact, Change, ChangeDetail, SpecContent } from '../types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ARTIFACT_STATUS, artifactMeta, changeArtifacts, joinWords, nextArtifactId } from '@/lib/artifacts';
import { STAGES, splitArchivedName, stageOf } from '@/lib/board';
import { TasksDocument } from './TasksDocument';

interface DetailModalProps {
  change: Change | null;
  onClose: () => void;
  /** Repo label, when the board mixes repos */
  repo?: { name: string; color: string } | null;
}

const prose =
  'prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm break-words';

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-sm text-muted-foreground">{children}</div>;
}

/** Files written for one artifact: what the backend lists, else the older fixed fields. */
function filesFor(detail: ChangeDetail, artifactId: string): SpecContent[] {
  const doc = detail.documents?.find((d) => d.artifactId === artifactId);
  if (doc) return doc.files;
  switch (artifactId) {
    case 'proposal':
      return detail.proposal ? [{ path: 'proposal.md', content: detail.proposal }] : [];
    case 'design':
      return detail.design ? [{ path: 'design.md', content: detail.design }] : [];
    case 'tasks':
      return detail.tasks ? [{ path: 'tasks.md', content: detail.tasks.raw }] : [];
    case 'specs':
      return detail.specs.map((s) => ({ path: `specs/${s.path}`, content: s.content }));
    default:
      return [];
  }
}

function Documents({ files, isTasks }: { files: SpecContent[]; isTasks: boolean }) {
  return (
    <div className="space-y-8">
      {files.map((file) => (
        <section key={file.path}>
          {files.length > 1 && (
            <h3 className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2 font-mono text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {file.path}
            </h3>
          )}
          {isTasks ? (
            <TasksDocument content={file.content} />
          ) : (
            <article className={prose}>
              <ReactMarkdown>{file.content}</ReactMarkdown>
            </article>
          )}
        </section>
      ))}
    </div>
  );
}

/** What an artifact without files is waiting for, in `openspec status` terms. */
function NotWritten({ artifact, isNext }: { artifact: Artifact; isNext: boolean }) {
  const { label } = artifactMeta(artifact.id);
  const { Icon } = ARTIFACT_STATUS[artifact.status];
  let text: React.ReactNode;
  if (artifact.status === 'skipped') {
    text = (
      <>
        Skipped. This change sets <code className="font-mono text-xs">skip_specs: true</code>, so it changes no specs.
      </>
    );
  } else if (artifact.status === 'ready') {
    text = (
      <>
        Not written yet, and nothing blocks it{isNext ? ': this is the next artifact to write' : ''}. It goes in{' '}
        <code className="font-mono text-xs">{artifact.outputPath}</code>.
      </>
    );
  } else if (artifact.status === 'blocked') {
    text =
      artifact.missingDeps.length > 0 ? (
        <>Not written yet. It waits for {joinWords(artifact.missingDeps.map((d) => artifactMeta(d).label.toLowerCase()))}.</>
      ) : (
        <>Not written yet.</>
      );
  } else {
    text = <>Marked as written, but no files were found at {artifact.outputPath}.</>;
  }
  return (
    <Centered>
      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="font-medium text-foreground">{label}</div>
      <p className="max-w-sm">{text}</p>
    </Centered>
  );
}

export function DetailModal({ change, onClose, repo }: DetailModalProps) {
  const { change: detail, loading, refetch } = useChange(change?.id || null);
  const [activeTab, setActiveTab] = useState<string>('proposal');
  const isMobile = useIsMobile();

  // The list refreshes on every file change; when it hands us a new copy of
  // this change, reload the documents too so the tabs match the header.
  const seen = useRef(change);
  useEffect(() => {
    if (seen.current === change) return;
    seen.current = change;
    refetch();
  }, [change, refetch]);

  if (!change) return null;

  const stage = stageOf(change);
  const stageMeta = STAGES[stage];
  const archived = stage === 'archived' ? splitArchivedName(change.name) : null;
  const next = nextArtifactId(changeArtifacts(change));

  // One tab per artifact in the schema's chain, written or not. A change
  // OpenSpec can't read has no chain; show whatever documents it does have.
  let artifacts = changeArtifacts(change);
  if (artifacts.length === 0 && detail) {
    artifacts = ['proposal', 'specs', 'design', 'tasks']
      .filter((id) => filesFor(detail, id).length > 0)
      .map((id) => ({ id, outputPath: id, status: 'done' as const, requires: [], missingDeps: [] }));
  }
  const currentTab = artifacts.some((a) => a.id === activeTab) ? activeTab : (artifacts[0]?.id ?? '');
  const stats = change.taskStats;
  const warnings = change.warnings ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={!isMobile}
        className={
          isMobile
            ? 'fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-dvh !max-w-none max-h-none rounded-none border-0 p-0 flex flex-col gap-0'
            : '!w-[85vw] !max-w-[960px] !h-[85vh] !max-h-[85vh] flex flex-col gap-0 p-0'
        }
      >
        <DialogHeader className={cn('flex-shrink-0 text-left gap-0 border-b border-border/70', isMobile ? 'px-4 pt-3 pb-3' : 'px-6 pt-5 pb-4')}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {repo && (
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', repo.color)} aria-hidden />
                    {repo.name}
                  </span>
                )}
                <span className="flex items-center gap-1" title={stageMeta.hint}>
                  <stageMeta.Icon className={cn('h-3.5 w-3.5', stageMeta.color)} aria-hidden />
                  {stageMeta.label}
                </span>
                {archived?.date && <span className="tabular-nums">Archived {archived.date}</span>}
                {change.schema && change.schema !== 'spec-driven' && (
                  <span title="Workflow schema">
                    schema <span className="font-mono text-foreground/80">{change.schema}</span>
                  </span>
                )}
                {stats && stats.total > 0 && (
                  <span className="tabular-nums">
                    {stats.done}/{stats.total} tasks
                  </span>
                )}
              </div>
              <DialogTitle className={cn('mt-1 font-semibold leading-snug break-words', isMobile ? 'text-base' : 'text-xl')}>
                {archived ? archived.name : change.name}
              </DialogTitle>
              {change.title && <p className="text-sm font-medium text-foreground/80">{change.title}</p>}
              <DialogDescription className={cn('mt-1 text-sm text-muted-foreground', isMobile && 'line-clamp-3')}>
                {change.summary || 'No summary yet: the proposal has no Why section and the change no goal.'}
              </DialogDescription>
              {stats && stats.total > 0 && (
                <div className="mt-3 h-1 max-w-sm overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn('h-full rounded-full', stats.done === stats.total ? 'bg-emerald-500' : 'bg-amber-500')}
                    style={{ width: `${(stats.done / stats.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
            {isMobile && (
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9 -mr-2" aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            )}
          </div>
          {change.error && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <div>
                <span className="font-semibold">OpenSpec can't read this change.</span> {change.error}
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
                  <span>
                    <span className="sr-only">Warning: </span>
                    {w}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-0">
          {artifacts.length > 0 && (
            <TabsList
              aria-label="Artifacts"
              className={cn(
                'h-auto w-full flex-shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0',
                isMobile ? 'px-2' : 'px-4'
              )}
            >
              {artifacts.map((artifact) => {
                const { label } = artifactMeta(artifact.id);
                const status = ARTIFACT_STATUS[artifact.status];
                const isNext = artifact.id === next;
                return (
                  <TabsTrigger
                    key={artifact.id}
                    value={artifact.id}
                    data-status={artifact.status}
                    className={cn(
                      'relative -mb-px h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm shadow-none',
                      'data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-foreground',
                      artifact.status === 'done' ? 'text-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    <status.Icon
                      className={cn('h-3.5 w-3.5', artifact.status === 'done' && 'text-emerald-600 dark:text-emerald-400', isNext && 'text-primary')}
                      aria-hidden
                    />
                    <span className={cn(artifact.status === 'skipped' && 'line-through')}>{label}</span>
                    {isNext && <span className="text-[10px] font-semibold text-primary">next</span>}
                    {!isNext && artifact.status !== 'done' && <span className="sr-only">, {status.label}</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          )}

          <div className={cn('min-h-0 flex-1 overflow-y-auto', isMobile ? 'px-4 py-4' : 'px-6 py-5')}>
            {artifacts.length === 0 ? (
              loading ? (
                <Centered>
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  Loading…
                </Centered>
              ) : (
                <Centered>Nothing written for this change yet.</Centered>
              )
            ) : (
              artifacts.map((artifact) => {
                const files = detail ? filesFor(detail, artifact.id) : [];
                return (
                  <TabsContent key={artifact.id} value={artifact.id} className="mt-0">
                    {files.length > 0 ? (
                      <Documents files={files} isTasks={artifact.id === 'tasks' || artifact.outputPath.startsWith('tasks')} />
                    ) : !detail && loading ? (
                      <Centered>
                        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                        Loading…
                      </Centered>
                    ) : !detail ? (
                      <Centered>Couldn't load this change.</Centered>
                    ) : (
                      <NotWritten artifact={artifact} isNext={artifact.id === next} />
                    )}
                  </TabsContent>
                );
              })
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
