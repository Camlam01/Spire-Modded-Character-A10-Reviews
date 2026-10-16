import { formatScore, scoreTone } from "@/lib/scoring";

/** A score out of 10 drawn as a ring that fills to the score. */
export function Medal({ value, size = "" }: { value: number | null; size?: "" | "sm" | "lg" }) {
  return (
    <div
      className={`medal ${size} ${scoreTone(value)}`}
      style={{ "--p": value == null ? 0 : value * 10 } as React.CSSProperties}
      role="img"
      aria-label={value == null ? "No score yet" : `${formatScore(value)} out of 10`}
    >
      <span>
        <b>{formatScore(value)}</b>
        <small>/10</small>
      </span>
    </div>
  );
}

export const catStyle = (key: string) => ({ "--cat": `var(--c-${key})` }) as React.CSSProperties;
