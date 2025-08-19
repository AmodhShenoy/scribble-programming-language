// src/logic/snapper.js
const DEFAULT_DIR = {
    prev: "up",
    next: "down",
    body: "down",
    true: "right",
    false: "down",
    left: "left",
    right: "right",
};

function toWorld(block, info, pt) {
    const sx = (block.w ?? info.viewBox.w) / info.viewBox.w;
    const sy = (block.h ?? info.viewBox.h) / info.viewBox.h;
    return { x: block.x + pt.x * sx, y: block.y + pt.y * sy };
}

function getWorldAnchors(block, info) {
    const out = [];
    // block-level anchors
    for (const [name, a] of Object.entries(info.anchors || {})) {
        const p = toWorld(block, info, a);
        out.push({ name, x: p.x, y: p.y, dir: DEFAULT_DIR[name] || "down", overlap: info.tipHeight || 0, blockId: block.id });
    }
    // input anchors (left/right) surfaced as "input:<name>-left/right"
    for (const [iname, i] of Object.entries(info.inputs || {})) {
        if (i.anchors?.left) {
            const p = toWorld(block, info, i.anchors.left);
            out.push({ name: `input:${iname}`, side: "left", x: p.x, y: p.y, dir: "right", overlap: 0, blockId: block.id });
        }
        if (i.anchors?.right) {
            const p = toWorld(block, info, i.anchors.right);
            out.push({ name: `input:${iname}`, side: "right", x: p.x, y: p.y, dir: "left", overlap: 0, blockId: block.id });
        }
    }
    return out;
}

function allowedPair(sourceName, targetName) {
    if (sourceName !== "prev") return false;
    if (targetName === "next" || targetName === "body" || targetName === "true" || targetName === "false") return true;
    if (String(targetName).startsWith("input:")) return true;
    return false;
}

export function findSnap(block, blocks, svgInfoByType, stageScale = 1, opts = {}) {
    const tuck = opts.tuck ?? false;

    const infoSrc = svgInfoByType[block.type];
    if (!infoSrc) return null;

    const srcPrev = getWorldAnchors(block, infoSrc).find((a) => a.name === "prev");
    if (!srcPrev) return null;

    const radiusWorld = 24 / (stageScale || 1);
    let best = null,
        bestD = Infinity;

    for (const other of blocks) {
        if (other.id === block.id) continue;
        const infoT = svgInfoByType[other.type];
        if (!infoT) continue;

        for (const t of getWorldAnchors(other, infoT)) {
            if (!allowedPair("prev", t.name)) continue;
            const d = Math.hypot(t.x - srcPrev.x, t.y - srcPrev.y);
            if (d < bestD && d <= radiusWorld) {
                best = { ...t };
                bestD = d;
            }
        }
    }
    if (!best) return null;

    let dx = best.x - srcPrev.x;
    let dy = best.y - srcPrev.y;

    if (tuck) {
        const o = best.overlap || 0;
        switch (best.dir) {
            case "down": dy -= o; break;
            case "up": dy += o; break;
            case "right": dx -= o; break;
            case "left": dx += o; break;
            default: break;
        }
    }

    return {
        dx, dy,
        target: { blockId: best.blockId, port: best.name }, // 'next' | 'true' | 'false' | 'body' | 'input:<name>'
        source: { blockId: block.id, port: "prev" },
    };
}
