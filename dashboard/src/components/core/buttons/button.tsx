// dashboard/src/components/core/buttons/button.tsx
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-editorial-accentPrimary/50 disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 border border-blue-400/30',
        secondary:
          'bg-blue-950/30 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm',
        ghost:
          'bg-transparent hover:bg-blue-500/10 text-zinc-400 hover:text-white border border-transparent',
        outline:
          'bg-transparent border border-blue-500/30 text-blue-300 hover:bg-blue-500/15',
        destructive:
          'bg-red-950/30 hover:bg-red-600/20 text-red-300 border border-red-500/30',
        success:
          'bg-emerald-950/30 hover:bg-emerald-600/20 text-emerald-300 border border-emerald-500/30',
        warning:
          'bg-amber-950/30 hover:bg-amber-600/20 text-amber-300 border border-amber-500/30',
        floating:
          'bg-[#0b1324] hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xl rounded-full',
      },
      size: {
        default: 'h-12 px-5 text-sm rounded-md', // 48px height
        large: 'h-14 px-7 text-base rounded-md', // 56px height
        hero: 'h-16 px-8 text-lg rounded-hero',  // 64px height
        icon: 'h-12 w-12 rounded-md p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={twMerge(clsx(buttonVariants({ variant, size, className })))}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
