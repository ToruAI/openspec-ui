import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { TouchEvent } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Source, Change, ChangeStatus, Idea } from '../types';
import { ChangeCard } from './ChangeCard';
import { IdeaCard } from './IdeaCard';
import { ColumnSkeleton } from './LoadingSkeleton';
import { SearchBar } from './SearchBar';
import { SortDropdown, type SortOption } from './SortDropdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Lightbulb, 
  ListTodo, 
  Loader, 
  CheckCircle2, 
  Archive,
  FolderOpen,
  Sparkles
} from 'lucide-react';

const ARCHIVED_COLUMN = {
  label: 'Archived',
  icon: <Archive className="h-4 w-4" />,
  color: 'text-gray-500'
};

const COLUMN_CONFIG: { status: ChangeStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { 
    status: 'todo', 
    label: 'Todo', 
    icon: <ListTodo className="h-4 w-4" />,
    color: 'text-blue-500'
  },
  { 
    status: 'in_progress', 
    label: 'In Progress', 
    icon: <Loader className="h-4 w-4" />,
    color: 'text-amber-500'
  },
  { 
    status: 'done', 
    label: 'Done', 
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-500'
  },
];

const IDEAS_COLUMN = {
  label: 'Ideas',
  icon: <Lightbulb className="h-4 w-4" />,
  color: 'text-violet-500'
};

type Column = 
  | { type: 'ideas'; label: string; icon: React.ReactNode; color: string }
  | { type: 'archived' | 'status'; status: ChangeStatus; label: string; icon: React.ReactNode; color: string };

interface KanbanBoardProps {
  changes: Change[];
  ideas: Idea[];
  sources: Source[];
  loading?: boolean;
  error?: Error | null;
  onCardClick: (change: Change) => void;
  onIdeaClick?: (idea: Idea) => void;
  selectedSourceId: string | null;
  showArchived?: boolean;
  onOpenSettings?: () => void;
}

export function KanbanBoard({ 
  changes, 
  ideas, 
  sources,
  loading = false, 
  error = null, 
  onCardClick, 
  onIdeaClick, 
  selectedSourceId, 
  showArchived = false, 
  onOpenSettings 
}: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  // Build columns array based on showArchived - Ideas column is always first
  const COLUMNS: Column[] = [
    { type: 'ideas', ...IDEAS_COLUMN },
    ...COLUMN_CONFIG.map(col => ({ type: 'status' as const, ...col })),
  ];
  
  if (showArchived) {
    COLUMNS.push({ type: 'archived', status: 'archived', ...ARCHIVED_COLUMN });
  }

  // Reset active column index if it's out of bounds when columns change
  useEffect(() => {
    setActiveColumnIndex(prev => {
      if (prev >= COLUMNS.length) {
        return COLUMNS.length - 1;
      }
      return prev;
    });
  }, [COLUMNS.length]);

  // Filter changes by selected source and archived status
  const filteredChanges = useMemo(() => {
    let result = selectedSourceId
      ? changes.filter((c) => c.sourceId === selectedSourceId)
      : changes;

    // Filter out archived changes when showArchived is false
    if (!showArchived) {
      result = result.filter((c) => c.status !== 'archived');
    }
    
    // Filter out draft changes (now removed - use Ideas column instead)
    result = result.filter((c) => c.status !== 'draft');

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        c.sourceId.toLowerCase().includes(query)
      );
    }

    return result;
  }, [changes, selectedSourceId, showArchived, searchQuery]);

  // Filter ideas by selected source
  const filteredIdeas = useMemo(() => {
    let result = ideas;
    
    // Filter by selected source
    if (selectedSourceId) {
      result = result.filter((idea) => idea.sourceId === selectedSourceId);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((idea) =>
        idea.title.toLowerCase().includes(query) ||
        idea.description.toLowerCase().includes(query) ||
        idea.sourceId.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [ideas, selectedSourceId, searchQuery]);

  // Apply sorting
  const sortedChanges = useMemo(() => {
    const result = [...filteredChanges];
    if (sortBy === 'name-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'progress-asc') {
      result.sort((a, b) => {
        const aProgress = a.taskStats ? a.taskStats.done / a.taskStats.total : 0;
        const bProgress = b.taskStats ? b.taskStats.done / b.taskStats.total : 0;
        return aProgress - bProgress;
      });
    } else if (sortBy === 'progress-desc') {
      result.sort((a, b) => {
        const aProgress = a.taskStats ? a.taskStats.done / a.taskStats.total : 0;
        const bProgress = b.taskStats ? b.taskStats.done / b.taskStats.total : 0;
        return bProgress - aProgress;
      });
    }
    return result;
  }, [filteredChanges, sortBy]);

  // Swipe handling with drag offset
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isAnimating) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Add resistance at edges
    const isAtStart = activeColumnIndex === 0 && diff > 0;
    const isAtEnd = activeColumnIndex === COLUMNS.length - 1 && diff < 0;
    
    if (isAtStart || isAtEnd) {
      setDragOffset(diff * 0.3); // Rubber band effect
    } else {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (isAnimating) return;
    
    const diff = touchStartX.current - touchCurrentX.current;
    const threshold = 60;
    const containerWidth = containerRef.current?.offsetWidth || 300;

    setIsAnimating(true);

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && activeColumnIndex < COLUMNS.length - 1) {
        // Swipe left - next column
        setDragOffset(-containerWidth);
        setTimeout(() => {
          setActiveColumnIndex(prev => prev + 1);
          setDragOffset(0);
          setIsAnimating(false);
        }, 200);
      } else if (diff < 0 && activeColumnIndex > 0) {
        // Swipe right - previous column
        setDragOffset(containerWidth);
        setTimeout(() => {
          setActiveColumnIndex(prev => prev - 1);
          setDragOffset(0);
          setIsAnimating(false);
        }, 200);
      } else {
        // Bounce back
        setDragOffset(0);
        setTimeout(() => setIsAnimating(false), 200);
      }
    } else {
      // Bounce back
      setDragOffset(0);
      setTimeout(() => setIsAnimating(false), 200);
    }
  };

  const goToPrevColumn = useCallback(() => {
    if (activeColumnIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setActiveColumnIndex(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 200);
    }
  }, [activeColumnIndex, isAnimating]);

  const goToNextColumn = useCallback(() => {
    if (activeColumnIndex < COLUMNS.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setActiveColumnIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 200);
    }
  }, [activeColumnIndex, COLUMNS.length, isAnimating]);

  if (loading) {
    return (
      <div className="flex gap-4 pb-4">
        {COLUMNS.map((_, i) => <ColumnSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <div className="text-destructive font-medium">Error loading changes</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  const hasNoSources = sources.length === 0;
  const hasAnyItems = sortedChanges.length > 0 || filteredIdeas.length > 0;
  
  if (!hasAnyItems) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
          {hasNoSources ? (
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          ) : (
            <Sparkles className="h-10 w-10 text-muted-foreground/50" />
          )}
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-lg font-medium">
            {hasNoSources
              ? "No OpenSpec sources configured"
              : selectedSourceId
                ? "No changes found for this project"
                : searchQuery
                  ? "No items found matching your search"
                  : "No items found"
            }
          </div>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {hasNoSources 
              ? "Add a source to get started" 
              : "Try adjusting your filters or create a new idea"
            }
          </p>
        </div>
        {hasNoSources && (
          <Button onClick={onOpenSettings} size="sm" className="mt-2">
            <FolderOpen className="h-4 w-4 mr-2" />
            Configure Sources
          </Button>
        )}
        {searchQuery && !hasAnyItems && !hasNoSources && (
          <Button onClick={() => setSearchQuery('')} variant="outline" size="sm">
            Clear Search
          </Button>
        )}
      </div>
    );
  }

  // Mobile: Single column with swipe
  if (isMobile) {
    const activeColumn = COLUMNS[activeColumnIndex];
    const isIdeasColumn = (activeColumn as any).type === 'ideas';
    const isArchivedColumn = (activeColumn as any).type === 'archived';
    
    let columnItems: (Change | Idea)[] = [];
    if (isIdeasColumn) {
      columnItems = filteredIdeas;
    } else if (isArchivedColumn) {
      columnItems = sortedChanges.filter((c) => c.status === 'archived');
    } else {
      columnItems = sortedChanges.filter((c) => c.status === (activeColumn as { status: ChangeStatus }).status);
    }
    
    const totalCount = columnItems.length;

    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)]">
        {/* Search */}
        <div className="px-1 pb-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search changes..."
          />
        </div>

        {/* Column tabs with navigation */}
        <div className="flex items-center justify-between px-1 pb-3">
          <button
            onClick={goToPrevColumn}
            disabled={activeColumnIndex === 0}
            className={cn(
              "p-2 rounded-full transition-all",
              activeColumnIndex === 0
                ? "text-muted-foreground/30"
                : "text-foreground hover:bg-muted active:scale-95"
            )}
            aria-label="Previous column"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col items-center gap-1.5">
            {/* Pill tabs */}
            <div className="flex bg-muted/50 rounded-full p-1 gap-0.5">
              {COLUMNS.map((col, idx) => {
                const isIdeasColumn = (col as any).type === 'ideas';
                const isArchivedColumn = (col as any).type === 'archived';
                let colItems: (Change | Idea)[] = [];
                
                if (isIdeasColumn) {
                  colItems = filteredIdeas;
                } else if (isArchivedColumn) {
                  colItems = sortedChanges.filter((c) => c.status === 'archived');
                } else {
                  // Must be a status column
                  colItems = sortedChanges.filter((c) => c.status === (col as { status: ChangeStatus }).status);
                }
                
                const totalCount = colItems.length;
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isAnimating) {
                        setIsAnimating(true);
                        setActiveColumnIndex(idx);
                        setTimeout(() => setIsAnimating(false), 200);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1.5",
                      idx === activeColumnIndex
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={`${col.label} (${totalCount})`}
                  >
                    <span className={col.color}>{col.icon}</span>
                    <span className="hidden xs:inline">{col.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Count badge */}
            <span className="text-xs text-muted-foreground">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <button
            onClick={goToNextColumn}
            disabled={activeColumnIndex === COLUMNS.length - 1}
            className={cn(
              "p-2 rounded-full transition-all",
              activeColumnIndex === COLUMNS.length - 1
                ? "text-muted-foreground/30"
                : "text-foreground hover:bg-muted active:scale-95"
            )}
            aria-label="Next column"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Swipeable content area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
           <div 
             className={cn(
               "h-full px-1 overflow-y-auto",
               isAnimating && "transition-transform duration-200 ease-out"
             )}
             style={{ 
               transform: `translateX(${dragOffset}px)`,
               opacity: Math.max(0.4, 1 - Math.abs(dragOffset) / 400)
             }}
            >
              <div className="flex flex-col gap-3 pb-4">
                {columnItems.map((item) => {
                  // Type guard based on unique properties: Idea doesn't have 'status'
                  const isIdea = !('status' in item);
                  
                  if (isIdea) {
                    return (
                      <IdeaCard
                        key={item.id}
                        idea={item}
                        onClick={() => onIdeaClick?.(item)}
                      />
                    );
                  } else {
                    return (
                      <ChangeCard
                        key={item.id}
                        change={item}
                        onClick={() => onCardClick(item)}
                      />
                    );
                  }
                })}
                
                {totalCount === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className={cn("mb-3", activeColumn.color)}>
                      {activeColumn.icon}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      No items in {activeColumn.label}
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Horizontal columns
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search changes..."
        />
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 pb-4">
        {COLUMNS.map((column) => {
          const isIdeasColumn = (column as any).type === 'ideas';
          const isArchivedColumn = (column as any).type === 'archived';
          let columnItems: (Change | Idea)[] = [];
          
          if (isIdeasColumn) {
            columnItems = filteredIdeas;
          } else if (isArchivedColumn) {
            columnItems = sortedChanges.filter((c) => c.status === 'archived');
          } else {
            columnItems = sortedChanges.filter((c) => c.status === (column as { status: ChangeStatus }).status);
          }
          
          const { label, icon, color } = column;
          const totalCount = columnItems.length;
          
          return (
            <div
              key={label}
              className="flex-1 min-w-0 flex flex-col"
            >
              {/* Column header */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-3 z-10 border-b border-border/50 mb-3">
                <div className="flex items-center gap-2">
                  <span className={color}>{icon}</span>
                  <h2 className="text-sm font-semibold text-foreground">
                    {label}
                  </h2>
                  <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {totalCount}
                  </span>
                </div>
              </div>
              
              {/* Column content */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100dvh-14rem)] pr-1">
                {columnItems.map((item) => {
                  // Type guard based on unique properties: Idea doesn't have 'status'
                  const isIdea = !('status' in item);
                  
                  if (isIdea) {
                    return (
                      <IdeaCard
                        key={item.id}
                        idea={item}
                        onClick={() => onIdeaClick?.(item)}
                      />
                    );
                  } else {
                    return (
                      <ChangeCard
                        key={item.id}
                        change={item}
                        onClick={() => onCardClick(item)}
                      />
                    );
                  }
                })}
                
                {totalCount === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border/50 bg-muted/20">
                    <span className={cn("mb-2 opacity-40", color)}>{icon}</span>
                    <div className="text-xs text-muted-foreground/70">
                      No items
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
