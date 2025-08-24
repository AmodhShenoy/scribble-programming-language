// src/logic/layout.js
import { useBlockStore } from "../store/useBlockStore";

// ---------- helpers ----------
function byIdMap(blocks) {
    const m = new Map();
    for (const b of blocks) m.set(b.id, b);
    return m;
}
function headOfBranch(edges, ifId, branch) {
    const e = edges.find(
        (x) => x.kind === "branch" && x.from === ifId && x.meta?.branch === branch
    );
    return e ? e.to : null;
}
function nextOf(edges, id) {
    return edges.find((e) => e.kind === "stack" && e.from === id)?.to || null;
}
function tailOfChain(edges, startId) {
    let cur = startId;
    if (!cur) return null;
    while (true) {
        const n = nextOf(edges, cur);
        if (!n) return cur;
        cur = n;
    }
}
function lengthOfChain(edges, startId) {
    let cur = startId, n = 0;
    while (cur) { n++; cur = nextOf(edges, cur); }
    return n;
}
function getAnchor(info, key, fallbackW = 0, fallbackH = 0) {
    if (info?.anchors?.[key]) return info.anchors[key];
    if (key === "next") return { x: (info?.viewBox?.w || fallbackW) / 2, y: info?.viewBox?.h || fallbackH };
    if (key === "prev") return { x: (info?.viewBox?.w || fallbackW) / 2, y: 0 };
    return { x: 0, y: 0 };
}
function attachToTargetNext(target, targetInfo, enderInfo, enderAnchorName) {
    const tNext = getAnchor(targetInfo, "next", target.w, target.h);
    const eAnchor =
        enderInfo?.anchors?.[enderAnchorName] || getAnchor(enderInfo, "prev");
    const worldX = target.x + tNext.x;
    const worldY = target.y + tNext.y;
    return { x: Math.round(worldX - eAnchor.x), y: Math.round(worldY - eAnchor.y) };
}
function placeUnderIf(ifBlock, ifInfo, enderInfo, offset = 40) {
    const tNext = getAnchor(ifInfo, "next", ifBlock.w, ifBlock.h);
    const ePrev = getAnchor(enderInfo, "prev");
    const worldX = ifBlock.x + tNext.x;
    const worldY = ifBlock.y + tNext.y + offset;
    return { x: Math.round(worldX - ePrev.x), y: Math.round(worldY - ePrev.y) };
}

// ---------- public ----------
export function reflowAllIfBranchEnders() {
    const store = useBlockStore.getState();
    const { blocks, edges, svgInfoByType, endersByIf = {} } = store;

    const map = byIdMap(blocks);

    for (const ifBlock of blocks) {
        if (ifBlock.type !== "if_else") continue;

        const enderId = endersByIf[ifBlock.id];
        if (!enderId) continue;
        const ender = map.get(enderId);
        if (!ender) continue;

        const trueHead = headOfBranch(edges, ifBlock.id, "true");
        const falseHead = headOfBranch(edges, ifBlock.id, "false");

        const tTail = trueHead ? tailOfChain(edges, trueHead) : null;
        const fTail = falseHead ? tailOfChain(edges, falseHead) : null;

        const depthTrue = trueHead ? lengthOfChain(edges, trueHead) : 0;
        const depthFalse = falseHead ? lengthOfChain(edges, falseHead) : 0;

        const total = Math.min(4, depthTrue + depthFalse);
        const wantType = total === 0 ? "if_branch_ender" : `if_branch_ender_${total}`;

        const ifInfo = svgInfoByType["if_else"] || {};
        const enderInfo = svgInfoByType[wantType] || svgInfoByType["if_branch_ender"] || {};

        let pos;
        if (total === 0) {
            // no children yet → float below IF
            pos = placeUnderIf(ifBlock, ifInfo, enderInfo, 32);
        } else {
            // odd → TRUE arm using ender anchor "true-in"
            // even → FALSE arm using ender anchor "false-in"
            const useTrue = total % 2 === 1;
            const tailId = useTrue ? (tTail || fTail) : (fTail || tTail); // graceful fallback if one arm empty
            const target = tailId ? map.get(tailId) : null;

            if (target) {
                const targetInfo = svgInfoByType[target.type] || {};
                const enderPort = useTrue ? "true-in" : "false-in";
                pos = attachToTargetNext(target, targetInfo, enderInfo, enderPort);
            } else {
                // nothing to attach → keep under IF
                pos = placeUnderIf(ifBlock, ifInfo, enderInfo, 32);
            }
        }

        if (ender.type !== wantType) store.updateBlock(ender.id, { type: wantType });
        if (ender.x !== pos.x || ender.y !== pos.y) store.moveBlock(ender.id, pos.x, pos.y);
    }
}
