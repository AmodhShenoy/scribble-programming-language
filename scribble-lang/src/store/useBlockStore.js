// src/store/useBlockStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Edge shapes:
 *  - { kind: "stack",  from, to }
 *  - { kind: "branch", from, to, meta:{ branch: "true"|"false"|"body" } }
 *  - { kind: "input",  from, to, meta:{ port: "<slotName>" } }
 *
 * Block shape:
 *  - { id, type, x, y, w, h, inputs?: { [port]: string } }
 */

function uid(prefix = "") {
    return (
        prefix +
        Math.random().toString(36).slice(2, 8) +
        Math.random().toString(36).slice(2, 6)
    );
}

export const useBlockStore = create(
    persist(
        (set, get) => ({
            // ---------------- state ----------------
            blocks: [],
            edges: [],
            selectedId: null,
            svgInfoByType: {}, // parsed anchors, inputs, viewBox per block type

            // Variables registry for palette (not the interpreter runtime state)
            // Shape: [{ id, name, initialValue }]
            variables: [],

            // --------------- variables --------------
            createVariable: (name, initialValue = 0) =>
                set((s) => {
                    const clean = (name ?? "").trim();
                    if (!clean) return {};
                    // ensure unique display name
                    let finalName = clean;
                    let n = 2;
                    const taken = new Set(s.variables.map((v) => v.name));
                    while (taken.has(finalName)) {
                        finalName = `${clean} (${n++})`;
                    }
                    const v = { id: uid("var_"), name: finalName, initialValue };
                    return { variables: [...s.variables, v] };
                }),

            deleteVariable: (id) =>
                set((s) => ({ variables: s.variables.filter((v) => v.id !== id) })),

            // --------------- blocks ----------------
            addBlock: (b) =>
                set((s) => ({
                    // do NOT force default w/h; Block registers its natural SVG size
                    blocks: [...s.blocks, { ...b, inputs: b.inputs ?? {} }],
                })),

            moveBlock: (id, x, y) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, x, y } : b)),
                })),

            updateBlock: (id, updates) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
                })),

            // only write if changed (prevents churn)
            registerSize: (id, w, h) =>
                set((s) => {
                    const idx = s.blocks.findIndex((b) => b.id === id);
                    if (idx === -1) return {};
                    const old = s.blocks[idx];
                    if (old.w === w && old.h === h) return {};
                    const next = [...s.blocks];
                    next[idx] = { ...old, w, h };
                    return { blocks: next };
                }),

            selectBlock: (id) => set({ selectedId: id }),
            clearSelection: () => set({ selectedId: null }),

            // ------------- svg info cache ----------
            setSvgInfo: (type, info) =>
                set((s) => ({ svgInfoByType: { ...s.svgInfoByType, [type]: info } })),
            setManySvgInfo: (map) =>
                set((s) => ({ svgInfoByType: { ...s.svgInfoByType, ...map } })),

            // -------------- connections ------------
            connectStack: (aboveId, belowId) => {
                const { edges } = get();
                // Only one outgoing "next" from a block and only one incoming "prev" to a block
                const pruned = edges.filter(
                    (e) => !(e.kind === "stack" && (e.from === aboveId || e.to === belowId))
                );
                pruned.push({ kind: "stack", from: aboveId, to: belowId });
                set({ edges: pruned });
            },

            connectBranch: (parentId, branch, childId) => {
                const { edges } = get();
                // One child per (parent,branch)
                const pruned = edges.filter(
                    (e) =>
                        !(
                            e.kind === "branch" &&
                            e.from === parentId &&
                            e.meta?.branch === branch
                        )
                );
                pruned.push({ kind: "branch", from: parentId, to: childId, meta: { branch } });
                set({ edges: pruned });
            },

            // plug a block into a named input slot (clears typed value)
            connectInput: (parentId, port, childId) => {
                const { edges, blocks } = get();
                const pruned = edges.filter(
                    (e) => !(e.kind === "input" && e.from === parentId && e.meta?.port === port)
                );
                pruned.push({ kind: "input", from: parentId, to: childId, meta: { port } });

                const nextBlocks = blocks.map((b) =>
                    b.id === parentId ? { ...b, inputs: { ...(b.inputs || {}), [port]: "" } } : b
                );
                set({ edges: pruned, blocks: nextBlocks });
            },

            // set a literal value for an input slot (removes any block connected there)
            setInputValue: (blockId, port, value) =>
                set((s) => {
                    const edges = s.edges.filter(
                        (e) => !(e.kind === "input" && e.from === blockId && e.meta?.port === port)
                    );
                    const blocks = s.blocks.map((b) =>
                        b.id === blockId
                            ? { ...b, inputs: { ...(b.inputs || {}), [port]: value } }
                            : b
                    );
                    return { edges, blocks };
                }),

            disconnectAllFor: (id) =>
                set((s) => ({ edges: s.edges.filter((e) => e.from !== id && e.to !== id) })),

            deleteBlock: (id) => {
                const { blocks, edges, selectedId } = get();

                // re-link stack neighbors if present
                const above = edges.find((e) => e.kind === "stack" && e.to === id)?.from || null;
                const below = edges.find((e) => e.kind === "stack" && e.from === id)?.to || null;

                const nb = blocks.filter((b) => b.id !== id);
                let ne = edges.filter((e) => e.from !== id && e.to !== id);

                if (above && below) {
                    // ensure no duplicate stack link remains
                    ne = ne.filter(
                        (e) => !(e.kind === "stack" && (e.from === above || e.to === below))
                    );
                    ne.push({ kind: "stack", from: above, to: below });
                }

                set({
                    blocks: nb,
                    edges: ne,
                    selectedId: selectedId === id ? null : selectedId,
                });
            },

            // ------------- helpers used by UI/snapper -------------
            // Generic connector that dispatches to correct edge type
            connectEdge: ({ fromId, fromPort, toId }) => {
                if (String(fromPort || "").startsWith("input:")) {
                    const port = String(fromPort).split(":")[1];
                    get().connectInput(fromId, port, toId);
                } else if (fromPort === "next") {
                    get().connectStack(fromId, toId);
                } else {
                    // "true" | "false" | "body" etc
                    get().connectBranch(fromId, String(fromPort), toId);
                }
            },

            // cycle detection across all edges
            wouldCreateCycle: (fromId, toId) => {
                const { edges } = get();
                const adj = new Map();

                for (const e of edges) {
                    if (!adj.has(e.from)) adj.set(e.from, []);
                    adj.get(e.from).push(e.to);
                }
                // include proposed edge
                if (!adj.has(fromId)) adj.set(fromId, []);
                adj.get(fromId).push(toId);

                const seen = new Set();
                const stack = [toId];
                while (stack.length) {
                    const n = stack.pop();
                    if (!n || seen.has(n)) continue;
                    if (n === fromId) return true;
                    seen.add(n);
                    const nxt = adj.get(n) || [];
                    for (const m of nxt) stack.push(m);
                }
                return false;
            },
        }),
        {
            name: "scribble-blocks-v2",
        }
    )
);
