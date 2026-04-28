"use client";

import { motion } from "framer-motion";
import { FolderOpen, CheckCircle2, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Variant = "projects" | "tasks" | "cost" | "default";

const VARIANTS: Record<
  Variant,
  { icon: LucideIcon | null; iconColor: string; iconBg: string; bar: string; badgeClass: string; hoverBorder: string }
> = {
  projects: { icon: FolderOpen,   iconColor: "text-accent",      iconBg: "bg-accent/15",     bar: "bg-accent",      badgeClass: "bg-done/10 text-done",        hoverBorder: "hover:border-accent/40" },
  tasks:    { icon: CheckCircle2, iconColor: "text-done",        iconBg: "bg-done/15",       bar: "bg-done",        badgeClass: "bg-done/10 text-done",        hoverBorder: "hover:border-done/40" },
  cost:     { icon: DollarSign,   iconColor: "text-accent",      iconBg: "bg-accent/15",     bar: "bg-accent",      badgeClass: "bg-blocked/10 text-blocked",  hoverBorder: "hover:border-accent/40" },
  default:  { icon: null,         iconColor: "text-text-muted",  iconBg: "bg-border",        bar: "bg-accent",      badgeClass: "bg-card-hover text-text-muted", hoverBorder: "hover:border-accent/30" },
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  progress?: number;
  variant?: Variant;
  badge?: string;
}

export function StatCard({ label, value, sub, progress, variant = "default", badge }: StatCardProps) {
  const { icon: Icon, iconColor, iconBg, bar, badgeClass, hoverBorder } = VARIANTS[variant];

  return (
    <motion.div
      className={`min-h-[170px] rounded-xl border border-border bg-card p-6 shadow-sm shadow-black/10 transition-colors ${hoverBorder}`}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-start justify-between">
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon size={19} className={iconColor} />
          </div>
        )}
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>{badge}</span>
        )}
      </div>

      <p className="min-w-0 break-words text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-text-muted">{label}</p>

      {progress !== undefined && (
        <div className="w-full bg-card-hover h-1.5 rounded-full mt-4 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>
      )}
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </motion.div>
  );
}
