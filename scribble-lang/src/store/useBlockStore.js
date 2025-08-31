// src/store/useBlockStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useBlockStore = create(
    persist(
        (set, get) => ({
            // ---------------- state ----------------
            blocks: [],
            variables: [],
            edges: [],
            selectedId: null,
            svgInfoByType: {},      // parsed anchors, inputs, viewBox per block type
            endersByIf: {},         // map: if_else.id -> branch ender id
            executingId: null,

            setExecutingId: (id) => set({ executingId: id }),

            // --------------- blocks ----------------
            createVariable: (name, initialValue = 0) =>
                set((state) => {
                    const id =
                        "var_" +
                        Math.random().toString(36).slice(2, 8) +
                        Math.random().toString(36).slice(2, 6);

                    // avoid dup names: if exists, just return state unchanged
                    if (state.variables?.some((v) => v.name === name)) return state;

                    return {
                        variables: [...(state.variables ?? []), { id, name, value: initialValue }],
                    };
                }),

            addBlock: (b) =>
                set((s) => {
                    const base = { ...b, inputs: b.inputs ?? {} };
                    const nextBlocks = [...s.blocks, base];
                    let endersByIf = s.endersByIf;

                    // Auto-create an unsnapped ender for every if_else
                    if (base.type === "if_else") {
                        const eid = `${base.id}__ender`;
                        const ender = {
                            id: eid,
                            type: "if_branch_ender", // base variant
                            x: (base.x ?? 0),
                            y: (base.y ?? 0) + (base.h ?? 120) + 32, // just below; layout will refine
                            w: undefined,
                            h: undefined,
                            inputs: {},
                            data: { parentIf: base.id },
                        };
                        nextBlocks.push(ender);
                        endersByIf = { ...endersByIf, [base.id]: eid };
                    }

                    return { blocks: nextBlocks, endersByIf };
                }),

            moveBlock: (id, x, y) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, x, y } : b)),
                })),

            updateBlock: (id, updates) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
                })),

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
                const pruned = edges.filter(
                    (e) => !(e.kind === "stack" && (e.from === aboveId || e.to === belowId))
                );
                pruned.push({ kind: "stack", from: aboveId, to: belowId });
                set({ edges: pruned });
            },

            connectBranch: (parentId, branch, childId) => {
                const { edges } = get();
                const pruned = edges.filter(
                    (e) => !(e.kind === "branch" && e.from === parentId && e.meta?.branch === branch)
                );
                pruned.push({ kind: "branch", from: parentId, to: childId, meta: { branch } });
                set({ edges: pruned });
            },

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

            setInputValue: (blockId, port, value) =>
                set((s) => {
                    const edges = s.edges.filter(
                        (e) => !(e.kind === "input" && e.from === blockId && e.meta?.port === port)
                    );
                    const blocks = s.blocks.map((b) =>
                        b.id === blockId ? { ...b, inputs: { ...(b.inputs || {}), [port]: value } } : b
                    );
                    return { edges, blocks };
                }),

            disconnectAllFor: (id) =>
                set((s) => ({ edges: s.edges.filter((e) => e.from !== id && e.to !== id) })),

            deleteBlock: (id) => {
                const { blocks, edges, selectedId, endersByIf } = get();

                // If deleting an if_else, also delete its ender
                let toDelete = new Set([id]);
                const ifIds = Object.keys(endersByIf || {});
                for (const ifId of ifIds) {
                    if (ifId === id) {
                        const enderId = endersByIf[ifId];
                        if (enderId) toDelete.add(enderId);
                    }
                }

                const above = edges.find((e) => e.kind === "stack" && e.to === id)?.from || null;
                const below = edges.find((e) => e.kind === "stack" && e.from === id)?.to || null;

                const nb = blocks.filter((b) => !toDelete.has(b.id));
                let ne = edges.filter((e) => !toDelete.has(e.from) && !toDelete.has(e.to));

                if (above && below) {
                    ne = ne.filter((e) => !(e.kind === "stack" && (e.from === above || e.to === below)));
                    ne.push({ kind: "stack", from: above, to: below });
                }

                const newEnders = { ...(endersByIf || {}) };
                for (const ifId of Object.keys(newEnders)) {
                    if (toDelete.has(ifId) || toDelete.has(newEnders[ifId])) delete newEnders[ifId];
                }

                set({
                    blocks: nb,
                    edges: ne,
                    selectedId: selectedId === id ? null : selectedId,
                    endersByIf: newEnders,
                });
            },

            // ------------- helpers for snapper -------------
            connectEdge: ({ fromId, fromPort, toId }) => {
                if (String(fromPort || "").startsWith("input:")) {
                    const port = String(fromPort).split(":")[1];
                    get().connectInput(fromId, port, toId);
                } else if (fromPort === "next") {
                    get().connectStack(fromId, toId);
                } else {
                    get().connectBranch(fromId, String(fromPort), toId);
                }
            },

            wouldCreateCycle: (fromId, toId) => {
                const { edges } = get();
                const adj = new Map();
                for (const e of edges) {
                    if (!adj.has(e.from)) adj.set(e.from, []);
                    adj.get(e.from).push(e.to);
                }
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
        { name: "scribble-blocks-v2" }
    )
);
