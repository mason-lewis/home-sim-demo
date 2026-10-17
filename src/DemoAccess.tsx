import { useState, type FormEvent } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { siteConfig } from "./config";

export function DemoAccess({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    setChecking(true);
    setError("");
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(password),
      );
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (hash === siteConfig.demoPasswordHash) onUnlock();
      else setError("That password didn’t match. Please try again.");
    } catch {
      setError("Unable to check the password. Please reload and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="stream-access">
      <form
        className="stream-access-card"
        onSubmit={unlock}
        aria-labelledby="stream-access-title"
      >
        <LockKeyhole size={22} strokeWidth={1.5} aria-hidden="true" />
        <p className="eyebrow">EXTERIOR DEMO</p>
        <h2 id="stream-access-title">
          Make yourself <em>at home.</em>
        </h2>
        <p>Enter your demo password to open the exterior studio.</p>
        <label htmlFor="stream-password">Demo password</label>
        <input
          id="stream-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "stream-password-error" : undefined}
        />
        {error && (
          <p id="stream-password-error" role="alert">{error}</p>
        )}
        <button className="button button-bronze" type="submit" disabled={checking}>
          {checking ? "Checking…" : "Open studio"}
          <ArrowUpRight aria-hidden="true" size={19} />
        </button>
      </form>
    </div>
  );
}
