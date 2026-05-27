import { useCallback } from "react"
import { Folder, FileText, BookOpen } from "lucide-react"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { useUiStore } from "@/store/ui"
import { useWorkspaceStore } from "@/store/workspace"
import { useTabsStore } from "@/store/tabs"
import type { CollectionItem, Collection } from "@/types"

type SearchResult =
  | { kind: "collection"; id: string; label: string; collection: Collection }
  | { kind: "folder"; id: string; label: string; collectionId: string; breadcrumb: string }
  | {
      kind: "request"
      id: string
      label: string
      method: string
      url: string
      collectionId: string
    }

function collectResults(
  items: CollectionItem[],
  collectionId: string,
  prefix: string,
  out: SearchResult[],
): void {
  for (const item of items) {
    if ("method" in item) {
      out.push({
        kind: "request",
        id: item.id,
        label: item.name,
        method: item.method,
        url: item.url,
        collectionId,
      })
    } else {
      const crumb = prefix ? `${prefix} / ${item.name}` : item.name
      out.push({ kind: "folder", id: item.id, label: item.name, collectionId, breadcrumb: crumb })
      collectResults(item.items, collectionId, crumb, out)
    }
  }
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-500",
  POST: "text-amber-500",
  PUT: "text-blue-500",
  PATCH: "text-violet-500",
  DELETE: "text-red-500",
}

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useUiStore()
  const { collections } = useWorkspaceStore()
  const { openRequestTab, openCollectionTab, openFolderTab } = useTabsStore()

  const results: SearchResult[] = []
  for (const col of collections) {
    results.push({ kind: "collection", id: col.id, label: col.name, collection: col })
    collectResults(col.items, col.id, col.name, results)
  }

  const handleSelect = useCallback(
    (r: SearchResult) => {
      setSearchOpen(false)
      if (r.kind === "collection") {
        openCollectionTab(r.collection)
      } else if (r.kind === "folder") {
        const col = collections.find((c) => c.id === r.collectionId)
        if (!col) return
        function findFolder(
          items: CollectionItem[],
          id: string,
        ): import("@/types").FolderItem | null {
          for (const item of items) {
            if (!("method" in item)) {
              if (item.id === id) return item
              const found = findFolder(item.items, id)
              if (found) return found
            }
          }
          return null
        }
        const folder = findFolder(col.items, r.id)
        if (folder) openFolderTab(folder, r.collectionId)
      } else {
        const col = collections.find((c) => c.id === r.collectionId)
        if (!col) return
        function findRequest(
          items: CollectionItem[],
          id: string,
        ): import("@/types").RequestItem | null {
          for (const item of items) {
            if ("method" in item) {
              if (item.id === id) return item
            } else {
              const found = findRequest(item.items, id)
              if (found) return found
            }
          }
          return null
        }
        const req = findRequest(col.items, r.id)
        if (req) openRequestTab(req)
      }
    },
    [collections, openCollectionTab, openFolderTab, openRequestTab, setSearchOpen],
  )

  const collectionResults = results.filter((r) => r.kind === "collection")
  const folderResults = results.filter((r) => r.kind === "folder")
  const requestResults = results.filter((r) => r.kind === "request")

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={setSearchOpen}
      title="Search"
      description="Search collections, folders, and requests"
    >
      <Command>
        <CommandInput placeholder="Search collections, folders, requests..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {collectionResults.length > 0 && (
            <CommandGroup heading="Collections">
              {collectionResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`col:${r.label}`}
                  onSelect={() => handleSelect(r)}
                  className="gap-2 text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {folderResults.length > 0 && (
            <CommandGroup heading="Folders">
              {folderResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`folder:${r.kind === "folder" ? r.breadcrumb : r.label}`}
                  onSelect={() => handleSelect(r)}
                  className="gap-2 text-xs"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{r.label}</span>
                  {r.kind === "folder" && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {r.breadcrumb}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {requestResults.length > 0 && (
            <CommandGroup heading="Requests">
              {requestResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`req:${r.label}:${r.kind === "request" ? r.url : ""}`}
                  onSelect={() => handleSelect(r)}
                  className="gap-2 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {r.kind === "request" && (
                    <span
                      className={`font-mono font-bold text-[10px] shrink-0 ${METHOD_COLORS[r.method] ?? "text-muted-foreground"}`}
                    >
                      {r.method}
                    </span>
                  )}
                  <span className="flex-1 truncate">{r.label}</span>
                  {r.kind === "request" && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[160px] font-mono">
                      {r.url}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
