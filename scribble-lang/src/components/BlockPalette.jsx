// src/components/BlockPalette.jsx
import React from "react";
import { useBlockStore } from "../store/useBlockStore";
import { getAssetUrl } from "../bootstrap/loadSvgInfo";

function uid(prefix = "") {
    return (
        prefix +
        Math.random().toString(36).slice(2, 8) +
        Math.random().toString(36).slice(2, 6)
    );
}

// classify helpers
const isOperator = (t) =>
    t.endsWith("_operator") ||
    [
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
    ].includes(t);

const isInternal = (t) =>
    t.startsWith("if_branch_ender") ||
    t.startsWith("repeat_loop_ender") ||
    t.startsWith("branch_ender") ||
    t.startsWith("loop_ender");

const isVariableReporter = (t) => t === "variable";
const isVariableStmt = (t) => t === "set_variable" || t === "change_variable";

// Optional: show some common actions first, then the rest alphabetically
const PINNED_ACTION_ORDER = [
    "start",
    "stop",
    "say",
    "think",
    "wait",
    "go_to",
    "move",
    "change_x_by",
    "change_y_by",
    "turn_anticlockwise",
    "turn_clockwise",
    "point_in",
    "if_else",
    "repeat_until",
    "repeat_times",
];

export default function BlockPalette() {
    const addBlock = useBlockStore((s) => s.addBlock);
    const svgInfoByType = useBlockStore((s) => s.svgInfoByType ?? {});
    const variables = useBlockStore((s) => s.variables ?? []);
    const createVariable = useBlockStore((s) => s.createVariable);

    // All known types from what’s actually loaded/registered
    const allTypes = React.useMemo(
        () => Object.keys(svgInfoByType || {}),
        [svgInfoByType]
    );

    // Filter into groups
    const operatorTypes = React.useMemo(
        () => allTypes.filter((t) => isOperator(t) && !isInternal(t)).sort(),
        [allTypes]
    );

    const variableStmtTypes = React.useMemo(
        () =>
            allTypes
                .filter((t) => isVariableStmt(t))
                .sort((a, b) => (a === "set_variable" ? -1 : 1)),
        [allTypes]
    );

    const variableReporterAvailable = allTypes.some(isVariableReporter);

    const actionTypes = React.useMemo(() => {
        const raw = allTypes.filter(
            (t) =>
                !isInternal(t) &&
                !isOperator(t) &&
                !isVariableReporter(t) &&
                !isVariableStmt(t)
        );
        // Sort with pinned first, then alphabetical for the rest
        const weight = (t) => {
            const i = PINNED_ACTION_ORDER.indexOf(t);
            return i === -1 ? 1000 : i; // big number if not pinned
        };
        return [
            ...raw
                .filter((t) => PINNED_ACTION_ORDER.includes(t))
                .sort((a, b) => weight(a) - weight(b)),
            ...raw
                .filter((t) => !PINNED_ACTION_ORDER.includes(t))
                .sort((a, b) => a.localeCompare(b)),
        ];
    }, [allTypes]);

    const hasVars = variables.length > 0;
    const firstVarName = hasVars ? variables[0].name : "";

    const add = (type, extra = {}) => {
        const assetUrl = getAssetUrl(type);
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
        const rawInit =
            window.prompt(`Initial value for "${name}"? (blank = 0)`) ?? "";
        const n = Number(rawInit);
        const init = Number.isFinite(n) ? n : rawInit;
        createVariable(name, init);
    };

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
                <TileRow items={actionTypes} onAdd={add} />
            </Section>

            <Section title="Operators">
                <TileRow items={operatorTypes} onAdd={add} />
            </Section>

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
                        {/* show set/change (if you’ve provided those SVGs) */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            {variableStmtTypes.includes("set_variable") && (
                                <Tile
                                    type="set_variable"
                                    label="set"
                                    onClick={() =>
                                        add("set_variable", { inputs: { name: firstVarName, value: 0 } })
                                    }
                                />
                            )}
                            {variableStmtTypes.includes("change_variable") && (
                                <Tile
                                    type="change_variable"
                                    label="change"
                                    onClick={() =>
                                        add("change_variable", {
                                            inputs: { name: firstVarName, delta: 1 },
                                        })
                                    }
                                />
                            )}
                        </div>

                        {/* one reporter tile per created variable */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {variables.map((v) =>
                                variableReporterAvailable ? (
                                    <VariableTile
                                        key={v.id}
                                        varName={v.name}
                                        onClick={() =>
                                            add("variable", { inputs: { name: v.name } })
                                        }
                                    />
                                ) : (
                                    <button
                                        key={v.id}
                                        onClick={() => add("variable", { inputs: { name: v.name } })}
                                        style={{
                                            border: "1px dashed #444",
                                            borderRadius: 8,
                                            padding: "6px 8px",
                                            background: "transparent",
                                            color: "#bbb",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {v.name}
                                    </button>
                                )
                            )}
                        </div>
                    </>
                )}
            </Section>
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
    const url = getAssetUrl("variable");
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
