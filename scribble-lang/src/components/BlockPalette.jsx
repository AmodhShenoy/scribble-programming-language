import React, { useRef } from "react";
import { nanoid } from "nanoid";
import { useBlockStore } from "../store/useBlockStore";

const BLOCK_TYPES = [
    "start",
    "say",
    "repeat_until",
    "if_else",
    "stop",
    "go_to",
    "change_x_by",
    "turn_anticlockwise",
    "plus_operator",
    "and_operator",
    "et_operator",
    "set_variable",
    "change_variable",
    "variable",
];

function BlockThumbnail({ type, onClick }) {
    return (
        <div
            onClick={onClick}
            onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
            role="button"
            tabIndex={0}
            title={type}
            style={{
                marginBottom: 12,
                cursor: "pointer",
                padding: 6,
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
                textAlign: "center",
                userSelect: "none",
            }}
        >
            {/* Read from public/blocks/NAME.svg */}
            <img
                src={`/blocks/${type}.svg`}
                alt={type}
                style={{
                    maxWidth: 160,
                    width: "100%",
                    height: "auto",
                    display: "block",
                    margin: "0 auto",
                    pointerEvents: "none", // ensure the DIV gets the click
                }}
                onError={() => console.warn(`Missing /blocks/${type}.svg`)}
            />
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{type}</div>
        </div>
    );
}

export default function BlockPalette() {
    const addBlock = useBlockStore((s) => s.addBlock);
    const spawnCountRef = useRef(0);

    const handleAdd = (type) => {
        const i = spawnCountRef.current++;
        const base = { x: 260, y: 180 };         // visible zone on canvas
        const jitter = { x: (i % 5) * 28, y: Math.floor(i / 5) * 28 };

        const block = {
            id: nanoid(),
            type,
            x: base.x + jitter.x,
            y: base.y + jitter.y,
        };
        console.log("[palette click]", type, block);
        addBlock(block);
    };

    return (
        <div
            style={{
                width: 220,
                padding: 16,
                background: "#f9f9f9",
                borderRight: "1px solid #ccc",
                overflowY: "auto",
                height: "100vh",
                boxSizing: "border-box",
            }}
        >
            <h3 style={{ margin: "0 0 12px" }}>Blocks</h3>
            {BLOCK_TYPES.map((type) => (
                <BlockThumbnail key={type} type={type} onClick={() => handleAdd(type)} />
            ))}

            {/* Debug helpers */}
            <button
                style={{ marginTop: 16, width: "100%" }}
                onClick={() =>
                    addBlock({ id: nanoid(), type: "say", x: 260, y: 180 })
                }
            >
                + Add test block
            </button>
        </div>
    );
}
