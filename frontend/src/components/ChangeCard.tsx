import type { Change } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Layers, CheckSquare, Palette } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ChangeCardProps {
  change: Change;
  onClick: () => void;
}

export function ChangeCard({ change, onClick }: ChangeCardProps) {
  const taskStats = change.taskStats;
  const progress = taskStats && taskStats.total > 0 ? (taskStats.done / taskStats.total) * 100 : 0;
  const isComplete = progress === 100;

  return (
    <Card
      className={cn(
        "cursor-pointer card-hover border-border/50 bg-card/80 backdrop-blur-sm",
        "hover:border-primary/30 transition-all duration-200",
        isComplete && "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: Title + Source */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-sm flex-1 line-clamp-2 leading-snug">
            {change.name}
          </h3>
          <Badge 
            variant="secondary" 
            className="text-[10px] font-medium px-2 py-0.5 shrink-0 bg-muted/80"
          >
            {change.sourceId}
          </Badge>
        </div>

        {/* Progress bar */}
        {taskStats && taskStats.total > 0 && (
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">
                {taskStats.done} of {taskStats.total} tasks
              </span>
              <span className={cn(
                "font-semibold tabular-nums",
                isComplete ? "text-[var(--accent-emerald)]" : "text-foreground"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  isComplete 
                    ? "bg-[var(--accent-emerald)]" 
                    : "progress-gradient"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Document indicators */}
        <div className="flex gap-2 flex-wrap items-center">
          {change.hasProposal && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400">
              <FileText className="h-3 w-3" />
              <span className="text-[10px] font-medium">Proposal</span>
            </div>
          )}
          {change.hasSpecs && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
              <Layers className="h-3 w-3" />
              <span className="text-[10px] font-medium">Specs</span>
            </div>
          )}
          {change.hasTasks && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <CheckSquare className="h-3 w-3" />
              <span className="text-[10px] font-medium">Tasks</span>
            </div>
          )}
          {change.hasDesign && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-400">
              <Palette className="h-3 w-3" />
              <span className="text-[10px] font-medium">Design</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
