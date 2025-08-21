// src/logic/layout.js
import { useBlockStore } from "../store/useBlockStore.js";
import { getSvgInfo } from "../bootstrap/loadSvgInfo.js";

// default padding INSIDE slots around a child reporter
export const SLOT_PAD = 8;

// ----- coord helpers -------------------------------------------------------
export function localToWorld(block, pt) {
    const info = getSvgInfo(block.type);
    const sx = block.w / info.viewBox.w;
    const sy = block.h / info.viewBox.h;
    return { x: block.x + pt.x * sx, y: block.y + pt.y * sy };
}

export function worldToLocal(block, pt) {
    const info = getSvgInfo(block.type);
    const sx = block.w / info.viewBox.w;
    const sy = block.h / info.viewBox.h;
    return { x: (pt.x - block.x) / sx, y: (pt.y - block.y) / sy };
}

// ----- slot geometry -------------------------------------------------------
export function slotWorldRect(parent, port) {
    const info = getSvgInfo(parent.type);
    const slot = info.inputs && info.inputs[port];
    if (!slot) return null;
    const sx = parent.w / info.viewBox.w;
    const sy = parent.h / info.viewBox.h;
    return {
        x: parent.x + slot.box.x * sx,
        y: parent.y + slot.box.y * sy,
        w: slot.box.w * sx,
        h: slot.box.h * sy,
        rx: (slot.box.rx || 0) * ((sx + sy) / 2)
    };
}

export function slotAnchorWorld(parent, port, side) {
    const info = getSvgInfo(parent.type);
    const def = info.inputs && info.inputs[port];
    if (!def || !def.anchors) return null;
    const a = def.anchors[side];
    if (!a) return null;
    return localToWorld(parent, a);
}

export function childInputAnchorWorld(child, side) {
    const info = getSvgInfo(child.type);
    const key = side === "left" ? "input-left" : "input-right";
    const a = info.anchors && info.anchors[key];
    if (!a) return null;
    return localToWorld(child, a);
}

export function alignChildIntoSlot(parent, port, child, side) {
    const ap = slotAnchorWorld(parent, port, side || "left");
    const ac = childInputAnchorWorld(child, side || "left");
    if (!ap || !ac) return { x: child.x, y: child.y };
    return { x: child.x + (ap.x - ac.x), y: child.y + (ap.y - ac.y) };
}

// ----- reflow (resize parents to fit children) -----------------------------
export function reflowFrom(parentId, seen) {
    const store = useBlockStore.getState();
    const parent = store.blocks.find((b) => b.id === parentId);
    if (!parent) return;
    const mark = seen || new Set();
    if (mark.has(parentId)) return;
    mark.add(parentId);

    const info = getSvgInfo(parent.type);
    const slotDefs = info.inputs || {};

    // reflow children first
    const edges = store.edges.filter((e) => e.kind === "input" && e.from === parentId);
    for (const e of edges) reflowFrom(e.to, mark);

    let desiredW = parent.w;
    let desiredH = parent.h;
    const baseW = info.viewBox.w;
    const baseH = info.viewBox.h;

    function rightMargin(slot) {
        return Math.max(0, baseW - (slot.box.x + slot.box.w));
    }
    function bottomMargin(slot) {
        return Math.max(0, baseH - (slot.box.y + slot.box.h));
    }

    for (const port of Object.keys(slotDefs)) {
        const slot = slotDefs[port];
        const edge = edges.find((e) => e.meta && e.meta.port === port);
        let needW = slot.box.w;
        let needH = slot.box.h;

        if (edge) {
            const child = store.blocks.find((b) => b.id === edge.to);
            if (child) {
                needW = Math.max(needW, child.w + SLOT_PAD * 2);
                needH = Math.max(needH, child.h + SLOT_PAD * 2);
            }
        }

        const reqW = slot.box.x + needW + rightMargin(slot);
        const reqH = slot.box.y + needH + bottomMargin(slot);
        desiredW = Math.max(desiredW, reqW);
        desiredH = Math.max(desiredH, reqH);
    }

    store.registerSize(parent.id, desiredW, desiredH);

    for (const e of edges) {
        const child = store.blocks.find((b) => b.id === e.to);
        if (!child) continue;
        const p = alignChildIntoSlot(parent, e.meta.port, child, "left");
        store.updateBlock(child.id, { x: p.x, y: p.y });
    }
}
