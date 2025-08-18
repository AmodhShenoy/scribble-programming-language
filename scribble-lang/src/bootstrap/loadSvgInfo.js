// Preload SVG metadata (anchors, tip height) for snapping — using public/blocks URLs
import { ensureSvgInfo } from "../logic/svgInfoCache";
import { useBlockStore } from "../store/useBlockStore";

export const ASSET_URLS = {
    start: "/blocks/start.svg",
    stop: "/blocks/stop.svg",
    say: "/blocks/say.svg",
    think: "/blocks/think.svg",
    repeat_until: "/blocks/repeat_until.svg",
    repeat_times: "/blocks/repeat_times.svg",
    repeat_loop_ender: "/blocks/repeat_loop_ender.svg",
    if_else: "/blocks/if_else.svg",
    if_branch_ender: "/blocks/if_branch_ender.svg",
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
    lt_operator: "/blocks/lt_operator.svg",
    et_operator: "/blocks/et_operator.svg",
    and_operator: "/blocks/and_operator.svg",
    or_operator: "/blocks/or_operator.svg",
    not_operator: "/blocks/not_operator.svg",
};

export function getAssetUrl(type) {
    return ASSET_URLS[type];
}

export async function preloadSvgInfo() {
    const setSvgInfo = useBlockStore.getState().setSvgInfo;
    await Promise.all(
        Object.entries(ASSET_URLS).map(([type, url]) =>
            ensureSvgInfo(type, url, setSvgInfo)
        )
    );
}
