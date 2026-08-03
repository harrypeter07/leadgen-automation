import * as React from "react"
import { cn } from "@/lib/utils"

interface TabItem {
  id: string
  label: string
  count?: number | string
}

interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  variant?: "primary" | "secondary"
  className?: string
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "primary",
  className,
}: TabsProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap select-none", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-pill px-4 py-2 text-xs font-bold uppercase tracking-button transition-all duration-200 flex items-center gap-1.5",
              isActive
                ? variant === "primary"
                  ? "bg-lime text-ink font-bold"
                  : "bg-ink text-page font-bold"
                : "bg-transparent text-text-muted hover:text-ink font-semibold"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn("text-[10px]", isActive ? "opacity-90" : "opacity-60")}>
                ({tab.count})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
