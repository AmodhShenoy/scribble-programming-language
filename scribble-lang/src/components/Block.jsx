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
    const svgInfoByType = useBlockStore((s) => s.svgInfoByType);
    const registerSize = useBlockStore((s) => s.registerSize);

    const info = svgInfoByType[b.type];
    const vbw = info?.viewBox?.w || img?.naturalWidth || 128;
    const vbh = info?.viewBox?.h || img?.naturalHeight || 128;

    // ⬇️ if size not set (or wrong), sync it to the SVG natural size
    React.useEffect(() => {
        if (!b.w || !b.h || b.w !== vbw || b.h !== vbh) {
            registerSize(b.id, vbw, vbh);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [b.id, vbw, vbh, registerSize]);

    const width = b.w ?? vbw;
    const height = b.h ?? vbh;

    const isSelected = selectedId === b.id;

    // scale factors from SVG viewBox to rendered size
    const sx = width / vbw;
    const sy = height / vbh;

    const slotLocal = (slot) => ({
        x: slot.box.x * sx,
        y: slot.box.y * sy,
        w: slot.box.w * sx,
        h: slot.box.h * sy,
        rx: (slot.box.rx ?? 8) * Math.max(sx, sy),
    });

    // … keep your drag/snap/selection handlers the same …

    return (
        <Group
            x={b.x}
            y={b.y}
            draggable
            // (click / contextmenu / drag handlers unchanged)
            onClick={(e) => { e.cancelBubble = true; selectBlock(b.id); }}
            onTap={(e) => { e.cancelBubble = true; selectBlock(b.id); }}
            onContextMenu={(e) => {
                e.evt.preventDefault(); e.cancelBubble = true; selectBlock(b.id);
                props.onShowContextMenu?.({ x: e.evt.clientX, y: e.evt.clientY }, b.id);
            }}
            onDragStart={(e) => { e.cancelBubble = true; props.onBlockDragStart?.(); }}
            onDragMove={(e) => { e.cancelBubble = true; const p = e.target.position(); moveBlock(b.id, p.x, p.y); }}
            onDragEnd={(e) => {
                e.cancelBubble = true;
                const stage = e.target.getStage();
                const scale = props.stageScale ?? (stage ? stage.scaleX() : 1);
                const state = useBlockStore.getState();
                const me = state.blocks.find((x) => x.id === b.id);
                if (!me) { props.onBlockDragEnd?.(); return; }

                const snap = findSnap(me, state.blocks, state.svgInfoByType, scale, { tuck: false });
                if (snap) {
                    state.moveBlock(b.id, me.x + snap.dx, me.y + snap.dy);
                    if (!state.wouldCreateCycle(snap.target.blockId, b.id)) {
                        if (String(snap.target.port).startsWith("input:")) {
                            state.connectInput(snap.target.blockId, snap.target.port.split(":")[1], b.id);
                        } else {
                            state.connectEdge({ fromId: snap.target.blockId, fromPort: snap.target.port, toId: b.id });
                        }
                    }
                }
                props.onBlockDragEnd?.();
            }}
        >
            {/* base image */}
            {img ? (
                <KImage image={img} width={width} height={height} />
            ) : (
                <Rect width={width} height={height} fill="#eee" stroke="#999" />
            )}

            {/* input slots in LOCAL coords (white) */}
            {Object.entries(info?.inputs || {}).map(([name, slot]) => {
                const R = slotLocal(slot);
                const typed = (b.inputs && b.inputs[name]) || "";
                return (
                    <React.Fragment key={name}>
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

            {isSelected && (
                <Rect
                    x={-6} y={-6}
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
