import Link from "next/link";
import { redirect } from "next/navigation";
import { AddModForm } from "@/components/AddModForm";
import { missingEnv } from "@/lib/env";
import { getSession } from "@/lib/session";

export const metadata = { title: "Add a mod" };

export default async function NewModPage() {
  if (missingEnv().length) return null;
  if (!(await getSession())) redirect("/api/auth/steam/login?next=/mods/new");
  return (
    <>
      <Link className="back" href="/">← All mods</Link>
      <AddModForm />
    </>
  );
}
