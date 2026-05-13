import { useState } from "react"
import { ImageIcon, Type } from "lucide-react"
import { PureEditor } from "@/components/editor/PureEditor"
import { ImageEditor } from "@/components/editor/ImageEditor"

type Mode = "pure" | "image"

function App() {
  const [mode, setMode] = useState<Mode>("pure")

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold tracking-tighter">
            字
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">made-font</div>
            <div className="text-[11px] text-muted-foreground">字型 → 圖片</div>
          </div>
        </div>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("pure")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
              mode === "pure"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            純編輯
          </button>
          <button
            type="button"
            onClick={() => setMode("image")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
              mode === "image"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            圖片
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {mode === "pure" ? <PureEditor /> : <ImageEditor />}
      </div>
    </main>
  )
}

export default App
