// src/components/CanvasStage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import { useBlockStore } from "../store/useBlockStore";
import Block from "./Block";
import { getAssetUrl } from "../bootstrap/loadSvgInfo";

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

    const [isPanning, setIsPanning] = useState(false);       // Hold Space or MMB
    const [draggingStage, setDraggingStage] = useState(false);
    const [draggingBlock, setDraggingBlock] = useState(false); // <- NEW

    // Delete / Esc
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === " ") setIsPanning(true); // Space to pan
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
        const onKeyUp = (e) => {
            if (e.key === " ") setIsPanning(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // Resize
    useEffect(() => {
        const onResize = () =>
            setDims({
                width: Math.max(1, window.innerWidth - PALETTE_WIDTH),
                height: Math.max(1, window.innerHeight),
            });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Wheel: zoom with Ctrl/Cmd; pan with deltas — but DO NOT pan while dragging a block
    const handleWheel = (e) => {
        e.evt.preventDefault();
        if (draggingBlock) return; // <- prevent canvas from moving during block drag

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

    // Allow Middle-mouse to pan
    const handleMouseDown = (e) => {
        if (e.evt.button === 1) setIsPanning(true);
    };
    const handleMouseUp = (e) => {
        if (e.evt.button === 1) setIsPanning(false);
    };

    // Click empty canvas to clear selection
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
                cursor:
                    isPanning && !draggingBlock
                        ? draggingStage
                            ? "grabbing"
                            : "grab"
                        : "default",
            }}
        >
            <Stage
                ref={stageRef}
                width={dims.width}
                height={dims.height}
                draggable={isPanning && !draggingBlock}   // <- Stage only drags when panning & not dragging a block
                onDragStart={(e) => {
                    if (!(isPanning && !draggingBlock)) return;
                    setDraggingStage(true);
                }}
                onDragMove={(e) => {
                    if (!draggingStage) return;            // <- gate updates
                    setPos(e.target.position());
                }}
                onDragEnd={(e) => {
                    if (!draggingStage) return;
                    setDraggingStage(false);
                    setPos(e.target.position());
                }}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseDownCapture={handleStageMouseDown}
            >
                <Layer>
                    {blocks.map((b) => (
                        <Block
                            key={b.id}
                            {...b}
                            assetUrl={getAssetUrl(b.type)}
                            stageRef={stageRef}
                            stageScale={scale}
                            // Notify canvas when a block drag starts/ends
                            onBlockDragStart={() => setDraggingBlock(true)}
                            onBlockDragEnd={() => setDraggingBlock(false)}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
}
