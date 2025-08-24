// src/logic/branchEnders.js
//
// Auto create & auto place the visual-only "if_branch_ender" for every "if_else".
// This file does not change edges used by the interpreter; the ender is layout only.

export function lastInStack(startId, edges) {
    if (!startId) return null;
    let cur = startId;
    while (true) {
        const e = edges.find((x) => x.kind === "stack" && x.from === cur);
        if (!e) return cur;
        cur = e.to;
    }
}

function getWorldAnchor(block, info, name) {
    if (!block || !info || !info.anchors || !info.anchors[name]) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    const a = info.anchors[name];
    return { x: block.x + a.x * sx, y: block.y + a.y * sy };
}

function getAnchorOffset(block, info, name) {
    // local offset of an anchor inside the block (top-left origin)
    if (!block || !info || !info.anchors || !info.anchors[name]) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    const a = info.anchors[name];
    return { dx: a.x * sx, dy: a.y * sy };
}

// Find or create the ender that pairs with this if_else block.
// We store the association in ender.data.pairWith === ifId
export function ensureEnderForIf(ifBlock, state) {
    const { blocks, addBlock } = state;
    const existing = blocks.find(
        (b) => b.type === "if_branch_ender" && b.data?.pairWith === ifBlock.id
    );
    if (existing) return existing;

    const enderId = crypto.randomUUID?.() || String(Math.random());
    // Place roughly under the if block; we'll relayout immediately after.
    const ender = {
        id: enderId,
        type: "if_branch_ender",
        x: ifBlock.x + 20,
        y: ifBlock.y + (ifBlock.h || 120) + 80,
        data: { pairWith: ifBlock.id, auto: true },
    };
    addBlock(ender);
    return ender;
}

// Compute the desired position of the paired ender so that its two top
// anchors are centered on the last descendants of each branch. We center
// the ender on the midpoint between targets; spacing is assumed to be OK
// (we don't stretch graphics here).
export function relayoutEnderForIf(ifBlock, state) {
    const { blocks, edges, svgInfoByType, moveBlock } = state;
    const ifInfo = svgInfoByType[ifBlock.type];
    if (!ifInfo) return;

    const ender = blocks.find(
        (b) => b.type === "if_branch_ender" && b.data?.pairWith === ifBlock.id
    );
    if (!ender) return;

    const trueHead = edges.find(
        (e) => e.kind === "branch" && e.from === ifBlock.id && e.meta?.branch === "true"
    )?.to;
    const falseHead = edges.find(
        (e) => e.kind === "branch" && e.from === ifBlock.id && e.meta?.branch === "false"
    )?.to;

    // Walk each arm to the last stack descendant
    const lastTrueId = lastInStack(trueHead, edges);
    const lastFalseId = lastInStack(falseHead, edges);

    const trueNode =
        blocks.find((b) => b.id === lastTrueId) || ifBlock; // fallback to if block
    const falseNode =
        blocks.find((b) => b.id === lastFalseId) || ifBlock;

    const trueInfo = svgInfoByType[trueNode.type];
    const falseInfo = svgInfoByType[falseNode.type];
    const enderInfo = svgInfoByType[ender.type];

    if (!trueInfo || !falseInfo || !enderInfo) return;

    // Targets: where the branch arms should meet (use "next" of last nodes; fallback to if's anchors)
    const targetTrue =
        getWorldAnchor(trueNode, trueInfo, "next") ||
        getWorldAnchor(ifBlock, ifInfo, "true");
    const targetFalse =
        getWorldAnchor(falseNode, falseInfo, "next") ||
        getWorldAnchor(ifBlock, ifInfo, "false");

    if (!targetTrue || !targetFalse) return;

    // Ender local anchor mid-point
    const offT = getAnchorOffset(ender, enderInfo, "true-in");
    const offF = getAnchorOffset(ender, enderInfo, "false-in");
    if (!offT || !offF) return;

    const midLocal = { x: (offT.dx + offF.dx) / 2, y: (offT.dy + offF.dy) / 2 };
    const midTarget = {
        x: (targetTrue.x + targetFalse.x) / 2,
        y: (targetTrue.y + targetFalse.y) / 2,
    };

    const desiredX = midTarget.x - midLocal.x;
    const desiredY = midTarget.y - midLocal.y;

    if (Math.abs(ender.x - desiredX) > 0.5 || Math.abs(ender.y - desiredY) > 0.5) {
        moveBlock(ender.id, desiredX, desiredY);
    }
}

// Relayout all if-else enders in the document
export function relayoutAllEnders(state) {
    const { blocks } = state;
    for (const b of blocks) {
        if (b.type !== "if_else") continue;
        ensureEnderForIf(b, state);
        relayoutEnderForIf(b, state);
    }
}
