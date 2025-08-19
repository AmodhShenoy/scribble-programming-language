// src/logic/svgInfoCache.js
// Caches: viewBox, anchors, tipHeight, inputs (per block type)
const cache = new Map();

function parseViewBox(svgEl) {
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
        const [x, y, w, h] = vb.split(/\s+/).map(Number);
        return { x, y, w, h };
    }
    return {
        x: 0,
        y: 0,
        w: Number(svgEl.getAttribute("width") || 0),
        h: Number(svgEl.getAttribute("height") || 0),
    };
}

function mountForBBox(templateSvgEl, node) {
    // need a live <svg> to call getBBox
    const tmpSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tmpSvg.setAttribute(
        "viewBox",
        templateSvgEl.getAttribute("viewBox") ||
        `0 0 ${templateSvgEl.getAttribute("width") || 0} ${templateSvgEl.getAttribute("height") || 0}`
    );
    tmpSvg.style.position = "absolute";
    tmpSvg.style.left = "-10000px";
    tmpSvg.style.top = "-10000px";
    document.body.appendChild(tmpSvg);
    const clone = node.cloneNode(true);
    tmpSvg.appendChild(clone);
    const bbox = clone.getBBox();
    tmpSvg.remove();
    return bbox;
}

function parseAnchorsInputsTip(doc) {
    const svg = doc.querySelector("svg");
    const viewBox = parseViewBox(svg);

    // anchors
    const anchors = {};
    doc.querySelectorAll("[id^='anchor:']").forEach((el) => {
        const name = el.id.split(":")[1];
        let x = 0,
            y = 0;
        const tag = el.tagName.toLowerCase();
        if (tag === "circle" || tag === "ellipse") {
            x = Number(el.getAttribute("cx") || 0);
            y = Number(el.getAttribute("cy") || 0);
        } else if (tag === "rect") {
            const rx = Number(el.getAttribute("x") || 0);
            const ry = Number(el.getAttribute("y") || 0);
            const rw = Number(el.getAttribute("width") || 0);
            const rh = Number(el.getAttribute("height") || 0);
            x = rx + rw / 2;
            y = ry + rh / 2;
        } else {
            const b = mountForBBox(svg, el);
            x = b.x + b.width / 2;
            y = b.y + b.height / 2;
        }
        anchors[name] = { x, y };
    });

    // tip height (#arrowHead > #tip)
    let tipHeight = 0;
    const tip = doc.querySelector("#arrowHead #tip");
    if (tip) {
        const b = mountForBBox(svg, tip);
        tipHeight = b.height || 0;
    }

    // inputs: <g id="input:<name>"> with a child <rect id="box"> (opacity 0–1)
    // optional anchors inside the group:
    //   <circle id="anchor-input:<name>-left"> / "-right">
    const inputs = {};
    doc.querySelectorAll("g[id^='input:']").forEach((g) => {
        const name = g.id.split(":")[1];
        const box = g.querySelector("#box, rect#box");
        if (!box) return;
        const x = Number(box.getAttribute("x") || 0);
        const y = Number(box.getAttribute("y") || 0);
        const w = Number(box.getAttribute("width") || 0);
        const h = Number(box.getAttribute("height") || 0);
        const rx = Number(box.getAttribute("rx") || 0);

        const leftEl = g.querySelector(`[id="anchor-input:${name}-left"]`);
        const rightEl = g.querySelector(`[id="anchor-input:${name}-right"]`);
        const toPt = (el) => {
            if (!el) return null;
            const tag = el.tagName.toLowerCase();
            if (tag === "circle") {
                return { x: Number(el.getAttribute("cx") || 0), y: Number(el.getAttribute("cy") || 0) };
            }
            if (tag === "rect") {
                const rx = Number(el.getAttribute("x") || 0);
                const ry = Number(el.getAttribute("y") || 0);
                const rw = Number(el.getAttribute("width") || 0);
                const rh = Number(el.getAttribute("height") || 0);
                return { x: rx + rw / 2, y: ry + rh / 2 };
            }
            const b = mountForBBox(svg, el);
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        };

        inputs[name] = {
            box: { x, y, w, h, rx },
            anchors: {
                left: leftEl ? toPt(leftEl) : { x, y: y + h / 2 },
                right: rightEl ? toPt(rightEl) : { x: x + w, y: y + h / 2 },
            },
        };
    });

    return { viewBox, anchors, tipHeight, inputs };
}

export async function ensureSvgInfo(type, url, setSvgInfo) {
    if (cache.has(type)) return cache.get(type);
    const res = await fetch(url);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const info = parseAnchorsInputsTip(doc);
    cache.set(type, info);
    if (typeof setSvgInfo === "function") setSvgInfo(type, info);
    return info;
}

export function getSvgInfo(type) {
    return cache.get(type) || null;
}
