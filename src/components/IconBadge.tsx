import type { LucideIcon } from "lucide-react";

type IconBadgeProps = {
  icon: LucideIcon;
  tone?: "emerald" | "gold" | "mint" | "amber" | "sky";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const TONES: Record<NonNullable<IconBadgeProps["tone"]>, string> = {
  emerald: "border-[#1B4332]/25 from-[#DDF1E4] to-[#B7DEC5] text-[#1B4332]",
  gold: "border-[#A16207]/25 from-[#FEF3C7] to-[#FDE68A] text-[#854D0E]",
  mint: "border-[#1B4332]/20 from-[#F6FBF8] to-[#DDEBE1] text-[#1B4332]",
  amber: "border-[#9A3412]/25 from-[#FFEDD5] to-[#FED7AA] text-[#9A3412]",
  sky: "border-[#1D4ED8]/20 from-[#DBEAFE] to-[#BFDBFE] text-[#1E40AF]",
};

const SIZES: Record<
  NonNullable<IconBadgeProps["size"]>,
  { badge: string; icon: string }
> = {
  sm: { badge: "size-9", icon: "size-4" },
  md: { badge: "size-11", icon: "size-5" },
  lg: { badge: "size-14", icon: "size-7" },
};

export function IconBadge({
  icon: Icon,
  tone = "emerald",
  size = "md",
  className = "",
}: IconBadgeProps) {
  const dimensions = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-xl border bg-gradient-to-br shadow-sm ${TONES[tone]} ${dimensions.badge} ${className}`}
    >
      <Icon className={dimensions.icon} strokeWidth={2} />
    </span>
  );
}
