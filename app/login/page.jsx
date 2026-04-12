"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(next);
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
    }}>
      <form onSubmit={submit} style={{
        background: "#fff", padding: 32, borderRadius: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", width: 340,
        border: "1px solid #e2e8f0",
      }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, color: "#0f172a" }}>
          Diabetes Dashboard
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
          Sign in to continue
        </p>
        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>
          Username
        </label>
        <input
          type="text" value={user} onChange={(e) => setUser(e.target.value)}
          autoFocus autoComplete="username" required
          style={{
            width: "100%", padding: "10px 12px", marginBottom: 14,
            border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password" required
          style={{
            width: "100%", padding: "10px 12px", marginBottom: 14,
            border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        {error && (
          <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} style={{
          width: "100%", padding: "10px 14px", borderRadius: 8, border: "none",
          background: submitting ? "#475569" : "#0f172a", color: "#fff",
          fontSize: 14, fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
        }}>
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
