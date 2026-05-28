import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/server/auth/session";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}

