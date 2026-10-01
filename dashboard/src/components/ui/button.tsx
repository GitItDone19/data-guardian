import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-semibold",
        outline:
          "border-border bg-card/40 hover:bg-card hover:text-foreground text-muted-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40 font-mono text-xs",
        ghost:
          "hover:bg-secondary/60 hover:text-foreground text-muted-foreground",
        destructive:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30 font-mono",
        link: "text-primary underline-offset-4 hover:underline",
        // Forensic Instrument Variants
        instrument:
          "border-border/80 bg-card/60 hover:bg-card hover:border-primary/50 text-foreground font-mono text-xs tracking-tight shadow-sm active:translate-y-px",
        switch:
          "border-border/60 bg-secondary/40 hover:bg-secondary/80 text-foreground font-mono text-[11px] gap-2 rounded-[var(--radius-sm)] border",
        verdictApprove:
          "bg-success text-slate-950 font-mono font-semibold tracking-wider hover:bg-success/90 shadow-[0_0_18px_rgba(50,210,130,0.2)] border border-success/40",
        verdictReject:
          "bg-destructive/15 text-destructive border border-destructive/35 font-mono tracking-wider hover:bg-destructive/25",
      },
      size: {
        default: "h-8 gap-2 px-3 text-xs font-mono",
        xs: "h-6 gap-1.5 px-2 text-[10px] font-mono",
        sm: "h-7 gap-1.5 px-2.5 text-xs font-mono",
        lg: "h-9 gap-2 px-4 text-sm font-mono",
        icon: "size-8",
        "icon-xs": "size-6",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
