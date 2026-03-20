import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"

// ─── Keyframe Styles ────────────────────────────────────────────────────────
// Injected once into the document so no extra CSS file is needed.
const SIDEBAR_STYLES = `
  @keyframes sb-logo-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  @keyframes sb-item-in {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0);     }
  }
  @keyframes sb-active-pulse {
    0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.25); }
    50%       { box-shadow: 0 0 0 5px hsl(var(--primary) / 0);  }
  }
  .sb-logo-enter {
    animation: sb-logo-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  /* Each sidebar menu item gets a staggered delay via CSS variable --sb-i */
  .sb-item-enter {
    opacity: 0;
    animation: sb-item-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--sb-i, 0) * 55ms + 80ms);
  }
  .sb-active-pulse {
    animation: sb-active-pulse 2.4s ease-in-out infinite;
  }
`

function injectSidebarStyles() {
  if (typeof document === "undefined") return
  if (document.getElementById("sb-anim-styles")) return
  const tag = document.createElement("style")
  tag.id = "sb-anim-styles"
  tag.textContent = SIDEBAR_STYLES
  document.head.appendChild(tag)
}

// ─── Context ─────────────────────────────────────────────────────────────────

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.")
  return context
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = (v: any) => {
    const s = typeof v === "function" ? v(open) : v
    if (setOpenProp) setOpenProp(s)
    else _setOpen(s)
  }
  const toggleSidebar = () => (isMobile ? setOpenMobile(!openMobile) : setOpen(!open))
  const state = (open ? "expanded" : "collapsed") as "expanded" | "collapsed"

  React.useEffect(() => { injectSidebarStyles() }, [])

  return (
    <SidebarContext.Provider value={{ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }}>
      <TooltipProvider delayDuration={0}>
        <div
          style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style } as any}
          className={cn("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar", className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
})

// ─── Sidebar Shell ────────────────────────────────────────────────────────────

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(({ side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (isMobile)
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          className="w-[18rem] bg-sidebar p-0 text-sidebar-foreground border-r border-sidebar-border"
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )

  return (
    <div
      ref={ref}
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      {/* Spacer */}
      <div
        className={cn(
          "relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0"
        )}
      />
      {/* Fixed panel */}
      <div
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear md:flex border-r border-sidebar-border bg-sidebar",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0",
          className
        )}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </div>
    </div>
  )
})

// ─── Menu Button (with stagger index support) ────────────────────────────────
// Pass `data-sb-i="0"`, `"1"`, `"2"` … on each SidebarMenuItem to stagger.

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }
>(({ asChild = false, isActive = false, className, style, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref}
      data-active={isActive}
      style={style}
      className={cn(
        // Base
        "relative flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-medium",
        "transition-all duration-200 ease-out",
        "text-muted-foreground",
        // Border always present, transparent at rest
        "border border-transparent",
        // Hover: lift up + purple border glow + text white
        "hover:bg-primary/10 hover:text-primary hover:-translate-y-[2px] hover:translate-x-0",
        "hover:border-purple-500/60",
        "hover:shadow-lg hover:shadow-purple-500/15",
        // Active: tinted bg + pulse glow
        isActive && "bg-primary/10 text-primary sb-active-pulse",
        className
      )}
      {...props}
    />
  )
})

// ─── Atomic Logo ─────────────────────────────────────────────────────────────

export const AtomiseLogo = () => (
  <div className="sb-logo-enter flex items-center gap-3 px-1 py-2">
    {/* Icon with subtle spin-in */}
    <div
      className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold"
      style={{
        boxShadow: "0 0 14px hsl(var(--primary) / 0.45)",
        transition: "box-shadow 0.3s ease",
      }}
    >
      A
    </div>
    <div className="flex flex-col">
      <span className="text-sidebar-foreground font-bold leading-tight">Atomise</span>
      <span className="text-primary text-[9px] font-bold tracking-widest">CRM</span>
    </div>
  </div>
)

// ─── Menu Item (wires up stagger index) ──────────────────────────────────────

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li"> & { index?: number }
>(({ index, style, className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("relative sb-item-enter", className)}
    style={{ "--sb-i": index ?? 0, ...style } as React.CSSProperties}
    {...props}
  />
))

// ─── Standard exports (unchanged) ────────────────────────────────────────────

export const SidebarTrigger = (props: any) => {
  const { toggleSidebar } = useSidebar()
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar} {...props}>
      <PanelLeft className="h-4 w-4" />
    </Button>
  )
}

export const SidebarInset = (props: any) => (
  <main className="relative flex min-h-svh flex-1 flex-col bg-sidebar" {...props} />
)
export const SidebarHeader = (props: any) => <div className="flex flex-col gap-2 p-4" {...props} />
export const SidebarContent = (props: any) => (
  <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto py-2" {...props} />
)
export const SidebarFooter = (props: any) => (
  <div className="flex flex-col gap-1 p-3 mt-auto border-t border-sidebar-border" {...props} />
)
export const SidebarGroup = (props: any) => (
  <div className="relative flex w-full min-w-0 flex-col p-2" {...props} />
)
export const SidebarGroupLabel = (props: any) => (
  <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-muted-foreground/60" {...props} />
)
export const SidebarMenu = (props: any) => (
  <ul className="flex w-full min-w-0 flex-col gap-1 px-2" {...props} />
)
export const SidebarRail = (props: any) => <div {...props} />
export const SidebarInput = (props: any) => <Input {...props} />
export const SidebarSeparator = (props: any) => <Separator {...props} />
export const SidebarGroupContent = (props: any) => <div {...props} />
export const SidebarMenuAction = (props: any) => <button {...props} />
export const SidebarMenuBadge = (props: any) => <div {...props} />
export const SidebarMenuSub = (props: any) => <ul {...props} />
export const SidebarMenuSubItem = (props: any) => <li {...props} />
export const SidebarMenuSubButton = (props: any) => <a {...props} />
export const SidebarMenuSkeleton = (props: any) => <div {...props} />