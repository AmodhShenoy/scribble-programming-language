// src/logic/astBuilder.js

// Build a navigable AST from your flat blocks[] + edges[].
// Edges:
//   { kind: "stack", from, to }
//   { kind: "branch", from, to, meta: { branch: "true" | "false" | "body" } }
//
// Each AST node: { id, type, inputs, next, branches: {true,false,body}, data? }

export function buildAST(blocks, edges) {
    const byId = new Map();
    for (const b of blocks) {
        byId.set(b.id, {
            id: b.id,
            type: b.type,
            inputs: b.inputs || {},   // literals or refs (see interpreter)
            next: null,
            branches: {},
            data: b.data || {},
        });
    }

    for (const e of edges) {
        if (e.kind !== "stack") continue;
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        if (from && to) from.next = to;
    }

    for (const e of edges) {
        if (e.kind !== "branch") continue;
        const p = byId.get(e.from);
        const c = byId.get(e.to);
        if (!p || !c) continue;
        const key = e.meta?.branch || "body";
        p.branches[key] = c;
    }

    const incoming = new Set(edges.filter(e => e.kind === "stack").map(e => e.to));
    const roots = blocks.filter(b => !incoming.has(b.id)).map(b => byId.get(b.id));
    const entry = roots.find(r => r.type === "start") || roots[0] || null;

    return { nodes: byId, roots, entry };
}
