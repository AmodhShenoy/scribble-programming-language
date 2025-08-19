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

    const [isPanning, setIsPanning] = useState(false);
    const [draggingStage, setDraggingStage] = useState(false);
    const [draggingBlock, setDraggingBlock] = useState(false);

    // context menu (right-click)
    const [ctx, setCtx] = useState(null); // {x,y,id}

    // inline input editor overlay
    const [inputUI, setInputUI] = useState(null); // {blockId,port,worldRect{ x,y,w,h,rx },value}

    // keyboard handlers
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === " ") setIsPanning(true); // Space to pan
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
                setInputUI(null);
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

    // wheel: zoom (Ctrl/Cmd) or pan; disable while dragging a block
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

        // pan with deltas
        setPos((p) => ({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY }));
    };

    // middle mouse pans; click hides context menu
    const handleMouseDown = (e) => {
        if (e.evt.button === 1) setIsPanning(true);
        setCtx(null);
        setInputUI(null);
    };
    const handleMouseUp = (e) => {
        if (e.evt.button === 1) setIsPanning(false);
    };

    // clear selection when clicking empty canvas
    const handleStageMouseDown = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            const { clearSelection } = useBlockStore.getState();
            clearSelection();
            setCtx(null);
            setInputUI(null);
        }
    };

    // world → screen for input overlay
    const worldToScreen = (x, y, w = 0, h = 0) => {
        const stage = stageRef.current;
        const s = stage ? stage.scaleX() : 1;
        const sx = (stage ? stage.x() : 0) + x * s;
        const sy = (stage ? stage.y() : 0) + y * s;
        return { left: sx, top: sy, width: w * s, height: h * s };
    };

    const startEditInput = ({ blockId, port, worldRect, value }) => {
        setInputUI({ blockId, port, worldRect, value });
    };

    const commitInput = (val) => {
        if (!inputUI) return;
        useBlockStore.getState().setInputValue(inputUI.blockId, inputUI.port, val ?? "");
        setInputUI(null);
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
                            onRequestEditInput={startEditInput}
                        />
                    ))}
                </Layer>
            </Stage>

            {/* Inline input overlay — replace this whole block */}
            {inputUI && (() => {
                const s = stageRef.current?.scaleX() || 1;
                const { left, top, width, height } = worldToScreen(
                    inputUI.worldRect.x,
                    inputUI.worldRect.y,
                    inputUI.worldRect.w,
                    inputUI.worldRect.h
                );
                const radius = Math.max(4, (inputUI.worldRect.rx || 8) * s);

                return (
                    <input
                        autoFocus
                        defaultValue={inputUI.value || ""}
                        onBlur={(e) => commitInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitInput(e.currentTarget.value);
                            if (e.key === "Escape") setInputUI(null);
                            e.stopPropagation();
                        }}
                        style={{
                            position: "absolute",
                            left,
                            top,
                            width,
                            height,
                            // make the element's outer box equal to the slot rect
                            boxSizing: "border-box",
                            border: "2px solid #6ad3ff",
                            borderRadius: radius,
                            padding: "0 10px",
                            // keep text vertically centered without changing outer size
                            lineHeight: `${Math.max(1, height - 4)}px`, // 4px = 2px top + 2px bottom border
                            background: "#ffffff",
                            color: "#111",
                            outline: "none",
                            boxShadow: "none",
                            zIndex: 1000,
                        }}
                    />
                );
            })()}

            {/* Context menu */}
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
                        minWidth: 160,
                    }}
                >
                    <div style={{ padding: "6px 10px", cursor: "pointer" }} onClick={deleteFromContext}>
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
