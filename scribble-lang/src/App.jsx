// src/App.jsx
import React from "react";
import BlockPalette from "./components/BlockPalette";
import CanvasStage from "./components/CanvasStage";
import { preloadSvgInfo } from "./bootstrap/loadSvgInfo";
import DebugDock from "./components/DebugDock";
import RunnerPanel from "./runtime/RunnerPanel"; // keep if you're already using it

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

  // ⬅️ Adjust this to control the horizontal scrollable width of your canvas
  const CANVAS_WORLD_WIDTH = 3200; // px

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr 380px", // palette | canvas | runner
        gridTemplateRows: "100vh",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Left menu (unchanged) */}
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

      {/* Main canvas area with ONLY horizontal scroll */}
      <main style={{ position: "relative", overflow: "hidden" }}>
        {/* Scroll container provides a horizontal scrollbar just for the canvas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* This inner track defines how far you can scroll horizontally */}
          <div style={{ width: CANVAS_WORLD_WIDTH, height: "100%" }}>
            {/* CanvasStage will size to this inner container width */}
            <CanvasStage />
          </div>
        </div>
      </main>

      {/* Right-side runner panel (unchanged) */}
      <RunnerPanel />

      {/* Debug dock (unchanged) */}
      <>
        <DebugDock />
      </>
    </div>
  );
}
