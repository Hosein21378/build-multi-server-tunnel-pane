import { CopyButton } from "@/components/CopyButton";

type CodeBlockProps = {
  code: string;
  label?: string;
  tone?: "neutral" | "before" | "after";
  className?: string;
};

const toneClass: Record<NonNullable<CodeBlockProps["tone"]>, string> = {
  neutral: "",
  before: "code-before",
  after: "code-after",
};

export function CodeBlock({ code, label, tone = "neutral", className = "" }: CodeBlockProps) {
  return (
    <div className={`code-shell ${toneClass[tone]} ${className}`}>
      {label ? (
        <div
          dir="rtl"
          className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-1.5"
        >
          <span className="text-[11px] font-medium text-slate-400">{label}</span>
          <CopyButton
            value={code}
            className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
          />
        </div>
      ) : null}
      <pre>{code}</pre>
    </div>
  );
}
