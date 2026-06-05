import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

export function SidebarFilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: Props) {
  // Find the display label for current value
  const displayLabel =
    value === null
      ? placeholder
      : options.find((o) => o.value === value)?.label;

  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange(v === '' ? null : v)}
    >
      <SelectTrigger className="h-7 text-xs text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3 border border-transparent hover:border-line-subtle transition-colors gap-1 px-2 max-w-28 flex overflow-hidden justify-start">
        <SelectValue placeholder={placeholder} className="truncate min-w-0">
          <span className="truncate">{displayLabel}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
