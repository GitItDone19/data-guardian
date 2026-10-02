"use client";

import React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-8 rounded-[6px] bg-secondary hover:bg-accent border border-border text-foreground flex items-center justify-center transition-colors cursor-pointer"
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="size-3.5 text-[#f59e0b] transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-3.5 text-[#3ecf8e] transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
