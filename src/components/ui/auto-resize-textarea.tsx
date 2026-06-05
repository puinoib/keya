import * as React from 'react';
import { cn } from '@/lib/utils';

type TextSecurityStyle = React.CSSProperties & {
  WebkitTextSecurity?: 'disc' | 'none';
};

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  masked?: boolean;
}

const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, masked = false, onInput, style, value, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(() => {
    const textarea = innerRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    resize();
  }, [resize, value]);

  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  const mergedStyle: TextSecurityStyle = {
    ...style,
    WebkitTextSecurity: masked ? 'disc' : 'none',
  };

  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      style={mergedStyle}
      className={cn(
        'flex min-h-9 w-full resize-none overflow-hidden rounded-md bg-surface-2 border border-line px-3 py-2',
        'text-sm text-ink-primary placeholder:text-ink-quaternary',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors duration-150',
        className
      )}
      {...props}
    />
  );
});
AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export { AutoResizeTextarea };
