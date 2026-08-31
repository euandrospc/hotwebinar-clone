"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { createAttendantAction, toggleAttendantAction, deleteAttendantAction } from "@/server/actions/attendants";

export interface AttendantRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export function AttendantsManager({ initial }: { initial: AttendantRow[] }) {
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
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="max-w-xl space-y-4 rounded-md border bg-card p-6">
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
        <Button type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar atendente"}
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum atendente cadastrado.
        </div>
      ) : (
        <Table>
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
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <Badge variant={r.role === "disabled" ? "destructive" : "default"}>
                    {r.role === "disabled" ? "Desativado" : "Ativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={r.role !== "disabled"}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleToggle(r.id, !checked)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {confirmId === r.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleDelete(r.id)}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
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
