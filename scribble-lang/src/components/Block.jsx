// src/components/Block.jsx
import React from "react";
import { Group, Image as KImage, Rect, Text as KText } from "react-konva";
import { useBlockStore } from "../store/useBlockStore";
import { findSnap } from "../logic/snapper";

function useHtmlImage(src) {
    const [img, setImg] = React.useState(null);
    React.useEffect(() => {
        if (!src) return;
        const im = new window.Image();
        im.onload = () => setImg(im);
        im.src = src;
        return () => setImg(null);
    }, [src]);
    return img;
}

export default function Block(props) {
    // normalize props
    const b = props.b ?? {
        id: props.id,
        type: props.type,
        x: props.x ?? 0,
        y: props.y ?? 0,
        w: props.w,
        h: props.h,
        inputs: props.inputs,
    };

    const img = useHtmlImage(props.assetUrl);

    const moveBlock = useBlockStore((s) => s.moveBlock);
    const selectBlock = useBlockStore((s) => s.selectBlock);
    const selectedId = useBlockStore((s) => s.selectedId);
    const edges = useBlockStore((s) => s.edges);
    const allBlocks = useBlockStore((s) => s.blocks);
    const svgInfoByType = useBlockStore((s) => s.svgInfoByType);
    const registerSize = useBlockStore((s) => s.registerSize);

    const info = svgInfoByType[b.type] || {};
    const vbw = info?.viewBox?.w || img?.naturalWidth || 128;
    const vbh = info?.viewBox?.h || img?.naturalHeight || 128;

    // keep size = intrinsic SVG size
    React.useEffect(() => {
        if (!b.w || !b.h || b.w !== vbw || b.h !== vbh) {
            registerSize(b.id, vbw, vbh);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [b.id, vbw, vbh]);

    const width = b.w ?? vbw;
    const height = b.h ?? vbh;
    const isSelected = selectedId === b.id;

    // viewBox -> local scale
    const sx = width / vbw;
    const sy = height / vbh;

    // slot rect (viewBox units -> local)
    const slotLocal = (slot) => ({
        x: slot.box.x * sx,
        y: slot.box.y * sy,
        w: slot.box.w * sx,
        h: slot.box.h * sy,
        rx: (slot.box.rx ?? 8) * Math.max(sx, sy),
    });

    // current input connection for a slot
    const getInputConnection = (slotName) =>
        edges.find((e) => e.kind === "input" && e.from === b.id && e.meta?.port === slotName);

    return (
        <Group
            x={b.x}
            y={b.y}
            draggable
            onClick={(e) => { e.cancelBubble = true; selectBlock(b.id); }}
            onTap={(e) => { e.cancelBubble = true; selectBlock(b.id); }}
            onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                selectBlock(b.id);
                props.onShowContextMenu?.({ x: e.evt.clientX, y: e.evt.clientY }, b.id);
            }}
            onDragStart={(e) => { e.cancelBubble = true; props.onBlockDragStart?.(); }}
            onDragMove={(e) => {
                e.cancelBubble = true;
                const p = e.target.position();
                moveBlock(b.id, p.x, p.y);
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true;
                const stage = e.target.getStage();
                const scale = props.stageScale ?? (stage ? stage.scaleX() : 1);

                const state = useBlockStore.getState();
                const meNow = state.blocks.find((x) => x.id === b.id);
                if (!meNow) { props.onBlockDragEnd?.(); return; }

                const snap = findSnap(meNow, state.blocks, state.svgInfoByType, scale, { tuck: false });
                if (snap) {
                    // move into place
                    state.moveBlock(b.id, meNow.x + snap.dx, meNow.y + snap.dy);

                    // connect (avoid cycles)
                    if (!state.wouldCreateCycle(snap.target.blockId, b.id)) {
                        if (String(snap.target.port).startsWith("input:")) {
                            const port = snap.target.port.split(":")[1];
                            state.connectInput(snap.target.blockId, port, b.id);
                        } else {
                            state.connectEdge({
                                fromId: snap.target.blockId,
                                fromPort: snap.target.port,
                                toId: b.id,
                            });
                        }
                    }
                }
                props.onBlockDragEnd?.();
            }}
        >
            {/* Base SVG image */}
            {img ? (
                <KImage image={img} width={width} height={height} />
            ) : (
                <Rect width={width} height={height} fill="#eee" stroke="#999" />
            )}

            {/* Input slots — white overlay is hidden if a child is connected */}
            {Object.entries(info?.inputs || {}).map(([name, slot]) => {
                const R = slotLocal(slot);
                const conn = getInputConnection(name);
                const typed = (b.inputs && b.inputs[name]) || "";
                const showOverlay = !conn; // hide overlay if a block is snapped in

                return (
                    <React.Fragment key={name}>
                        {showOverlay && (
                            <Rect
                                x={R.x}
                                y={R.y}
                                width={R.w}
                                height={R.h}
                                cornerRadius={Math.max(4, R.rx)}
                                fill="#fff"
                                stroke="rgba(0,0,0,0.35)"
                                strokeWidth={1}
                                onMouseDown={(e) => { e.cancelBubble = true; }}
                                onDblClick={(e) => {
                                    e.cancelBubble = true;
                                    props.onRequestEditInput?.({
                                        blockId: b.id,
                                        port: name,
                                        worldRect: { x: b.x + R.x, y: b.y + R.y, w: R.w, h: R.h, rx: R.rx },
                                        value: typed,
                                    });
                                }}
                            />
                        )}
                        {typed && (
                            <KText
                                x={R.x + 8}
                                y={R.y + Math.max(4, (R.h - 16) / 2)}
                                text={typed}
                                fontSize={14}
                                fill="#111"
                                listening={false}
                            />
                        )}
                    </React.Fragment>
                );
            })}

            {/* Selection outline */}
            {isSelected && (
                <Rect
                    x={-6}
                    y={-6}
                    width={width + 12}
                    height={height + 12}
                    stroke="#6ad3ff"
                    strokeWidth={2}
                    cornerRadius={8}
                    listening={false}
                />
            )}
        </Group>
    );
}
