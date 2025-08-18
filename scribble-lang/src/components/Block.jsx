// src/components/Block.jsx
import React from "react";
import { Group, Image as KImage, Rect } from "react-konva";
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
    };

    const img = useHtmlImage(props.assetUrl);
    const moveBlock = useBlockStore((s) => s.moveBlock);

    const width = b.w ?? 128;
    const height = b.h ?? 150;

    return (
        <Group
            x={b.x}
            y={b.y}
            draggable
            onDragStart={(e) => {
                e.cancelBubble = true;                 // <- don't let Stage see this
                props.onBlockDragStart?.();
            }}
            onDragMove={(e) => {
                e.cancelBubble = true;                 // <- prevent bubbling to Stage
                const p = e.target.position();
                moveBlock(b.id, p.x, p.y);
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true;                 // <- prevent Stage handlers
                const stage = e.target.getStage();
                const scale = props.stageScale ?? (stage ? stage.scaleX() : 1);

                const state = useBlockStore.getState();
                const me = state.blocks.find((x) => x.id === b.id);
                if (!me) { props.onBlockDragEnd?.(); return; }

                // Snap (no tuck)
                const snap = findSnap(me, state.blocks, state.svgInfoByType, scale, { tuck: false });
                if (snap) {
                    state.moveBlock(b.id, me.x + snap.dx, me.y + snap.dy);
                    if (!state.wouldCreateCycle(snap.target.blockId, b.id)) {
                        state.connectEdge({
                            fromId: snap.target.blockId,
                            fromPort: snap.target.port,
                            toId: b.id,
                            toPort: "prev",
                        });
                    }
                }

                props.onBlockDragEnd?.();
            }}
        >
            {img ? (
                <KImage image={img} width={width} height={height} />
            ) : (
                <Rect width={width} height={height} fill="#eee" stroke="#999" />
            )}
        </Group>
    );
}
