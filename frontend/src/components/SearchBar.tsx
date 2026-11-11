import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search...", className, id }: SearchBarProps) {
  return (
    <div className={cn("relative w-full sm:w-auto group", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-primary" />
      <Input
        id={id}
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          }
        }}
        placeholder={placeholder}
        className={cn(
          "pl-9 pr-9 h-9 w-full sm:w-[200px] [&::-webkit-search-cancel-button]:hidden",
          "bg-background/50 border-border/70",
          "focus:border-primary/50 focus:bg-background",
          "transition-all duration-200",
          "placeholder:text-muted-foreground"
        )}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-muted"
          onClick={() => onChange('')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
