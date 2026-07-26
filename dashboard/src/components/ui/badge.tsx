import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-blue-500/30 bg-blue-500/15 text-blue-300 font-mono",
        glow: "border-blue-400/40 bg-blue-600/20 text-blue-200 shadow-sm shadow-blue-500/20 font-mono",
        secondary: "border-slate-700/60 bg-slate-800/60 text-slate-300",
        destructive: "border-red-500/30 bg-red-500/15 text-red-300",
        critical: "border-red-500/40 bg-red-500/20 text-red-300 font-semibold animate-pulse",
        outline: "border-white/10 text-muted-foreground bg-white/5",
        success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-mono",
        warning: "border-amber-500/30 bg-amber-500/15 text-amber-300 font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
