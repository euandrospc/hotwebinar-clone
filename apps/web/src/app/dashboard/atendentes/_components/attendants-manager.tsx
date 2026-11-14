"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminEmptyState } from "@/components/admin/admin-page";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Users } from "@/components/icons";
import { createAttendantAction, toggleAttendantAction, deleteAttendantAction } from "@/server/actions/attendants";

export interface AttendantRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export function AttendantsManager({ initial }: { initial: AttendantRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = rows.filter((row) => row.role !== "disabled").length;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAttendantAction({ name, email, password });
      if ("ok" in result) {
        toast.success("Atendente criado");
        setCreateOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRows((prev) => [
          { id: crypto.randomUUID(), name, email, role: "attendant", createdAt: new Date().toISOString() },
          ...prev
        ]);
      } else {
        toast.error("Não foi possível criar o atendente");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAttendantAction(id);
      if ("ok" in result) {
        toast.success("Atendente excluído");
        setRows((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error("Não foi possível excluir o atendente");
      }
      setConfirmId(null);
    });
  }

  function handleToggle(id: string, disabled: boolean) {
    startTransition(async () => {
      const result = await toggleAttendantAction(id, disabled);
      if ("ok" in result) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, role: disabled ? "disabled" : "attendant" } : r))
        );
      } else {
        toast.error("Não foi possível atualizar o atendente");
      }
    });
  }

  const input = "h-[38px] rounded-[10px] border-[#1E241F] bg-[#070807] text-[13px] text-neutral-100 focus-visible:ring-palco";
  const label = "text-[13px] font-semibold text-[#C9D1CA]";
  const head = "px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-[#6E776F]";

  return (
    <section aria-labelledby="team-title" className="overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C] font-palco">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]">
        <div className="flex items-center gap-2.5">
          <h2 id="team-title" className="text-sm font-semibold text-neutral-100">Sua equipe</h2>
          <span className="rounded-md bg-palco/[0.12] px-2 py-[3px] text-[11px] font-semibold tabular-nums text-palco">{rows.length}</span>
          <span className="text-xs text-[#7C867E]">{activeCount} {activeCount === 1 ? "ativo" : "ativos"}</span>
        </div>
        <Button className="h-auto gap-2 rounded-[10px] bg-palco px-4 py-2.5 text-[13px] font-semibold text-palco-ink hover:bg-palco/90 focus-visible:ring-palco" onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" className="size-4" />Novo atendente</Button>
      </div>
      <Dialog open={createOpen} onOpenChange={value => { if (!isPending) setCreateOpen(value); }}>
        <DialogContent className="max-w-md rounded-2xl border-[#1E241F] bg-[#0C0E0C] p-5 font-palco text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">Novo atendente</DialogTitle>
            <DialogDescription className="text-[13px] text-neutral-400">Crie um acesso para sua equipe responder às conversas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="attendant-name" className={label}>Nome</Label>
              <Input id="attendant-name" className={input} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendant-email" className={label}>E-mail</Label>
              <Input id="attendant-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendant-password" className={label}>Senha</Label>
              <Input id="attendant-password" type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" className="h-9 rounded-[10px] border-[#1E241F] bg-transparent text-[13px] text-[#C9D1CA] hover:bg-[#121512] hover:text-neutral-100" disabled={isPending} onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" className="h-9 rounded-[10px] bg-palco text-[13px] font-semibold text-palco-ink hover:bg-palco/90" disabled={isPending}>{isPending ? "Criando..." : "Criar atendente"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? (
        <div className="border-t border-[#1E241F] p-5"><AdminEmptyState icon={<Users />} title="Sua equipe começa aqui" description="Adicione um atendente para dividir as conversas com sua equipe." /></div>
      ) : (
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="border-y border-[#1E241F] bg-[#090B09]">
            <tr>
              <th scope="col" className={`${head} sm:w-[320px]`}>Nome</th>
              <th scope="col" className={`${head} hidden md:table-cell`}>E-mail</th>
              <th scope="col" className={`${head} hidden w-[150px] sm:table-cell`}>Status</th>
              <th scope="col" className={`${head} w-[84px] sm:w-[110px]`}>Ativo</th>
              <th scope="col" className={`${head} w-[76px] text-right sm:w-[100px]`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const active = r.role !== "disabled";
              return (
                <tr key={r.id} className="border-b border-[#1E241F] last:border-b-0">
                  <td className="px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-palco/[0.12] text-[11px] font-semibold text-palco">{r.name.trim().slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-100">{r.name}</span>
                        <span className="block truncate text-xs text-[#7C867E] md:hidden">{r.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="hidden truncate px-5 py-3.5 text-[13px] text-[#C9D1CA] md:table-cell">{r.email}</td>
                  <td className="hidden px-5 py-3.5 sm:table-cell">
                    <span className={active ? "inline-flex items-center gap-1.5 rounded-full bg-palco/[0.08] px-2.5 py-1 text-xs font-medium text-palco" : "inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#7C867E]"}>
                      <span aria-hidden="true" className={active ? "size-1.5 rounded-full bg-palco" : "size-1.5 rounded-full bg-[#6E776F]"} />
                      {active ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Switch
                      aria-label={`Ativar ou desativar ${r.name}`}
                      className="data-[state=checked]:bg-palco data-[state=unchecked]:bg-[#1E241F]"
                      checked={active}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleToggle(r.id, !checked)}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {confirmId === r.id ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <Button className="h-8 rounded-lg px-2.5 text-xs" size="sm" variant="destructive" disabled={isPending} onClick={() => handleDelete(r.id)}>Confirmar</Button>
                        <Button className="h-8 rounded-lg px-2.5 text-xs text-[#C9D1CA] hover:bg-white/5 hover:text-neutral-100" size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmId(null)}>Cancelar</Button>
                      </span>
                    ) : (
                      <Button size="icon" variant="ghost" className="size-8 rounded-lg text-[#7C867E] hover:bg-red-500/10 hover:text-red-400 focus-visible:ring-palco" aria-label={`Excluir ${r.name}`} onClick={() => setConfirmId(r.id)}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
