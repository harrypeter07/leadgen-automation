import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AccordionItem {
  id: string
  question?: string
  answer?: React.ReactNode
  title?: string
  content?: React.ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
  className?: string
}

export function Accordion({ items, className }: AccordionProps) {
  const [openId, setOpenId] = React.useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", className)}>
      {items.map((item) => {
        const isOpen = openId === item.id
        const itemQuestion = item.question || item.title
        const itemAnswer = item.answer || item.content

        return (
          <div
            key={item.id}
            className="bg-page-alt rounded-lg p-6 lg:p-8 transition-all flex flex-col justify-between"
          >
            <div
              onClick={() => toggle(item.id)}
              className="flex items-start gap-4 cursor-pointer select-none"
            >
              <button
                type="button"
                className="w-10 h-10 rounded-md bg-ink text-page flex items-center justify-center shrink-0 transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
              >
                <Plus className="w-5 h-5" />
              </button>
              <h4 className="text-lg font-bold text-ink font-display pt-1 leading-snug">
                {itemQuestion}
              </h4>
            </div>

            {isOpen && (
              <div className="mt-4 pt-4 border-t border-border-subtle text-sm text-text-body leading-relaxed animate-fade-in pl-14">
                {itemAnswer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
