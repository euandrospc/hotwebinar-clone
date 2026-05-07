"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Button variant="ghost" size="icon" aria-label="Tema" />;

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
