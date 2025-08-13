// src/components/Block.jsx
import React, { useEffect, useState } from "react";
import { Group, Image as KImage, Rect, Text } from "react-konva";
import useImage from "use-image";
import { useBlockStore } from "../store/useBlockStore";

export default function Block({ id, type, x, y }) {
    const [img] = useImage(`/blocks/${type}.svg`);
    const updateBlock = useBlockStore((s) => s.updateBlock);
    const [size, setSize] = useState({ width: 160, height: 64 });

    useEffect(() => {
        if (img) setSize({ width: img.width, height: img.height });
    }, [img]);

    const stopBubble = (e) => {
        e.cancelBubble = true;
    };

    return (
        <Group
            x={x}
            y={y}
            draggable
            onDragStart={stopBubble}
            onDragMove={stopBubble}
            onDragEnd={(e) => {
                stopBubble(e);
                updateBlock(id, { x: e.target.x(), y: e.target.y() });
            }}
        >
            {img ? (
                <KImage image={img} width={size.width} height={size.height} />
            ) : (
                <>
                    <Rect width={size.width} height={size.height} fill="#eef" stroke="#99c" cornerRadius={8} />
                    <Text text={type} x={8} y={8} fontSize={14} fill="#335" />
                </>
            )}
        </Group>
    );
}
