import { Calendar } from '@/components/ui/calendar';

export function DayPicker({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Calendar
      mode="single"
      selected={value}
      defaultMonth={value ?? today}
      disabled={{ before: today }}
      onSelect={(date) => {
        if (date) onChange(date);
      }}
    />
  );
}
