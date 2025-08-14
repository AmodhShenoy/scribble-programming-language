// src/components/BlockPalette.jsx
import React, { useRef } from "react";
import { nanoid } from "nanoid";
import { useBlockStore } from "../store/useBlockStore";

// Serve SVGs from /public/blocks/*.svg
const ASSET_BASE = "/blocks";

// Grouped palette (edit or reorder as you like)
const CATEGORIES = [
    {
        title: "Control",
        types: [
            "start",
            "stop",
            "wait",
            "repeat_times",
            "repeat_until",
            "if_else",
            "if_branch_ender",
            "repeat_loop_ender",
        ],
    },
    {
        title: "Motion",
        types: [
            "move",
            "go_to",
            "change_x_by",
            "change_y_by",
            "turn_clockwise",
            "turn_anticlockwise",
            "point_in",
        ],
    },
    {
        title: "Looks",
        types: ["say", "think", "clear"],
    },
    {
        title: "Variables",
        types: ["set_variable", "change_variable", "variable"],
    },
    {
        title: "Operators",
        types: [
            "plus_operator",
            "minus_operator",
            "multiply_operator",
            "divide_operator",
            "mod_operator",
            "gt_operator",
            "lt_operator",
            "et_operator",
            "and_operator",
            "or_operator",
            "not_operator",
        ],
    },
];

// Optional pretty label (used under thumbnails)
const PRETTY = {
    start: "start",
    stop: "stop",
    wait: "wait",
    repeat_times: "repeat (times)",
    repeat_until: "repeat until",
    if_else: "if / else",
    if_branch_ender: "if ender",
    repeat_loop_ender: "loop ender",

    move: "move",
    go_to: "go to",
    change_x_by: "change x by",
    change_y_by: "change y by",
    turn_clockwise: "turn ↻",
    turn_anticlockwise: "turn ↺",
    point_in: "point in",

    say: "say",
    think: "think",
    clear: "clear",

    set_variable: "set variable",
    change_variable: "change variable",
    variable: "variable",

    plus_operator: "a + b",
    minus_operator: "a − b",
    multiply_operator: "a × b",
    divide_operator: "a ÷ b",
    mod_operator: "a mod b",
    gt_operator: "a > b",
    lt_operator: "a < b",
    et_operator: "a = b",
    and_operator: "a AND b",
    or_operator: "a OR b",
    not_operator: "NOT a",
};

function BlockThumbnail({ type, onClick }) {
    return (
        <div
            onClick={onClick}
            title={type}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
            style={{
                cursor: "pointer",
                padding: 6,
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
                textAlign: "center",
                userSelect: "none",
            }}
        >
            <img
                src={`${ASSET_BASE}/${type}.svg`}
                alt={type}
                style={{
                    maxWidth: 160,
                    width: "100%",
                    height: "auto",
                    display: "block",
                    margin: "0 auto",
                    pointerEvents: "none", // ensure wrapper receives click
                }}
                onError={() => console.warn(`Missing ${ASSET_BASE}/${type}.svg`)}
            />
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                {PRETTY[type] || type}
            </div>
        </div>
    );
}

function Category({ title, types, onAdd }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div
                style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#444",
                    margin: "6px 0 8px",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                }}
            >
                {title}
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 12,
                }}
            >
                {types.map((t) => (
                    <BlockThumbnail key={t} type={t} onClick={() => onAdd(t)} />
                ))}
            </div>
        </div>
    );
}

export default function BlockPalette() {
    const addBlock = useBlockStore((s) => s.addBlock);
    const spawnCountRef = useRef(0);

    const handleAdd = (type) => {
        // Spawn in a visible region with a small offset each time
        const i = spawnCountRef.current++;
        const base = { x: 260, y: 180 };
        const jitter = { x: (i % 5) * 28, y: Math.floor(i / 5) * 28 };

        addBlock({
            id: nanoid(),
            type,
            x: base.x + jitter.x,
            y: base.y + jitter.y,
        });
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

            {CATEGORIES.map((cat) => (
                <Category
                    key={cat.title}
                    title={cat.title}
                    types={cat.types}
                    onAdd={handleAdd}
                />
            ))}
        </div>
    );
}
