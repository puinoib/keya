import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  DayPicker,
  getDefaultClassNames,
  type DayPickerProps,
} from 'react-day-picker';
import { cn } from '@/lib/utils';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3 select-none', className)}
      classNames={{
        ...defaultClassNames,
        root: cn(defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('space-y-2', defaultClassNames.month),
        month_caption: cn(
          'flex h-6 items-center justify-center text-xs font-medium text-ink-secondary',
          defaultClassNames.month_caption
        ),
        caption_label: cn('truncate', defaultClassNames.caption_label),
        nav: cn(
          'absolute inset-x-0 top-0 flex items-center justify-between',
          defaultClassNames.nav
        ),
        button_previous: cn(
          'size-6 inline-flex items-center justify-center rounded text-ink-quaternary transition-colors hover:bg-surface-3 hover:text-ink-secondary disabled:pointer-events-none disabled:opacity-40',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          'size-6 inline-flex items-center justify-center rounded text-ink-quaternary transition-colors hover:bg-surface-3 hover:text-ink-secondary disabled:pointer-events-none disabled:opacity-40',
          defaultClassNames.button_next
        ),
        month_grid: cn(
          'w-full border-collapse space-y-1',
          defaultClassNames.month_grid
        ),
        weekdays: cn('grid grid-cols-7', defaultClassNames.weekdays),
        weekday: cn(
          'py-0.5 text-center text-[9px] font-normal leading-none tracking-[0.08em] text-ink-quaternary/70',
          defaultClassNames.weekday
        ),
        week: cn('grid grid-cols-7 gap-0.5', defaultClassNames.week),
        day: cn(
          'relative size-7 p-0 text-center text-xs text-ink-secondary',
          defaultClassNames.day
        ),
        day_button: cn(
          'size-7 rounded text-xs transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright disabled:pointer-events-none',
          defaultClassNames.day_button
        ),
        selected: cn(
          '[&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent-bright',
          defaultClassNames.selected
        ),
        today: cn('[&>button]:text-accent-bright', defaultClassNames.today),
        outside: cn(
          'text-ink-quaternary/30 [&>button]:text-ink-quaternary/30',
          defaultClassNames.outside
        ),
        disabled: cn(
          'pointer-events-none text-ink-quaternary/25 [&>button]:cursor-not-allowed [&>button]:text-ink-quaternary/25',
          defaultClassNames.disabled
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          const Icon = orientation === 'left' ? CaretLeft : CaretRight;
          return <Icon className={cn('size-3', chevronClassName)} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
