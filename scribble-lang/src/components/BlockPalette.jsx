// src/components/BlockPalette.jsx
import React from "react";
import { useBlockStore } from "../store/useBlockStore";
import { getAssetUrl, getMenuAssetUrl, CATEGORY_BY_TYPE } from "../bootstrap/loadSvgInfo";

/** ── TWEAK HERE ─────────────────────────────────────────────── */
const PALETTE_WIDTH = 220;   // overall left panel width (also controlled by App.jsx grid)
const TILE_HEIGHT = 84;      // regular tile height (was 56)
const VAR_TILE_HEIGHT = 90;  // variable tile height (was 60)
/** ───────────────────────────────────────────────────────────── */

function uid(prefix = "") {
    return (
        prefix +
        Math.random().toString(36).slice(2, 8) +
        Math.random().toString(36).slice(2, 6)
    );
}

const isInternal = (t) =>
    t.startsWith("if_branch_ender") ||
    t.startsWith("repeat_loop_ender") ||
    t.startsWith("branch_ender") ||
    t.startsWith("loop_ender");

// Order categories in the palette
const CATEGORY_ORDER = ["event", "motion", "action", "control", "operator", "variable"];

// Optional pinned order inside some categories
const PINNED_BY_CATEGORY = {
    event: ["start", "stop"],
    motion: [
        "move",
        "change_x_by",
        "change_y_by",
        "turn_anticlockwise",
        "turn_clockwise",
        "point_in",
        "go_to",
    ],
    action: ["say", "think", "wait", "clear"],
    control: ["if_else", "repeat_until", "repeat_times"],
    operator: [
        "plus_operator",
        "minus_operator",
        "multiply_operator",
        "divide_operator",
        "mod_operator",
        "gt_operator",
        "gte_operator",
        "lt_operator",
        "lte_operator",
        "eq_operator",
        "neq_operator",
        "and_operator",
        "or_operator",
        "not_operator",
        "et_operator",
    ],
    variable: ["set_variable", "change_variable", "variable"],
};

export default function BlockPalette() {
    const addBlock = useBlockStore((s) => s.addBlock);
    const svgInfoByType = useBlockStore((s) => s.svgInfoByType ?? {});
    const variables = useBlockStore((s) => s.variables ?? []);
    const createVariable = useBlockStore((s) => s.createVariable);

    const allTypes = React.useMemo(
        () => Object.keys(svgInfoByType || {}).filter((t) => !isInternal(t)),
        [svgInfoByType]
    );

    const byCategory = React.useMemo(() => {
        const m = new Map();
        for (const t of allTypes) {
            const cat = CATEGORY_BY_TYPE[t] || "action";
            if (!m.has(cat)) m.set(cat, []);
            m.get(cat).push(t);
        }
        for (const cat of m.keys()) {
            const list = m.get(cat);
            const pinned = PINNED_BY_CATEGORY[cat] || [];
            const weight = (x) => {
                const i = pinned.indexOf(x);
                return i === -1 ? 1000 + x.localeCompare("") : i;
            };
            list.sort((a, b) => weight(a) - weight(b) || a.localeCompare(b));
            m.set(cat, list);
        }
        return m;
    }, [allTypes]);

    const hasVars = variables.length > 0;
    const firstVarName = hasVars ? variables[0].name : "";

    const add = (type, extra = {}) => {
        const assetUrl = getAssetUrl(type); // runtime svg on canvas
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

    return (
        <aside
            style={{
                width: PALETTE_WIDTH,
                height: "100vh",
                overflowY: "auto",
                background: "#141414",
                color: "#ddd",
                borderRight: "1px solid #222",
                padding: 10,
                boxSizing: "border-box",
            }}
        >
            {CATEGORY_ORDER.map((cat) => {
                const items = byCategory.get(cat) || [];
                if (cat === "variable") {
                    return (
                        <Section
                            key={cat}
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
                                    <TileColumn
                                        items={items.filter((t) => t !== "variable")}
                                        onAdd={(t) =>
                                            add(t, {
                                                inputs:
                                                    t === "set_variable"
                                                        ? { name: firstVarName, value: 0 }
                                                        : { name: firstVarName, delta: 1 },
                                            })
                                        }
                                    />
                                    {/* one reporter tile per created variable */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {variables.map((v) => (
                                            <VariableTile
                                                key={v.id}
                                                varName={v.name}
                                                onClick={() => add("variable", { inputs: { name: v.name } })}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </Section>
                    );
                }

                const title =
                    cat === "event"
                        ? "Events"
                        : cat === "motion"
                            ? "Motion"
                            : cat === "action"
                                ? "Actions"
                                : cat === "control"
                                    ? "Control"
                                    : cat === "operator"
                                        ? "Operators"
                                        : "Other";

                return (
                    <Section key={cat} title={title}>
                        <TileColumn items={items} onAdd={add} />
                    </Section>
                );
            })}
        </aside>
    );
}

/* ---------- UI bits ---------- */

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
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
                    {title}
                </h3>
                {extra}
            </div>
            {children}
        </div>
    );
}

// One full-width tile per row
function TileColumn({ items, onAdd }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((type) => (
                <Tile key={type} type={type} onClick={() => onAdd(type)} />
            ))}
        </div>
    );
}

function Tile({ type, onClick, label }) {
    const url = getMenuAssetUrl(type);
    return (
        <button
            onClick={onClick}
            title={label || type}
            style={{
                width: "100%",
                height: TILE_HEIGHT,       // <── tweak with TILE_HEIGHT
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
                }}
            />
            {label && (
                <div
                    style={{
                        position: "absolute",
                        left: 8,
                        top: 8,
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
    const url = getMenuAssetUrl("variable");
    return (
        <button
            onClick={onClick}
            title={varName}
            style={{
                width: "100%",
                height: VAR_TILE_HEIGHT,   // <── tweak with VAR_TILE_HEIGHT
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
