"use client";
import { Search } from "@/components/icons";
import styles from "./webinars.module.css";
import adminStyles from "@/components/admin/admin-page.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WebinarsFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function push(next: URLSearchParams) {
    next.delete("page");
    router.push(`/dashboard/webinars?${next.toString()}`);
  }

  function onChange(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    startTransition(() => push(next));
  }

  return (
    <div className={styles.filters}>
      <div className={styles.filter}>
        <label htmlFor="webinars-search">Pesquisar</label>
        <div className={styles.search}><Search aria-hidden="true" />
        <Input
          id="webinars-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => onChange("q", q)}
          onKeyDown={event => { if (event.key === "Enter") onChange("q", q); }}
          placeholder="Nome ou título"
        />
        </div>
      </div>
      <div className={styles.filter}>
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={params.get("status") ?? "ALL"} onValueChange={(v) => onChange("status", v)}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent className={adminStyles.portal}>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Rascunho</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="ARCHIVED">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={styles.filter}>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select value={params.get("tipo") ?? "ALL"} onValueChange={(v) => onChange("tipo", v)}>
          <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
          <SelectContent className={adminStyles.portal}>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="UNICO">Único</SelectItem>
            <SelectItem value="RECURRING">Recorrente</SelectItem>
            <SelectItem value="JIT">Just in time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={styles.filter}>
        <label className="text-xs text-muted-foreground">Ordenar</label>
        <Select value={params.get("sort") ?? "recent"} onValueChange={(v) => onChange("sort", v)}>
          <SelectTrigger aria-label="Ordenar"><SelectValue /></SelectTrigger>
          <SelectContent className={adminStyles.portal}>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
            <SelectItem value="za">Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
