import { useTrimToolStore, type TrimTool } from "@/hooks/useTrimTools";

const TOOLS: { id: TrimTool; label: string; title: string; icon: string }[] = [
  { id: "select",  label: "V",  title: "Select (V)",                icon: "↖" },
  { id: "trim",    label: "T",  title: "Trim — T (cycle tools)",    icon: "⊢" },
  { id: "ripple",  label: "R",  title: "Ripple edit",               icon: "⊣⊢" },
  { id: "roll",    label: "RO", title: "Roll edit",                 icon: "⊢⊣" },
  { id: "slip",    label: "SL", title: "Slip edit",                 icon: "↔" },
  { id: "slide",   label: "SD", title: "Slide edit",                icon: "⇔" },
];

export function TrimToolbar() {
  const activeTool = useTrimToolStore((s) => s.activeTool);
  const setTool = useTrimToolStore((s) => s.setTool);

  return (
    <div className="flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 p-0.5">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={t.title}
          className={`flex h-6 min-w-[26px] items-center justify-center rounded px-1.5 text-[10px] font-mono font-semibold transition-colors ${
            activeTool === t.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
