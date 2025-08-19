// src/logic/astBuilder.js

// Wrap user-typed values; interpreter also accepts plain values,
// but using a lit keeps it explicit.
const lit = (v) => ({ kind: "lit", value: v });
const ref = (blockId) => ({ kind: "ref", blockId });

/** Coerce a string into number/bool when it looks like one. */
function parseLiteral(raw) {
    if (raw == null) return lit("");
    if (typeof raw !== "string") return lit(raw);
    const s = raw.trim();
    if (s === "") return lit("");
    const low = s.toLowerCase();
    if (low === "true") return lit(true);
    if (low === "false") return lit(false);
    if (/^-?\d+(\.\d+)?$/.test(s)) return lit(Number(s));
    return lit(s);
}

// Build a navigable AST from your flat blocks[] + edges[].
// Edges:
//   { kind: "stack", from, to }
//   { kind: "branch", from, to, meta: { branch: "true" | "false" | "body" } }
//   { kind: "input", from, to, meta: { port: "<slotName>" } }
//
// Each AST node: { id, type, inputs, next, branches: {true,false,body}, data? }
export function buildAST(blocks, edges) {
    // 1) Create node objects
    const byId = new Map();
    for (const b of blocks) {
        // start with typed inputs (as literals)
        const inputs = {};
        if (b.inputs) {
            for (const [k, v] of Object.entries(b.inputs)) {
                inputs[k] = parseLiteral(v);
            }
        }

        byId.set(b.id, {
            id: b.id,
            type: b.type,
            inputs,                  // may be overridden by input edges
            next: null,
            branches: {},
            data: b.data || {},
        });
    }

    // 2) Wire linear flow (stack)
    for (const e of edges) {
        if (e.kind !== "stack") continue;
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        if (from && to) from.next = to;
    }

    // 3) Wire branches
    for (const e of edges) {
        if (e.kind !== "branch") continue;
        const p = byId.get(e.from);
        const c = byId.get(e.to);
        if (!p || !c) continue;
        const key = e.meta?.branch || "body";
        p.branches[key] = c;
    }

    // 4) Wire input connections: parent.inputs[port] = {kind:"ref", blockId}
    for (const e of edges) {
        if (e.kind !== "input") continue;
        const p = byId.get(e.from);
        if (!p) continue;
        const port = e.meta?.port;
        if (!port) continue;
        p.inputs[port] = ref(e.to);
    }

    // 5) Entry/root selection: prefer a "start" with no incoming stack
    const incomingStack = new Set(edges.filter(e => e.kind === "stack").map(e => e.to));
    const roots = blocks
        .filter(b => !incomingStack.has(b.id))
        .map(b => byId.get(b.id));

    const entry =
        roots.find(r => r && r.type === "start") ||
        roots[0] ||
        null;

    return { nodes: byId, roots, entry };
}

/** Convenience: build directly from a Zustand store object */
export function buildASTFromStore(store) {
    const s = store.getState ? store.getState() : store;
    return buildAST(s.blocks, s.edges);
}
