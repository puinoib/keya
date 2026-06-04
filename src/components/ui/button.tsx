import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-bright',
        ghost:
          'bg-surface-2 text-ink-secondary border border-line hover:bg-surface-5 hover:text-ink-primary',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        outline:
          'border border-line bg-transparent text-ink-secondary hover:bg-surface-4 hover:text-ink-primary',
        secondary:
          'bg-surface-4 text-ink-secondary hover:bg-surface-6 hover:text-ink-primary',
        link: 'text-ink-secondary underline-offset-4 hover:underline hover:text-ink-primary',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = React.Children.only(children) as React.ReactElement<
        Record<string, unknown>
      >;
      return React.cloneElement(child, {
        className: cn(
          buttonVariants({ variant, size }),
          className,
          child.props.className
        ),
        ref,
        ...props,
      });
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
