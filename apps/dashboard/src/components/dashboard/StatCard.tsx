"use client";

import { motion } from "framer-motion";
import { FolderOpen, CheckCircle2, Zap, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Variant = "projects" | "tasks" | "tokens" | "cost" | "default";

const VARIANTS: Record<
  Variant,
  { icon: LucideIcon | null; iconColor: string; iconBg: string; bar: string; badgeClass: string; hoverBorder: string }
> = {
  projects: { icon: FolderOpen,   iconColor: "text-accent",       iconBg: "bg-accent/10",      bar: "bg-accent",      badgeClass: "text-done text-xs font-medium flex items-center gap-1",        hoverBorder: "hover:border-accent/30" },
  tasks:    { icon: CheckCircle2, iconColor: "text-done",         iconBg: "bg-done/10",        bar: "bg-done",        badgeClass: "text-done text-xs font-medium flex items-center gap-1",        hoverBorder: "hover:border-done/30" },
  tokens:   { icon: Zap,         iconColor: "text-in-progress",  iconBg: "bg-in-progress/10", bar: "bg-in-progress", badgeClass: "text-in-progress text-xs font-mono font-medium",               hoverBorder: "hover:border-in-progress/30" },
  cost:     { icon: DollarSign,  iconColor: "text-purple-400",   iconBg: "bg-purple-400/10",  bar: "bg-purple-400",  badgeClass: "text-text-muted text-xs font-medium",                         hoverBorder: "hover:border-purple-400/30" },
  default:  { icon: null,        iconColor: "text-text-muted",   iconBg: "bg-border",         bar: "bg-accent",      badgeClass: "text-text-muted text-xs font-medium",                         hoverBorder: "hover:border-accent/20" },
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
      className={`rounded-xl border border-border bg-card p-6 shadow-sm transition-all ${hoverBorder}`}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="flex justify-between items-start mb-4">
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon size={18} className={iconColor} />
          </div>
        )}
        {badge && (
          <span className={badgeClass}>{badge}</span>
        )}
      </div>

      <p className="text-text-muted text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-text mt-1">{value}</p>

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
