// dashboard/src/components/core/feedback/badge.tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type StatusType = 'new' | 'whatsapp_sent' | 'email_sent' | 'replied' | 'converted' | 'skip' | string;

const statusStyles: Record<string, string> = {
  new: 'border-blue-500/30 bg-blue-950/30 text-blue-300',
  whatsapp_sent: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300',
  email_sent: 'border-purple-500/30 bg-purple-950/30 text-purple-300',
  replied: 'border-amber-500/30 bg-amber-950/30 text-amber-300',
  converted: 'border-blue-400/40 bg-blue-600/30 text-blue-200 font-bold',
  skip: 'border-zinc-800 bg-zinc-900/40 text-zinc-400',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StatusType;
  label?: string;
}

export function Badge({ status = 'new', label, className, ...props }: BadgeProps) {
  const style = statusStyles[status] || 'border-zinc-800 bg-zinc-900/40 text-zinc-400';
  const displayLabel = label || status.replace(/_/g, ' ');

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider',
          style,
          className
        )
      )}
      {...props}
    >
      {displayLabel}
    </span>
  );
}
