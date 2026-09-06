import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight, ArrowUpRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-bold uppercase tracking-[0.04em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-page hover:bg-ink-soft rounded-pill h-12 pl-5 pr-1.5 shadow-none",
        default:
          "bg-ink text-page hover:bg-ink-soft rounded-pill h-12 pl-5 pr-1.5 shadow-none",
        secondary:
          "bg-page border-[1.5px] border-ink text-ink hover:bg-page-alt rounded-pill h-12 pl-5 pr-1.5 shadow-none",
        ghost:
          "bg-transparent text-ink hover:bg-page-alt hover:text-ink rounded-pill h-10 px-4 normal-case tracking-normal font-semibold shadow-none",
        outline:
          "bg-transparent border border-border-subtle text-ink hover:bg-page-alt rounded-pill h-10 px-4 normal-case tracking-normal font-semibold shadow-none",
        icon:
          "w-10 h-10 rounded-full bg-page text-ink hover:bg-lime hover:text-ink transition-colors p-0 inline-flex items-center justify-center border-none shadow-none",
        darkIcon:
          "w-10 h-10 rounded-full bg-ink text-lime hover:bg-ink-soft transition-colors p-0 inline-flex items-center justify-center border-none shadow-none",
      },
      size: {
        default: "text-xs h-12",
        sm: "text-[11px] h-10 pl-4 pr-1",
        lg: "text-sm h-14 pl-6 pr-2",
        icon: "w-10 h-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  iconType?: "arrow-right" | "arrow-up-right" | "none"
  iconCircleClassName?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size,
      loading,
      iconType = "arrow-right",
      iconCircleClassName,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === "primary" || variant === "default"
    const isSecondary = variant === "secondary"
    const hasIconCircle = (isPrimary || isSecondary) && iconType !== "none"

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : null}

        <span className="flex-1 text-center">{children}</span>

        {hasIconCircle && !loading && (
          <span
            className={cn(
              "w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0 ml-3 transition-colors",
              isPrimary
                ? "bg-page text-ink"
                : "bg-ink text-page",
              iconCircleClassName
            )}
          >
            {iconType === "arrow-up-right" ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </span>
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
