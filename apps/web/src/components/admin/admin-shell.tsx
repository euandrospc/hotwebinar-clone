import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

export async function AdminShell({
  pathname,
  children
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <div className="flex w-60 flex-col">
        <Sidebar pathname={pathname} />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </div>
      <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
    </div>
  );
}
