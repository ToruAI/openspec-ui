import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Menu, FileText, Folder, Loader2 } from 'lucide-react';
import { useSpecs, useSpec } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Spec } from '../types';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SpecsViewProps {
  selectedSourceId: string | null;
}

export function SpecsView({ selectedSourceId }: SpecsViewProps) {
  const { specs, loading, error } = useSpecs();
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { spec: specDetail, loading: detailLoading } = useSpec(selectedSpecId);
  const isMobile = useIsMobile();

  // Filter specs by selected source
  const filteredSpecs = selectedSourceId
    ? specs.filter((s) => s.sourceId === selectedSourceId)
    : specs;

  // Group specs by source
  const specsBySource = filteredSpecs.reduce((acc, spec) => {
    if (!acc[spec.sourceId]) {
      acc[spec.sourceId] = [];
    }
    acc[spec.sourceId].push(spec);
    return acc;
  }, {} as Record<string, Spec[]>);

  const handleSpecSelect = (specId: string) => {
    setSelectedSpecId(specId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <div className="text-muted-foreground">Loading specs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <div className="text-destructive font-medium">Error loading specs</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
      </div>
    );
  }

  if (filteredSpecs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-lg font-medium">
            {selectedSourceId ? 'No specs found for selected project' : 'No specs found'}
          </div>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Specs will appear here once they're created
          </p>
        </div>
      </div>
    );
  }

  // Sidebar content (shared between drawer and fixed sidebar)
  const SidebarContent = () => (
    <div className="space-y-6">
      {Object.entries(specsBySource).map(([sourceId, sourceSpecs]) => (
        <div key={sourceId}>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider">
            <Folder className="h-3.5 w-3.5" />
            {sourceId}
          </div>
          <div className="space-y-1">
            {sourceSpecs.map((spec) => (
              <button
                key={spec.id}
                onClick={() => handleSpecSelect(spec.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2",
                  selectedSpecId === spec.id
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <FileText className={cn(
                  "h-4 w-4 shrink-0",
                  selectedSpecId === spec.id ? "text-primary-foreground" : "text-muted-foreground"
                )} />
                <span className="truncate">{spec.path}</span>
              </button>
            ))}
          </div>
          <Separator className="mt-4" />
        </div>
      ))}
    </div>
  );

  // Content area
  const ContentArea = () => (
    <div className="p-4 md:p-8">
      {selectedSpecId ? (
        detailLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="text-muted-foreground text-sm">Loading spec...</div>
          </div>
        ) : specDetail ? (
          <div className="animate-in fade-in-50 duration-200">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold leading-tight">
                  {specDetail.path}
                </h1>
                <div className="text-sm text-muted-foreground mt-1">
                  {specDetail.sourceId}
                </div>
              </div>
            </div>
            <article className="prose prose-sm md:prose dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm">
              <ReactMarkdown>{specDetail.content}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-muted-foreground">Failed to load spec</div>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <div className="text-muted-foreground font-medium">
            {isMobile ? 'Tap the menu to select a spec' : 'Select a spec to view'}
          </div>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Choose from the {isMobile ? 'menu' : 'sidebar'} to get started
          </p>
        </div>
      )}
    </div>
  );

  // Mobile layout with drawer
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)]">
        {/* Mobile header with menu trigger */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/50">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-background/50">
                <Menu className="h-4 w-4" />
                Specs
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0">
              <SheetHeader className="p-5 border-b border-border">
                <SheetTitle className="text-left flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Specifications
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-5rem)]">
                <div className="p-4">
                  <SidebarContent />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          {selectedSpecId && specDetail && (
            <span className="text-sm text-muted-foreground truncate font-mono">
              {specDetail.path}
            </span>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <ContentArea />
        </ScrollArea>
      </div>
    );
  }

  // Desktop layout with fixed sidebar
  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-6">
      {/* Sidebar */}
      <div className="w-72 border border-border/50 rounded-xl bg-card/50 backdrop-blur-sm flex-shrink-0 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Specifications
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredSpecs.length} {filteredSpecs.length === 1 ? 'spec' : 'specs'}
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-4.5rem)]">
          <div className="p-3">
            <SidebarContent />
          </div>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex-1 border border-border/50 rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden">
        <ScrollArea className="h-full">
          <ContentArea />
        </ScrollArea>
      </div>
    </div>
  );
}
