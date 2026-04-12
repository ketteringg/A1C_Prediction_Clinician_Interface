"use client";
import { useRouter } from "next/navigation";
import App from "./App.jsx";

export default function DashboardPage() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={logout}
        style={{
          position: "fixed", top: 12, right: 16, zIndex: 1000,
          padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1",
          background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600,
          cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
        title="Sign out"
      >
        Sign out
      </button>
      <App />
    </div>
  );
}
