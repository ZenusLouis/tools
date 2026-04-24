"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1 }}
      className={cn("px-4 py-2 rounded", className)}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    />
  );
}
