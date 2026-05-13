import { useState } from "react"
import { ImageIcon, Type } from "lucide-react"
import { PureEditor } from "@/components/editor/PureEditor"
import { ImageEditor } from "@/components/editor/ImageEditor"
import { Splash } from "@/components/Splash"

type Mode = "pure" | "image"

function App() {
  const [mode, setMode] = useState<Mode>("pure")
  const [splashed, setSplashed] = useState(false)

  if (!splashed) {
    return (
      <main className="h-[100dvh] bg-background text-foreground">
        <Splash onDone={() => setSplashed(true)} />
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
            字
          </div>
          <div className="text-sm font-semibold leading-none">made-font</div>
        </div>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("pure")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
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
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
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

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "pure" ? <PureEditor /> : <ImageEditor />}
      </div>
    </main>
  )
}

export default App
