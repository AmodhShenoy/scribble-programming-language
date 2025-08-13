import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useBlockStore = create(
    persist(
        (set, get) => ({
            blocks: [],
            addBlock: (block) => {
                set((state) => {
                    const next = [...state.blocks, block];
                    console.log("[addBlock]", block, "count ->", next.length);
                    return { blocks: next };
                });
            },
            updateBlock: (id, updates) => {
                set((state) => {
                    const next = state.blocks.map((b) =>
                        b.id === id ? { ...b, ...updates } : b
                    );
                    // console.log("[updateBlock]", id, updates);
                    return { blocks: next };
                });
            },
            clearBlocks: () => set({ blocks: [] }),
        }),
        { name: "scribble-blocks" }
    )
);
