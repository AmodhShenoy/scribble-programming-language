// src/components/CanvasStage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import { useBlockStore } from "../store/useBlockStore";
import Block from "./Block";

const PALETTE_WIDTH = 220;

export default function CanvasStage() {
    const blocks = useBlockStore((s) => s.blocks);
    const stageRef = useRef(null);

    const [dims, setDims] = useState(() => ({
        width: Math.max(1, window.innerWidth - PALETTE_WIDTH),
        height: Math.max(1, window.innerHeight),
    }));

    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    // ✅ Restore delete/backspace to remove selected block
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                const { selectedId, deleteBlock } = useBlockStore.getState();
                if (selectedId) {
                    e.preventDefault();
                    deleteBlock(selectedId);
                }
            }
            if (e.key === "Escape") {
                const { clearSelection } = useBlockStore.getState();
                clearSelection();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

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

    // Wheel/trackpad: Ctrl/Cmd + wheel zooms; otherwise pans
    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        if (e.evt.ctrlKey || e.evt.metaKey) {
            const oldScale = scale;
            const pointer = stage.getPointerPosition();
            const scaleBy = 1.05;
            const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

            const mousePointTo = {
                x: (pointer.x - pos.x) / oldScale,
                y: (pointer.y - pos.y) / oldScale,
            };

            setScale(newScale);
            setPos({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            });
            return;
        }

        // pan
        const k = 1;
        setPos((p) => ({ x: p.x - e.evt.deltaX * k, y: p.y - e.evt.deltaY * k }));
    };

    // ✅ Click empty canvas to clear selection (optional but nice)
    const handleStageMouseDown = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            const { clearSelection } = useBlockStore.getState();
            clearSelection();
        }
    };

    return (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                height: "100vh",
                background: "#1f1f1f",
                overflow: "hidden",
                cursor: dragging ? "grabbing" : "grab",
            }}
        >
            <Stage
                ref={stageRef}
                width={dims.width}
                height={dims.height}
                draggable
                onDragStart={() => setDragging(true)}
                onDragEnd={(e) => {
                    setDragging(false);
                    setPos(e.target.position());
                }}
                onDragMove={(e) => setPos(e.target.position())}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                onWheel={handleWheel}
                onMouseDown={handleStageMouseDown}
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
