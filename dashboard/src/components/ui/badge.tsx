import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors select-none",
  {
    variants: {
      variant: {
        dark: "bg-ink text-lime border-none",
        lime: "bg-lime text-ink border-none",
        neutral: "bg-transparent text-text-muted border border-border-subtle",
        muted: "bg-page-alt text-ink-muted border-none",
        sage: "bg-sage text-sage-text border-none",
        lavender: "bg-lavender text-lavender-text border-none",
        success: "bg-[#6FA968]/20 text-[#2E4E29] border border-[#6FA968]/30",
        warning: "bg-[#D6B25E]/20 text-[#5C481A] border border-[#D6B25E]/30",
        error: "bg-[#B5583F]/20 text-[#592316] border border-[#B5583F]/30",
        info: "bg-[#7C8FD6]/20 text-[#293563] border border-[#7C8FD6]/30",
        // Legacy variant aliases
        default: "bg-ink text-lime border-none",
        secondary: "bg-page-alt text-ink-muted border-none",
        outline: "bg-transparent text-text-muted border border-border-subtle",
      },
    },
    defaultVariants: {
      variant: "dark",
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
