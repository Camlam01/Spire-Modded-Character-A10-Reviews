import "server-only";
import { databaseProblem } from "./data";
import { missingEnv } from "./env";

/** True while settings are missing or the database isn't set up; the layout shows instructions instead of the page. */
export async function siteNotReady(): Promise<boolean> {
  return missingEnv().length > 0 || (await databaseProblem()) !== null;
}
