import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight">made-font</h1>
      </div>
      <p className="text-muted-foreground max-w-md text-center">
        React + Vite + TypeScript + Tailwind CSS + shadcn/ui
      </p>
      <div className="flex gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </main>
  )
}

export default App
