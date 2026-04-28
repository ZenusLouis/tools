import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#6366f1",
          borderRadius: "8px",
          color: "white",
          display: "flex",
          fontSize: "15px",
          fontWeight: 900,
          height: "32px",
          justifyContent: "center",
          letterSpacing: "-0.02em",
          width: "32px",
        }}
      >
        &gt;_
      </div>
    ),
    size,
  );
}
