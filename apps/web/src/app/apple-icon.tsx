import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050505",
        border: "10px solid #ffffff",
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: 76,
        fontWeight: 800,
        letterSpacing: "-10px",
      }}
    >
      L/
    </div>,
    size,
  );
}
