import { EditorTopbar } from "@/components/editor/EditorTopbar"
import { MediaPanel } from "@/components/editor/MediaPanel"
import { PreviewPanel } from "@/components/editor/PreviewPanel"
import { PropertiesPanel } from "@/components/editor/PropertiesPanel"
import { Timeline } from "@/components/editor/Timeline"

export function EditorPage() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EditorTopbar />
      <div className="flex min-h-0 flex-1">
        <MediaPanel />
        <PreviewPanel />
        <PropertiesPanel />
      </div>
      <Timeline />
    </div>
  )
}
