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

    const [isPanning, setIsPanning] = useState(false);
    const [draggingStage, setDraggingStage] = useState(false);
    const [draggingBlock, setDraggingBlock] = useState(false);

    // simple context menu state
    const [ctx, setCtx] = useState(null); // {x,y, id}

    // keyboard: Delete/Backspace, Esc; Space = pan
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === " ") setIsPanning(true);
            if (e.key === "Delete" || e.key === "Backspace") {
                const { selectedId, deleteBlock } = useBlockStore.getState();
                if (selectedId) {
                    e.preventDefault();
                    deleteBlock(selectedId);
                    setCtx(null);
                }
            }
            if (e.key === "Escape") {
                const { clearSelection } = useBlockStore.getState();
                clearSelection();
                setCtx(null);
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

    // resize
    useEffect(() => {
        const onResize = () =>
            setDims({
                width: Math.max(1, window.innerWidth - PALETTE_WIDTH),
                height: Math.max(1, window.innerHeight),
            });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // wheel: zoom/pan; no pan while dragging block
    const handleWheel = (e) => {
        e.evt.preventDefault();
        if (draggingBlock) return;

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

        setPos((p) => ({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY }));
    };

    // middle mouse pan
    const handleMouseDown = (e) => {
        if (e.evt.button === 1) setIsPanning(true);
        // clicking anywhere hides context menu
        setCtx(null);
    };
    const handleMouseUp = (e) => {
        if (e.evt.button === 1) setIsPanning(false);
    };

    const handleStageMouseDown = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            const { clearSelection } = useBlockStore.getState();
            clearSelection();
            setCtx(null);
        }
    };

    const deleteFromContext = () => {
        if (!ctx) return;
        const { deleteBlock } = useBlockStore.getState();
        deleteBlock(ctx.id);
        setCtx(null);
    };
    const disconnectFromContext = () => {
        if (!ctx) return;
        const { disconnectAllFor } = useBlockStore.getState();
        disconnectAllFor(ctx.id);
        setCtx(null);
    };

    return (
        <div
            style={{
                position: "relative",
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
                draggable={isPanning && !draggingBlock}
                onDragStart={() => setDraggingStage(true)}
                onDragMove={(e) => {
                    if (!draggingStage) return;
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
                            onBlockDragStart={() => setDraggingBlock(true)}
                            onBlockDragEnd={() => setDraggingBlock(false)}
                            onShowContextMenu={(pt, id) => setCtx({ ...pt, id })}
                        />
                    ))}
                </Layer>
            </Stage>

            {/* Simple context menu */}
            {ctx && (
                <div
                    style={{
                        position: "fixed",
                        left: ctx.x,
                        top: ctx.y,
                        background: "#202225",
                        color: "#fff",
                        border: "1px solid #333",
                        borderRadius: 6,
                        boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
                        padding: 6,
                        zIndex: 1000,
                        minWidth: 140,
                    }}
                >
                    <div
                        style={{ padding: "6px 10px", cursor: "pointer" }}
                        onClick={deleteFromContext}
                    >
                        🗑️ Delete (Del)
                    </div>
                    <div
                        style={{ padding: "6px 10px", cursor: "pointer" }}
                        onClick={disconnectFromContext}
                    >
                        🔌 Disconnect links
                    </div>
                </div>
            )}
        </div>
    );
}
