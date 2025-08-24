// src/logic/snapper.js
// Find nearest snap opportunity for a dragged block.
// Supports: stack (prev->next), branch arms ("true"/"false"/"body"),
// and reporter -> input-slot snapping.

const DEFAULT_SNAP_PX = 14;

// ---- helpers ---------------------------------------------------------------

function getViewBox(info, fallbackW = 0, fallbackH = 0) {
    const w = info?.viewBox?.w || fallbackW || 0;
    const h = info?.viewBox?.h || fallbackH || 0;
    return { w, h };
}

function getAnchor(info, name, fallbackW = 0, fallbackH = 0) {
    if (info?.anchors?.[name]) return info.anchors[name];
    // Reasonable fallbacks for common anchors
    if (name === "next") return { x: (info?.viewBox?.w || fallbackW) / 2, y: info?.viewBox?.h || fallbackH };
    if (name === "prev") return { x: (info?.viewBox?.w || fallbackW) / 2, y: 0 };
    return null;
}

function worldFromLocal(block, pt) {
    return { x: block.x + pt.x, y: block.y + pt.y };
}

function sqr(n) { return n * n; }
function dist2(a, b) { return sqr(a.x - b.x) + sqr(a.y - b.y); }

// slot left anchor (fallback to left-middle of the slot box)
function slotLeftAnchor(slot) {
    if (slot?.anchors?.left) return slot.anchors.left;
    const bx = slot?.box?.x ?? 0;
    const by = slot?.box?.y ?? 0;
    const bw = slot?.box?.w ?? 0;
    const bh = slot?.box?.h ?? 0;
    return { x: bx, y: by + bh / 2 };
}

// child “handle” to plug into a parent input.
// prefer explicit "input-left" anchor, else "prev", else left-middle of its viewbox
function childInputHandle(childInfo, child) {
    if (childInfo?.anchors?.["input-left"]) return childInfo.anchors["input-left"];
    if (childInfo?.anchors?.prev) return childInfo.anchors.prev;
    const vb = getViewBox(childInfo, child.w, child.h);
    return { x: 0, y: vb.h / 2 };
}

// ---- main -----------------------------------------------------------------

/**
 * @param {object} me        The dragged block {id,type,x,y,w,h}
 * @param {object[]} blocks  All blocks
 * @param {object} svgInfoByType  { [type]: {viewBox, anchors, inputs} }
 * @param {number} stageScale Current stage scale (1 = 100%)
 * @param {object} opts      { edges? }
 * @returns {null | { dx, dy, target: { blockId, port } }}
 */
export function findSnap(me, blocks, svgInfoByType, stageScale = 1, opts = {}) {
    const SNAP_R = (DEFAULT_SNAP_PX * (1 / stageScale));
    const SNAP_R2 = SNAP_R * SNAP_R;

    const meInfo = svgInfoByType[me.type] || {};
    const mePrev = getAnchor(meInfo, "prev", me.w, me.h);
    const mePrevWorld = mePrev ? worldFromLocal(me, mePrev) : null;

    // for input snapping, compute child's handle (local) and world coords
    const meHandleLocal = childInputHandle(meInfo, me);
    const meHandleWorld = worldFromLocal(me, meHandleLocal);

    let best = null; // {d2, dx, dy, target:{blockId, port}}

    for (const p of blocks) {
        if (!p || p.id === me.id) continue;

        const pInfo = svgInfoByType[p.type] || {};
        const vbP = getViewBox(pInfo, p.w, p.h);

        // ===== 1) stack snapping: my prev → their next =====
        if (mePrevWorld) {
            const theirNext = getAnchor(pInfo, "next", vbP.w, vbP.h);
            if (theirNext) {
                const tNextWorld = worldFromLocal(p, theirNext);
                const d2 = dist2(mePrevWorld, tNextWorld);
                if (d2 <= SNAP_R2) {
                    const dx = Math.round(tNextWorld.x - mePrevWorld.x);
                    const dy = Math.round(tNextWorld.y - mePrevWorld.y);
                    if (!best || d2 < best.d2) {
                        best = { d2, dx, dy, target: { blockId: p.id, port: "next" } };
                    }
                }
            }

            // branch arms (“true”, “false”, “body”) if present on parent
            for (const arm of ["true", "false", "body"]) {
                const armAnchor = getAnchor(pInfo, arm, vbP.w, vbP.h);
                if (!armAnchor) continue;
                const armWorld = worldFromLocal(p, armAnchor);
                const d2 = dist2(mePrevWorld, armWorld);
                if (d2 <= SNAP_R2) {
                    const dx = Math.round(armWorld.x - mePrevWorld.x);
                    const dy = Math.round(armWorld.y - mePrevWorld.y);
                    if (!best || d2 < best.d2) {
                        best = { d2, dx, dy, target: { blockId: p.id, port: arm } };
                    }
                }
            }
        }

        // ===== 2) reporter → input-slot snapping =====
        // parent must expose inputs via svgInfo
        const inputs = pInfo.inputs || {};
        for (const [slotName, slot] of Object.entries(inputs)) {
            // Don't allow plugging into branch enders, etc.
            if (p.type === "if_branch_ender" || p.type === "repeat_loop_ender") continue;

            const leftLocal = slotLeftAnchor(slot);
            const leftWorld = worldFromLocal(p, leftLocal);

            const d2 = dist2(meHandleWorld, leftWorld);
            if (d2 <= SNAP_R2) {
                const dx = Math.round(leftWorld.x - meHandleWorld.x);
                const dy = Math.round(leftWorld.y - meHandleWorld.y);
                if (!best || d2 < best.d2) {
                    best = { d2, dx, dy, target: { blockId: p.id, port: `input:${slotName}` } };
                }
            }
        }
    }

    if (!best) return null;
    return { dx: best.dx, dy: best.dy, target: best.target };
}
