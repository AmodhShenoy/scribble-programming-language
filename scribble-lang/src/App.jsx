// src/App.jsx
import React from "react";
import BlockPalette from "./components/BlockPalette";
import CanvasStage from "./components/CanvasStage";
import { preloadSvgInfo } from "./bootstrap/loadSvgInfo";

export default function App() {
  // Prevent duplicate preload in Strict Mode / HMR
  const bootedRef = React.useRef(false);

  React.useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    preloadSvgInfo().catch((err) => {
      console.error("Failed to preload SVG info:", err);
    });
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gridTemplateRows: "100vh",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #eee",
          padding: 8,
          overflow: "auto",
          background: "#fafafa",
        }}
      >
        <h3 style={{ margin: "8px 0 12px 0" }}>Palette</h3>
        <BlockPalette />
      </aside>

      <main style={{ position: "relative", overflow: "hidden" }}>
        <CanvasStage />
      </main>
    </div>
  );
}
