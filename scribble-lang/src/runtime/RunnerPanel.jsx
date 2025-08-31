// src/components/RunnerPanel.jsx
import React from "react";
import { useBlockStore } from "../store/useBlockStore";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ── Config (edit these values as you like) ────────────────────────────── */
const EXEC_DELAY_MS = 300;   // delay between executed blocks (ms)
const STEP_SCALE = 10;    // 1 "step" = 10 px (screen distance)
/** ─────────────────────────────────────────────────────────────────────── */

export default function RunnerPanel() {
    // runner area dimensions
    const stageRef = React.useRef(null);
    const [stageSize, setStageSize] = React.useState({ w: 600, h: 400 });

    // sprite state (dir is CSS angle: +deg = clockwise)
    const [sprite, setSprite] = React.useState({
        x: 25,
        y: 40,
        dir: 0, // 0 => +X
    });

    // stdout log
    const [stdout, setStdout] = React.useState([]);
    const appendLog = React.useCallback((line) => {
        setStdout((s) => [...s, line]);
    }, []);

    // execution
    const [running, setRunning] = React.useState(false);
    const [stepDelayMs] = React.useState(EXEC_DELAY_MS);

    // runtime variables
    const runtimeVarsRef = React.useRef(Object.create(null));

    // measure stage once mounted
    React.useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            setStageSize({ w: el.clientWidth, h: el.clientHeight });
        });
        ro.observe(el);
        setStageSize({ w: el.clientWidth, h: el.clientHeight });
        return () => ro.disconnect();
    }, []);

    // ---------- helpers to read the graph ----------
    const getStoreSnapshot = () => useBlockStore.getState();

    const findStart = (blocks) =>
        blocks.find((b) => b.type === "start")?.id || null;

    const nextOf = (edges, fromId) =>
        edges.find((e) => e.kind === "stack" && e.from === fromId)?.to || null;

    const inputTo = (edges, fromId, portName) =>
        edges.find(
            (e) => e.kind === "input" && e.from === fromId && e.meta?.port === portName
        )?.to || null;

    const branchHead = (edges, fromId, which /* 'true' | 'false' */) =>
        edges.find(
            (e) => e.kind === "branch" && e.from === fromId && e.meta?.branch === which
        )?.to || null;

    const blockById = (blocks, id) => blocks.find((b) => b.id === id) || null;
    const svgInfoOf = (svgInfoByType, type) => svgInfoByType[type] || null;

    // evaluate a reporter (operators/variable/typed inputs)
    async function evalPort(blocks, edges, svgInfoByType, blockId, port) {
        const b = blockById(blocks, blockId);
        if (!b) return null;

        // 1) does this port have a connected reporter?
        const child = inputTo(edges, blockId, port);
        if (child) {
            return await evalReporter(blocks, edges, svgInfoByType, child);
        }

        // 2) fall back to typed value in the block itself
        const val =
            (b.inputs && (b.inputs[port] ?? b.inputs.value ?? b.inputs.text)) ?? "";
        const n = Number(val);
        return Number.isFinite(n) && String(val).trim() !== "" ? n : String(val);
    }

    async function evalReporter(blocks, edges, svgInfoByType, id) {
        const b = blockById(blocks, id);
        if (!b) return null;

        // variable reporter returns its current value
        if (b.type === "variable") {
            const name =
                (b.inputs && (b.inputs.name || b.inputs.value || b.inputs.text)) ||
                "variable";
            const rv = runtimeVarsRef.current;
            return rv[name] ?? 0;
        }

        // binary math
        const math2 = new Set([
            "plus_operator",
            "minus_operator",
            "multiply_operator",
            "divide_operator",
            "mod_operator",
        ]);
        if (math2.has(b.type)) {
            const a = Number(await evalPort(blocks, edges, svgInfoByType, id, "a") ?? 0);
            const c = Number(await evalPort(blocks, edges, svgInfoByType, id, "b") ?? 0);
            switch (b.type) {
                case "plus_operator": return a + c;
                case "minus_operator": return a - c;
                case "multiply_operator": return a * c;
                case "divide_operator": return c === 0 ? 0 : a / c;
                case "mod_operator": return c === 0 ? 0 : a % c;
                default: return 0;
            }
        }

        // binary comparisons
        const cmp2 = new Set([
            "gt_operator",
            "gte_operator",
            "lt_operator",
            "lte_operator",
            "et_operator", // equals
        ]);
        if (cmp2.has(b.type)) {
            const a = await evalPort(blocks, edges, svgInfoByType, id, "a");
            const c = await evalPort(blocks, edges, svgInfoByType, id, "b");
            switch (b.type) {
                case "gt_operator": return Number(a) > Number(c);
                case "gte_operator": return Number(a) >= Number(c);
                case "lt_operator": return Number(a) < Number(c);
                case "lte_operator": return Number(a) <= Number(c);
                case "et_operator": return a == c; // loose equality
                default: return false;
            }
        }

        // logical
        if (b.type === "and_operator" || b.type === "or_operator") {
            const a = Boolean(await evalPort(blocks, edges, svgInfoByType, id, "a"));
            const c = Boolean(await evalPort(blocks, edges, svgInfoByType, id, "b"));
            return b.type === "and_operator" ? a && c : a || c;
        }
        if (b.type === "not_operator") {
            const a = Boolean(await evalPort(blocks, edges, svgInfoByType, id, "a"));
            return !a;
        }

        // fallback: typed value
        const typed =
            (b.inputs && (b.inputs.value ?? b.inputs.text ?? b.inputs.name)) ?? "";
        const n = Number(typed);
        return Number.isFinite(n) && String(typed).trim() !== "" ? n : String(typed);
    }

    // ---------- sprite commands ----------
    const cmdSay = React.useCallback(
        async (text, thinking = false) => {
            const msg = String(text ?? "");
            appendLog(`>> Sprite${thinking ? "(thinking)" : ""}: ${msg}`);
        },
        [appendLog]
    );

    const cmdMove = React.useCallback(
        async (distance) => {
            // Apply step scaling so "1" step is larger on screen
            const dist = (Number(distance) || 0) * STEP_SCALE;

            // Convert CSS heading (cw positive) to math radians (ccw positive)
            const rad = (-sprite.dir) * (Math.PI / 180);
            const dx = dist * Math.cos(rad);
            const dy = dist * Math.sin(rad);

            setSprite((s) => {
                const spriteSize = 64; // rough sprite footprint for clamping
                const maxX = Math.max(0, stageSize.w - spriteSize);
                const maxY = Math.max(0, stageSize.h - spriteSize);
                const nx = Math.max(0, Math.min(maxX, s.x + dx));
                const ny = Math.max(0, Math.min(maxY, s.y + dy));
                return { ...s, x: nx, y: ny };
            });
        },
        [sprite.dir, stageSize.w, stageSize.h]
    );

    const cmdTurnACW = React.useCallback(async (deg) => {
        const d = Number(deg) || 0;
        // CSS angle; positive is clockwise. Anticlockwise = subtract.
        setSprite((s) => ({ ...s, dir: (s.dir - d + 360) % 360 }));
    }, []);

    // ---------- execution primitives ----------
    async function runStackFrom(blocks, edges, svgInfoByType, headId, haltRef) {
        let cur = headId;
        let safety = 5000;
        while (cur && !haltRef.current && safety-- > 0) {
            cur = await execSingle(blocks, edges, svgInfoByType, cur, haltRef);
        }
    }

    async function execSingle(blocks, edges, svgInfoByType, curId, haltRef) {
        const b = blockById(blocks, curId);
        if (!b) return null;

        // STOP: end entire program
        if (b.type === "stop") {
            haltRef.current = true;
            return null;
        }

        // SAY / THINK
        if (b.type === "say") {
            const msg =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? "";
            await cmdSay(msg, false);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }
        if (b.type === "think") {
            const msg =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? "";
            await cmdSay(msg, true);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }

        // MOVE / TURN
        if (b.type === "move") {
            const dist =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? 0;
            await cmdMove(dist);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }
        if (b.type === "turn_anticlockwise") {
            const deg =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? 0;
            await cmdTurnACW(deg);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }

        // SET / CHANGE VARIABLE
        if (b.type === "set_variable") {
            const name =
                (b.inputs && b.inputs.name) ||
                useBlockStore.getState().variables?.[0]?.name ||
                "var";
            const value =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? 0;
            runtimeVarsRef.current[name] = Number(value);
            appendLog(`>> ${name} = ${runtimeVarsRef.current[name]}`);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }
        if (b.type === "change_variable") {
            const name =
                (b.inputs && b.inputs.name) ||
                useBlockStore.getState().variables?.[0]?.name ||
                "var";
            const delta =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "value")) ?? 0;
            const cur = Number(runtimeVarsRef.current[name] ?? 0);
            runtimeVarsRef.current[name] = cur + Number(delta);
            appendLog(`>> ${name} += ${Number(delta)}  → ${runtimeVarsRef.current[name]}`);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }

        // IF / ELSE
        if (b.type === "if_else") {
            const cond =
                (await evalPort(blocks, edges, svgInfoByType, b.id, "condition")) ?? false;

            const headTrue = branchHead(edges, b.id, "true");
            const headFalse = branchHead(edges, b.id, "false");

            if (cond) {
                await runStackFrom(blocks, edges, svgInfoByType, headTrue, haltRef);
            } else {
                await runStackFrom(blocks, edges, svgInfoByType, headFalse, haltRef);
            }
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }

        // REPEAT UNTIL
        if (b.type === "repeat_until") {
            // body is wired on "false" arm
            const bodyHead = branchHead(edges, b.id, "false");
            let guard = 2000;
            while (!haltRef.current && guard-- > 0) {
                const done =
                    (await evalPort(blocks, edges, svgInfoByType, b.id, "until")) ?? false;
                if (done) break;
                await runStackFrom(blocks, edges, svgInfoByType, bodyHead, haltRef);
                await sleep(stepDelayMs);
            }
            return nextOf(edges, b.id);
        }

        // Operators (top-level): evaluate and log
        if (String(b.type).endsWith("_operator") || b.type === "variable") {
            const v = await evalReporter(blocks, edges, svgInfoByType, b.id);
            appendLog(`>> ${b.type}: ${String(v)}`);
            await sleep(stepDelayMs);
            return nextOf(edges, b.id);
        }

        // Default: just move forward in the stack
        return nextOf(edges, b.id);
    }

    // ---------- runner entry ----------
    async function run() {
        if (running) return;
        setRunning(true);
        try {
            const { blocks, edges, svgInfoByType, variables } = getStoreSnapshot();

            // re-init runtime vars to 0 for declared variables
            runtimeVarsRef.current = Object.create(null);
            for (const v of variables || []) runtimeVarsRef.current[v.name] = 0;

            // find entry
            const startId = findStart(blocks);
            if (!startId) {
                appendLog(">> No 'start' block found.");
                setRunning(false);
                return;
            }

            const haltRef = { current: false };
            let cur = nextOf(edges, startId);
            let safety = 5000; // overall loop guard

            while (cur && !haltRef.current && safety-- > 0) {
                cur = await execSingle(blocks, edges, svgInfoByType, cur, haltRef);
            }
        } catch (err) {
            console.error(err);
            appendLog(`!! Runtime error: ${err?.message ?? String(err)}`);
        } finally {
            setRunning(false);
        }
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateRows: "auto 1fr 140px",
                borderLeft: "1px solid #eee",
                height: "100%",
                minWidth: 380,
                background: "#fff",
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 10px",
                    borderBottom: "1px solid #eee",
                }}
            >
                <button
                    onClick={run}
                    disabled={running}
                    style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: running ? "#ddd" : "#f5f5f5",
                        cursor: running ? "not-allowed" : "pointer",
                    }}
                >
                    ▶ Run
                </button>
                <span style={{ color: "#666", fontSize: 12 }}>
                    Sprite at ({sprite.x.toFixed(1)}, {sprite.y.toFixed(1)}) • dir{" "}
                    {sprite.dir.toFixed(0)}°
                </span>
            </div>

            {/* Stage (origin at bottom-left via CSS bottom/left) */}
            <div
                ref={stageRef}
                style={{
                    position: "relative",
                    overflow: "hidden",
                    background:
                        "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to top, rgba(0,0,0,0.04) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                }}
            >
                {/* Sprite */}
                <img
                    src="/sprite.svg"
                    alt="sprite"
                    style={{
                        position: "absolute",
                        left: `${sprite.x}px`,
                        bottom: `${sprite.y}px`,
                        width: 64,
                        height: 64,
                        transform: `rotate(${sprite.dir}deg)`,
                        transformOrigin: "50% 50%",
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                />
                {/* Origin marker (optional) */}
                <div
                    style={{
                        position: "absolute",
                        left: 6,
                        bottom: 6,
                        fontSize: 10,
                        color: "#666",
                        background: "rgba(255,255,255,0.8)",
                        padding: "2px 4px",
                        borderRadius: 4,
                    }}
                >
                    (0,0)
                </div>
            </div>

            {/* Stdout */}
            <div
                style={{
                    borderTop: "1px solid #eee",
                    background: "#fafafa",
                    padding: "8px 10px",
                    overflow: "auto",
                    fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12.5,
                    lineHeight: 1.35,
                }}
            >
                {stdout.length === 0 ? (
                    <div style={{ color: "#888" }}>stdout will appear here…</div>
                ) : (
                    stdout.map((line, i) => <div key={i}>{line}</div>)
                )}
            </div>
        </div>
    );
}
