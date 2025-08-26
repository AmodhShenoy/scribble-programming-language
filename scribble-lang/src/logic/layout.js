// src/logic/layout.js
//
// Thin pass-through to reflow helpers. Also purges legacy base-type enders.

import { useBlockStore } from "../store/useBlockStore";
import {
    ensureIfBranchEnderOnCreate,
    onIfBranchChildSnap,
    reflowAllIfBranchEnders as _reflowAllIfBranchEnders,
} from "./branchEnders";

import {
    ensureInitialRepeatEnder,
    onRepeatFalseChildSnap,
    reflowAllRepeatEnders as _reflowAllRepeatEnders,
} from "./repeatEnders";

function purgeLegacyBaseTypes() {
    const s = useBlockStore.getState();
    const stale = s.blocks.filter(
        (b) => b.type === "if_branch_ender" || b.type === "repeat_loop_ender"
    );
    if (stale.length) {
        console.log("[layout] purge legacy enders:", stale.map((b) => b.type + ":" + b.id));
        stale.forEach((b) => s.removeBlock(b.id));
    }
}

export function reflowAllIfBranchEnders() {
    purgeLegacyBaseTypes();
    _reflowAllIfBranchEnders();
}

export function reflowAllRepeatEnders() {
    purgeLegacyBaseTypes();
    _reflowAllRepeatEnders();
}

// Re-export the create/on-snap helpers so other files can import from layout if they already do.
export {
    ensureIfBranchEnderOnCreate,
    onIfBranchChildSnap,
    ensureInitialRepeatEnder,
    onRepeatFalseChildSnap,
};
