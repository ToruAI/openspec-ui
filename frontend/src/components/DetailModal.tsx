import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
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

interface DetailModalProps {
  change: Change | null;
  onClose: () => void;
}

type Tab = 'proposal' | 'specs' | 'tasks' | 'design';

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

  return (
    <Dialog open={!!change} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={!isMobile}
        className={
          isMobile
            // Full-screen on mobile
            ? "fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen !max-w-none max-h-none rounded-none border-0 p-0 flex flex-col gap-0"
            // Better size on desktop - reduced from 90% to 85%
            : "!w-[85vw] !max-w-[1100px] !h-[85vh] !max-h-[85vh] flex flex-col"
        }
      >
        {/* Header */}
        <DialogHeader className={isMobile ? "p-4 border-b border-border flex-shrink-0" : "flex-shrink-0 px-6"}>
          <div className={isMobile ? "flex items-center justify-between gap-4" : ""}>
            <div className={isMobile ? "flex-1 min-w-0" : ""}>
              <DialogTitle className={isMobile ? "truncate text-left" : "text-xl"}>{change.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{change.sourceId}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{change.status.replace('_', ' ')}</Badge>
              </div>
            </div>
            {isMobile && (
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${isMobile ? '' : 'px-6'}`}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid w-full flex-shrink-0" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
              {change.hasProposal && (
                <TabsTrigger value="proposal" className="text-xs md:text-sm">Proposal</TabsTrigger>
              )}
              {change.hasSpecs && (
                <TabsTrigger value="specs" className="text-xs md:text-sm">Specs</TabsTrigger>
              )}
              {change.hasTasks && (
                <TabsTrigger value="tasks" className="text-xs md:text-sm">Tasks</TabsTrigger>
              )}
              {change.hasDesign && (
                <TabsTrigger value="design" className="text-xs md:text-sm">Design</TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 scroll-smooth">
              <div className="pr-2 pb-8">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : !detail ? (
                  <div className="text-muted-foreground py-8">Failed to load details</div>
                ) : (
                  <>
                    <TabsContent value="proposal" className="mt-0 data-[state=active]:block">
                      {detail.proposal ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{detail.proposal}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8">No proposal document found</div>
                      )}
                    </TabsContent>

                    <TabsContent value="specs" className="mt-0 data-[state=active]:block">
                      {detail.specs.length > 0 ? (
                        <div className="space-y-6">
                          {detail.specs.map((spec, idx) => (
                            <div key={idx}>
                              <h3 className="text-sm font-semibold mb-3">
                                {spec.path}
                              </h3>
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{spec.content}</ReactMarkdown>
                              </div>
                              {idx < detail.specs.length - 1 && <Separator className="my-6" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8">No specs found</div>
                      )}
                    </TabsContent>

                    <TabsContent value="tasks" className="mt-0 data-[state=active]:block">
                      {detail.tasks ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{detail.tasks.raw}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8">No tasks document found</div>
                      )}
                    </TabsContent>

                    <TabsContent value="design" className="mt-0 data-[state=active]:block">
                      {detail.design ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{detail.design}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8">No design document found</div>
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
