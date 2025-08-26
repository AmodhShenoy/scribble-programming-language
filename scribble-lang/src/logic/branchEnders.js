// src/logic/branchEnders.js
//
// Numbered IF branch enders only: if_branch_ender_0..4
// 0: on IF creation (below IF)
// 1 & 3: ender.true-in → next of TRUE arm's last child
// 2 & 4: ender.false-in → next of FALSE arm's last child

import { useBlockStore } from "../store/useBlockStore";

const LOG = (...a) => console.log("[branchEnders]", ...a);

// Per-IF counter: 0 at creation, then 1..4 as children are added (T,F,T,F)
const IF_SNAP_COUNT = new Map();

/* ---------------- helpers ---------------- */

function lastInStack(startId, edges) {
    if (!startId) return null;
    let cur = startId;
    while (true) {
        const e = edges.find((x) => x.kind === "stack" && x.from === cur);
        if (!e) return cur;
        cur = e.to;
    }
}

function pickAnchor(info, name) {
    if (!info || !info.anchors) return null;
    return (
        info.anchors[name] ||
        info.anchors[name.replace("-", "_")] ||
        info.anchors[name.replace("-", "")]
    );
}

function getWorldAnchor(block, info, name) {
    const a = block && info && pickAnchor(info, name);
    if (!a) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    return { x: block.x + a.x * sx, y: block.y + a.y * sy };
}

function getAnchorOffset(block, info, name) {
    const a = block && info && pickAnchor(info, name);
    if (!a) return null;
    const vb = info.viewBox || { w: block.w || 1, h: block.h || 1 };
    const sx = (block.w || vb.w) / vb.w;
    const sy = (block.h || vb.h) / vb.h;
    return { dx: a.x * sx, dy: a.y * sy };
}

function variantOf(b) {
    const m = String(b?.type ?? "").match(/if_branch_ender_(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
}

// Remove *all* if_branch_ender variants for a given ifId by rewriting state in one setState call
function removeAllEndersFor(ifId) {
    useBlockStore.setState((s) => {
        const toKill = s.blocks.filter(
            (b) =>
                (b.type === "if_branch_ender" ||
                    String(b.type).startsWith("if_branch_ender_")) &&
                b.data?.pairWith === ifId
        );
        if (toKill.length) {
            LOG("purge", toKill.map((x) => `${x.type}:${x.id}`));
        }
        return {
            ...s,
            blocks: s.blocks.filter((b) => !toKill.includes(b)),
        };
    });
}

function createNumberedEnder(ifBlock, index) {
    const api = useBlockStore.getState();
    const type = `if_branch_ender_${index}`;
    const id = crypto.randomUUID?.() || String(Math.random());
    const ender = {
        id,
        type,
        x: ifBlock.x + 120,
        y: ifBlock.y + (ifBlock.h || 120) + 80,
        data: { pairWith: ifBlock.id, auto: true, variant: index },
    };
    // add via action if present, else inline setState fallback
    if (typeof api.addBlock === "function") {
        api.addBlock(ender);
    } else {
        useBlockStore.setState((s) => ({ ...s, blocks: [...s.blocks, ender] }));
    }
    LOG("create ender", id, "type", type, "at", { x: ender.x, y: ender.y });
    return ender;
}

function moveTo(ender, enderInfo, anchorName, worldPoint) {
    const api = useBlockStore.getState();
    const off = getAnchorOffset(ender, enderInfo, anchorName);
    if (!off || !worldPoint) {
        LOG("WARN moveTo missing anchors", {
            enderType: ender?.type,
            anchorName,
            worldPoint,
        });
        return;
    }
    const desiredX = worldPoint.x - off.dx;
    const desiredY = worldPoint.y - off.dy;
    if (
        Math.abs((ender.x ?? 0) - desiredX) > 0.5 ||
        Math.abs((ender.y ?? 0) - desiredY) > 0.5
    ) {
        LOG("move if ender", ender.id, "→", { desiredX, desiredY });
        if (typeof api.moveBlock === "function") {
            api.moveBlock(ender.id, desiredX, desiredY);
        } else {
            useBlockStore.setState((s) => ({
                ...s,
                blocks: s.blocks.map((b) =>
                    b.id === ender.id ? { ...b, x: desiredX, y: desiredY } : b
                ),
            }));
        }
    }
}

/* ---------------- public API ---------------- */

export function ensureIfBranchEnderOnCreate(ifId) {
    const api = useBlockStore.getState();
    const ifBlock = api.blocks.find((b) => b.id === ifId && b.type === "if_else");
    if (!ifBlock) return;

    IF_SNAP_COUNT.set(ifId, 0);
    removeAllEndersFor(ifId);

    const ender0 = createNumberedEnder(ifBlock, 0);
    relayoutOne(ifBlock, ender0);
}

export function onIfBranchChildSnap(ifId) {
    const api = useBlockStore.getState();
    const ifBlock = api.blocks.find((b) => b.id === ifId && b.type === "if_else");
    if (!ifBlock) return;

    const current = IF_SNAP_COUNT.get(ifId) ?? 0;
    const next = Math.min(4, current + 1); // 1..4
    IF_SNAP_COUNT.set(ifId, next);
    LOG("bump counter", { ifId, current, next });

    // remove previous, create next, place
    removeAllEndersFor(ifId);
    const ender = createNumberedEnder(ifBlock, next);
    relayoutOne(ifBlock, ender);
}

export function reflowAllIfBranchEnders() {
    const api = useBlockStore.getState();
    for (const ifBlock of api.blocks) {
        if (ifBlock.type !== "if_else") continue;
        const all = api.blocks
            .filter(
                (b) =>
                    String(b.type).startsWith("if_branch_ender_") &&
                    b.data?.pairWith === ifBlock.id
            )
            .sort((a, b) => variantOf(a) - variantOf(b));
        const ender = all.length ? all[all.length - 1] : null;
        if (!ender) continue;
        relayoutOne(ifBlock, ender);
    }
}

/* ---------------- placement ---------------- */

function relayoutOne(ifBlock, ender) {
    const api = useBlockStore.getState();
    const { blocks, edges, svgInfoByType } = api;

    const ifInfo = svgInfoByType[ifBlock.type];
    const enderInfo = svgInfoByType[ender.type];
    if (!ifInfo || !enderInfo) {
        LOG("WARN relayoutOne missing svgInfo", {
            ifInfo: !!ifInfo,
            enderType: ender.type,
            enderInfo: !!enderInfo,
        });
        return;
    }

    const v = variantOf(ender);

    if (v === 0) {
        const desiredX = ifBlock.x + 120;
        const desiredY = ifBlock.y + (ifBlock.h || 120) + 80;
        LOG("place ender0", ender.id, "→", { desiredX, desiredY });
        moveTo(ender, enderInfo, "true-in", { x: desiredX, y: desiredY }); // simple place via moveTo to stay consistent
        return;
    }

    const trueHead = edges.find(
        (e) => e.kind === "branch" && e.from === ifBlock.id && e.meta?.branch === "true"
    )?.to;
    const falseHead = edges.find(
        (e) => e.kind === "branch" && e.from === ifBlock.id && e.meta?.branch === "false"
    )?.to;

    const lastTrueId = lastInStack(trueHead, edges);
    const lastFalseId = lastInStack(falseHead, edges);

    const trueNode = blocks.find((b) => b.id === lastTrueId) || ifBlock;
    const falseNode = blocks.find((b) => b.id === lastFalseId) || ifBlock;

    const trueInfo = svgInfoByType[trueNode.type];
    const falseInfo = svgInfoByType[falseNode.type];
    if (!trueInfo || !falseInfo) {
        LOG("WARN target info missing", { trueInfo: !!trueInfo, falseInfo: !!falseInfo });
        return;
    }

    const targetTrue =
        getWorldAnchor(trueNode, trueInfo, "next") ||
        getWorldAnchor(ifBlock, ifInfo, "true");
    const targetFalse =
        getWorldAnchor(falseNode, falseInfo, "next") ||
        getWorldAnchor(ifBlock, ifInfo, "false");

    LOG("targets", {
        variant: v,
        trueHead,
        falseHead,
        lastTrueId,
        lastFalseId,
        targetTrue,
        targetFalse,
    });

    if (v === 1 || v === 3) {
        moveTo(ender, enderInfo, "true-in", targetTrue);
        return;
    }
    if (v === 2 || v === 4) {
        moveTo(ender, enderInfo, "false-in", targetFalse);
        return;
    }
}
