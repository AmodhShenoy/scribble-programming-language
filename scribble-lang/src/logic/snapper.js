// src/logic/snapper.js
// keep your other exports/helpers if you have them; just replace findSnap (and add allowStackPair)

const MAGNET_PX = 24; // visual radius in screen px

function allowStackPair(aboveType, belowType) {
    // stop cannot have outgoing "next", so it can't be the parent
    if (aboveType === "stop") return false;
    // don't allow connecting into start from above (start is an entry)
    if (belowType === "start") return false;
    // everything else is fine (including start → X and X → stop)
    return true;
}

function collectAnchorsAbs(block, info) {
    const vb = info?.viewBox || { w: block.w || 0, h: block.h || 0 };
    const sx = (block.w || vb.w) / vb.w || 1;
    const sy = (block.h || vb.h) / vb.h || 1;

    const toAbs = (pt) =>
        pt
            ? { x: block.x + pt.x * sx, y: block.y + pt.y * sy }
            : null;

    const a = info?.anchors || {};
    return {
        prev: toAbs(a.prev),
        next: toAbs(a.next),
        // (inputs stay as-is in your file; not needed for start/stop stack fix)
    };
}

/**
 * Returns either:
 *   null
 *   or { dx, dy, target: { blockId, port: "next"|"input:..."|"true"|"false"|"body" } }
 *
 * We only create "stack" snaps as: target.next → me.prev
 * That matches your connectEdge call (from target, port "next", to me).
 */
export function findSnap(me, blocks, svgInfoByType, stageScale = 1, opts = {}) {
    const magnet = MAGNET_PX / Math.max(0.75, stageScale);
    const meInfo = svgInfoByType[me.type] || {};
    const meAnch = collectAnchorsAbs(me, meInfo);

    let best = null;

    // --- stack snapping: place "me" under "target" (target.next → me.prev)
    if (meAnch.prev) {
        for (const target of blocks) {
            if (target.id === me.id) continue;
            const tInfo = svgInfoByType[target.type] || {};
            const tAnch = collectAnchorsAbs(target, tInfo);
            if (!tAnch.next) continue;

            if (!allowStackPair(target.type, me.type)) continue;

            const dx = tAnch.next.x - meAnch.prev.x;
            const dy = tAnch.next.y - meAnch.prev.y;
            const d2 = dx * dx + dy * dy;

            if (Math.sqrt(d2) <= magnet) {
                if (!best || d2 < best.d2) {
                    best = {
                        d2,
                        dx,
                        dy,
                        target: { blockId: target.id, port: "next" }, // from target.next → me
                    };
                }
            }
        }
    }

    // (keep your input/branch snap logic below intact, if you have it; this change
    //  only ensures start/stop work for stack. If you don't have extra logic, just return here.)

    return best ? { dx: best.dx, dy: best.dy, target: best.target } : null;
}
