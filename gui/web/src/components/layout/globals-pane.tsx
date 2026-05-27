import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkspaceStore } from "@/store/workspace"
import { useDeleteConfirm } from "@/hooks/use-delete-confirm"
import type { EnvVariable } from "@/types"

function GlobalRow({ variable }: { variable: EnvVariable }) {
  const { updateGlobalVariable, deleteGlobalVariable } = useWorkspaceStore()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-muted/20">
      {deleteDialog}
      <Checkbox
        checked={variable.enabled}
        onCheckedChange={(checked) => updateGlobalVariable(variable.id, { enabled: !!checked })}
        className="shrink-0"
      />
      <Input
        value={variable.key}
        onChange={(e) => updateGlobalVariable(variable.id, { key: e.target.value })}
        placeholder="Variable"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <Input
        value={variable.initialValue}
        onChange={(e) => updateGlobalVariable(variable.id, { initialValue: e.target.value })}
        placeholder="Initial value"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <Input
        value={variable.currentValue}
        onChange={(e) => updateGlobalVariable(variable.id, { currentValue: e.target.value })}
        placeholder="Current value"
        className="h-6 text-xs font-mono flex-1 border-0 bg-transparent focus-visible:ring-1 px-1"
      />
      <button
        onClick={() => requestDelete(variable.key || "", () => deleteGlobalVariable(variable.id))}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

export function GlobalsPane() {
  const { globalVariables, addGlobalVariable } = useWorkspaceStore()

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border shrink-0 bg-card">
        <span className="text-sm font-semibold text-foreground">Global Variables</span>
        <span className="text-xs text-muted-foreground">{globalVariables.length} variables</span>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 bg-muted/30">
        <div className="w-4 shrink-0" />
        <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Variable
        </span>
        <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Initial Value
        </span>
        <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Current Value
        </span>
        <div className="w-5 shrink-0" />
      </div>

      <ScrollArea className="flex-1">
        {globalVariables.map((v) => (
          <GlobalRow key={v.id} variable={v} />
        ))}
        {globalVariables.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">No global variables yet. Add one below.</p>
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={addGlobalVariable}
        >
          <Plus className="h-3 w-3" />
          Add Variable
        </Button>
      </div>
    </div>
  )
}
