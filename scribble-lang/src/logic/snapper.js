// src/logic/snapper.js
//
// Find nearest snap target for the block that finished dragging.
// - Stack snap:   our "prev" to other "next"
// - Input snap:   our "input-left" to other's each slot's "left" anchor
//
// This uses the SVG metadata cached in svgInfoByType (anchors, inputs, viewBox).

const STACK_RADIUS_SCR = 24;   // px at 100% zoom
const INPUT_RADIUS_SCR = 22;   // px at 100% zoom

function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

function viewBoxSize(info) {
    const w = info?.viewBox?.w ?? 128;
    const h = info?.viewBox?.h ?? 128;
    return { w, h };
}

// local (SVG coords) -> local group coords (screen px inside the block's Group)
function localToBlock(b, info, pt) {
    if (!pt) return null;
    const { w: vbw, h: vbh } = viewBoxSize(info);
    const sx = (b.w ?? vbw) / vbw;
    const sy = (b.h ?? vbh) / vbh;
    return { x: pt.x * sx, y: pt.y * sy };
}

// local anchor to world coords
function localToWorld(b, info, pt) {
    const p = localToBlock(b, info, pt);
    return p ? { x: b.x + p.x, y: b.y + p.y } : null;
}

function getAnchor(info, name) {
    return info?.anchors?.[name] || null;
}

export function findSnap(me, blocks, svgInfoByType, stageScale = 1, opts = {}) {
    const myInfo = svgInfoByType[me.type];
    if (!myInfo) return null;

    const candidates = [];

    // ----- A) stack snap (our prev ↔︎ other next) -----
    const myPrev = getAnchor(myInfo, "prev");
    const myPrevW = localToWorld(me, myInfo, myPrev);

    if (myPrevW) {
        const rad = STACK_RADIUS_SCR / stageScale;

        for (const other of blocks) {
            if (other.id === me.id) continue;
            const oInfo = svgInfoByType[other.type];
            if (!oInfo) continue;

            const oNext = getAnchor(oInfo, "next");
            const oNextW = localToWorld(other, oInfo, oNext);
            if (!oNextW) continue;

            const d = dist(myPrevW, oNextW);
            if (d <= rad) {
                candidates.push({
                    kind: "stack",
                    d,
                    dx: oNextW.x - myPrevW.x,
                    dy: oNextW.y - myPrevW.y,
                    target: { blockId: other.id, port: "next" },
                });
            }
        }
    }

    // ----- B) input snap (our input-left ↔︎ other input-slot left) -----
    // Child anchor on the block being dragged:
    const myInputLeftL = getAnchor(myInfo, "input-left");   // shared name across input blocks
    const myInputLeftW = localToWorld(me, myInfo, myInputLeftL);

    if (myInputLeftW) {
        const rad = INPUT_RADIUS_SCR / stageScale;

        for (const parent of blocks) {
            if (parent.id === me.id) continue;
            const pInfo = svgInfoByType[parent.type];
            const slots = pInfo?.inputs || {};
            if (!slots || !Object.keys(slots).length) continue;

            for (const [slotName, slot] of Object.entries(slots)) {
                // slot.anchors.left was produced from id="anchor-input:<slot>-left"
                const leftL = slot?.anchors?.left;
                if (!leftL) continue;

                const leftW = localToWorld(parent, pInfo, leftL);
                if (!leftW) continue;

                const d = dist(myInputLeftW, leftW);
                if (d <= rad) {
                    candidates.push({
                        kind: "input",
                        d,
                        dx: leftW.x - myInputLeftW.x,
                        dy: leftW.y - myInputLeftW.y,
                        target: { blockId: parent.id, port: `input:${slotName}` },
                    });
                }
            }
        }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0];
}
