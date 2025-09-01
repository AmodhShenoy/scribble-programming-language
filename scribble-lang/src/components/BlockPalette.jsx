// src/components/BlockPalette.jsx
import React from "react";
import { useBlockStore } from "../store/useBlockStore";
import { getAssetUrl, getMenuAssetUrl, CATEGORY_BY_TYPE } from "../bootstrap/loadSvgInfo";

/** ── TWEAKS ─────────────────────────────────────────────────── */
const PALETTE_WIDTH = 220;           // Left panel width (matches App.jsx grid if you set it there)
const TILE_HEIGHT = 120;              // Default tile height
const VAR_TILE_HEIGHT = 90;          // Variable reporter tile height
const LABEL_BAR_HEIGHT = 22;         // Reserved space at bottom for label
const TILE_PADDING = 8;              // Inner padding around the preview image

// Custom heights for tall/complex palette previews
const TILE_HEIGHT_BY_TYPE = {
    if_else: 200,
    repeat_until: 250,
    repeat_times: 250,
};
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

function prettyLabelFromType(type) {
    // Convert "repeat_until_menu" -> "repeat until"
    // Remove trailing "_menu" if present, then replace underscores with spaces
    const trimmed = type.endsWith("_menu") ? type.slice(0, -5) : type;
    return trimmed.replaceAll("_", " ");
}

function Tile({ type, onClick }) {
    const url = getMenuAssetUrl(type);
    const label = prettyLabelFromType(type);
    const tileHeight = TILE_HEIGHT_BY_TYPE[type] ?? TILE_HEIGHT;

    // Reserve space for the label; image fills the remaining area with padding
    const imageBoxTop = TILE_PADDING;
    const imageBoxLeft = TILE_PADDING;
    const imageBoxRight = TILE_PADDING;
    const imageBoxBottom = LABEL_BAR_HEIGHT + TILE_PADDING;

    return (
        <button
            onClick={onClick}
            title={label}
            style={{
                width: "100%",
                height: tileHeight,
                padding: 0,
                border: "1px solid #2b2b2b",
                borderRadius: 10,
                background: "#1b1b1b",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Preview image area */}
            <img
                src={url}
                alt={type}
                style={{
                    position: "absolute",
                    left: imageBoxLeft,
                    right: imageBoxRight,
                    top: imageBoxTop,
                    bottom: imageBoxBottom,
                    width: "auto",
                    height: "auto",
                    maxWidth: `calc(100% - ${imageBoxLeft + imageBoxRight}px)`,
                    maxHeight: `calc(100% - ${imageBoxTop + imageBoxBottom}px)`,
                    objectFit: "contain",
                    display: "block",
                    margin: "auto",
                }}
            />

            {/* Bottom label bar */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: LABEL_BAR_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#cfcfcf",
                    background: "rgba(0,0,0,0.18)",
                    borderTop: "1px solid #222",
                    pointerEvents: "none",
                    padding: "0 6px",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                }}
            >
                {label}
            </div>
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
                height: VAR_TILE_HEIGHT,
                padding: 0,
                border: "1px solid #2b2b2b",
                borderRadius: 10,
                background: "#1b1b1b",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Preview image area — also reserve space for the text overlay */}
            <img
                src={url}
                alt={varName}
                style={{
                    position: "absolute",
                    left: TILE_PADDING,
                    right: TILE_PADDING,
                    top: TILE_PADDING,
                    bottom: LABEL_BAR_HEIGHT + TILE_PADDING,
                    width: "auto",
                    height: "auto",
                    maxWidth: `calc(100% - ${TILE_PADDING * 2}px)`,
                    maxHeight: `calc(100% - ${TILE_PADDING * 2 + LABEL_BAR_HEIGHT}px)`,
                    objectFit: "contain",
                    display: "block",
                    margin: "auto",
                }}
            />
            {/* Bottom label bar with variable name */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: LABEL_BAR_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: "rgba(0,0,0,0.25)",
                    borderTop: "1px solid #222",
                    pointerEvents: "none",
                    padding: "0 6px",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    textShadow: "0 1px 0 rgba(0,0,0,0.35)",
                }}
            >
                {varName}
            </div>
        </button>
    );
}
