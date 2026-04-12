"use client";
import { useState, useMemo, useCallback } from "react";
import RAW from "./data.js";

function parsePatients(raw) {
  return raw.d.map(d => ({
    id: d[0], risk: d[1], actual: d[2], age: d[3],
    gender: d[4] === "F" ? "Female" : d[4] === "M" ? "Male" : "Unknown",
    race: d[5], a1cMean: d[6], a1cMax: d[7], a1cVisits: d[8], nVisits: d[9],
    meds: d[10], flags: d[11],
    drivers: d[12].map(dr => ({ name: dr[0], contribution: dr[1], value: dr[2] })),
    ed: d[13], pcp: d[14], admits: d[15], insurance: d[16],
  }));
}

const PATIENTS = parsePatients(RAW);

const FLAG_DESCRIPTIONS = {
  "A1C >9.0": "At least one A1c measurement in the lookback window exceeded 9.0%, indicating severely uncontrolled glycemia.",
  "Mean A1C >8.0": "The patient's mean A1c across all lookback measurements is above 8.0% — chronically above the ADA target of 7.0%.",
  "Trending Up": "A1c increased by at least 1.0 percentage point between the first and second recorded measurements.",
  "Persistent Moderate": "Mean A1c between 7.0% and 9.0% with no upward trend — chronically above goal but not acutely deteriorating. High-leverage intervention target.",
  "Single Visit": "Only one A1c measurement available in the lookback window — trend assessment not possible. Schedule follow-up for trajectory data.",
  "High ED Use": "Elevated emergency department utilization suggests poorly controlled disease or access barriers to primary care.",
  "No Meds, High A1C": "Elevated A1c without any diabetes medications on record. Candidate for medication initiation.",
  "On Insulin, A1C >9.0": "On insulin therapy yet still severely uncontrolled — likely needs dose escalation, adherence review, or regimen change.",
  "Schedule Follow-Up": "No 2025 A1c collection date on record. Routine follow-up recommended to re-establish monitoring cadence.",
  "Urgent: Schedule Follow-Up": "No 2025 A1c collection date AND predicted probability of uncontrolled A1c is at or above the high-risk threshold. Prioritize outreach.",
};
const flagTip = (f) => FLAG_DESCRIPTIONS[f] || "";
const POP = RAW.p;
const MODEL = RAW.m;

function riskScore(r) {
  return Math.round(r * 100);
}
function riskColor(r) {
  // Smooth gradient: green (0%) -> yellow (20%) -> orange (40%) -> red (70%+)
  const s = Math.min(r, 0.8) / 0.8; // normalize to 0-1 over useful range
  if (s <= 0.25) {
    // green to yellow-green
    const t = s / 0.25;
    const red = Math.round(34 + t * (180 - 34));
    const green = Math.round(163 + t * (160 - 163));
    const blue = Math.round(74 - t * 74);
    return `rgb(${red},${green},${blue})`;
  } else if (s <= 0.5) {
    // yellow-green to orange
    const t = (s - 0.25) / 0.25;
    const red = Math.round(180 + t * (234 - 180));
    const green = Math.round(160 - t * (160 - 88));
    const blue = Math.round(0 + t * 12);
    return `rgb(${red},${green},${blue})`;
  } else {
    // orange to red
    const t = (s - 0.5) / 0.5;
    const red = Math.round(234 - t * (234 - 185));
    const green = Math.round(88 - t * (88 - 28));
    const blue = Math.round(12 + t * (26 - 12));
    return `rgb(${red},${green},${blue})`;
  }
}
function riskTier(r) {
  if (r >= 0.7) return "Extremely High";
  if (r >= 0.4) return "High Risk";
  if (r >= 0.1) return "Moderate Risk";
  return "Low Risk";
}
function riskAction(r) {
  if (r >= 0.7) return "Immediate clinical review and medication escalation";
  if (r >= 0.4) return "Proactive clinical review within 2 weeks";
  if (r >= 0.1) return "Recheck A1C within 3 months";
  return "Continue routine monitoring";
}
function riskBg(r) {
  const c = riskColor(r);
  return c.replace("rgb(", "rgba(").replace(")", ",0.08)");
}
function tierBorderColor(r) {
  if (r >= 0.7) return "#991b1b";
  if (r >= 0.4) return "#dc2626";
  if (r >= 0.1) return "#d97706";
  return "#16a34a";
}

function RiskGauge({ risk }) {
  const score = riskScore(risk);
  const color = riskColor(risk);
  const rd = 70, cx = 80, cy = 82;
  // Draw gradient arc with multiple segments
  const segments = 20;
  const segPaths = [];
  const fillTo = Math.min(risk, 1.0);
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    if (t0 >= fillTo) break;
    const end = Math.min(t1, fillTo);
    const a0 = Math.PI + t0 * Math.PI;
    const a1 = Math.PI + end * Math.PI;
    const x0 = cx + rd * Math.cos(a0);
    const y0 = cy + rd * Math.sin(a0);
    const x1 = cx + rd * Math.cos(a1);
    const y1 = cy + rd * Math.sin(a1);
    const segColor = riskColor(t0);
    segPaths.push(
      `<path d="M ${x0} ${y0} A ${rd} ${rd} 0 0 1 ${x1} ${y1}" fill="none" stroke="${segColor}" stroke-width="12" stroke-linecap="butt" />`
    );
  }
  // Tier markers
  const m10 = Math.PI + 0.10 * Math.PI;
  const m40 = Math.PI + 0.40 * Math.PI;
  const m70 = Math.PI + 0.70 * Math.PI;
  return (
    <svg viewBox="0 0 160 108" style={{ width: "100%", maxWidth: 220 }}>
      <path d={`M ${cx-rd} ${cy} A ${rd} ${rd} 0 0 1 ${cx+rd} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
      <g dangerouslySetInnerHTML={{ __html: segPaths.join("") }} />
      {/* Tier boundary ticks */}
      <line x1={cx + (rd-8)*Math.cos(m10)} y1={cy + (rd-8)*Math.sin(m10)}
            x2={cx + (rd+8)*Math.cos(m10)} y2={cy + (rd+8)*Math.sin(m10)}
            stroke="#6b7280" strokeWidth="1.5" />
      <line x1={cx + (rd-8)*Math.cos(m40)} y1={cy + (rd-8)*Math.sin(m40)}
            x2={cx + (rd+8)*Math.cos(m40)} y2={cy + (rd+8)*Math.sin(m40)}
            stroke="#6b7280" strokeWidth="1.5" />
      <line x1={cx + (rd-8)*Math.cos(m70)} y1={cy + (rd-8)*Math.sin(m70)}
            x2={cx + (rd+8)*Math.cos(m70)} y2={cy + (rd+8)*Math.sin(m70)}
            stroke="#6b7280" strokeWidth="1.5" />
      <text x={cx} y={cy-12} textAnchor="middle" fontSize="30" fontWeight="800" fill={color}>
        {score}
      </text>
      <text x={cx} y={cy+2} textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="500">
        RISK SCORE
      </text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="9" fill={tierBorderColor(risk)} fontWeight="700">
        {riskTier(risk)}
      </text>
      {/* Scale labels */}
      <text x={cx-rd-2} y={cy+10} textAnchor="middle" fontSize="7" fill="#9ca3af">0</text>
      <text x={cx+rd+2} y={cy+10} textAnchor="middle" fontSize="7" fill="#9ca3af">100</text>
    </svg>
  );
}

function WaterfallChart({ drivers }) {
  if (!drivers || drivers.length === 0) return null;
  const sorted = [...drivers].sort((a,b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const maxAbs = Math.max(...sorted.map(d => Math.abs(d.contribution)), 0.1);
  const barW = 180;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 10, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-6"/></svg>
        SHAP RISK DRIVERS
      </div>
      {sorted.map((d, i) => {
        const pct = (Math.abs(d.contribution) / maxAbs) * barW;
        const isRisk = d.contribution > 0;
        const labelInside = pct > 50;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ width: 120, fontSize: 11, color: "#4b5563", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
              {d.name}
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative", height: 20, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#d1d5db" }} />
              {isRisk ? (
                <div style={{ position: "absolute", left: "50%", width: Math.min(pct, barW * 0.5), height: 16, borderRadius: "0 4px 4px 0",
                  background: "linear-gradient(90deg, #f87171, #dc2626)", boxShadow: "0 1px 3px rgba(220,38,38,0.2)" }} />
              ) : (
                <div style={{ position: "absolute", right: "50%", width: Math.min(pct, barW * 0.5), height: 16, borderRadius: "4px 0 0 4px",
                  background: "linear-gradient(270deg, #60a5fa, #2563eb)", boxShadow: "0 1px 3px rgba(37,99,235,0.2)" }} />
              )}
              {labelInside ? (
                <div style={{ position: "absolute",
                  left: isRisk ? "50%" : undefined,
                  right: isRisk ? undefined : "50%",
                  paddingLeft: isRisk ? 6 : 0, paddingRight: isRisk ? 0 : 6,
                  fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                  lineHeight: "20px" }}>
                  {isRisk ? "+" : ""}{d.contribution.toFixed(2)}
                </div>
              ) : (
                <div style={{ position: "absolute",
                  left: isRisk ? `calc(50% + ${pct + 4}px)` : undefined,
                  right: isRisk ? undefined : `calc(50% + ${pct + 4}px)`,
                  fontSize: 10, fontWeight: 700, color: isRisk ? "#dc2626" : "#2563eb", whiteSpace: "nowrap" }}>
                  {isRisk ? "+" : ""}{d.contribution.toFixed(2)}
                </div>
              )}
            </div>
            <div style={{ width: 55, fontSize: 11, color: "#374151", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
              {d.value != null ? d.value : "N/A"}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 10, fontSize: 10 }}>
        <span style={{ color: "#2563eb", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 12, height: 4, background: "#2563eb", borderRadius: 2, display: "inline-block" }} /> Protective
        </span>
        <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 12, height: 4, background: "#dc2626", borderRadius: 2, display: "inline-block" }} /> Risk-increasing
        </span>
      </div>
    </div>
  );
}

function A1CSparkline({ visits }) {
  if (!visits || visits.length === 0) return <span style={{ color: "#9ca3af", fontSize: 12 }}>--</span>;
  const w = 120, h = 36;
  const minV = Math.min(...visits, 5);
  const maxV = Math.max(...visits, 10);
  const range = maxV - minV || 1;
  const pts = visits.map((v, i) => {
    const x = visits.length === 1 ? w/2 : (i/(visits.length-1)) * (w-8) + 4;
    const y = h - 4 - ((v - minV)/range) * (h-8);
    return [x, y];
  });
  const pathD = pts.map((p, i) => `${i===0?"M":"L"} ${p[0]} ${p[1]}`).join(" ");
  const threshY = h - 4 - ((7.0 - minV)/range) * (h-8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      {threshY > 0 && threshY < h && (
        <line x1="0" y1={threshY} x2={w} y2={threshY} stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3,2" />
      )}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={visits[i] > 7 ? "#ef4444" : "#6366f1"} />
      ))}
    </svg>
  );
}

function PatientDetail({ patient, onClose }) {
  if (!patient) return null;
  const p = patient;
  const medList = Object.entries(p.meds);

  const recs = [];
  // Tier-based primary action
  if (p.risk >= 0.7) {
    recs.push({ type: "flag", text: "EXTREMELY HIGH RISK: Immediate clinical review and medication escalation" });
    recs.push({ type: "flag", text: "Consider endocrinology referral" });
  } else if (p.risk >= 0.4) {
    recs.push({ type: "flag", text: "HIGH RISK: Schedule clinical review within 2 weeks" });
  } else if (p.risk >= 0.1) {
    recs.push({ type: "monitor", text: "MODERATE RISK: Schedule A1C recheck within 3 months" });
  } else {
    recs.push({ type: "low", text: "LOW RISK: Continue current management with routine monitoring" });
  }
  // Condition-specific actions
  if (p.a1cMean > 8 && medList.length === 0) recs.push({ type: "rx", text: "No active medications despite elevated A1C: evaluate for pharmacotherapy per ADA guidelines" });
  if (p.a1cMean > 8 && !p.meds["GLP-1"] && !p.meds["SGLT2"] && medList.length > 0) recs.push({ type: "rx", text: "Not on GLP-1 RA or SGLT2i: evaluate for initiation based on comorbid profile" });
  if (p.a1cMax > 9 && p.meds["Insulin"]) recs.push({ type: "rx", text: "On insulin with A1C >9: review regimen for dose optimization" });
  if (p.ed >= 3) recs.push({ type: "care", text: "High ED utilization ("+p.ed+" visits): consider care coordination referral" });
  if (p.nVisits === 1) recs.push({ type: "monitor", text: "Single A1C measurement in lookback: schedule follow-up for trend assessment" });
  if (p.risk >= 0.1 && p.risk < 0.4) {
    recs.push({ type: "monitor", text: "Review medication adherence and screen for barriers at next visit" });
  }
  if (p.risk >= 0.7 && p.a1cMean > 12) {
    recs.push({ type: "flag", text: "A1C >12: assess for inpatient stabilization" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px", overflowY: "auto" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 760, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", borderRadius: "16px 16px 0 0" }}>
          <div>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.06em", fontWeight: 600 }}>PATIENT ID</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>#{p.id}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.age}y {p.gender} | {p.race}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: riskBg(p.risk), color: riskColor(p.risk), border: `1.5px solid ${tierBorderColor(p.risk)}` }}>
              Score {riskScore(p.risk)} | {riskTier(p.risk)}
            </div>
            {p.actual ? (
              <div style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>Uncontrolled</div>
            ) : (
              <div style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Controlled</div>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", padding: "4px 8px", lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Action bar */}
        <div style={{ padding: "10px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10,
          background: riskBg(p.risk) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tierBorderColor(p.risk)} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: tierBorderColor(p.risk) }}>{riskAction(p.risk)}</span>
        </div>

        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
          <div>
            <RiskGauge risk={p.risk} />
            <div style={{ marginTop: 16, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 8 }}>A1C TRAJECTORY</div>
              <A1CSparkline visits={p.a1cVisits} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                <div style={{ padding: 6, background: "#fff", borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>Mean</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: p.a1cMean > 7 ? "#dc2626" : "#16a34a" }}>{p.a1cMean}</div>
                </div>
                <div style={{ padding: 6, background: "#fff", borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>Max</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: p.a1cMax > 9 ? "#dc2626" : p.a1cMax > 7 ? "#d97706" : "#16a34a" }}>{p.a1cMax}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{p.nVisits} A1C visit{p.nVisits !== 1 ? "s" : ""} in lookback</div>
            </div>

            <div style={{ marginTop: 12, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>MEDICATIONS</div>
              {medList.length > 0 ? medList.map(([name, count]) => (
                <div key={name} style={{ fontSize: 12, color: "#1e293b", display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontWeight: 500 }}>{name}</span><span style={{ color: "#64748b", fontSize: 11 }}>{count} orders</span>
                </div>
              )) : (
                <div style={{ padding: 8, background: "#fef3c7", borderRadius: 6, fontSize: 11, color: "#92400e", fontWeight: 500 }}>
                  No medications on record
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>UTILIZATION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[["ED", p.ed, p.ed >= 3], ["PCP", p.pcp, false], ["Admits", p.admits, p.admits >= 3]].map(([l, v, warn]) => (
                  <div key={l} style={{ textAlign: "center", padding: 6, background: "#fff", borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: warn ? "#dc2626" : "#1e293b" }}>{v}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
              <span style={{ fontWeight: 600 }}>Insurance:</span> {p.insurance}
            </div>
          </div>

          <div>
            <WaterfallChart drivers={p.drivers} />

            {p.flags.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  RED FLAGS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {p.flags.map((f, i) => (
                    <span key={i} title={flagTip(f)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 14,
                      background: "#fef2f2", color: "#b91c1c", fontWeight: 600, border: "1px solid #fecaca", cursor: "help" }}>{f}</span>
                  ))}
                </div>
              </div>
            )}

            {recs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  CLINICAL CONSIDERATIONS
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {recs.map((rc, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#1e293b", padding: "10px 14px", borderRadius: 8,
                      background: rc.type === "rx" ? "#eff6ff" : rc.type === "flag" ? "#fef2f2" : rc.type === "care" ? "#fefce8" : "#f0fdf4",
                      borderLeft: `3px solid ${rc.type === "rx" ? "#3b82f6" : rc.type === "flag" ? "#ef4444" : rc.type === "care" ? "#eab308" : "#22c55e"}`,
                      lineHeight: 1.5 }}>
                      {rc.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
              <strong style={{ color: "#475569" }}>Model:</strong> CatBoost (AUC {MODEL.auc}) | {MODEL.n_features} features | Score 0-100 | Tiers: Low (0-9), Moderate (10-39), High (40-69), Extremely High (70-100)<br/>
              <strong style={{ color: "#475569" }}>Explanations:</strong> SHAP TreeExplainer values (log-odds contribution per feature)<br/>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>This tool is for clinical decision support only and does not replace clinical judgment.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PopPanel() {
  const exHighN = PATIENTS.filter(p => p.risk >= 0.7).length;
  const highN = PATIENTS.filter(p => p.risk >= 0.4 && p.risk < 0.7).length;
  const modN = PATIENTS.filter(p => p.risk >= 0.1 && p.risk < 0.4).length;
  const lowN = PATIENTS.filter(p => p.risk < 0.1).length;
  const total = PATIENTS.length;
  const bars = [
    { label: "Extremely High (70-100)", count: exHighN, color: "#991b1b", action: "Immediate review" },
    { label: "High Risk (40-69)", count: highN, color: "#dc2626", action: "Review in 2 wks" },
    { label: "Moderate Risk (10-39)", count: modN, color: "#d97706", action: "Recheck in 3 mo" },
    { label: "Low Risk (0-9)", count: lowN, color: "#16a34a", action: "Routine care" },
  ];
  return (
    <div style={{ padding: 20, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        Population Overview
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          ["Total Patients", POP.total.toLocaleString(), "#6366f1"],
          ["Predicted Uncontrolled", POP.uncontrolled.toLocaleString(), "#dc2626"],
          ["Predicted Rate", POP.rate + "%", "#d97706"],
          ["Median Age", POP.median_age, "#0891b2"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ textAlign: "center", padding: "12px 8px", background: "#f8fafc", borderRadius: 10, border: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 8, letterSpacing: "0.02em" }}>Risk Tiers with Clinical Action Levels ({total.toLocaleString()} patients)</div>
      <div style={{ display: "grid", gap: 5 }}>
        {bars.map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 120, fontSize: 11, color: "#475569", fontWeight: 500 }}>{b.label}</div>
            <div style={{ flex: 1, height: 16, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ width: `${(b.count/total)*100}%`, height: "100%", background: b.color, borderRadius: 8, transition: "width 0.5s" }} />
            </div>
            <div style={{ width: 55, fontSize: 11, color: "#475569", textAlign: "right", fontWeight: 600 }}>{b.count.toLocaleString()}</div>
            <div style={{ width: 110, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{b.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function App() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState("risk");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [flagFilter, setFlagFilter] = useState("all");
  const pageSize = 50;

  const filtered = useMemo(() => {
    let pts = PATIENTS;
    if (search) {
      const s = search.toLowerCase();
      pts = pts.filter(p =>
        String(p.id).includes(s) ||
        p.gender.toLowerCase().includes(s) ||
        p.race.toLowerCase().includes(s)
      );
    }
    if (riskFilter !== "all") {
      pts = pts.filter(p => {
        if (riskFilter === "exhigh") return p.risk >= 0.7;
        if (riskFilter === "high") return p.risk >= 0.4 && p.risk < 0.7;
        if (riskFilter === "moderate") return p.risk >= 0.1 && p.risk < 0.4;
        if (riskFilter === "low") return p.risk < 0.1;
        return true;
      });
    }
    if (flagFilter !== "all") {
      pts = pts.filter(p => p.flags.some(f => f.toLowerCase().includes(flagFilter.toLowerCase())));
    }
    const dir = sortDir === "desc" ? -1 : 1;
    pts.sort((a, b) => {
      if (sortBy === "risk") return (a.risk - b.risk) * dir;
      if (sortBy === "a1c") return ((a.a1cMean||0) - (b.a1cMean||0)) * dir;
      if (sortBy === "age") return (a.age - b.age) * dir;
      if (sortBy === "id") return String(a.id).localeCompare(String(b.id)) * dir;
      return 0;
    });
    return pts;
  }, [search, riskFilter, sortBy, sortDir, flagFilter]);

  const paged = filtered.slice(page * pageSize, (page+1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleSort = useCallback((col) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(0);
  }, [sortBy]);

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: "#cbd5e1", fontSize: 10 }}> ↕</span>;
    return <span style={{ color: "#6366f1", fontSize: 10, fontWeight: 800 }}> {sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const filterBtnStyle = (active) => ({
    padding: "8px 14px", borderRadius: 8,
    border: active ? "2px solid #6366f1" : "1px solid #d1d5db",
    background: active ? "#eef2ff" : "#fff",
    fontSize: 12, fontWeight: active ? 700 : 500,
    color: active ? "#4338ca" : "#475569",
    cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>
              Glycemic Control Risk Monitor
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>
              Diabetes A1C Prediction Dashboard
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ padding: "5px 12px", background: "rgba(99,102,241,0.15)", borderRadius: 8, fontSize: 11, color: "#a5b4fc", fontWeight: 600, border: "1px solid rgba(99,102,241,0.25)" }}>
            CatBoost | AUC: {MODEL.auc}
          </div>
          <div style={{ padding: "5px 12px", background: "rgba(99,102,241,0.15)", borderRadius: 8, fontSize: 11, color: "#a5b4fc", fontWeight: 600, border: "1px solid rgba(99,102,241,0.25)" }}>
            {MODEL.n_features} Features
          </div>
          <div style={{ padding: "5px 12px", background: "rgba(99,102,241,0.15)", borderRadius: 8, fontSize: 11, color: "#a5b4fc", fontWeight: 600, border: "1px solid rgba(99,102,241,0.25)" }}>
            N = {POP.total.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 20px" }}>
        <PopPanel />

        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <input type="text" placeholder="Search by Patient ID, gender, or race..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10, border: "1px solid #d1d5db",
                fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box", transition: "border 0.15s" }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "#d1d5db"} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {[["all","All Tiers"],["exhigh","Extremely High"],["high","High Risk"],["moderate","Moderate"],["low","Low Risk"]].map(([val, label]) => (
            <button key={val} onClick={() => { setRiskFilter(val); setPage(0); }} style={filterBtnStyle(riskFilter === val)}>
              {label}
            </button>
          ))}
          <select value={flagFilter} onChange={e => { setFlagFilter(e.target.value); setPage(0); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, color: "#475569", background: "#fff", cursor: "pointer" }}>
            <option value="all">All Flags</option>
            <option value="A1C >9">A1C &gt;9.0</option>
            <option value="Mean A1C">Mean A1C &gt;8.0</option>
            <option value="Trending Up">Trending Up</option>
            <option value="High ED">High ED Use</option>
            <option value="No Meds">No Meds, High A1C</option>
            <option value="On Insulin">On Insulin, A1C &gt;9</option>
            <option value="Schedule Follow-Up">Follow-Up Needed (no 2025 A1C)</option>
            <option value="Urgent: Schedule Follow-Up">Urgent Follow-Up (high-risk, no 2025 A1C)</option>
          </select>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", fontWeight: 500 }}>
          {filtered.length.toLocaleString()} patients
          {search && ` matching "${search}"`}
          {riskFilter !== "all" && ` | ${riskFilter === "exhigh" ? "extremely high" : riskFilter} tier`}
          {flagFilter !== "all" && ` | flag: ${flagFilter}`}
          <span style={{ color: "#94a3b8" }}> | N = {POP.total.toLocaleString()}</span>
        </div>

        <div style={{ marginTop: 10, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[["id","Patient ID"],["risk","Risk Score"],["a1c","Mean A1C"],["age","Age"]].map(([col, label]) => (
                    <th key={col} onClick={() => handleSort(col)}
                      style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#475569",
                        cursor: "pointer", userSelect: "none", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0",
                        whiteSpace: "nowrap" }}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#475569", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0" }}>A1C Trend</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#475569", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0" }}>Flags</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#475569", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0" }}>Top SHAP Driver</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#475569", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0" }}>Actual</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(p)}
                    style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9", transition: "background 0.12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f172a", fontSize: 13 }}>#{p.id}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(p.risk*100,100)}%`, height: "100%", background: `linear-gradient(90deg, ${riskColor(0)}, ${riskColor(p.risk)})`, borderRadius: 4, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: riskColor(p.risk), minWidth: 24 }}>
                          {riskScore(p.risk)}
                        </span>
                        <span style={{ fontSize: 9, color: tierBorderColor(p.risk), fontWeight: 600, opacity: 0.8 }}>
                          {riskTier(p.risk)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: p.a1cMean > 8 ? "#dc2626" : p.a1cMean > 7 ? "#d97706" : "#16a34a" }}>
                      {p.a1cMean}%
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>{p.age}</td>
                    <td style={{ padding: "10px 14px" }}><A1CSparkline visits={p.a1cVisits} /></td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {p.flags.slice(0,2).map((f,i) => (
                          <span key={i} title={flagTip(f)} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontWeight: 600, whiteSpace: "nowrap", cursor: "help" }}>{f}</span>
                        ))}
                        {p.flags.length > 2 && <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>+{p.flags.length-2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#475569", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {p.drivers[0]?.name || ""}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      {p.actual ? (
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#fef2f2", color: "#dc2626", fontWeight: 700 }}>Unctrl</span>
                      ) : (
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", fontWeight: 700 }}>Ctrl</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                Page {page+1} of {totalPages} ({filtered.length.toLocaleString()} patients)
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(0)} disabled={page===0}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 11, cursor: page===0?"default":"pointer", opacity: page===0?0.4:1 }}>First</button>
                <button onClick={() => setPage(Math.max(0, page-1))} disabled={page===0}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, cursor: page===0?"default":"pointer", opacity: page===0?0.4:1 }}>← Prev</button>
                <button onClick={() => setPage(Math.min(totalPages-1, page+1))} disabled={page>=totalPages-1}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, cursor: page>=totalPages-1?"default":"pointer", opacity: page>=totalPages-1?0.4:1 }}>Next →</button>
                <button onClick={() => setPage(totalPages-1)} disabled={page>=totalPages-1}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 11, cursor: page>=totalPages-1?"default":"pointer", opacity: page>=totalPages-1?0.4:1 }}>Last</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: 14, textAlign: "center", fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>
          Glycemic Control Risk Monitor<br/>
          CatBoost (AUC {MODEL.auc}) | {MODEL.n_features} features | Risk Score 0-100 | Four-tier stratification (10/40/70) | SHAP TreeExplainer<br/>
          For clinical decision support only. Does not replace clinical judgment.
        </div>
      </div>

      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
