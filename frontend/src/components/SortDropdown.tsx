import { ArrowUpDown, ArrowUpAZ, ArrowDownAZ, TrendingUp, TrendingDown, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { SortOption } from '@/lib/board';

export type { SortOption };

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'name-asc', label: 'Name A–Z', icon: <ArrowUpAZ className="h-4 w-4" /> },
  { value: 'name-desc', label: 'Name Z–A', icon: <ArrowDownAZ className="h-4 w-4" /> },
  { value: 'progress-asc', label: 'Least done', icon: <TrendingDown className="h-4 w-4" /> },
  { value: 'progress-desc', label: 'Most done', icon: <TrendingUp className="h-4 w-4" /> },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const selectedOption = SORT_OPTIONS.find(opt => opt.value === value);
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Sort" className={cn(
        "w-[140px] h-9 gap-2",
        "bg-background/50 border-border/70",
        "hover:border-border transition-colors"
      )}>
        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Sort by">
          {selectedOption?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-muted-foreground",
                  value === option.value && "text-primary"
                )}>
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </div>
              {value === option.value && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
