// src/components/BlockPalette.jsx
import React from "react";
import { useBlockStore } from "../store/useBlockStore";
import { getAssetUrl } from "../bootstrap/loadSvgInfo";

// Small id helper (matches store style)
function uid(prefix = "") {
    return (
        prefix +
        Math.random().toString(36).slice(2, 8) +
        Math.random().toString(36).slice(2, 6)
    );
}

// Non-variable groups you already have in the palette.
// (Keep your list; I’m including a reasonable default.)
const ACTIONS = [
    "start",
    "stop",
    "say",
    "think",
    "wait",
    "clear",
    "go_to",
    "move",
    "change_x_by",
    "change_y_by",
    "turn_clockwise",
    "turn_anticlockwise",
    "point_in",
    "if_else",
    "repeat_times",
    "repeat_until",
];

const REPORTERS = [
    "plus_operator",
    "minus_operator",
    "multiply_operator",
    "divide_operator",
    "mod_operator",
    "gt_operator",
    "gte_operator",
    "lt_operator",
    "lte_operator",
    "et_operator",
    "and_operator",
    "or_operator",
    "not_operator",
];

// Variable-related block types
const VAR_TYPES = {
    variable: "variable", // reporter (shows the name)
    set: "set_variable",
    change: "change_variable",
};

export default function BlockPalette() {
    const addBlock = useBlockStore((s) => s.addBlock);
    const variables = useBlockStore((s) => s.variables);
    const createVariable = useBlockStore((s) => s.createVariable);

    const hasVars = variables.length > 0;

    const add = (type, extra = {}) => {
        const assetUrl = getAssetUrl(type);
        // Initial position near the left edge of the canvas area
        addBlock({
            id: uid("b_"),
            type,
            x: 260,
            y: 160,
            assetUrl,
            inputs: extra.inputs || {},
        });
    };

    const onCreateVariable = () => {
        const name = window.prompt('Enter a variable name (e.g. "score"):');
        if (!name) return;
        const rawInit = window.prompt(`Initial value for "${name}"? (blank = 0)`) ?? "";
        const n = Number(rawInit);
        const init = Number.isFinite(n) ? n : rawInit;
        createVariable(name, init);
    };

    // when user clicks “set”/“change” and we have variables,
    // default to the first variable name; they can edit later via input slot.
    const firstVarName = hasVars ? variables[0].name : "";

    return (
        <aside
            style={{
                width: 220,
                height: "100vh",
                overflowY: "auto",
                background: "#141414",
                color: "#ddd",
                borderRight: "1px solid #222",
                padding: 10,
                boxSizing: "border-box",
            }}
        >
            <Section title="Actions">
                <TileRow items={ACTIONS} onAdd={add} />
            </Section>

            <Section title="Operators">
                <TileRow items={REPORTERS} onAdd={add} />
            </Section>

            {/* ---------------- Variables LAST ---------------- */}
            <Section
                title="Variables"
                extra={
                    <button
                        onClick={onCreateVariable}
                        style={{
                            background: "#2a88ff",
                            color: "white",
                            border: 0,
                            borderRadius: 6,
                            padding: "6px 10px",
                            cursor: "pointer",
                        }}
                    >
                        Create variable
                    </button>
                }
            >
                {!hasVars ? (
                    <p style={{ opacity: 0.6, margin: "6px 0 0 2px" }}>
                        No variables yet. Create one to unlock variable blocks.
                    </p>
                ) : (
                    <>
                        {/* Generic “set …” and “change …” (shown only when a variable exists) */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            <Tile
                                type={VAR_TYPES.set}
                                label="set"
                                onClick={() =>
                                    add(VAR_TYPES.set, { inputs: { name: firstVarName, value: 0 } })
                                }
                            />
                            <Tile
                                type={VAR_TYPES.change}
                                label="change"
                                onClick={() =>
                                    add(VAR_TYPES.change, { inputs: { name: firstVarName, delta: 1 } })
                                }
                            />
                        </div>

                        {/* One “variable.svg” per created variable with the name overlaid */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {variables.map((v) => (
                                <VariableTile
                                    key={v.id}
                                    varName={v.name}
                                    onClick={() => add(VAR_TYPES.variable, { inputs: { name: v.name } })}
                                />
                            ))}
                        </div>
                    </>
                )}
            </Section>
        </aside>
    );
}

/* ---------------- UI bits ---------------- */

function Section({ title, children, extra }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                }}
            >
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.8 }}>{title}</h3>
                {extra}
            </div>
            {children}
        </div>
    );
}

function TileRow({ items, onAdd }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((type) => (
                <Tile key={type} type={type} onClick={() => onAdd(type)} />
            ))}
        </div>
    );
}

function Tile({ type, onClick, label }) {
    const url = getAssetUrl(type);
    return (
        <button
            onClick={onClick}
            title={label || type}
            style={{
                width: 88,
                height: 54,
                padding: 0,
                border: "1px solid #2b2b2b",
                borderRadius: 10,
                background: "#1b1b1b",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <img
                src={url}
                alt={type}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    filter: "drop-shadow(0 0 0 rgba(0,0,0,0))",
                }}
            />
            {label && (
                <div
                    style={{
                        position: "absolute",
                        left: 6,
                        top: 6,
                        fontSize: 11,
                        color: "#bbb",
                        pointerEvents: "none",
                    }}
                >
                    {label}
                </div>
            )}
        </button>
    );
}

function VariableTile({ varName, onClick }) {
    const url = getAssetUrl("variable"); // public/blocks/variable.svg
    return (
        <button
            onClick={onClick}
            title={varName}
            style={{
                width: 112,
                height: 60,
                padding: 0,
                border: "1px solid #2b2b2b",
                borderRadius: 10,
                background: "#1b1b1b",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <img
                src={url}
                alt={varName}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
            {/* Name overlay — this visually “replaces” the text layer in the SVG for the menu tile */}
            <div
                style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    top: 16,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "white",
                    textShadow: "0 1px 0 rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                }}
            >
                {varName}
            </div>
        </button>
    );
}
