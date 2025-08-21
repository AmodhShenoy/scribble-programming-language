// src/logic/svgInfoCache.js
// Caches per-type SVG metadata (viewBox, anchors, input slots, bodyStretch box)

const cache = new Map(); // type -> info

export function getSvgInfo(type) {
    return cache.get(type) || null;
}

/**
 * Load + parse once per type, then write into your Zustand store via setSvgInfo.
 *   type: "think", "plus_operator", ...
 *   url : "/blocks/think.svg" (served from public/)
 */
export async function ensureSvgInfo(type, url, setSvgInfo) {
    if (cache.has(type)) return cache.get(type);
    const resp = await fetch(url);
    const svgText = await resp.text();
    const info = parseSvgInfo(svgText);
    cache.set(type, info);
    if (typeof setSvgInfo === "function") setSvgInfo(type, info);
    return info;
}

// --------------------- parsing -----------------------

function parseSvgInfo(svgText) {
    // Attach once to DOM so getBBox works for paths/groups
    const holder = document.createElement("div");
    holder.style.position = "absolute";
    holder.style.left = "-100000px";
    holder.style.top = "-100000px";
    holder.innerHTML = svgText;
    document.body.appendChild(holder);

    const svg = holder.querySelector("svg");
    const info = {
        viewBox: readViewBox(svg),
        anchors: {},         // e.g. { prev:{x,y}, next:{x,y} }
        inputs: {},          // name -> { box:{x,y,w,h,rx}, anchors:{left:{x,y}, right:{x,y}} }
        bodyStretch: null,   // { box:{x,y,w,h}, fill? }
    };

    // ---- bodyStretch bbox
    const bodyEl = svg.querySelector("#bodyStretch");
    if (bodyEl) {
        const bb = bodyEl.getBBox();
        info.bodyStretch = {
            box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
            fill: bodyEl.getAttribute("fill") || undefined,
        };
    }

    // ---- plain anchors: <circle id="anchor:prev" ...> / <rect id="anchor:next" ...>
    svg.querySelectorAll("[id^='anchor:']").forEach((el) => {
        const key = el.id.split(":")[1];
        info.anchors[key] = readCenter(el);
    });

    // ---- input groups: <g id="input:value"> ... <rect id="box" .../>
    svg.querySelectorAll("g[id^='input:']").forEach((g) => {
        const name = g.id.split(":")[1];
        if (!info.inputs[name]) info.inputs[name] = { box: null, anchors: {} };

        // box: use rect's numeric attrs (works without getBBox); fallback to getBBox
        let box = null;
        const rect = g.querySelector("#box");
        if (rect) {
            const x = num(rect.getAttribute("x"));
            const y = num(rect.getAttribute("y"));
            const w = num(rect.getAttribute("width"));
            const h = num(rect.getAttribute("height"));
            const rx = rect.hasAttribute("rx") ? num(rect.getAttribute("rx")) : 0;
            if (Number.isFinite(x + y + w + h)) {
                box = { x, y, w, h, rx };
            }
        }
        if (!box) {
            const bb = g.getBBox();
            box = { x: bb.x, y: bb.y, w: bb.width, h: bb.height, rx: 0 };
        }
        info.inputs[name].box = box;

        // input anchors: circle ids "anchor-input:value-left/right"
        const left = g.querySelector(`#anchor-input\\:${cssEscape(name)}-left`);
        const right = g.querySelector(`#anchor-input\\:${cssEscape(name)}-right`);
        if (left) info.inputs[name].anchors.left = readCenter(left);
        if (right) info.inputs[name].anchors.right = readCenter(right);
    });

    // detach
    holder.remove();
    return info;
}

// --------------------- helpers -----------------------

function readViewBox(svg) {
    if (!svg) return { x: 0, y: 0, w: 0, h: 0 };
    const vb = svg.getAttribute("viewBox");
    if (vb) {
        const [x, y, w, h] = vb.split(/\s+|,/).map((n) => Number(n));
        return { x, y, w, h };
    }
    // fallback: width/height attrs
    const w = num(svg.getAttribute("width"));
    const h = num(svg.getAttribute("height"));
    return { x: 0, y: 0, w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
}

function readCenter(el) {
    if (!el) return { x: 0, y: 0 };
    if (el.tagName.toLowerCase() === "circle") {
        return { x: num(el.getAttribute("cx")), y: num(el.getAttribute("cy")) };
    }
    // rect (x,y,width,height) → center
    if (el.tagName.toLowerCase() === "rect") {
        const x = num(el.getAttribute("x"));
        const y = num(el.getAttribute("y"));
        const w = num(el.getAttribute("width"));
        const h = num(el.getAttribute("height"));
        return { x: x + w / 2, y: y + h / 2 };
    }
    // generic fallback: getBBox center
    const bb = el.getBBox();
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

// Escape ':' in querySelector
function cssEscape(name) {
    return String(name).replace(/([:\\[\\].#>+~*^$|()])/g, "\\$1");
}
