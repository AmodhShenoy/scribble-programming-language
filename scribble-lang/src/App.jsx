// src/App.jsx
import BlockPalette from "./components/BlockPalette";
import CanvasStage from "./components/CanvasStage";

export default function App() {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ width: 220, flex: "0 0 220px" }}>
        <BlockPalette />
      </div>
      <CanvasStage />
    </div>
  );
}
