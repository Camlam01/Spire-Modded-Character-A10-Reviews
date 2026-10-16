import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// "Your profile" link target: sends signed-in players to their own page.
export default async function MyProfile() {
  const session = await getSession();
  redirect(session ? `/players/${session.steamId}` : "/api/auth/steam/login?next=/profile");
}
