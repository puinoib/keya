import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root {...props} />;
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      className={cn('border-b border-line-subtle last:border-b-0', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex flex-1 items-center justify-between py-3 text-left',
          'text-sm font-medium text-ink-primary transition-colors',
          'hover:text-ink-secondary',
          className
        )}
        {...props}
      >
        {children}
        <CaretDown
          weight="bold"
          className="h-3.5 w-3.5 shrink-0 text-ink-quaternary transition-transform duration-200 group-data-[panel-open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionPanel({
  className,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      className={cn('text-sm text-ink-secondary pb-4', className)}
      {...props}
    />
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
