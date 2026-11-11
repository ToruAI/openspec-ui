import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, FileText, Layers, Loader2 } from 'lucide-react';
import { useChange } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Change } from '../types';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { artifactMeta, changeArtifacts } from "@/lib/artifacts";
import { ArtifactChain } from './ArtifactChain';

interface DetailModalProps {
  change: Change | null;
  onClose: () => void;
}

/** Generic document tabs are prefixed so a custom artifact can never collide with a built-in tab. */
const DOC_TAB = 'doc:';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  todo: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  done: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  archived: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <div className="text-muted-foreground text-sm">Loading content...</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="text-muted-foreground">{message}</div>
    </div>
  );
}

export function DetailModal({ change, onClose }: DetailModalProps) {
  const { change: detail, loading } = useChange(change?.id || null);
  const [activeTab, setActiveTab] = useState<string>('proposal');
  const isMobile = useIsMobile();

  const availableTabs: string[] = [];
  if (change?.hasProposal) availableTabs.push('proposal');
  if (change?.hasSpecs) availableTabs.push('specs');
  if (change?.hasTasks) availableTabs.push('tasks');
  if (change?.hasDesign) availableTabs.push('design');
  // Every other written artifact gets a document tab once the detail has
  // loaded: artifacts a custom schema adds, and built-in ids whose files live
  // somewhere the dedicated tab does not read (e.g. design generating design/*.md).
  const extraDocuments = (detail?.documents ?? []).filter((d) => !availableTabs.includes(d.artifactId));
  for (const doc of extraDocuments) availableTabs.push(DOC_TAB + doc.artifactId);
  // The last tab picked, while it exists; otherwise the first one this change has.
  const currentTab = availableTabs.includes(activeTab) ? activeTab : (availableTabs[0] ?? 'proposal');

  if (!change) return null;


  return (
    <Dialog open={!!change} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={!isMobile}
        className={
          isMobile
            // Full-screen on mobile
            ? "fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen !max-w-none max-h-none rounded-none border-0 p-0 flex flex-col gap-0"
            // Better size on desktop
            : "!w-[85vw] !max-w-[1100px] !h-[85vh] !max-h-[85vh] flex flex-col"
        }
      >
        {/* Header */}
        <DialogHeader className={isMobile ? "p-4 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur-sm" : "flex-shrink-0 px-6"}>
          <div className={isMobile ? "flex items-center justify-between gap-4" : ""}>
            <div className={isMobile ? "flex-1 min-w-0" : ""}>
              <DialogTitle className={cn(
                "leading-snug",
                isMobile ? "truncate text-left text-base" : "text-xl"
              )}>
                {change.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge 
                  variant="secondary" 
                  className="text-xs font-medium bg-muted/80"
                >
                  {change.sourceId}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs capitalize font-medium",
                    STATUS_STYLES[change.status]
                  )}
                >
                  {change.status.replace('_', ' ')}
                </Badge>
                {change.taskStats && change.taskStats.total > 0 && (
                  <Badge variant="outline" className="text-xs font-medium">
                    {change.taskStats.done}/{change.taskStats.total} tasks
                  </Badge>
                )}
                {change.schema && change.schema !== 'spec-driven' && (
                  <Badge variant="outline" className="text-xs font-medium" title="Workflow schema">
                    {change.schema}
                  </Badge>
                )}
              </div>
              <ArtifactChain
                className="mt-3"
                artifacts={changeArtifacts(change)}
                error={change.error}
                warnings={change.warnings}
              />
            </div>
            {isMobile && (
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${isMobile ? 'px-4' : 'px-6'}`}>
          <Tabs value={currentTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {availableTabs.length > 0 && (
            <TabsList 
              className="grid w-full flex-shrink-0 bg-muted/50 p-1 h-auto gap-1" 
              style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}
            >
              {availableTabs.map((tab) => {
                const config = artifactMeta(tab.startsWith(DOC_TAB) ? tab.slice(DOC_TAB.length) : tab);
                return (
                  <TabsTrigger 
                    key={tab}
                    value={tab} 
                    className={cn(
                      "text-xs md:text-sm py-2 px-3 rounded-md transition-all duration-200",
                      "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                      "flex items-center gap-2"
                    )}
                  >
                    <span className={cn(
                      "transition-colors",
                      currentTab === tab ? config.color : "text-muted-foreground"
                    )}>
                      <config.Icon className="h-4 w-4" />
                    </span>
                    <span className="hidden sm:inline">{config.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden mt-4 scroll-smooth">
              <div className="pr-2 pb-8 overflow-hidden">
                {availableTabs.length === 0 && !loading ? (
                  <EmptyState message="Nothing written for this change yet" />
                ) : loading ? (
                  <LoadingState />
                ) : !detail ? (
                  <EmptyState message="Failed to load details" />
                ) : (
                  <>
                    <TabsContent value="proposal" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200 overflow-hidden">
                      {detail.proposal ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm overflow-hidden break-words">
                          <ReactMarkdown>{detail.proposal}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No proposal document found" />
                      )}
                    </TabsContent>

                    <TabsContent value="specs" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200 overflow-hidden">
                      {detail.specs.length > 0 ? (
                        <div className="space-y-8 overflow-hidden">
                          {detail.specs.map((spec, idx) => (
                            <div key={idx} className="overflow-hidden">
                              <div className="flex items-center gap-2 mb-4 min-w-0">
                                <Layers className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <h3 className="text-sm font-semibold font-mono text-foreground truncate">
                                  {spec.path}
                                </h3>
                              </div>
                              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm overflow-hidden break-words">
                                <ReactMarkdown>{spec.content}</ReactMarkdown>
                              </article>
                              {idx < detail.specs.length - 1 && <Separator className="my-8" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No specs found" />
                      )}
                    </TabsContent>

                    <TabsContent value="tasks" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200 overflow-hidden">
                      {detail.tasks ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm prose-li:marker:text-primary overflow-hidden break-words">
                          <ReactMarkdown>{detail.tasks.raw}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No tasks document found" />
                      )}
                    </TabsContent>

                    <TabsContent value="design" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200 overflow-hidden">
                      {detail.design ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm overflow-hidden break-words">
                          <ReactMarkdown>{detail.design}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No design document found" />
                      )}
                    </TabsContent>

                    {extraDocuments.map((doc) => (
                      <TabsContent key={doc.artifactId} value={DOC_TAB + doc.artifactId} className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200 overflow-hidden">
                        <div className="space-y-8 overflow-hidden">
                          {doc.files.map((file, idx) => (
                            <div key={file.path} className="overflow-hidden">
                              {doc.files.length > 1 && (
                                <div className="flex items-center gap-2 mb-4 min-w-0">
                                  <FileText className="h-4 w-4 text-sky-500 flex-shrink-0" />
                                  <h3 className="text-sm font-semibold font-mono text-foreground truncate">{file.path}</h3>
                                </div>
                              )}
                              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm overflow-hidden break-words">
                                <ReactMarkdown>{file.content}</ReactMarkdown>
                              </article>
                              {idx < doc.files.length - 1 && <Separator className="my-8" />}
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </>
                )}
              </div>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
