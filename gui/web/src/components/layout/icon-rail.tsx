import { FolderOpen, Globe2, Clock3 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useUiStore, type SidePanel } from "@/store/ui"

interface RailItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}

function RailItem({ icon, label, active, onClick }: RailItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150",
            active
              ? "bg-primary/10 text-primary after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:h-4 after:w-0.5 after:rounded-r after:bg-primary after:-ml-[2px]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function IconRail() {
  const { activePanel, togglePanel } = useUiStore()

  const panels: { panel: SidePanel; icon: React.ReactNode; label: string }[] = [
    {
      panel: "collections",
      icon: <FolderOpen className="h-[17px] w-[17px]" />,
      label: "Collections",
    },
    {
      panel: "environments",
      icon: <Globe2 className="h-[17px] w-[17px]" />,
      label: "Environments",
    },
    { panel: "history", icon: <Clock3 className="h-[17px] w-[17px]" />, label: "History" },
  ]

  return (
    <div className="w-[46px] flex flex-col items-center py-2 gap-1 border-r border-border bg-card shrink-0 overflow-hidden">
      {panels.map(({ panel, icon, label }) => (
        <RailItem
          key={panel}
          icon={icon}
          label={label}
          active={activePanel === panel}
          onClick={() => togglePanel(panel)}
        />
      ))}

      <div className="flex-1" />
    </div>
  )
}
