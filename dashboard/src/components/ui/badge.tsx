import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-[var(--radius-sm)] border border-transparent px-2 py-0.5 text-[11px] font-mono whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground border-border/50",
        destructive: "bg-destructive/15 text-destructive border-destructive/30",
        outline: "border-border text-foreground bg-card/40",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Forensic Case File Status Variants
        waiting: "bg-warning/15 text-warning border-warning/40 breathe-amber shadow-[0_0_12px_rgba(235,160,50,0.15)]",
        resolved: "bg-success/15 text-success border-success/40 shadow-[0_0_10px_rgba(40,200,120,0.12)]",
        investigating: "bg-info/15 text-info border-info/40",
        detected: "bg-destructive/15 text-destructive border-destructive/40 shadow-[0_0_10px_rgba(240,60,60,0.15)]",
        rejected: "bg-muted-rose/15 text-muted-rose border-muted-rose/40",
        specimen: "bg-secondary/60 text-muted-foreground border-border font-mono text-[10px] tracking-wider uppercase",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
