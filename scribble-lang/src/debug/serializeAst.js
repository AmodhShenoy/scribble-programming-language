// src/debug/serializeAst.js
export function serializeAst(ast) {
    const out = { entry: ast.entry || null, nodes: {} };
    ast.nodes.forEach((n, id) => {
        out.nodes[id] = {
            id,
            type: n.type,
            next: n.next ? n.next.id : null,
            branches: {
                true: n.branches?.true ? n.branches.true.id : null,
                false: n.branches?.false ? n.branches.false.id : null,
                body: n.branches?.body ? n.branches.body.id : null,
            },
            inputs: Object.fromEntries(
                Object.entries(n.inputs || {}).map(([k, v]) => {
                    if (v && typeof v === "object" && v.kind === "ref") {
                        return [k, { ref: v.blockId }];
                    }
                    // literal or plain value
                    const val = v && typeof v === "object" && "value" in v ? v.value : v;
                    return [k, { lit: val }];
                })
            ),
        };
    });
    return out;
}
