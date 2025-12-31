import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Menu } from 'lucide-react';
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
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading specs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="text-destructive">Error loading specs</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
      </div>
    );
  }

  if (filteredSpecs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">
          {selectedSourceId ? 'No specs found for selected project' : 'No specs found'}
        </div>
      </div>
    );
  }

  // Sidebar content (shared between drawer and fixed sidebar)
  const SidebarContent = () => (
    <div className="space-y-4">
      {Object.entries(specsBySource).map(([sourceId, sourceSpecs]) => (
        <div key={sourceId}>
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            {sourceId}
          </div>
          <div className="space-y-1">
            {sourceSpecs.map((spec) => (
              <button
                key={spec.id}
                onClick={() => handleSpecSelect(spec.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedSpecId === spec.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {spec.path}
              </button>
            ))}
          </div>
          <Separator className="my-4" />
        </div>
      ))}
    </div>
  );

  // Content area
  const ContentArea = () => (
    <div className="p-4 md:p-6">
      {selectedSpecId ? (
        detailLoading ? (
          <div className="text-muted-foreground">Loading spec...</div>
        ) : specDetail ? (
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">
              {specDetail.path}
            </h1>
            <div className="text-sm text-muted-foreground mb-6">
              {specDetail.sourceId}
            </div>
            <div className="prose prose-sm md:prose dark:prose-invert max-w-none">
              <ReactMarkdown>{specDetail.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">Failed to load spec</div>
        )
      ) : (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          {isMobile ? 'Tap the menu to select a spec' : 'Select a spec to view'}
        </div>
      )}
    </div>
  );

  // Mobile layout with drawer
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)]">
        {/* Mobile header with menu trigger */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                Specs
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle>Specifications</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-5rem)]">
                <div className="p-4">
                  <SidebarContent />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          {selectedSpecId && specDetail && (
            <span className="text-sm text-muted-foreground truncate">
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
    <div className="flex h-[calc(100dvh-8rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex-shrink-0">
        <div className="p-4">
          <h2 className="text-sm font-semibold mb-4">Specifications</h2>
          <ScrollArea className="h-[calc(100dvh-12rem)]">
            <SidebarContent />
          </ScrollArea>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <ContentArea />
      </ScrollArea>
    </div>
  );
}
