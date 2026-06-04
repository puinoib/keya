export function DayPicker({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  const year = value ? value.getFullYear() : new Date().getFullYear();
  const month = value ? value.getMonth() : new Date().getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prevMonth = () =>
    onChange(new Date(year, month - 1, value?.getDate() ?? 1));
  const nextMonth = () =>
    onChange(new Date(year, month + 1, value?.getDate() ?? 1));

  return (
    <div className="p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="size-6 flex items-center justify-center rounded text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M8 2L4 6l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-xs font-medium text-ink-secondary">
          {new Date(year, month).toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="size-6 flex items-center justify-center rounded text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-2xs text-ink-quaternary py-1">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const date = new Date(year, month, day);
          const isPast = date < today;
          const isSelected =
            value &&
            value.getFullYear() === year &&
            value.getMonth() === month &&
            value.getDate() === day;
          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onChange(date)}
              className={`size-7 rounded text-xs flex items-center justify-center transition-colors
                ${isSelected ? 'bg-accent text-white' : isPast ? 'text-ink-quaternary/40 cursor-not-allowed' : 'text-ink-secondary hover:bg-surface-3'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
