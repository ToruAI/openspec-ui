import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { TouchEvent } from 'react';
import { useChanges, useSources } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Change, ChangeStatus } from '../types';
import { ChangeCard } from './ChangeCard';
import { ColumnSkeleton } from './LoadingSkeleton';
import { SearchBar } from './SearchBar';
import { SortDropdown, type SortOption } from './SortDropdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BASE_COLUMNS: { status: ChangeStatus; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

const ARCHIVED_COLUMN: { status: ChangeStatus; label: string } = {
  status: 'archived',
  label: 'Archived',
};

interface KanbanBoardProps {
  onCardClick: (change: Change) => void;
  selectedSourceId: string | null;
  showArchived?: boolean;
  onOpenSettings?: () => void;
}

export function KanbanBoard({ onCardClick, selectedSourceId, showArchived = false, onOpenSettings }: KanbanBoardProps) {
  const { changes, loading, error } = useChanges();
  const { sources } = useSources();
  const isMobile = useIsMobile();
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  // Build columns array based on showArchived
  const COLUMNS = showArchived
    ? [...BASE_COLUMNS, ARCHIVED_COLUMN]
    : BASE_COLUMNS;

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
        {COLUMNS.map(() => <ColumnSkeleton key={crypto.randomUUID()} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="text-destructive">Error loading changes</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  const hasNoSources = sources.length === 0;
  if (sortedChanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-muted-foreground text-lg">
          {hasNoSources
            ? "No OpenSpec sources configured"
            : selectedSourceId
              ? "No changes found for this project"
              : searchQuery
                ? "No changes found matching your search"
                : "No changes found"
          }
        </div>
        {hasNoSources && (
          <Button onClick={onOpenSettings} size="sm">
            Configure Sources
          </Button>
        )}
        {searchQuery && sortedChanges.length === 0 && !hasNoSources && (
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
    const columnChanges = sortedChanges.filter((c) => c.status === activeColumn.status);

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
            <div className="flex bg-muted rounded-full p-1 gap-0.5">
              {COLUMNS.map((col, idx) => {
                const colChanges = sortedChanges.filter((c) => c.status === col.status);
                return (
                  <button
                    key={col.status}
                    onClick={() => {
                      if (!isAnimating) {
                        setIsAnimating(true);
                        setActiveColumnIndex(idx);
                        setTimeout(() => setIsAnimating(false), 200);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200",
                      idx === activeColumnIndex
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={`${col.label} (${colChanges.length})`}
                  >
                    {col.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
            {/* Count badge */}
            <span className="text-xs text-muted-foreground">
              {columnChanges.length} {columnChanges.length === 1 ? 'item' : 'items'}
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
              {columnChanges.map((change) => (
                <ChangeCard
                  key={change.id}
                  change={change}
                  onClick={() => onCardClick(change)}
                />
              ))}
              {columnChanges.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-muted-foreground/60 text-4xl mb-3">📋</div>
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
        {COLUMNS.map(({ status, label }) => {
          const columnChanges = sortedChanges.filter((c) => c.status === status);
          return (
            <div
              key={status}
              className="flex-1 min-w-0 flex flex-col"
            >
              <div className="sticky top-0 bg-background py-2 z-10">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {label}
                </h2>
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  {columnChanges.length}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[calc(100dvh-12rem)]">
                {columnChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onClick={() => onCardClick(change)}
                  />
                ))}
                {columnChanges.length === 0 && (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No items
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
