// src/dev/test-interpreter.mjs
import { buildAST } from "../logic/astBuilder.js";
import { Interpreter } from "../logic/interpreter.js";

const lit = (v) => ({ kind: "lit", value: v });
const ref = (id) => ({ kind: "ref", blockId: id });

// Demo program:
// start
//   set i = 0
//   repeat_times (3) {
//     say("i=" + i)
//     change i by 1
//   }
//   if (i > 2) {
//     think("gt 2")
//   } else {
//     say("not gt 2")
//   }
//   point_in 0; move 10; turn_clockwise 90; move 10
//   wait 0.05   (interpreted as ~3 ticks if 60 tps)
//   say("done")
// stop

const blocks = [
    { id: "start1", type: "start" },
    { id: "setI", type: "set_variable", inputs: { name: lit("i"), value: lit(0) } },
    { id: "rep", type: "repeat_times", inputs: { times: lit(3) } },
    { id: "sayI", type: "say", inputs: { text: ref("plus") } },
    { id: "plus", type: "plus_operator", inputs: { a: lit("i="), b: ref("iVar") } },
    { id: "iVar", type: "variable", inputs: { name: lit("i") } },
    { id: "incI", type: "change_variable", inputs: { name: lit("i"), delta: lit(1) } },

    { id: "if1", type: "if_else", inputs: { condition: ref("gt") } },
    { id: "gt", type: "gt_operator", inputs: { a: ref("iVar"), b: lit(2) } },
    { id: "think1", type: "think", inputs: { text: lit("gt 2") } },
    { id: "sayNo", type: "say", inputs: { text: lit("not gt 2") } },

    { id: "motion1", type: "point_in", inputs: { degrees: lit(0) } },
    { id: "move1", type: "move", inputs: { steps: lit(10) } },
    { id: "turn1", type: "turn_clockwise", inputs: { degrees: lit(90) } },
    { id: "move2", type: "move", inputs: { steps: lit(10) } },

    { id: "wait1", type: "wait", inputs: { seconds: lit(0.05) } },
    { id: "sayDone", type: "say", inputs: { text: lit("done") } },
    { id: "stop1", type: "stop" },
];

const edges = [
    { kind: "stack", from: "start1", to: "setI" },
    { kind: "stack", from: "setI", to: "rep" },
    { kind: "stack", from: "rep", to: "if1" },

    { kind: "branch", from: "rep", to: "sayI", meta: { branch: "body" } },
    { kind: "stack", from: "sayI", to: "incI" },
    // body returns to header after incI

    { kind: "stack", from: "if1", to: "motion1" },
    { kind: "branch", from: "if1", to: "think1", meta: { branch: "true" } },
    { kind: "branch", from: "if1", to: "sayNo", meta: { branch: "false" } },

    { kind: "stack", from: "motion1", to: "move1" },
    { kind: "stack", from: "move1", to: "turn1" },
    { kind: "stack", from: "turn1", to: "move2" },
    { kind: "stack", from: "move2", to: "wait1" },
    { kind: "stack", from: "wait1", to: "sayDone" },
    { kind: "stack", from: "sayDone", to: "stop1" },
];

const ast = buildAST(blocks, edges);

const interp = new Interpreter(ast, {
    onHighlight: (id) => console.log("[highlight]", id),
    onOutput: (text, kind) => console.log(`[${kind}]`, text),
    onState: (s) => { }, // hook for UI
    ticksPerSecond: 60,
});

// Step mode (so you can see the waits & highlights)
console.log("== step mode ==");
for (let i = 0; i < 200 && !interp.state.halted; i++) {
    const { done, waiting } = interp.step();
    if (done) break;
    if (waiting) {
        // simulate a little "time" passing: keep stepping
    }
}

console.log("vars:", interp.state.vars);
console.log("sprite:", interp.state.sprite);
console.log("outputs:", interp.state.outputs);
