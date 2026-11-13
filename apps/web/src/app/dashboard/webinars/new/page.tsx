import type { Metadata } from "next";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import { NewWebinarButton } from "@/components/webinars/new-webinar-button";
import { MonitorPlay } from "@/components/icons";

export const metadata: Metadata = { title: "Criar webinar" };

// Creating the draft on GET broke (revalidatePath during render) and spawned drafts on every prefetch/visit,
// so the draft is only created by an explicit click, the same action used on the Webinars list.
export default function NewWebinarPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Novo webinar" description="Configure a experiência do seu público, do acesso à oferta."
        back={{ href: "/dashboard/webinars", label: "Webinars" }} />
      <AdminEmptyState icon={<MonitorPlay />} title="Comece um novo webinar"
        description="Criamos um rascunho e abrimos o editor na etapa Início."
        action={<NewWebinarButton label="Criar webinar" className="h-[38px] rounded-[10px] bg-palco px-3.5 text-[13px] font-bold text-palco-ink hover:bg-palco/90" />} />
    </AdminPage>
  );
}
