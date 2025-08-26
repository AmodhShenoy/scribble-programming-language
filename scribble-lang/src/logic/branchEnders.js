// src/logic/branchEnders.js
//
// IF branch-ender logic only. Separate from repeat logic.
// Behavior:
// - Create "if_branch_ender_0" when an if_else block is created.
// - Each time a child is snapped into true/false, replace the ender with
//   "if_branch_ender_1"..."if_branch_ender_4" based on the longest branch,
//   and place it so both inputs meet the 'next' anchors of the two arms.

import { useBlockStore } from "../store/useBlockStore";

const LOG = (...a) => console.debug("[branchEnders]", ...a);

// ---------- helpers ----------
function getState(s) { return s || useBlockStore.getState(); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function lastInStack(startId, edges) {
    if (!startId) return null;
    let cur = startId;
    while (true) {
        const e = edges.find((x) => x.kind === "stack" && x.from === cur);
        if (!e) return cur;
        cur = e.to;
    }
}

function stackLength(headId, edges) {
    if (!headId) return 0;
    let n = 1, cur = headId;
    while (true) {
        const e = edges.find((x) => x.kind === "stack" && x.from === cur);
        if (!e) return n;
        n += 1;
        cur = e.to;
    }
}

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

function outgoingBranches(state, ifId) {
    const { edges } = state;
    return edges.filter((e) => e.kind === "branch" && e.from === ifId);
}

function headsForIf(state, ifBlock) {
    const outs = outgoingBranches(state, ifBlock.id);
    LOG("if", ifBlock.id, "outgoing:", outs.map(o => JSON.stringify({ kind: o.kind, from: o.from, to: o.to, meta: o.meta })));

    // prefer meta.branch when present
    let trueHead = null, falseHead = null;
    for (const e of outs) {
        if (e.meta?.branch === "true") trueHead = e.to;
        if (e.meta?.branch === "false") falseHead = e.to;
    }
    // fallback: first = true, second = false
    if (!trueHead && outs[0]) trueHead = outs[0].to;
    if (!falseHead && outs[1]) falseHead = outs[1].to;

    return { trueHead, falseHead };
}

function enderTypeForCount(count) {
    const idx = clamp(count, 0, 4);
    return `if_branch_ender_${idx}`;
}

function ensureEnderForIf(state, ifBlock, desiredType) {
    const { blocks, addBlock } = state;
    const existing = blocks.find(
        (b) => b.data?.pairWith === ifBlock.id && String(b.type).startsWith("if_branch_ender")
    );
    if (existing) return existing;

    const type = desiredType || "if_branch_ender_0";
    const ender = {
        id: crypto.randomUUID?.() || String(Math.random()),
        type,
        x: ifBlock.x + 20,
        y: ifBlock.y + (ifBlock.h || 100) + 80,
        data: { pairWith: ifBlock.id, auto: true },
    };
    LOG("create ender", ender.id, "type", ender.type, "at", { x: ender.x, y: ender.y });
    addBlock(ender);
    return ender;
}

function replaceEnderType(state, ender, newType) {
    if (ender.type === newType) return ender;
    const { removeBlock, addBlock } = state;
    const next = { ...ender, id: crypto.randomUUID?.() || String(Math.random()), type: newType };
    LOG("replace", ender.id, "→", next.id, "type", newType);
    removeBlock(ender.id);
    addBlock(next);
    return next;
}

function relayoutEnderForIf(state, ifBlock) {
    const { blocks, edges, svgInfoByType, moveBlock } = state;

    const ender = blocks.find(
        (b) => b.data?.pairWith === ifBlock.id && String(b.type).startsWith("if_branch_ender")
    );
    if (!ender) { LOG("no ender to reflow for if", ifBlock.id); return; }

    const ifInfo = svgInfoByType[ifBlock.type];
    const enderInfo = svgInfoByType[ender.type];
    if (!ifInfo || !enderInfo) return;

    const { trueHead, falseHead } = headsForIf(state, ifBlock);
    const lastTrueId = lastInStack(trueHead, edges);
    const lastFalseId = lastInStack(falseHead, edges);

    const trueNode = blocks.find((b) => b.id === lastTrueId) || null;
    const falseNode = blocks.find((b) => b.id === lastFalseId) || null;

    const trueInfo = trueNode ? svgInfoByType[trueNode.type] : null;
    const falseInfo = falseNode ? svgInfoByType[falseNode.type] : null;

    // targets: prefer the last child's "next"; fall back to if's own "true"/"false"
    const targetTrue = (trueNode && trueInfo && getWorldAnchor(trueNode, trueInfo, "next"))
        || getWorldAnchor(ifBlock, ifInfo, "true");
    const targetFalse = (falseNode && falseInfo && getWorldAnchor(falseNode, falseInfo, "next"))
        || getWorldAnchor(ifBlock, ifInfo, "false");

    const offT = getAnchorOffset(ender, enderInfo, "true-in");
    const offF = getAnchorOffset(ender, enderInfo, "false-in");

    LOG("targets", { trueHead, falseHead, lastTrueId, lastFalseId, targetTrue, targetFalse });

    if (!targetTrue || !targetFalse || !offT || !offF) return;

    // center the ender so both inputs coincide with the two branch tails
    const midLocal = { x: (offT.dx + offF.dx) / 2, y: (offT.dy + offF.dy) / 2 };
    const midTarget = { x: (targetTrue.x + targetFalse.x) / 2, y: (targetTrue.y + targetFalse.y) / 2 };

    const desiredX = midTarget.x - midLocal.x;
    const desiredY = midTarget.y - midLocal.y;

    LOG("move if ender", ender.id, "→", { desiredX, desiredY });
    moveBlock(ender.id, desiredX, desiredY);
}

// ---------- public API (names used by Block.jsx) ----------
export function ensureIfBranchEnderOnCreate(ifId, stateArg) {
    const state = getState(stateArg);
    const ifBlock = state.blocks.find((b) => b.id === ifId);
    if (!ifBlock) return;
    ensureEnderForIf(state, ifBlock, "if_branch_ender_0");
    relayoutEnderForIf(state, ifBlock);
}

// bump visual variant and snap after a child gets attached to true/false
export function onIfBranchChildSnap(ifId, stateArg) {
    const state = getState(stateArg);
    const ifBlock = state.blocks.find((b) => b.id === ifId);
    if (!ifBlock) return;

    const { edges, blocks } = state;
    const { trueHead, falseHead } = headsForIf(state, ifBlock);
    const countTrue = stackLength(trueHead, edges);
    const countFalse = stackLength(falseHead, edges);
    const longest = Math.max(countTrue, countFalse);

    // After first child, we want _1 (not _0)
    const nextType = enderTypeForCount(clamp(longest, 1, 4));

    const existing = blocks.find(
        (b) => b.data?.pairWith === ifId && String(b.type).startsWith("if_branch_ender")
    );
    const ender = existing
        ? replaceEnderType(state, existing, nextType)
        : ensureEnderForIf(state, ifBlock, nextType);

    relayoutEnderForIf(state, ifBlock);
}

export function reflowAllIfBranchEnders(stateArg) {
    const state = getState(stateArg);
    for (const b of state.blocks) {
        if (b.type !== "if_else") continue;
        ensureEnderForIf(state, b, "if_branch_ender_0");
        relayoutEnderForIf(state, b);
    }
}
