import type { Metadata } from "next";
import Link from "next/link";
import { Alegreya_Sans, Alegreya_SC } from "next/font/google";
import { MetricsProvider } from "@/components/MetricsProvider";
import { MetricFilters } from "@/components/MetricFilters";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getPlayer } from "@/lib/data";
import { signOutAction } from "./actions";
import "./globals.css";

const display = Alegreya_SC({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-alegreya-sc" });
const body = Alegreya_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-alegreya-sans" });

// Every page depends on who is signed in, so never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "STS2 Character Mod Reviews", template: "%s · STS2 Character Mod Reviews" },
  description: "Community reviews of Slay the Spire 2 character mods from the Steam Workshop, scored for Ascension 10.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const missing = missingEnv();
  const session = missing.length ? null : await getSession();
  const player = session ? await getPlayer(session.steamId) : null;

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <MetricsProvider>
          <header className="top">
            <div className="top-in">
              <Link className="brand" href="/"><h1>STS2 Character Mod Reviews</h1><span className="asc">Ascension 10</span></Link>
              <span className="spacer" />
              {missing.length ? null : session ? (
                <div className="me">
                  {player?.avatar_url ? <img src={player.avatar_url} alt="" /> : null}
                  <span>{player?.persona_name || "Signed in"}</span>
                  <form action={signOutAction}><button type="submit" className="linkish">Sign out</button></form>
                </div>
              ) : (
                <a className="btn steam small" href="/api/auth/steam/login">Sign in with Steam</a>
              )}
            </div>
          </header>
          <main className="wrap">
            <MetricFilters />
            <section className="content">{missing.length ? <SetupNotice missing={missing} /> : children}</section>
          </main>
        </MetricsProvider>
      </body>
    </html>
  );
}
