import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, FileText, Layers, CheckSquare, Palette, Loader2 } from 'lucide-react';
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

interface DetailModalProps {
  change: Change | null;
  onClose: () => void;
}

type Tab = 'proposal' | 'specs' | 'tasks' | 'design';

const TAB_CONFIG: Record<Tab, { icon: React.ReactNode; label: string; color: string }> = {
  proposal: { 
    icon: <FileText className="h-4 w-4" />, 
    label: 'Proposal',
    color: 'text-blue-500'
  },
  specs: { 
    icon: <Layers className="h-4 w-4" />, 
    label: 'Specs',
    color: 'text-emerald-500'
  },
  tasks: { 
    icon: <CheckSquare className="h-4 w-4" />, 
    label: 'Tasks',
    color: 'text-amber-500'
  },
  design: { 
    icon: <Palette className="h-4 w-4" />, 
    label: 'Design',
    color: 'text-purple-500'
  },
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  todo: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  done: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  archived: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export function DetailModal({ change, onClose }: DetailModalProps) {
  const { change: detail, loading } = useChange(change?.id || null);
  const [activeTab, setActiveTab] = useState<Tab>('proposal');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (change) {
      setActiveTab(
        change.hasProposal ? 'proposal' :
        change.hasSpecs ? 'specs' :
        change.hasTasks ? 'tasks' :
        change.hasDesign ? 'design' :
        'proposal'
      );
    }
  }, [change]);

  if (!change) return null;

  const availableTabs: Tab[] = [];
  if (change.hasProposal) availableTabs.push('proposal');
  if (change.hasSpecs) availableTabs.push('specs');
  if (change.hasTasks) availableTabs.push('tasks');
  if (change.hasDesign) availableTabs.push('design');

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <div className="text-muted-foreground text-sm">Loading content...</div>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="text-muted-foreground">{message}</div>
    </div>
  );

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
              </div>
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
        <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${isMobile ? '' : 'px-6'}`}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList 
              className="grid w-full flex-shrink-0 bg-muted/50 p-1 h-auto gap-1" 
              style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}
            >
              {availableTabs.map((tab) => {
                const config = TAB_CONFIG[tab];
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
                      activeTab === tab ? config.color : "text-muted-foreground"
                    )}>
                      {config.icon}
                    </span>
                    <span className="hidden sm:inline">{config.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 scroll-smooth">
              <div className="pr-2 pb-8">
                {loading ? (
                  <LoadingState />
                ) : !detail ? (
                  <EmptyState message="Failed to load details" />
                ) : (
                  <>
                    <TabsContent value="proposal" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200">
                      {detail.proposal ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm">
                          <ReactMarkdown>{detail.proposal}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No proposal document found" />
                      )}
                    </TabsContent>

                    <TabsContent value="specs" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200">
                      {detail.specs.length > 0 ? (
                        <div className="space-y-8">
                          {detail.specs.map((spec, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2 mb-4">
                                <Layers className="h-4 w-4 text-emerald-500" />
                                <h3 className="text-sm font-semibold font-mono text-foreground">
                                  {spec.path}
                                </h3>
                              </div>
                              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm">
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

                    <TabsContent value="tasks" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200">
                      {detail.tasks ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm prose-li:marker:text-primary">
                          <ReactMarkdown>{detail.tasks.raw}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No tasks document found" />
                      )}
                    </TabsContent>

                    <TabsContent value="design" className="mt-0 data-[state=active]:block animate-in fade-in-50 duration-200">
                      {detail.design ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm">
                          <ReactMarkdown>{detail.design}</ReactMarkdown>
                        </article>
                      ) : (
                        <EmptyState message="No design document found" />
                      )}
                    </TabsContent>
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
