import { ImageResponse } from "next/og";

export const alt =
  "TrackMyEstate — Track Every Property, Policy, Loan and Investment";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#020617",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "#059669",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          T
        </div>
        <div style={{ fontSize: 32, fontWeight: 600 }}>TrackMyEstate</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 14px",
            borderRadius: 999,
            background: "rgba(5, 150, 105, 0.15)",
            color: "#34d399",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          Free
        </div>
      </div>
      <div
        style={{
          marginTop: 48,
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.15,
          maxWidth: 950,
        }}
      >
        Aggregate everything. Never miss a date.
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          color: "#94a3b8",
          maxWidth: 900,
        }}
      >
        Properties, insurance, investments and loans — in one place, with
        reminders that reach you in time.
      </div>
    </div>,
    { ...size },
  );
}
