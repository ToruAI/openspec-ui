import { ArrowUpDown, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SortOption = 'name-asc' | 'name-desc' | 'progress-asc' | 'progress-desc';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'progress-asc', label: 'Progress (least first)' },
  { value: 'progress-desc', label: 'Progress (most first)' },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-8 gap-2">
        <ArrowUpDown className="h-4 w-4 shrink-0" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center justify-between w-full gap-4">
              <span>{option.label}</span>
              {value === option.value && <Check className="h-3 w-3 shrink-0" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
