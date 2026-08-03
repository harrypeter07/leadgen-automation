import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <span className="absolute left-4 text-text-muted pointer-events-none">
          {icon || <Search className="w-4 h-4" />}
        </span>
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full h-12 rounded-pill bg-page-alt pl-11 pr-5 text-sm text-ink placeholder:text-text-muted border-none focus:outline-none focus:ring-2 focus:ring-lime transition-all duration-200 font-medium",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
