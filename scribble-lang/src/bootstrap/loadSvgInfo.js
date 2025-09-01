// src/bootstrap/loadSvgInfo.js
// Preload SVG metadata (anchors, inputs, viewBox…) for snapping — served from public/blocks
import { ensureSvgInfo } from "../logic/svgInfoCache";
import { useBlockStore } from "../store/useBlockStore";

/**
 * RUNTIME (on-canvas) SVGs
 * These are the ones we parse for anchors, inputs, etc.
 * Keep this list as your source of truth for block *types*.
 */
export const ASSET_URLS = {
    // event
    start: "/blocks/start.svg",
    stop: "/blocks/stop.svg",

    // action
    say: "/blocks/say.svg",
    think: "/blocks/think.svg",
    wait: "/blocks/wait.svg",
    clear: "/blocks/clear.svg",

    // motion
    go_to: "/blocks/go_to.svg",
    move: "/blocks/move.svg",
    change_x_by: "/blocks/change_x_by.svg",
    change_y_by: "/blocks/change_y_by.svg",
    turn_clockwise: "/blocks/turn_clockwise.svg",
    turn_anticlockwise: "/blocks/turn_anticlockwise.svg",
    point_in: "/blocks/point_in.svg",

    // control
    if_else: "/blocks/if_else.svg",
    repeat_until: "/blocks/repeat_until.svg",
    repeat_times: "/blocks/repeat_times.svg",

    // loop/branch enders (internal visuals only; not shown in palette)
    repeat_loop_ender_0: "/blocks/repeat_loop_ender_0.svg",
    repeat_loop_ender_1: "/blocks/repeat_loop_ender_1.svg",
    repeat_loop_ender_2: "/blocks/repeat_loop_ender_2.svg",
    repeat_loop_ender_3: "/blocks/repeat_loop_ender_3.svg",
    if_branch_ender_0: "/blocks/if_branch_ender_0.svg",
    if_branch_ender_1: "/blocks/if_branch_ender_1.svg",
    if_branch_ender_2: "/blocks/if_branch_ender_2.svg",
    if_branch_ender_3: "/blocks/if_branch_ender_3.svg",
    if_branch_ender_4: "/blocks/if_branch_ender_4.svg",

    // variables
    set_variable: "/blocks/set_variable.svg",
    change_variable: "/blocks/change_variable.svg",
    variable: "/blocks/variable.svg",

    // operators
    plus_operator: "/blocks/plus_operator.svg",
    minus_operator: "/blocks/minus_operator.svg",
    multiply_operator: "/blocks/multiply_operator.svg",
    divide_operator: "/blocks/divide_operator.svg",
    mod_operator: "/blocks/mod_operator.svg",
    gt_operator: "/blocks/gt_operator.svg",
    gte_operator: "/blocks/gte_operator.svg",
    lt_operator: "/blocks/lt_operator.svg",
    lte_operator: "/blocks/lte_operator.svg",
    eq_operator: "/blocks/eq_operator.svg",
    neq_operator: "/blocks/neq_operator.svg",
    and_operator: "/blocks/and_operator.svg",
    or_operator: "/blocks/or_operator.svg",
    not_operator: "/blocks/not_operator.svg",
    et_operator: "/blocks/et_operator.svg",
};

/**
 * PALETTE (menu) art — what you see in the left menu only.
 * If a specific *_menu.svg doesn’t exist for a type, we fall back to the runtime art.
 */
export const MENU_ASSET_URLS = Object.fromEntries(
    Object.keys(ASSET_URLS).map((t) => {
        // internal enders shouldn’t appear in the palette anyway
        if (t.startsWith("if_branch_ender") || t.startsWith("repeat_loop_ender")) {
            return [t, ASSET_URLS[t]];
        }
        return [t, `/blocks/${t}_menu.svg`];
    })
);

/**
 * Category mapping used by the palette to group tiles visually.
 * Any type not listed falls back to "action".
 */
export const CATEGORY_BY_TYPE = {
    // event
    start: "event",
    stop: "event",

    // action
    say: "action",
    think: "action",
    clear: "action",

    // motion
    go_to: "motion",
    move: "motion",
    change_x_by: "motion",
    change_y_by: "motion",
    turn_clockwise: "motion",
    turn_anticlockwise: "motion",
    point_in: "motion",

    // control
    if_else: "control",
    repeat_until: "control",
    repeat_times: "control",
    wait: "control",

    // variables
    set_variable: "variable",
    change_variable: "variable",
    variable: "variable",

    // operators
    plus_operator: "operator",
    minus_operator: "operator",
    multiply_operator: "operator",
    divide_operator: "operator",
    mod_operator: "operator",
    gt_operator: "operator",
    gte_operator: "operator",
    lt_operator: "operator",
    lte_operator: "operator",
    eq_operator: "operator",
    neq_operator: "operator",
    and_operator: "operator",
    or_operator: "operator",
    not_operator: "operator",
    et_operator: "operator",
};

export function getAssetUrl(type) {
    return ASSET_URLS[type] || `/blocks/${type}.svg`;
}

export function getMenuAssetUrl(type) {
    // fall back to runtime asset if a *_menu.svg is not present
    return MENU_ASSET_URLS[type] || ASSET_URLS[type] || `/blocks/${type}.svg`;
}

/**
 * Simple synchronous getter used by renderers/snapper.
 * Returns whatever is currently cached in the store (or null if not loaded yet).
 */
export function getSvgInfo(type) {
    return useBlockStore.getState().svgInfoByType[type] || null;
}

/**
 * Preload all RUNTIME SVG infos at boot (recommended so getSvgInfo() is filled).
 * We only preload runtime art (anchors/inputs), not the menu art.
 */
export async function preloadSvgInfo() {
    const setSvgInfo = useBlockStore.getState().setSvgInfo;
    await Promise.all(
        Object.entries(ASSET_URLS).map(([type, url]) =>
            ensureSvgInfo(type, url, setSvgInfo)
        )
    );
}

/**
 * Optional helper if you want to lazily ensure a single type is loaded.
 */
export async function ensureOneSvgInfo(type) {
    const url = ASSET_URLS[type];
    if (!url) return null;
    const setSvgInfo = useBlockStore.getState().setSvgInfo;
    return ensureSvgInfo(type, url, setSvgInfo);
}
