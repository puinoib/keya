import { Calendar } from '@/components/ui/calendar';

export function DayPicker({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Calendar
      mode="single"
      selected={value}
      defaultMonth={value ?? new Date()}
      onSelect={(date) => {
        if (date) onChange(date);
      }}
    />
  );
}
