import Link from "next/link";
import { redirect } from "next/navigation";
import { AddModForm } from "@/components/AddModForm";
import { siteNotReady } from "@/lib/ready";
import { getSession } from "@/lib/session";

export const metadata = { title: "Add a mod" };

export default async function NewModPage() {
  if (await siteNotReady()) return null;
  if (!(await getSession())) redirect("/api/auth/steam/login?next=/mods/new");
  return (
    <>
      <Link className="back" href="/">← All mods</Link>
      <AddModForm />
    </>
  );
}
