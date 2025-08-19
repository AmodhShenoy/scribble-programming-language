import React from "react";
import { useBlockStore } from "../store/useBlockStore";
import { buildASTFromStore } from "../logic/astBuilder";
import { serializeAst } from "../debug/serializeAst";
import { Interpreter } from "../logic/interpreter";

export default function DebugDock() {
    const storeRef = useBlockStore;
    const [open, setOpen] = React.useState(true);
    const [astJson, setAstJson] = React.useState("{}");
    const [outputs, setOutputs] = React.useState([]);
    const [sprite, setSprite] = React.useState({ x: 0, y: 0, heading: 90 });
    const [selected, setSelected] = React.useState(null);

    const blocks = useBlockStore((s) => s.blocks);
    const edges = useBlockStore((s) => s.edges);

    React.useEffect(() => {
        const ast = buildASTFromStore(storeRef);
        const s = serializeAst(ast);
        setAstJson(JSON.stringify(s, null, 2));
    }, [blocks, edges, storeRef]);

    React.useEffect(() => {
        const onKey = (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === "d") {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (mod && e.key.toLowerCase() === "l") {
                e.preventDefault();
                const ast = buildASTFromStore(storeRef);
                console.log("[AST]", serializeAst(ast));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [storeRef]);

    const logAst = () => {
        const ast = buildASTFromStore(storeRef);
        console.log("[AST]", serializeAst(ast));
    };

    const runOnce = () => {
        const ast = buildASTFromStore(storeRef);
        const newOut = [];
        const vm = new Interpreter(ast, {
            onOutput: (t, k) => newOut.push({ kind: k, text: t }),
            onState: (st) => setSprite({ ...st.sprite }),
            onHighlight: (id) => setSelected(id),
            ticksPerSecond: 30,
        });
        vm.run();
        setOutputs(newOut);
    };

    const stepOnce = () => {
        const ast = buildASTFromStore(storeRef);
        const newOut = [];
        const vm = new Interpreter(ast, {
            onOutput: (t, k) => newOut.push({ kind: k, text: t }),
            onState: (st) => setSprite({ ...st.sprite }),
            onHighlight: (id) => setSelected(id),
            ticksPerSecond: 30,
        });
        vm.step();
        setOutputs((prev) => [...prev, ...newOut]);
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                style={{
                    position: "fixed",
                    right: 12,
                    bottom: 12,
                    zIndex: 2000,
                    background: "#2b2f36",
                    color: "#fff",
                    border: "1px solid #3b4048",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                }}
            >
                Debug
            </button>
        );
    }

    return (
        <div
            onWheel={(e) => e.stopPropagation()} // prevent canvas from eating the wheel
            style={{
                position: "fixed",
                right: 10,
                bottom: 10,
                width: 420,
                height: 360,
                background: "#111417",
                color: "#d6deeb",
                border: "1px solid #2c313a",
                borderRadius: 10,
                boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
                display: "flex",
                flexDirection: "column",
                zIndex: 2000,
                overflow: "hidden",
                fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
            }}
        >
            <div
                style={{
                    padding: "8px 10px",
                    background: "#171b20",
                    borderBottom: "1px solid #2c313a",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <strong style={{ flex: 1 }}>AST Debug</strong>
                <button onClick={logAst} style={btnStyle}>
                    Log AST
                </button>
                <button onClick={stepOnce} style={btnStyle}>
                    Step
                </button>
                <button onClick={runOnce} style={btnStyle}>
                    Run
                </button>
                <button onClick={() => setOpen(false)} style={btnStyle}>
                    ✕
                </button>
            </div>

            {/* Body */}
            <div
                style={{
                    display: "grid",
                    gridTemplateRows: "1fr 110px",
                    gap: 0,
                    flex: 1,
                    minHeight: 0, // <-- allow children to shrink & scroll
                }}
            >
                {/* AST pane (scrollable) */}
                <div
                    style={{
                        padding: 8,
                        overflow: "auto", // <-- enables scroll
                        borderBottom: "1px solid #2c313a",
                        minHeight: 0, // <-- critical for scroll in grid/flex
                    }}
                >
                    <div style={{ marginBottom: 6, opacity: 0.8 }}>
                        <span style={{ marginRight: 10 }}>
                            selected: <code>{String(selected || "none")}</code>
                        </span>
                        <span>
                            sprite:{" "}
                            <code>{`x:${sprite.x.toFixed(1)} y:${sprite.y.toFixed(
                                1
                            )} h:${sprite.heading}`}</code>
                        </span>
                    </div>
                    <pre
                        style={{
                            margin: 0,
                            whiteSpace: "pre", // keep formatting
                            overflowX: "auto",
                        }}
                    >
                        {astJson}
                    </pre>
                </div>

                {/* Outputs pane */}
                <div style={{ padding: 8, overflow: "auto" }}>
                    <strong>Outputs</strong>
                    {outputs.length === 0 ? (
                        <div style={{ opacity: 0.6 }}>—</div>
                    ) : (
                        <ul style={{ margin: "6px 0 0 18px" }}>
                            {outputs.map((o, i) => (
                                <li key={i}>
                                    <code>[{o.kind}]</code> {o.text}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

const btnStyle = {
    background: "#23282f",
    color: "#d6deeb",
    border: "1px solid #3b4048",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
};
