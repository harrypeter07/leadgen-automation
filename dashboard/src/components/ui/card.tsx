import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowUpRight } from "lucide-react"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "page-alt" | "lavender" | "sage" | "cream" | "ink" | "hover"
  }
>(({ className, variant = "page-alt", ...props }, ref) => {
  const variantStyles = {
    default: "bg-page-alt text-ink",
    "page-alt": "bg-page-alt text-ink",
    lavender: "bg-lavender text-lavender-text",
    sage: "bg-sage text-sage-text",
    cream: "bg-cream-panel text-ink",
    ink: "bg-ink text-page",
    hover: "bg-page-alt text-ink hover:-translate-y-0.5 hover:shadow-hover transition-all duration-200 cursor-pointer",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg p-6 border-none shadow-none transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6 border-b border-border-subtle/50", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-bold font-display text-ink leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-text-muted font-medium", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-4", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 border-t border-border-subtle/50 mt-4", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Stat / Metric Card
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  variant?: "lavender" | "cream" | "sage" | "page-alt"
  subtext?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, variant = "lavender", subtext, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        variant={variant}
        className={cn("flex flex-col justify-between min-h-[120px] p-6 rounded-lg", className)}
        {...props}
      >
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] opacity-75">
          {label}
        </span>
        <div className="mt-3">
          <div className="text-3xl lg:text-4xl font-extrabold tracking-tight font-display">
            {value}
          </div>
          {subtext && (
            <p className="text-xs opacity-75 mt-1 font-medium">{subtext}</p>
          )}
        </div>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

// Hero Card
interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string
  title: string
  description?: string
  variant?: "sage" | "ink" | "lavender"
  action?: React.ReactNode
}

const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  (
    { className, eyebrow, title, description, variant = "sage", action, children, ...props },
    ref
  ) => {
    const isDark = variant === "ink"
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl p-8 lg:p-10 transition-all flex flex-col justify-between relative overflow-hidden",
          variant === "sage" && "bg-sage text-sage-text",
          variant === "ink" && "bg-ink text-page",
          variant === "lavender" && "bg-lavender text-lavender-text",
          className
        )}
        {...props}
      >
        <div>
          {eyebrow && (
            <span
              className={cn(
                "inline-block rounded-pill px-3.5 py-1 text-[11px] font-bold uppercase tracking-eyebrow mb-4",
                isDark ? "bg-lime text-ink" : "bg-ink text-lime"
              )}
            >
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight font-display leading-[1.05]">
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "text-base lg:text-lg mt-3 max-w-2xl font-normal leading-relaxed",
                isDark ? "text-text-onDarkMuted" : "opacity-90"
              )}
            >
              {description}
            </p>
          )}
        </div>
        {children}
        {action && <div className="mt-8">{action}</div>}
      </div>
    )
  }
)
HeroCard.displayName = "HeroCard"

// Gallery / Item Card
interface GalleryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  badge?: React.ReactNode
  description?: string
  caption?: string
  avatar?: React.ReactNode
  onCardClick?: () => void
}

const GalleryCard = React.forwardRef<HTMLDivElement, GalleryCardProps>(
  (
    { className, title, badge, description, caption, avatar, onCardClick, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        onClick={onCardClick}
        className={cn(
          "bg-page-alt rounded-lg p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover cursor-pointer group",
          className
        )}
        {...props}
      >
        <div>
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {avatar && (
                <div className="w-10 h-10 rounded-sm bg-page flex items-center justify-center font-bold text-ink shrink-0">
                  {avatar}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-ink font-display truncate">
                    {title}
                  </h3>
                  {badge}
                </div>
              </div>
            </div>
            <span className="w-9 h-9 rounded-full bg-page text-ink flex items-center justify-center group-hover:bg-lime transition-colors shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-4">
              {description}
            </p>
          )}
        </div>

        {/* Caption bottom row */}
        {caption && (
          <div className="text-[11px] text-text-muted font-medium pt-3 border-t border-border-subtle">
            {caption}
          </div>
        )}
      </div>
    )
  }
)
GalleryCard.displayName = "GalleryCard"

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  HeroCard,
  GalleryCard
}
