// dashboard/src/components/core/cards/card.tsx
import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = true, padded = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'glass glow-border rounded-lg border border-blue-500/20 bg-blue-950/20 transition-all duration-200 shadow-xl overflow-hidden',
            padded && 'p-8', // 32px padding
            hoverable && 'hover:-translate-y-0.5 hover:border-blue-500/40',
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
