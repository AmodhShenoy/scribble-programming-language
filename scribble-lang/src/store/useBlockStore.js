// src/store/useBlockStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useBlockStore = create(
    persist(
        (set, get) => ({
            blocks: [],
            edges: [], // { kind:'stack'|'branch', from, to, meta?:{branch} }
            selectedId: null,

            // parsed SVG metadata per block type (anchors, tipHeight, etc.)
            svgInfoByType: {},

            // ---------- blocks ----------
            addBlock: (b) =>
                set((s) => ({
                    blocks: [...s.blocks, { ...b, w: b.w ?? 160, h: b.h ?? 64 }],
                })),

            updateBlock: (id, updates) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
                })),

            moveBlock: (id, x, y) =>
                set((s) => ({
                    blocks: s.blocks.map((b) => (b.id === id ? { ...b, x, y } : b)),
                })),

            // Only write to state if w/h actually changed
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

            // ---------- svg info ----------
            setSvgInfo: (type, info) =>
                set((s) => ({ svgInfoByType: { ...s.svgInfoByType, [type]: info } })),
            setManySvgInfo: (map) =>
                set((s) => ({ svgInfoByType: { ...s.svgInfoByType, ...map } })),

            // ---------- connections (your original API) ----------
            connectStack: (aboveId, belowId) => {
                const { edges } = get();
                // ensure only one vertical neighbor
                const pruned = edges.filter(
                    (e) => !(e.kind === "stack" && (e.from === aboveId || e.to === belowId))
                );
                pruned.push({ kind: "stack", from: aboveId, to: belowId });
                set({ edges: pruned });
            },

            connectBranch: (parentId, branch, childId) => {
                const { edges } = get();
                // unique per (parent, branch)
                const pruned = edges.filter(
                    (e) => !(e.kind === "branch" && e.from === parentId && e.meta?.branch === branch)
                );
                pruned.push({ kind: "branch", from: parentId, to: childId, meta: { branch } });
                set({ edges: pruned });
            },

            disconnectAllFor: (id) =>
                set((s) => ({ edges: s.edges.filter((e) => e.from !== id && e.to !== id) })),

            deleteBlock: (id) => {
                const { blocks, edges, selectedId } = get();
                const above = edges.find((e) => e.kind === "stack" && e.to === id)?.from || null;
                const below = edges.find((e) => e.kind === "stack" && e.from === id)?.to || null;

                const nb = blocks.filter((b) => b.id !== id);
                let ne = edges.filter((e) => e.from !== id && e.to !== id);

                // if deleting a middle stack element, reconnect above ↕ below
                if (above && below) {
                    ne = ne.filter(
                        (e) => !(e.kind === "stack" && (e.from === above || e.to === below))
                    );
                    ne.push({ kind: "stack", from: above, to: below });
                }

                set({ blocks: nb, edges: ne, selectedId: selectedId === id ? null : selectedId });
            },

            // ---------- generic connections for snapper ----------
            // Map (fromPort) to your edge model
            connectByPorts: (fromId, fromPort, toId /* toPort always 'prev' */) => {
                if (fromPort === "next") {
                    get().connectStack(fromId, toId);
                    return;
                }
                // treat named ports as branches (body/true/false/left/right/…)
                get().connectBranch(fromId, String(fromPort), toId);
            },

            connectEdge: ({ fromId, fromPort, toId /*, toPort */ }) =>
                get().connectByPorts(fromId, fromPort, toId),

            // Optional: cycle check helper for snapper
            wouldCreateCycle: (fromId, toId) => {
                // DFS from 'toId' to see if we can reach 'fromId'
                const { edges } = get();
                const adj = new Map();
                for (const e of edges) {
                    if (!adj.has(e.from)) adj.set(e.from, []);
                    adj.get(e.from).push(e.to);
                }
                // include the prospective edge
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
        { name: "scribble-blocks" }
    )
);
