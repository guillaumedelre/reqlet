import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Trash2,
  Pencil,
  Copy,
  Download,
  Upload,
  Globe2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MethodBadge } from "@/components/method-badge"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/store/workspace"
import { useTabsStore } from "@/store/tabs"
import { useUiStore } from "@/store/ui"
import { useDeleteConfirm } from "@/hooks/use-delete-confirm"
import { api } from "@/lib/api"
import { listHistory, deleteHistoryEntry, clearHistory } from "@/lib/backend"
import type { HistoryEntry } from "@/lib/backend"
import type { Collection, CollectionItem, FolderItem, HttpMethod, RequestItem } from "@/types"
import { isRequest } from "@/types"

// ---------- Drag-and-drop context ----------

interface DragCtx {
  draggedId: string | null
  dragOverId: string | null
  startDrag: (id: string, collectionId: string) => void
  endDrag: () => void
  setDragOver: (id: string | null) => void
  drop: (targetCollectionId: string, targetFolderId: string | null) => void
}

const DragContext = createContext<DragCtx>({
  draggedId: null,
  dragOverId: null,
  startDrag: () => {},
  endDrag: () => {},
  setDragOver: () => {},
  drop: () => {},
})

// ---------- Inline rename input ----------

interface InlineRenameProps {
  name: string
  onCommit: (name: string) => void
  onCancel: () => void
  className?: string
}

function InlineRename({ name, onCommit, onCancel, className }: InlineRenameProps) {
  const [value, setValue] = useState(name)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          onCommit(value)
        }
        if (e.key === "Escape") {
          e.preventDefault()
          onCancel()
        }
        e.stopPropagation()
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex-1 min-w-0 text-xs bg-transparent border-b border-primary/60 focus:outline-none px-0 leading-none",
        className,
      )}
    />
  )
}

// ---------- Tree nodes ----------

interface RequestNodeProps {
  item: RequestItem
  depth: number
  collectionId: string
}

function RequestNode({ item, depth, collectionId }: RequestNodeProps) {
  const { openRequestTab, tabs, updateTab } = useTabsStore()
  const { renameItem, duplicateItem, deleteItem } = useWorkspaceStore()
  const { startDrag, endDrag } = useContext(DragContext)
  const [editing, setEditing] = useState(false)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const handleCommitRename = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== item.name) {
      renameItem(collectionId, item.id, trimmed)
      const tab = tabs.find((t) => t.requestId === item.id)
      if (tab) updateTab(tab.id, { title: trimmed })
    }
    setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        startDrag(item.id, collectionId)
      }}
      onDragEnd={endDrag}
      className={cn(
        "group flex items-center gap-1.5 h-7 pr-1 rounded cursor-pointer select-none transition-colors",
        "hover:bg-accent/60",
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={() => !editing && openRequestTab(item)}
    >
      {deleteDialog}
      <MethodBadge method={item.method} className="w-[46px]" />
      {editing ? (
        <InlineRename
          name={item.name}
          onCommit={handleCommitRename}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span className="flex-1 text-xs text-foreground truncate leading-none">{item.name}</span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 text-xs">
          <DropdownMenuItem className="text-xs gap-2" onSelect={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs gap-2"
            onSelect={() => duplicateItem(collectionId, item.id)}
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs gap-2 text-destructive focus:text-destructive"
            onSelect={() => requestDelete(item.name, () => deleteItem(collectionId, item.id))}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface FolderNodeProps {
  item: FolderItem
  depth: number
  collectionId: string
}

function FolderNode({ item, depth, collectionId }: FolderNodeProps) {
  const { isExpanded, toggleExpand, renameItem, duplicateItem, deleteItem, addRequest, addFolder } =
    useWorkspaceStore()
  const { openFolderTab, openRequestTab, tabs, updateTab } = useTabsStore()
  const { startDrag, endDrag, draggedId, dragOverId, setDragOver, drop } = useContext(DragContext)
  const expanded = isExpanded(item.id)
  const [editing, setEditing] = useState(false)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const actionTakenRef = useRef(false)

  const handleCommitRename = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== item.name) {
      renameItem(collectionId, item.id, trimmed)
      const tab = tabs.find((t) => t.folderId === item.id)
      if (tab) updateTab(tab.id, { title: trimmed })
    }
    setEditing(false)
  }

  const handleAddRequest = () => {
    const req = addRequest(collectionId, item.id)
    if (!expanded) toggleExpand(item.id)
    openRequestTab(req)
    actionTakenRef.current = true
  }

  const handleAddFolder = () => {
    const folder = addFolder(collectionId, item.id)
    if (!expanded) toggleExpand(item.id)
    openFolderTab(folder, collectionId)
    actionTakenRef.current = true
  }

  const isDropTarget = dragOverId === item.id && draggedId !== item.id

  return (
    <div>
      {deleteDialog}
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          startDrag(item.id, collectionId)
        }}
        onDragEnd={endDrag}
        onDragOver={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes("Files")) return
          e.stopPropagation()
          setDragOver(item.id)
        }}
        onDragLeave={(e) => {
          e.stopPropagation()
          setDragOver(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files.length > 0) return
          e.stopPropagation()
          drop(collectionId, item.id)
        }}
        className={cn(
          "group flex items-center gap-1 h-7 pr-1 rounded cursor-pointer select-none transition-colors hover:bg-accent/60",
          isDropTarget && "ring-1 ring-primary/60 bg-primary/5",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (editing) return
          if (actionTakenRef.current) {
            actionTakenRef.current = false
            return
          }
          toggleExpand(item.id)
          openFolderTab(item, collectionId)
        }}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150",
            expanded && "rotate-90",
          )}
          onClick={(e) => {
            e.stopPropagation()
            toggleExpand(item.id)
          }}
        />
        {expanded ? (
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}

        {editing ? (
          <InlineRename
            name={item.name}
            onCommit={handleCommitRename}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="flex-1 text-xs text-foreground truncate leading-none">{item.name}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem className="text-xs gap-2" onSelect={handleAddRequest}>
              <FileText className="h-3 w-3" />
              Add Request
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onSelect={handleAddFolder}>
              <Folder className="h-3 w-3" />
              Add Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2" onSelect={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs gap-2"
              onSelect={() => duplicateItem(collectionId, item.id)}
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs gap-2 text-destructive focus:text-destructive"
              onSelect={() => requestDelete(item.name, () => deleteItem(collectionId, item.id))}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div>
          {item.items.map((child) => (
            <TreeNode key={child.id} item={child} depth={depth + 1} collectionId={collectionId} />
          ))}
        </div>
      )}
    </div>
  )
}

function TreeNode({
  item,
  depth,
  collectionId,
}: {
  item: CollectionItem
  depth: number
  collectionId: string
}) {
  if (isRequest(item)) return <RequestNode item={item} depth={depth} collectionId={collectionId} />
  return <FolderNode item={item} depth={depth} collectionId={collectionId} />
}

// ---------- Collection card ----------

function CollectionCard({ collection, autoEdit }: { collection: Collection; autoEdit?: boolean }) {
  const {
    isExpanded,
    toggleExpand,
    renameCollection,
    duplicateCollection,
    deleteCollection,
    addRequest,
    addFolder,
  } = useWorkspaceStore()
  const { openCollectionTab, openFolderTab, openRequestTab, tabs, updateTab } = useTabsStore()
  const { draggedId, dragOverId, setDragOver, drop } = useContext(DragContext)
  const expanded = isExpanded(collection.id)
  const [editing, setEditing] = useState(false)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const actionTakenRef = useRef(false)

  useEffect(() => {
    if (autoEdit) setEditing(true)
  }, [autoEdit])
  const isDropTarget = dragOverId === collection.id && draggedId !== collection.id

  const requestCount = (items: CollectionItem[]): number =>
    items.reduce((acc, item) => {
      if (isRequest(item)) return acc + 1
      return acc + requestCount(item.items)
    }, 0)

  const handleCommitRename = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== collection.name) {
      renameCollection(collection.id, trimmed)
      const tab = tabs.find((t) => t.collectionId === collection.id && t.type === "collection")
      if (tab) updateTab(tab.id, { title: trimmed })
    }
    setEditing(false)
  }

  const handleAddRequest = () => {
    const req = addRequest(collection.id)
    if (!expanded) toggleExpand(collection.id)
    openRequestTab(req)
    actionTakenRef.current = true
  }

  const handleAddFolder = () => {
    const folder = addFolder(collection.id)
    if (!expanded) toggleExpand(collection.id)
    openFolderTab(folder, collection.id)
    actionTakenRef.current = true
  }

  return (
    <div className="mb-0.5">
      {deleteDialog}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(collection.id)
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => {
          e.preventDefault()
          drop(collection.id, null)
        }}
        className={cn(
          "group flex items-center gap-1.5 h-8 px-2 rounded cursor-pointer select-none transition-colors hover:bg-accent/60",
          isDropTarget && "ring-1 ring-primary/60 bg-primary/5",
        )}
        onClick={() => {
          if (editing) return
          if (actionTakenRef.current) {
            actionTakenRef.current = false
            return
          }
          openCollectionTab(collection)
        }}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150",
            expanded && "rotate-90",
          )}
          onClick={(e) => {
            e.stopPropagation()
            toggleExpand(collection.id)
          }}
        />
        <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />

        {editing ? (
          <InlineRename
            name={collection.name}
            onCommit={handleCommitRename}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="flex-1 text-xs font-medium text-foreground truncate leading-none">
            {collection.name}
          </span>
        )}

        {!editing && (
          <span className="text-[0.625rem] text-muted-foreground shrink-0">
            {requestCount(collection.items)}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem className="text-xs gap-2" onSelect={handleAddRequest}>
              <FileText className="h-3 w-3" />
              Add Request
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onSelect={handleAddFolder}>
              <Folder className="h-3 w-3" />
              Add Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs gap-2"
              onSelect={() => duplicateCollection(collection.id)}
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs gap-2"
              onSelect={() => api.collections.export(collection.id)}
            >
              <Download className="h-3 w-3" />
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs gap-2 text-destructive focus:text-destructive"
              onSelect={() => requestDelete(collection.name, () => deleteCollection(collection.id))}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="pb-0.5">
          {collection.items.map((item) => (
            <TreeNode key={item.id} item={item} depth={1} collectionId={collection.id} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Panel views ----------

function CollectionsPanel() {
  const { collections, moveItem, addCollection } = useWorkspaceStore()
  const { openCollectionTab } = useTabsStore()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOver] = useState<string | null>(null)
  const dragSourceRef = useRef<{ id: string; collectionId: string } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const col = addCollection("New Collection")
    openCollectionTab(col)
    setEditingId(col.id)
  }

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const name: string = json?.info?.name ?? json?.name ?? ""
        if (name && collections.some((c) => c.name === name)) {
          toast.error(`A collection named "${name}" already exists.`)
          return
        }
        await api.collections.import(file)
        await queryClient.refetchQueries({ queryKey: ["collections"] })
      } catch {
        toast.error("Failed to import collection. Check the file format.")
      }
    },
    [collections, queryClient],
  )

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    await importFile(file)
  }

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.dataTransfer.files.length === 0) return
      const file = e.dataTransfer.files[0]
      if (!file.name.endsWith(".json")) {
        toast.error("Only JSON collection files are supported.")
        return
      }
      await importFile(file)
    },
    [importFile],
  )

  const startDrag = useCallback((id: string, collectionId: string) => {
    dragSourceRef.current = { id, collectionId }
    setDraggedId(id)
  }, [])

  const endDrag = useCallback(() => {
    dragSourceRef.current = null
    setDraggedId(null)
    setDragOver(null)
  }, [])

  const drop = useCallback(
    (targetCollectionId: string, targetFolderId: string | null) => {
      const src = dragSourceRef.current
      if (!src || src.id === targetFolderId) {
        endDrag()
        return
      }
      moveItem(src.collectionId, src.id, targetCollectionId, targetFolderId)
      endDrag()
    },
    [moveItem, endDrag],
  )

  const filtered = query.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : collections

  return (
    <DragContext.Provider value={{ draggedId, dragOverId, startDrag, endDrag, setDragOver, drop }}>
      <div
        className="flex flex-col h-full"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <div className="flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
          <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
            Collections
          </span>
          <div className="flex items-center gap-0.5">
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Import collection</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={handleAdd}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">New Collection</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search collections…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-6 pl-6 text-xs bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-1 py-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No collections found
            </div>
          ) : (
            filtered.map((col) => (
              <CollectionCard key={col.id} collection={col} autoEdit={editingId === col.id} />
            ))
          )}
        </ScrollArea>
      </div>
    </DragContext.Provider>
  )
}

function EnvironmentsPanel() {
  const { environments, globalVariables, addEnvironment, deleteEnvironment, renameEnvironment } =
    useWorkspaceStore()
  const { activeEnvironmentId, setActiveEnvironment } = useUiStore()
  const { openEnvironmentTab, openGlobalsTab, tabs, updateTab } = useTabsStore()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const env = addEnvironment("New Environment")
    openEnvironmentTab(env)
    setEditingId(env.id)
  }

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const name: string = json?.name ?? ""
        if (name && environments.some((env) => env.name === name)) {
          toast.error(`An environment named "${name}" already exists.`)
          return
        }
        await api.environments.import(file)
        await queryClient.invalidateQueries({ queryKey: ["environments"] })
      } catch {
        toast.error("Failed to import environment. Check the file format.")
      }
    },
    [environments, queryClient],
  )

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    await importFile(file)
  }

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.dataTransfer.files.length === 0) return
      const file = e.dataTransfer.files[0]
      if (!file.name.endsWith(".json")) {
        toast.error("Only JSON environment files are supported.")
        return
      }
      await importFile(file)
    },
    [importFile],
  )

  const handleCommitRename = (id: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed) {
      renameEnvironment(id, trimmed)
      const tab = tabs.find((t) => t.environmentId === id)
      if (tab) updateTab(tab.id, { title: trimmed })
    }
    setEditingId(null)
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      <div className="flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
        <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
          Environments
        </span>
        <div className="flex items-center gap-0.5">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Import environment</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={handleAdd}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">New Environment</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {deleteDialog}
      <ScrollArea className="flex-1 min-h-0 p-2">
        <div className="space-y-0.5">
          {/* Globals entry — singleton */}
          <div
            className="flex items-center gap-2 h-8 px-2 rounded cursor-pointer transition-colors hover:bg-accent/60 text-foreground"
            onClick={openGlobalsTab}
          >
            <Globe2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1 text-xs">Globals</span>
            <span className="text-[0.625rem] text-muted-foreground">
              {globalVariables.length} vars
            </span>
          </div>

          <div className="h-px bg-border mx-1 my-0.5" />

          {environments.map((env) => (
            <div
              key={env.id}
              className={cn(
                "group flex items-center gap-2 h-8 px-2 rounded cursor-pointer transition-colors",
                activeEnvironmentId === env.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent/60 text-foreground",
              )}
              onClick={() => {
                if (editingId === env.id) return
                openEnvironmentTab(env)
              }}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  activeEnvironmentId === env.id ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              {editingId === env.id ? (
                <InlineRename
                  name={env.name}
                  onCommit={(name) => handleCommitRename(env.id, name)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <span className="flex-1 text-xs truncate">{env.name}</span>
              )}
              {editingId !== env.id && (
                <span className="text-[0.625rem] text-muted-foreground">
                  {env.variables.length} vars
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem className="text-xs gap-2" onSelect={() => setEditingId(env.id)}>
                    <Pencil className="h-3 w-3" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs gap-2"
                    onSelect={() => api.environments.export(env.id)}
                  >
                    <Download className="h-3 w-3" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs gap-2 text-destructive focus:text-destructive"
                    onSelect={() =>
                      requestDelete(env.name, () => {
                        if (activeEnvironmentId === env.id) setActiveEnvironment(null)
                        deleteEnvironment(env.id)
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {environments.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No environments yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

const PAGE_SIZE = 50

function statusColor(status: number) {
  if (status >= 500) return "text-destructive"
  if (status >= 400) return "text-orange-500 dark:text-orange-400"
  if (status >= 300) return "text-yellow-500 dark:text-yellow-400"
  if (status >= 200) return "text-emerald-600 dark:text-emerald-400"
  return "text-muted-foreground"
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function HistoryPanel() {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const { dialog, requestDelete } = useDeleteConfirm()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["history", offset],
    queryFn: () => listHistory(PAGE_SIZE, offset),
    staleTime: 0,
  })

  useEffect(() => {
    if (data === undefined) return
    setEntries((prev) => (offset === 0 ? data : [...prev, ...data]))
    setHasMore(data.length === PAGE_SIZE)
  }, [data, offset])

  const reload = useCallback(() => {
    setOffset(0)
    setEntries([])
    queryClient.invalidateQueries({ queryKey: ["history"] })
  }, [queryClient])

  const handleDelete = useCallback(
    (entry: HistoryEntry) => {
      requestDelete(`${entry.method} ${entry.url}`, async () => {
        await deleteHistoryEntry(entry.id)
        reload()
      })
    },
    [requestDelete, reload],
  )

  const handleClearAll = useCallback(() => {
    requestDelete("all history entries", async () => {
      await clearHistory()
      reload()
    })
  }, [requestDelete, reload])

  return (
    <div className="flex flex-col h-full">
      {dialog}

      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
          History
        </span>
        {entries.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Clear all
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* List */}
      {isLoading && offset === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Loading…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-4">No history yet</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-default"
              >
                <MethodBadge
                  method={entry.method as HttpMethod}
                  className="shrink-0 text-[0.6rem] px-1 py-px"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate text-foreground leading-snug">{entry.url}</p>
                  <p className="text-[0.6rem] text-muted-foreground leading-snug">
                    <span className={statusColor(entry.status)}>{entry.status}</span>
                    {" · "}
                    {formatDuration(entry.durationMs)}
                    {" · "}
                    {formatTimestamp(entry.timestamp)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(entry)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {hasMore && (
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={isFetching}
                >
                  {isFetching ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// ---------- Main export ----------

export function SidePanel() {
  const { activePanel } = useUiStore()

  if (!activePanel) return null

  return (
    <div className="flex flex-col h-full border-r border-border bg-sidebar text-sidebar-foreground overflow-hidden">
      {activePanel === "collections" && <CollectionsPanel />}
      {activePanel === "environments" && <EnvironmentsPanel />}
      {activePanel === "history" && <HistoryPanel />}
    </div>
  )
}
