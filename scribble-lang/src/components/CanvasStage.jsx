// src/components/CanvasStage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import { useBlockStore } from "../store/useBlockStore";
import Block from "./Block";

const PALETTE_WIDTH = 220; // must match your palette column width

export default function CanvasStage() {
    const blocks = useBlockStore((s) => s.blocks);
    const stageRef = useRef(null);

    // Stable stage size (no ResizeObserver)
    const [dims, setDims] = useState(() => ({
        width: Math.max(1, window.innerWidth - PALETTE_WIDTH),
        height: Math.max(1, window.innerHeight),
    }));

    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    // Explicit panning state
    const [isPanning, setIsPanning] = useState(false);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                const { selectedId, deleteBlock } = useBlockStore.getState();
                if (selectedId) deleteBlock(selectedId);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Keep size in sync with viewport (not with content)
    useEffect(() => {
        const onResize = () => {
            setDims({
                width: Math.max(1, window.innerWidth - PALETTE_WIDTH),
                height: Math.max(1, window.innerHeight),
            });
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Space = hold to pan; middle mouse = press to pan
    useEffect(() => {
        const down = (e) => {
            if (e.code === "Space") setIsPanning(true);
        };
        const up = (e) => {
            if (e.code === "Space") setIsPanning(false);
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, []);

    // Start/stop pan with middle mouse button (button === 1)
    const handleMouseDown = (e) => {
        if (e.evt.button === 1) setIsPanning(true);
    };
    const handleMouseUp = (e) => {
        if (e.evt.button === 1) setIsPanning(false);
    };

    // Manual zoom only; never auto-center
    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = scale;
        const pointer = stage.getPointerPosition();
        const scaleBy = 1.05;
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        // anchor zoom to mouse
        const mousePointTo = {
            x: (pointer.x - pos.x) / oldScale,
            y: (pointer.y - pos.y) / oldScale,
        };

        setScale(newScale);
        setPos({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    // If Stage drag starts without pan mode, cancel it immediately
    const handleStageDragStart = (e) => {
        if (!isPanning) e.target.stopDrag();
    };

    return (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                height: "100vh",
                overflow: "hidden",
                background: "#f5f5f5",
                cursor: isPanning ? "grab" : "default",
            }}
        >
            <Stage
                ref={stageRef}
                width={dims.width}
                height={dims.height}
                draggable={isPanning}               // ← only pannable when true
                onDragStart={handleStageDragStart}
                onDragEnd={(e) => setPos(e.target.position())}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                onWheel={handleWheel}
            >
                <Layer>
                    {blocks.map((b) => (
                        <Block key={b.id} {...b} />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
}
