import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Lunchportalen — interaktiv AI forretningsmotor-demo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f172a 0%, #1e293b 42%, #0f172a 100%)",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
          <div
            style={{
              width: 10,
              height: 52,
              background: "#ff007f",
              borderRadius: 5,
            }}
          />
          <span style={{ fontSize: 30, color: "#94a3b8", fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
            Lunchportalen
          </span>
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1.08,
            maxWidth: 980,
            letterSpacing: -1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Se tallet røre på seg — fra kaos til kontroll
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#cbd5e1",
            marginTop: 26,
            maxWidth: 880,
            lineHeight: 1.35,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Interaktiv demo: før → etter når AI styrer margin og strategi. Ett trykk.
        </div>
        <div
          style={{
            marginTop: 44,
            padding: "16px 36px",
            background: "#ff007f",
            color: "#ffffff",
            fontSize: 26,
            fontWeight: 700,
            borderRadius: 999,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Klikk for å se hva som skjer →
        </div>
      </div>
    ),
    { ...size },
  );
}
