// src/logic/interpreter.js

// Input atoms
const lit = (v) => ({ kind: "lit", value: v });
const isRef = (x) => x && typeof x === "object" && x.kind === "ref";

// ---- Expression evaluation -----------------------------------------------

function evalExpr(expr, ctx) {
    if (expr == null) return null;
    if (!isRef(expr)) return expr.value ?? expr; // literal or plain value
    const node = ctx.ast.nodes.get(expr.blockId);
    if (!node) return null;
    return evalNodeExpr(node, ctx);
}

function num(x) { return Number(x ?? 0); }
function bool(x) { return Boolean(x); }
function str(x) { return String(x ?? ""); }

function evalNodeExpr(node, ctx) {
    const { vars } = ctx.state;

    switch (node.type) {
        // value/reporters
        case "variable": {
            const name = str(evalExpr(node.inputs?.name, ctx));
            return vars[name] ?? 0;
        }
        case "plus_operator": {
            const a = evalExpr(node.inputs?.a, ctx);
            const b = evalExpr(node.inputs?.b, ctx);
            return addOp(a, b);
        }
        case "minus_operator": return num(evalExpr(node.inputs?.a, ctx)) - num(evalExpr(node.inputs?.b, ctx));
        case "multiply_operator": return num(evalExpr(node.inputs?.a, ctx)) * num(evalExpr(node.inputs?.b, ctx));
        case "divide_operator": return num(evalExpr(node.inputs?.a, ctx)) / num(evalExpr(node.inputs?.b, ctx));
        case "mod_operator": return num(evalExpr(node.inputs?.a, ctx)) % num(evalExpr(node.inputs?.b, ctx));
        case "gt_operator": return num(evalExpr(node.inputs?.a, ctx)) > num(evalExpr(node.inputs?.b, ctx));
        case "lt_operator": return num(evalExpr(node.inputs?.a, ctx)) < num(evalExpr(node.inputs?.b, ctx));
        case "et_operator": return evalExpr(node.inputs?.a, ctx) == evalExpr(node.inputs?.b, ctx);
        case "and_operator": return bool(evalExpr(node.inputs?.a, ctx)) && bool(evalExpr(node.inputs?.b, ctx));
        case "or_operator": return bool(evalExpr(node.inputs?.a, ctx)) || bool(evalExpr(node.inputs?.b, ctx));
        case "not_operator": return !bool(evalExpr(node.inputs?.a, ctx));

        // You can add more reporter types here (distance_to, pick_random, etc.)
        default:
            return null;
    }
}

function addOp(a, b) {
    const na = Number(a);
    const nb = Number(b);
    const an = Number.isFinite(na);
    const bn = Number.isFinite(nb);
    if (an && bn) return na + nb;              // numeric add
    return String(a ?? "") + String(b ?? "");  // fallback: concat
}

// ---- Step-wise interpreter ------------------------------------------------

export class Interpreter {
    constructor(ast, opts = {}) {
        this.ast = ast;
        this.onHighlight = opts.onHighlight || (() => { });
        this.onOutput = opts.onOutput || ((text, kind = "say") => console.log(`[${kind}]`, text));
        this.onState = opts.onState || (() => { });
        this.maxSteps = opts.maxSteps ?? 10000;
        this.ticksPerSecond = opts.ticksPerSecond ?? 60; // for "wait"
        this.debug = !!opts.debug;

        this.state = {
            halted: false,
            vars: Object.create(null),
            sprite: { x: 0, y: 0, heading: 90 }, // Scratch-style: 90=up, 0=right
            outputs: [],
        };

        this.current = ast.entry || null;
        this.stack = []; // control frames
        this.waiting = null; // { nodeId, ticksRemaining }
    }

    // Scratch-like heading to dx,dy (y down positive → invert sin)
    #moveForward(steps) {
        const rad = (this.state.sprite.heading * Math.PI) / 180;
        this.state.sprite.x += Math.cos(rad) * steps;
        this.state.sprite.y -= Math.sin(rad) * steps;
    }

    step() {
        if (this.state.halted || !this.current) {
            this.state.halted = true;
            this.onState(this.state);
            return { done: true };
        }

        // Handle waits: keep highlighting same node until countdown finishes
        if (this.waiting) {
            this.onHighlight(this.waiting.nodeId);
            this.waiting.ticksRemaining -= 1;

            if (this.waiting.ticksRemaining > 0) {
                return { done: false, waiting: true };
            }

            // finished waiting → move off the wait node
            const finishedId = this.waiting.nodeId;
            this.waiting = null;

            const finishedNode = this.ast.nodes.get(finishedId);
            this.current = (finishedNode && finishedNode.next) ? finishedNode.next : this.popToNext();
            this.onState(this.state);
            return { done: false };
        }

        const node = this.current;
        this.onHighlight(node.id);

        switch (node.type) {
            case "start": {
                this.current = node.next || this.popToNext();
                break;
            }

            case "stop": {
                this.state.halted = true;
                break;
            }

            // ---------- Display ----------
            case "say": {
                const text = str(evalExpr(node.inputs?.text ?? lit(""), this));
                this.state.outputs.push({ kind: "say", text });
                this.onOutput(text, "say");
                this.current = node.next || this.popToNext();
                break;
            }
            case "think": {
                const text = str(evalExpr(node.inputs?.text ?? lit(""), this));
                this.state.outputs.push({ kind: "think", text });
                this.onOutput(text, "think");
                this.current = node.next || this.popToNext();
                break;
            }
            case "clear": {
                this.state.outputs = [];
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }

            // ---------- Motion ----------
            case "go_to": {
                const x = num(evalExpr(node.inputs?.x, this));
                const y = num(evalExpr(node.inputs?.y, this));
                this.state.sprite.x = x; this.state.sprite.y = y;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "move": {
                const steps = num(evalExpr(node.inputs?.steps, this));
                this.#moveForward(steps);
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "change_x_by": {
                const dx = num(evalExpr(node.inputs?.dx, this));
                this.state.sprite.x += dx;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "change_y_by": {
                const dy = num(evalExpr(node.inputs?.dy, this));
                this.state.sprite.y += dy;   // screen y+ is down; fine for now
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "turn_clockwise": {
                const deg = num(evalExpr(node.inputs?.degrees, this));
                this.state.sprite.heading = (this.state.sprite.heading + deg) % 360;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "turn_anticlockwise": {
                const deg = num(evalExpr(node.inputs?.degrees, this));
                this.state.sprite.heading = (this.state.sprite.heading - deg) % 360;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "point_in": { // "point in direction"
                const deg = num(evalExpr(node.inputs?.degrees, this));
                this.state.sprite.heading = deg % 360;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }

            // ---------- Variables ----------
            case "set_variable": {
                const name = String(evalExpr(node.inputs?.name, this));
                const value = evalExpr(node.inputs?.value, this);
                this.state.vars[name] = value;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }
            case "change_variable": {
                const name = String(evalExpr(node.inputs?.name, this));
                const delta = num(evalExpr(node.inputs?.delta, this));
                this.state.vars[name] = (this.state.vars[name] ?? 0) + delta;
                this.onState(this.state);
                this.current = node.next || this.popToNext();
                break;
            }

            // ---------- Control ----------
            case "wait": {
                const seconds = num(evalExpr(node.inputs?.seconds, this));
                const ticks = Math.max(1, Math.round(seconds * this.ticksPerSecond));
                this.waiting = { nodeId: node.id, ticksRemaining: ticks };
                // keep current on this node until countdown finishes
                break;
            }

            case "if_else": {
                const cond = bool(evalExpr(node.inputs?.condition, this));
                this.stack.push({ type: "if", retNext: node.next });
                const head = cond ? node.branches.true : node.branches.false;
                this.current = head || this.popToNext();
                break;
            }

            case "repeat_times": {
                const times = Math.max(0, Math.floor(num(evalExpr(node.inputs?.times, this))));
                this.stack.push({
                    type: "repeat_times",
                    remaining: times,
                    body: node.branches.body || node.branches.true,
                    retNext: node.next,
                });
                this.current = this.enterRepeatTimes();
                break;
            }

            case "repeat_until": {
                // Execute body until "until" becomes true
                this.stack.push({
                    type: "repeat_until",
                    cond: node.inputs?.until,
                    body: node.branches.body || node.branches.true,
                    retNext: node.next,
                });
                this.current = this.enterRepeatUntil();
                break;
            }

            // Visual-only/ender blocks: treat as no-ops
            case "repeat_loop_ender":
            case "if_branch_ender": {
                this.current = node.next || this.popToNext();
                break;
            }

            default: {
                // Unknown block: no-op
                this.current = node.next || this.popToNext();
            }
        }

        const done = !!this.state.halted;
        if (done) this.onState(this.state);
        return { done };
    }

    // ---- loop helpers
    enterRepeatTimes() {
        const f = this.stack[this.stack.length - 1];
        if (!f || f.type !== "repeat_times") return null;
        if (f.remaining <= 0) {
            this.stack.pop();
            return f.retNext || this.popToNext();
        }
        f.remaining -= 1;
        return f.body || (f.retNext || this.popToNext());
    }

    enterRepeatUntil() {
        const f = this.stack[this.stack.length - 1];
        if (!f || f.type !== "repeat_until") return null;
        const condVal = bool(evalExpr(f.cond, this));
        if (condVal) {
            this.stack.pop();
            return f.retNext || this.popToNext();
        }
        return f.body || (f.retNext || this.popToNext());
    }

    // When a branch finishes (no 'next'), resume the parent frame
    popToNext() {
        while (this.stack.length) {
            const f = this.stack[this.stack.length - 1];
            if (f.type === "if") {
                this.stack.pop();
                return f.retNext || null;
            }
            if (f.type === "repeat_times") return this.enterRepeatTimes();
            if (f.type === "repeat_until") return this.enterRepeatUntil();
            this.stack.pop();
        }
        return null;
    }

    // Run to completion (synchronous). If you use "wait", prefer manual stepping.
    run(maxSteps = this.maxSteps) {
        let steps = 0;
        while (!this.state.halted && steps < maxSteps) {
            this.step();
            steps++;
        }
        return this.state;
    }
}
