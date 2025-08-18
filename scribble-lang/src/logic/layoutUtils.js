// src/logic/layoutUtils.js

// ---- Anchors stay the same
export function getAnchors(b) {
    const cx = b.x + b.w / 2;
    const anchors = {
        prev: { x: cx, y: b.y },              // top center
        next: { x: cx, y: b.y + b.h },        // bottom center
    };
    if (b.type === "if_else") {
        anchors.true = { x: b.x + b.w * 0.30, y: b.y + b.h * 0.60 };
        anchors.false = { x: b.x + b.w * 0.70, y: b.y + b.h * 0.60 };
    }
    if (b.type === "repeat_until") {
        anchors.body = { x: b.x + b.w * 0.50, y: b.y + b.h * 0.60 };
    }
    return anchors;
}

// Aggressive snapping defaults
export const SNAP_DEFAULTS = {
    radius: 56,        // was ~28; bigger = easier to snap
    stackOverlap: 34,  // pull lower block "into" the upper frame by arrowhead height
    branchOverlap: 0,  // leave branches as-is (tweak if you want)
    horizBias: 0.6,    // weight horizontal delta a bit less than vertical
};

// score with horizontal bias (encourages vertical stacking)
function score(dx, dy, k = 0.6) {
    return Math.hypot(dx * k, dy);
}

export function findSnapTarget(allBlocks, movingId, opts = {}) {
    const { radius, stackOverlap, branchOverlap, horizBias } = {
        ...SNAP_DEFAULTS,
        ...opts,
    };

    const me = allBlocks.find((b) => b.id === movingId);
    if (!me) return null;

    const aMe = getAnchors(me);
    let best = null;

    for (const b of allBlocks) {
        if (b.id === movingId) continue;
        const a = getAnchors(b);

        // --- Stack candidate: b.next -> me.prev
        {
            const dx = a.next.x - aMe.prev.x;
            const dy = a.next.y - aMe.prev.y;
            const within = Math.abs(dx) < radius && Math.abs(dy) < radius;
            if (within) {
                const s = score(dx, dy, horizBias);
                if (!best || s < best.s) {
                    best = {
                        kind: "stack",
                        s,
                        snapTo: a.next,
                        aboveId: b.id,
                        // final placement: center X, pull up by overlap so arrowheads tuck in
                        x: Math.round(a.next.x - me.w / 2),
                        y: Math.round(a.next.y - stackOverlap),
                    };
                }
            }
        }

        // --- IF/ELSE branches
        if (b.type === "if_else") {
            for (const branch of ["true", "false"]) {
                const target = a[branch];
                const dx = target.x - aMe.prev.x;
                const dy = target.y - aMe.prev.y;
                const within = Math.abs(dx) < radius && Math.abs(dy) < radius;
                if (within) {
                    const s = score(dx, dy, horizBias);
                    if (!best || s < best.s) {
                        best = {
                            kind: "branch",
                            s,
                            snapTo: target,
                            parentId: b.id,
                            branch,
                            x: Math.round(target.x - me.w / 2),
                            y: Math.round(target.y - branchOverlap), // usually 0
                        };
                    }
                }
            }
        }

        // --- REPEAT body
        if (b.type === "repeat_until") {
            const target = a.body;
            const dx = target.x - aMe.prev.x;
            const dy = target.y - aMe.prev.y;
            const within = Math.abs(dx) < radius && Math.abs(dy) < radius;
            if (within) {
                const s = score(dx, dy, horizBias);
                if (!best || s < best.s) {
                    best = {
                        kind: "branch",
                        s,
                        snapTo: target,
                        parentId: b.id,
                        branch: "body",
                        x: Math.round(target.x - me.w / 2),
                        y: Math.round(target.y - branchOverlap),
                    };
                }
            }
        }
    }

    return best; // {kind, x, y, ...}
}
