// src/bootstrap/loadSvgInfo.js
// Preload SVG metadata (anchors, inputs, viewBox…) for snapping — served from public/blocks
import { ensureSvgInfo } from "../logic/svgInfoCache";
import { useBlockStore } from "../store/useBlockStore";

export const ASSET_URLS = {
    start: "/blocks/start.svg",
    stop: "/blocks/stop.svg",
    say: "/blocks/say.svg",
    think: "/blocks/think.svg",
    repeat_until: "/blocks/repeat_until.svg",
    repeat_times: "/blocks/repeat_times.svg",
    // if + enders
    if_else: "/blocks/if_else.svg",
    if_branch_ender_0: "/blocks/if_branch_ender_0.svg",
    if_branch_ender_1: "/blocks/if_branch_ender_1.svg",
    if_branch_ender_2: "/blocks/if_branch_ender_2.svg",
    if_branch_ender_3: "/blocks/if_branch_ender_3.svg",
    if_branch_ender_4: "/blocks/if_branch_ender_4.svg",

    // repeat + enders
    repeat_until: "/blocks/repeat_until.svg",
    repeat_times: "/blocks/repeat_times.svg",
    repeat_loop_ender_0: "/blocks/repeat_loop_ender_0.svg",
    repeat_loop_ender_1: "/blocks/repeat_loop_ender_1.svg",
    repeat_loop_ender_2: "/blocks/repeat_loop_ender_2.svg",
    repeat_loop_ender_3: "/blocks/repeat_loop_ender_3.svg",
    repeat_loop_ender_4: "/blocks/repeat_loop_ender_4.svg",
    repeat_loop_ender_5: "/blocks/repeat_loop_ender_5.svg",
    repeat_loop_ender_6: "/blocks/repeat_loop_ender_6.svg",
    repeat_loop_ender_7: "/blocks/repeat_loop_ender_7.svg",
    go_to: "/blocks/go_to.svg",
    move: "/blocks/move.svg",
    change_x_by: "/blocks/change_x_by.svg",
    change_y_by: "/blocks/change_y_by.svg",
    clear: "/blocks/clear.svg",
    wait: "/blocks/wait.svg",
    turn_clockwise: "/blocks/turn_clockwise.svg",
    turn_anticlockwise: "/blocks/turn_anticlockwise.svg",
    point_in: "/blocks/point_in.svg",
    set_variable: "/blocks/set_variable.svg",
    change_variable: "/blocks/change_variable.svg",
    variable: "/blocks/variable.svg",
    plus_operator: "/blocks/plus_operator.svg",
    minus_operator: "/blocks/minus_operator.svg",
    multiply_operator: "/blocks/multiply_operator.svg",
    divide_operator: "/blocks/divide_operator.svg",
    mod_operator: "/blocks/mod_operator.svg",
    gt_operator: "/blocks/gt_operator.svg",
    gte_operator: "/blocks/gte_operator.svg",
    lt_operator: "/blocks/lt_operator.svg",
    lte_operator: "/blocks/lte_operator.svg",
    et_operator: "/blocks/et_operator.svg",
    and_operator: "/blocks/and_operator.svg",
    or_operator: "/blocks/or_operator.svg",
    not_operator: "/blocks/not_operator.svg",
};

export function getAssetUrl(type) {
    return ASSET_URLS[type];
}

/**
 * Simple synchronous getter used by renderers/snapper.
 * Returns whatever is currently cached in the store (or null if not loaded yet).
 */
export function getSvgInfo(type) {
    return useBlockStore.getState().svgInfoByType[type] || null;
}

/**
 * Preload all SVG infos at boot (recommended so getSvgInfo() is filled).
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
