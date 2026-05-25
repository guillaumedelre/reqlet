import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { SearchModal } from "@/components/search-modal"

export function App() {
  return (
    <ThemeProvider>
      <AppLayout />
      <SearchModal />
      <Toaster position="bottom-right" richColors />
    </ThemeProvider>
  )
}
