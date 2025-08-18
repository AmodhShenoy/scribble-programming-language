// src/logic/svgInfoCache.js
// Minimal parser: viewBox, anchors, tipHeight (arrow overlap).
// Call ensureSvgInfo(type, url) once per block type at app start.

const cache = new Map();

function parseViewBox(svgEl) {
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
        const [x, y, w, h] = vb.split(/\s+/).map(Number);
        return { x, y, w, h };
    }
    // fallback to width/height if no viewBox
    return {
        x: 0,
        y: 0,
        w: Number(svgEl.getAttribute("width") || 0),
        h: Number(svgEl.getAttribute("height") || 0),
    };
}

function getBBoxInDoc(node, svgForBBox) {
    // Must be in a live <svg> to use getBBox()
    const clone = node.cloneNode(true);
    svgForBBox.appendChild(clone);
    const b = clone.getBBox();
    svgForBBox.removeChild(clone);
    return b;
}

function parseAnchorsAndTip(doc) {
    const svg = doc.querySelector("svg");
    const viewBox = parseViewBox(svg);

    const anchors = {};
    // Any element id starting with "anchor:"
    doc.querySelectorAll("[id^='anchor:']").forEach(el => {
        const id = el.id; // e.g., "anchor:next"
        const name = id.split(":")[1]; // next | prev | body | true | false | ...
        const tag = el.tagName.toLowerCase();
        let x = 0, y = 0;

        if (tag === "circle" || tag === "ellipse") {
            x = Number(el.getAttribute("cx") || 0);
            y = Number(el.getAttribute("cy") || 0);
        } else if (tag === "rect") {
            // use rect center if someone used rect anchors
            const rx = Number(el.getAttribute("x") || 0);
            const ry = Number(el.getAttribute("y") || 0);
            const rw = Number(el.getAttribute("width") || 0);
            const rh = Number(el.getAttribute("height") || 0);
            x = rx + rw / 2; y = ry + rh / 2;
        } else {
            // fallback to getBBox center
            const tmpSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            tmpSvg.setAttribute("viewBox", svg.getAttribute("viewBox") || `0 0 ${viewBox.w} ${viewBox.h}`);
            tmpSvg.style.position = "absolute"; tmpSvg.style.left = "-10000px"; tmpSvg.style.top = "-10000px";
            document.body.appendChild(tmpSvg);
            const b = getBBoxInDoc(el, tmpSvg);
            document.body.removeChild(tmpSvg);
            x = b.x + b.width / 2; y = b.y + b.height / 2;
        }

        anchors[name] = { x, y };
    });

    // tipHeight = bbox height of #arrowHead > #tip
    let tipHeight = 0;
    const tip = doc.querySelector("#arrowHead #tip");
    if (tip) {
        const tmpSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        tmpSvg.setAttribute("viewBox", svg.getAttribute("viewBox") || `0 0 ${viewBox.w} ${viewBox.h}`);
        tmpSvg.style.position = "absolute"; tmpSvg.style.left = "-10000px"; tmpSvg.style.top = "-10000px";
        document.body.appendChild(tmpSvg);
        const b = getBBoxInDoc(tip, tmpSvg);
        document.body.removeChild(tmpSvg);
        tipHeight = b.height || 0; // e.g., 34
    }

    return { viewBox, anchors, tipHeight };
}

export async function ensureSvgInfo(type, url, setSvgInfo) {
    if (cache.has(type)) return cache.get(type);
    const res = await fetch(url);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const info = parseAnchorsAndTip(doc);
    cache.set(type, info);
    // Optionally push into store
    if (typeof setSvgInfo === "function") setSvgInfo(type, info);
    return info;
}

// Expose cache for testing
export function getSvgInfo(type) {
    return cache.get(type) || null;
}
