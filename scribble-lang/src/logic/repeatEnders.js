// src/logic/repeatEnders.js
//
// Repeat loop-ender logic (independent from if-branch enders).
// Rules:
//  - Create repeat_loop_ender_0 when a repeat block is created.
//  - Every time a child is snapped into the repeat's false arm,
//    remove the old ender and spawn the next variant (1..7),
//    then SNAP its anchor:false-in to the *effective* NEXT of the last child.
//  - If the last child is an `if_else`, the effective NEXT is taken from its
//    paired if-branch ender (not from the if block itself).

import { useBlockStore } from "../store/useBlockStore";

const LOG = (...a) => console.debug("[repeatEnders]", ...a);

// ---------- tiny helpers ----------
function S(s) { return s || useBlockStore.getState(); }

function getWorldAnchor(block, info, name) {
    if (!block || !info?.anchors?.[name]) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    const a = info.anchors[name];
    return { x: block.x + a.x * sx, y: block.y + a.y * sy };
}

function getAnchorOffset(block, info, name) {
    if (!block || !info?.anchors?.[name]) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    const a = info.anchors[name];
    return { dx: a.x * sx, dy: a.y * sy };
}

function lastInStack(startId, edges) {
    if (!startId) return null;
    let cur = startId;
    while (true) {
        const e = edges.find((x) => x.kind === "stack" && x.from === cur);
        if (!e) return cur;
        cur = e.to;
    }
}

function loopEnderType(idx) {
    const clamped = Math.max(0, Math.min(7, idx | 0));
    return `repeat_loop_ender_${clamped}`;
}

// Find the "paired" branch ender for an if_else block (visual-only block that merges both arms)
function findIfBranchEnderFor(state, ifId) {
    return state.blocks.find(
        (b) =>
            b.data?.pairWith === ifId &&
            String(b.type).startsWith("if_branch_ender")
    ) || null;
}

// When a block is the last child, this returns the *effective* target "next" position:
//  - normal blocks: their own 'next' anchor
//  - if_else blocks: the 'next' of their paired if-branch ender (so the repeat ender
//    meets precisely at the merge point)
function effectiveNextForBlock(state, block) {
    const info = state.svgInfoByType[block.type];
    if (!info) return null;

    if (block.type === "if_else") {
        const ender = findIfBranchEnderFor(state, block.id);
        if (ender) {
            const ei = state.svgInfoByType[ender.type];
            const p = ei && getWorldAnchor(ender, ei, "next");
            if (p) {
                LOG("effectiveNext: using if-branch ender.next for", block.id, "→", p);
                return p;
            }
        }
        // Fallback if ender not found yet: mid of if's true/false anchors (better than nothing)
        const t = getWorldAnchor(block, info, "true");
        const f = getWorldAnchor(block, info, "false");
        if (t && f) return { x: (t.x + f.x) / 2, y: (t.y + f.y) / 2 };
    }

    const ownNext = getWorldAnchor(block, info, "next");
    if (ownNext) return ownNext;

    return null;
}

// ---------- public API ----------

// Create initial 0-ender once
export function ensureInitialRepeatEnder(repeatId, stateArg) {
    const state = S(stateArg);
    const { blocks, addBlock } = state;
    const repeat = blocks.find((b) => b.id === repeatId);
    if (!repeat) return;

    const existing = blocks.find(
        (b) =>
            b.data?.pairWith === repeatId &&
            String(b.type).startsWith("repeat_loop_ender")
    );
    if (existing) return;

    const type = loopEnderType(0);
    const ender = {
        id: crypto.randomUUID?.() || String(Math.random()),
        type,
        x: repeat.x + 20,
        y: repeat.y + (repeat.h || 100) + 100,
        data: { pairWith: repeatId, auto: true, idx: 0 },
    };
    LOG("create initial ender", ender.id, "type", ender.type, "at", { x: ender.x, y: ender.y });
    addBlock(ender);
}

// Bump to the next variant and snap to the last child on the false arm
export function onRepeatFalseChildSnap(repeatId, stateArg) {
    const state = S(stateArg);
    const { blocks, edges, removeBlock, addBlock } = state;
    const repeat = blocks.find((b) => b.id === repeatId);
    if (!repeat) return;

    // Count current body length to decide which variant to show (1..7)
    const head = state.edges.find(
        (e) => e.kind === "branch" && e.from === repeatId && e.meta?.branch === "false"
    )?.to;

    // compute length by following "stack"
    let count = 0;
    if (head) {
        count = 1;
        let cur = head;
        while (true) {
            const e = state.edges.find((x) => x.kind === "stack" && x.from === cur);
            if (!e) break;
            count += 1;
            cur = e.to;
        }
    }
    const idx = Math.max(1, Math.min(7, count)); // after first child we want _1
    const nextType = loopEnderType(idx);

    // remove any existing enders for this repeat (always only one should remain)
    for (const b of blocks) {
        if (b.data?.pairWith === repeatId && String(b.type).startsWith("repeat_loop_ender")) {
            LOG("remove old loop ender", b.id, "type", b.type);
            removeBlock(b.id);
        }
    }

    // create new one
    const ender = {
        id: crypto.randomUUID?.() || String(Math.random()),
        type: nextType,
        x: repeat.x + 20,
        y: repeat.y + (repeat.h || 100) + 100,
        data: { pairWith: repeatId, auto: true, idx },
    };
    LOG("spawn new loop ender", ender.id, "type", ender.type);
    addBlock(ender);

    // snap it now
    relayoutRepeatEnder(state, repeat);
}

// Reposition all repeat enders (safe to call often)
export function reflowAllRepeatEnders(stateArg) {
    const state = S(stateArg);
    for (const b of state.blocks) {
        if (b.type !== "repeat_until" && b.type !== "repeat_times") continue;
        relayoutRepeatEnder(state, b);
    }
}

// ---------- placement core ----------
function relayoutRepeatEnder(state, repeat) {
    const { blocks, edges, svgInfoByType, moveBlock } = state;

    const ender = blocks.find(
        (b) =>
            b.data?.pairWith === repeat.id &&
            String(b.type).startsWith("repeat_loop_ender")
    );
    if (!ender) return;

    const enderInfo = svgInfoByType[ender.type];
    if (!enderInfo) return;

    // find the head of the false arm
    const falseHead = edges.find(
        (e) => e.kind === "branch" && e.from === repeat.id && e.meta?.branch === "false"
    )?.to;

    if (!falseHead) {
        // No body yet -> keep default spot (created earlier)
        LOG("reflow default (no body):", { x: ender.x, y: ender.y });
        return;
    }

    const lastId = lastInStack(falseHead, edges);
    const lastNode = blocks.find((b) => b.id === lastId);
    if (!lastNode) return;

    // *** HERE IS THE FIX ***
    // for normal blocks: use their 'next'
    // for if_else: use the *paired branch ender* 'next'
    const targetNext = effectiveNextForBlock(state, lastNode);
    const offFalseIn = getAnchorOffset(ender, enderInfo, "false-in");

    LOG("targets", { lastId, lastType: lastNode.type, targetNext, offFalseIn });

    if (!targetNext || !offFalseIn) return;

    const desiredX = targetNext.x - offFalseIn.dx;
    const desiredY = targetNext.y - offFalseIn.dy;

    moveBlock(ender.id, desiredX, desiredY);
}
