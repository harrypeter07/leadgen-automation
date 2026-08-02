# 03. UI Components & Design System Architecture

This document documents every reusable UI component in `dashboard/src/components` and its UI building blocks.

---

## 1. Design System & Styling Architecture

The dashboard UI is built on Next.js 14, React 18, and Tailwind CSS. Modern design primitives are constructed using **Class Variance Authority (`cva`)** for type-safe variant management and **`tailwind-merge` (`cn`)** for conflict-free utility merging.

### Utility Helper: `dashboard/src/lib/utils.ts`
```typescript
import { ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 2. Reusable Component Inventory

### 1. Button Component (`dashboard/src/components/ui/button.tsx`)
- **File Path**: `dashboard/src/components/ui/button.tsx`
- **Purpose**: Core interactive button component supporting multiple visual variants, sizes, and accessible HTML button attributes.
- **Props**:
  - `variant`: `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`
  - `size`: `'default' | 'sm' | 'lg' | 'icon'`
  - `asChild`: `boolean` (delegates rendering to child slot via Radix `Slot` primitive if enabled)
  - Standard `React.ButtonHTMLAttributes<HTMLButtonElement>`
- **Styling Tokens**: Smooth transitions, focus-visible outline rings, disabled state opacities (`disabled:pointer-events-none disabled:opacity-50`).

### 2. Loading Button Component (`dashboard/src/components/ui/loading-button.tsx`)
- **File Path**: `dashboard/src/components/ui/loading-button.tsx`
- **Purpose**: Wraps `Button` to render a spinning SVG loader icon when `loading` prop is `true`, disabling interaction.
- **Props**:
  - `loading`: `boolean`
  - Inherits all `ButtonProps`.
- **Usage**: Used in scraper submission forms, login submission button, WhatsApp manual trigger buttons, and Meta credential save actions.

### 3. Card Primitive Family (`dashboard/src/components/ui/card.tsx`)
- **File Path**: `dashboard/src/components/ui/card.tsx`
- **Purpose**: Modular visual container primitive family implementing dark glassmorphism surfaces and structured card layouts.
- **Exported Sub-components**:
  - `Card`: Primary rounded border container (`rounded-xl border bg-card text-card-foreground shadow-sm`).
  - `CardHeader`: Flex header container with vertical spacing.
  - `CardTitle`: `<h3>` heading formatted with tight tracking (`text-2xl font-semibold leading-none tracking-tight`).
  - `CardDescription`: Sub-text container formatted with muted foreground color.
  - `CardContent`: Main padded container body (`p-6 pt-0`).
  - `CardFooter`: Flex container positioned at bottom for action buttons.
- **Usage**: Metrics counters on `/dashboard`, Instagram profile summaries, scraper status panels, settings cards.

### 4. Dialog & Modal Primitives (`dashboard/src/components/ui/dialog.tsx`)
- **File Path**: `dashboard/src/components/ui/dialog.tsx`
- **Purpose**: Accessible overlay modal dialog built on Radix UI Dialog primitives.
- **Exported Sub-components**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`.
- **Usage**: Used for confirming destructive actions, viewing full lead JSON payloads, editing individual lead records.

### 5. Input Component (`dashboard/src/components/ui/input.tsx`)
- **File Path**: `dashboard/src/components/ui/input.tsx`
- **Purpose**: Form input element styled with unified borders, focus ring states, and file button styling.
- **Props**: Standard `React.InputHTMLAttributes<HTMLInputElement>`.
- **Usage**: Search inputs across `/leads`, keyword/city inputs on `/scraper`, password input on `/login`, configuration key fields on `/settings`.

### 6. Badge Component (`dashboard/src/components/ui/badge.tsx`)
- **File Path**: `dashboard/src/components/ui/badge.tsx`
- **Purpose**: Status pill badge component for categorizing lead pipeline states and job status indicators.
- **Props**:
  - `variant`: `'default' | 'secondary' | 'destructive' | 'outline'`
- **Usage**:
  - `status === 'new'`: Secondary gray badge
  - `status === 'whatsapp_sent'`: Green success badge
  - `status === 'email_sent'`: Blue info badge
  - `status === 'failed'`: Red destructive badge

### 7. Gemini Key Modal (`dashboard/src/components/gemini-key-modal.tsx`)
- **File Path**: `dashboard/src/components/gemini-key-modal.tsx`
- **Purpose**: Modal interface prompting user to enter or update their custom `GEMINI_API_KEY` for AI copy generation.
- **State**: Tracks input key string, validation state, local storage persistence.
- **Side Effects**: Saves entered key to `localStorage` under `gemini_api_key` key and updates runtime client context.

---

## 3. Global Layout Shell Components

### Layout Client Shell (`dashboard/src/app/layout-client.tsx`)
- **Purpose**: Wraps all authenticated pages inside the main dashboard layout frame.
- **Renders**:
  - **Sidebar Navigation**: Fixed left-hand navigation menu with links to `/dashboard`, `/leads`, `/scraper`, `/instagram-analyzer`, `/website-analyzer`, `/whatsapp`, `/workflows`, `/metrics`, `/settings`.
  - **Header Bar**: Top bar displaying current page title, server health indicators, quick action buttons, and Logout button.
  - **Main Content Workspace**: Scrollable viewport area rendering page children.
  - **Toaster Component**: Global `react-hot-toast` notifications container.
- **State Managed**: Sidebar collapsed/expanded state, mobile drawer drawer open/closed state.
