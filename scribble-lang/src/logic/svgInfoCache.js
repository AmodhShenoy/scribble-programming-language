// src/logic/svgInfoCache.js
// Cache of computed SVG metadata used for snapping & layout.
const cache = new Map();

async function fetchText(url) {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return await res.text();
}

function parseSvgInfo(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) throw new Error("No <svg> root");

    const viewBoxAttr = svg.getAttribute("viewBox");
    let vb = { x: 0, y: 0, w: 0, h: 0 };
    if (viewBoxAttr) {
        const [x, y, w, h] = viewBoxAttr.split(/\s+/).map(Number);
        vb = { x, y, w, h };
    } else {
        // fallback to width/height if no viewBox
        const w = Number(svg.getAttribute("width") || 0);
        const h = Number(svg.getAttribute("height") || 0);
        vb = { x: 0, y: 0, w, h };
    }

    // helper to get a safe bbox for a node
    const getBBox = (node) => {
        // Must be in the DOM to use getBBox; clone into a temp SVG
        const temp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        temp.setAttribute("width", vb.w || 1);
        temp.setAttribute("height", vb.h || 1);
        temp.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
        temp.style.position = "absolute";
        temp.style.left = "-99999px";
        temp.style.top = "-99999px";
        document.body.appendChild(temp);
        const clone = node.cloneNode(true);
        temp.appendChild(clone);
        const bb = clone.getBBox();
        temp.remove();
        return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    };

    // anchors: any element with id like "anchor:...".
    const anchors = {};
    doc.querySelectorAll("[id^='anchor:']").forEach((el) => {
        const id = el.getAttribute("id"); // e.g. "anchor:next"
        const name = id.slice("anchor:".length);
        const { x, y } = getBBox(el);
        // use the center of the tiny circle/path bbox
        anchors[name] = { x: x + 0, y: y + 0 };
    });

    // inputs: groups like <g id="input:a">, <g id="input:b">, etc.
    const inputs = {};
    doc.querySelectorAll("g[id^='input:']").forEach((g) => {
        const gid = g.getAttribute("id"); // e.g. "input:a"
        const key = gid.split(":")[1];    // "a"
        // IMPORTANT: accept box, box_2, box_whatever
        const boxNode = g.querySelector("[id^='box']");
        if (!boxNode) return;

        const box = getBBox(boxNode);
        // allow a rounded suggestion (Block.jsx will use rx)
        // You can refine with data-rx on the element if you want.
        const rx = 8;

        inputs[key] = {
            box: { x: box.x, y: box.y, w: box.w, h: box.h, rx },
        };
    });

    return {
        viewBox: { w: vb.w, h: vb.h },
        anchors,
        inputs,
        dropdowns: {}, // unchanged, keep if you use it elsewhere
    };
}

export async function ensureSvgInfo(type, url, setSvgInfo) {
    if (cache.has(type)) return cache.get(type);
    const svgText = await fetchText(url);
    const info = parseSvgInfo(svgText);
    cache.set(type, info);
    setSvgInfo(type, info);
    return info;
}
