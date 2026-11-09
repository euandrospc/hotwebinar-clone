"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminEmptyState } from "@/components/admin/admin-page";
import styles from "@/components/management-v2.module.css";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
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

  return (
    <div className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div className="flex items-center gap-2"><h2 className={styles.sectionTitle}>Sua equipe</h2><span className={styles.count}>{rows.length}</span><span className={styles.meta}>{rows.filter(row => row.role !== "disabled").length} ativos</span></div>
        <Button className={styles.primaryButton} onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Novo atendente</Button>
      </div>
      <Dialog open={createOpen} onOpenChange={value => { if (!isPending) setCreateOpen(value); }}>
        <DialogContent className={`${styles.dialog} sm:max-w-md`}>
          <DialogHeader><DialogTitle>Novo atendente</DialogTitle><DialogDescription>Crie um acesso para sua equipe responder às conversas.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className={styles.form}>
        <div className="space-y-2">
          <Label htmlFor="attendant-name">Nome</Label>
          <Input id="attendant-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendant-email">E-mail</Label>
          <Input
            id="attendant-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendant-password">Senha</Label>
          <Input
            id="attendant-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className={styles.formFooter}><Button type="button" variant="outline" className={styles.secondaryButton} disabled={isPending} onClick={() => setCreateOpen(false)}>Cancelar</Button><Button className={styles.primaryButton} type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar atendente"}
        </Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? (
        <AdminEmptyState icon={<Users />} title="Sua equipe começa aqui" description="Adicione um atendente para dividir as conversas com sua equipe." />
      ) : (
        <Table className={styles.table}>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ativo</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="flex items-center gap-2.5"><span className={styles.avatar} aria-hidden="true">{r.name.trim().slice(0, 2).toUpperCase()}</span><span className="font-medium">{r.name}</span></div></TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <span className={styles.status} data-status={r.role === "disabled" ? "disabled" : "active"}>
                    {r.role === "disabled" ? "Desativado" : "Ativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <Switch
                    aria-label={`Ativar ou desativar ${r.name}`}
                    className="data-[state=checked]:bg-[#548D45]"
                    checked={r.role !== "disabled"}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleToggle(r.id, !checked)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {confirmId === r.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Button className="h-8 rounded-lg text-xs" size="sm" variant="destructive" disabled={isPending} onClick={() => handleDelete(r.id)}>
                        Confirmar
                      </Button>
                      <Button className={styles.secondaryButton} size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`${styles.iconButton} hover:text-destructive`}
                      aria-label="Excluir atendente"
                      onClick={() => setConfirmId(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
