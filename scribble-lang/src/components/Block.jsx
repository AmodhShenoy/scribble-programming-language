// src/components/Block.jsx
import React from "react";
import { Group, Image as KImage, Rect, Text as KText } from "react-konva";
import { useBlockStore } from "../store/useBlockStore";
import { findSnap } from "../logic/snapper";
import { reflowAllIfBranchEnders } from "../logic/layout";

function useHtmlImage(src) {
    const [img, setImg] = React.useState(null);
    React.useEffect(() => {
        if (!src) return;
        const im = new window.Image();
        im.onload = () => setImg(im);
        im.src = src;
        return () => setImg(null);
    }, [src]);
    return img;
}

export default function Block(props) {
    const b = props.b ?? {
        id: props.id,
        type: props.type,
        x: props.x ?? 0,
        y: props.y ?? 0,
        w: props.w,
        h: props.h,
        inputs: props.inputs,
    };

    const img = useHtmlImage(props.assetUrl);

    const moveBlock = useBlockStore((s) => s.moveBlock);
    const selectBlock = useBlockStore((s) => s.selectBlock);
    const selectedId = useBlockStore((s) => s.selectedId);
    const edges = useBlockStore((s) => s.edges);
    const svgInfoByType = useBlockStore((s) => s.svgInfoByType);
    const registerSize = useBlockStore((s) => s.registerSize);
    const setInputValue = useBlockStore((s) => s.setInputValue);
    const variables = useBlockStore((s) => s.variables);

    const [openDropdown, setOpenDropdown] = React.useState(null);

    const info = svgInfoByType[b.type] || {};
    const vbw = info?.viewBox?.w || img?.naturalWidth || 128;
    const vbh = info?.viewBox?.h || img?.naturalHeight || 128;

    React.useEffect(() => {
        if (!b.w || !b.h || b.w !== vbw || b.h !== vbh) {
            registerSize(b.id, vbw, vbh);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [b.id, vbw, vbh]);

    const width = b.w ?? vbw;
    const height = b.h ?? vbh;
    const isSelected = selectedId === b.id;

    const sx = width / vbw;
    const sy = height / vbh;

    const slots = info?.inputs || {};
    const dropdowns = info?.dropdowns || {};

    const slotLocal = (slot) => ({
        x: slot.box.x * sx,
        y: slot.box.y * sy,
        w: slot.box.w * sx,
        h: slot.box.h * sy,
        rx: (slot.box.rx ?? 8) * Math.max(sx, sy),
    });

    const getInputConnection = (slotName) =>
        edges.find((e) => e.kind === "input" && e.from === b.id && e.meta?.port === slotName);

    // variable dropdown placement
    const isVarSetter = b.type === "set_variable";
    const isVarChanger = b.type === "change_variable";
    const wantsVarDropdown = isVarSetter || isVarChanger;

    const nameSlotRect = React.useMemo(() => {
        const src = (dropdowns && dropdowns.name) || (slots && slots.name) || null;
        if (src) return slotLocal(src);
        // (You asked to remove fallbacks for normal inputs; this fallback is only for the dropdown box
        // if an old SVG is missing it.)
        return { x: width * 0.16, y: height * 0.34, w: width * 0.30, h: Math.max(26, height * 0.18), rx: 10 };
    }, [dropdowns, slots, sx, sy, width, height]);

    const closeDropdown = () => setOpenDropdown(null);

    // ports that must be reporter-only (no typable pill)
    const logicOnlyPorts = new Set(
        b.type === "if_else"
            ? ["condition"]
            : b.type === "repeat_until"
                ? ["until"]
                : b.type === "repeat_times"
                    ? ["times"]
                    : []
    );

    return (
        <Group
            x={b.x}
            y={b.y}
            draggable={!String(b.type).startsWith("if_branch_ender")}
            onClick={(e) => {
                e.cancelBubble = true;
                selectBlock(b.id);
            }}
            onTap={(e) => {
                e.cancelBubble = true;
                selectBlock(b.id);
            }}
            onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                selectBlock(b.id);
                props.onShowContextMenu?.({ x: e.evt.clientX, y: e.evt.clientY }, b.id);
            }}
            onDragStart={(e) => {
                e.cancelBubble = true;
                closeDropdown();
                props.onBlockDragStart?.();
            }}
            onDragMove={(e) => {
                e.cancelBubble = true;
                const p = e.target.position();
                // Update only this block; do not touch stage pos/scale here
                moveBlock(b.id, p.x, p.y);
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true;

                const node = e.target;
                const stage = node.getStage();
                const scale = props.stageScale ?? (stage ? stage.scaleX() : 1);

                // read/store through zustand snapshot so we don't re-render during drag teardown
                const store = useBlockStore.getState();
                const meNow = store.blocks.find((x) => x.id === b.id);
                if (!meNow) {
                    props.onBlockDragEnd?.();
                    return;
                }

                // find candidate snap (uses latest positions already written in onDragMove)
                const snap = findSnap(
                    meNow,
                    store.blocks,
                    store.svgInfoByType,
                    scale,
                    { edges: store.edges }
                );

                if (snap) {
                    // place block at snapped position
                    const nx = meNow.x + snap.dx;
                    const ny = meNow.y + snap.dy;
                    store.moveBlock(b.id, nx, ny);

                    // connect unless it creates a cycle
                    if (!store.wouldCreateCycle(snap.target.blockId, b.id)) {
                        if (String(snap.target.port).startsWith("input:")) {
                            const port = snap.target.port.slice("input:".length);
                            store.connectInput(snap.target.blockId, port, b.id);
                        } else {
                            // "next" | "true" | "false" | "body" ...
                            store.connectEdge({
                                fromId: snap.target.blockId,
                                fromPort: snap.target.port,
                                toId: b.id,
                            });
                        }
                    }
                }

                props.onBlockDragEnd?.();

                // Reflow branch enders after the snap is committed
                requestAnimationFrame(() => {
                    try {
                        reflowAllIfBranchEnders();
                    } catch (err) {
                        console.error(err);
                    }
                });
            }}
        >
            {/* base SVG */}
            {img ? (
                <KImage image={img} width={width} height={height} />
            ) : (
                <Rect width={width} height={height} fill="#eee" stroke="#999" />
            )}

            {/* variable reporter: white text, no pill */}
            {b.type === "variable" && (() => {
                const R =
                    (slots?.name ? slotLocal(slots.name) : null) ||
                    { x: width * 0.18, y: height * 0.32, w: width * 0.64, h: Math.max(24, height * 0.24), rx: 12 };
                const name = (b.inputs && b.inputs.name) || "variable";
                return (
                    <KText
                        x={R.x + 8}
                        y={R.y + (R.h - 16) / 2}
                        width={R.w - 16}
                        text={name}
                        fontSize={14}
                        fontStyle="bold"
                        align="center"
                        fill="#fff"
                        listening={false}
                    />
                );
            })()}

            {/* typable input pills – only for slots that aren't logic-only and exist in the SVG */}
            {Object.entries(slots).map(([name, slot]) => {
                const isNameDropdownSlot = wantsVarDropdown && name === "name";
                if (isNameDropdownSlot) return null;
                if (logicOnlyPorts.has(name)) return null;

                const R = slotLocal(slot);
                const conn = getInputConnection(name);
                const typed = (b.inputs && b.inputs[name]) || "";
                const showOverlay = !conn;

                return (
                    <React.Fragment key={name}>
                        {showOverlay && (
                            <Rect
                                x={R.x}
                                y={R.y}
                                width={R.w}
                                height={R.h}
                                cornerRadius={Math.max(4, R.rx)}
                                fill="#fff"
                                stroke="rgba(0,0,0,0.35)"
                                strokeWidth={1}
                                onMouseDown={(e) => {
                                    e.cancelBubble = true;
                                }}
                                onDblClick={(e) => {
                                    e.cancelBubble = true;
                                    props.onRequestEditInput?.({
                                        blockId: b.id,
                                        port: name,
                                        worldRect: { x: b.x + R.x, y: b.y + R.y, w: R.w, h: R.h, rx: R.rx },
                                        value: typed,
                                    });
                                }}
                            />
                        )}
                        {typed && (
                            <KText
                                x={R.x + 8}
                                y={R.y + Math.max(4, (R.h - 16) / 2)}
                                text={typed}
                                fontSize={14}
                                fill="#111"
                                listening={false}
                            />
                        )}
                    </React.Fragment>
                );
            })}

            {/* variable name dropdown (set_variable / change_variable) */}
            {(isVarSetter || isVarChanger) &&
                (() => {
                    const base = nameSlotRect;
                    let R = { ...base, x: base.x };
                    if (b.type === "change_variable") R = { ...base, x: base.x + 18 };

                    const current = (b.inputs && b.inputs.name) || (variables[0]?.name ?? "choose…");

                    return (
                        <Group>
                            <Rect
                                x={R.x}
                                y={R.y}
                                width={R.w}
                                height={R.h}
                                cornerRadius={R.rx}
                                fill="#fff"
                                stroke="rgba(0,0,0,0.35)"
                                strokeWidth={1}
                                onClick={(e) => {
                                    e.cancelBubble = true;
                                    setOpenDropdown(openDropdown ? null : "name");
                                }}
                            />
                            <KText
                                x={R.x + 10}
                                y={R.y + Math.max(4, (R.h - 16) / 2)}
                                text={current}
                                fontSize={14}
                                fill="#111"
                            />
                            <KText
                                x={R.x + R.w - 18}
                                y={R.y + Math.max(2, (R.h - 14) / 2)}
                                text="▾"
                                fontSize={14}
                                fill="#555"
                            />

                            {openDropdown === "name" && (
                                <Group>
                                    <Rect
                                        x={R.x}
                                        y={R.y + R.h + 4}
                                        width={Math.max(120, R.w)}
                                        height={Math.max(28, 22 * Math.max(1, variables.length)) + 8}
                                        cornerRadius={8}
                                        fill="#202020"
                                        stroke="#3a3a3a"
                                        strokeWidth={1}
                                        shadowColor="black"
                                        shadowBlur={6}
                                        shadowOpacity={0.3}
                                    />
                                    {variables.length === 0 ? (
                                        <KText
                                            x={R.x + 10}
                                            y={R.y + R.h + 12}
                                            text="No variables"
                                            fontSize={13}
                                            fill="#bbb"
                                            listening={false}
                                        />
                                    ) : (
                                        variables.map((v, i) => (
                                            <Group
                                                key={v.id}
                                                onClick={(e) => {
                                                    e.cancelBubble = true;
                                                    setInputValue(b.id, "name", v.name);
                                                    setOpenDropdown(null);
                                                }}
                                            >
                                                <Rect
                                                    x={R.x + 4}
                                                    y={R.y + R.h + 8 + i * 22}
                                                    width={Math.max(112, R.w - 8)}
                                                    height={20}
                                                    cornerRadius={6}
                                                    fill="#2a2a2a"
                                                    stroke="rgba(255,255,255,0.06)"
                                                />
                                                <KText
                                                    x={R.x + 12}
                                                    y={R.y + R.h + 10 + i * 22}
                                                    text={v.name}
                                                    fontSize={13}
                                                    fill="#eaeaea"
                                                />
                                            </Group>
                                        ))
                                    )}
                                </Group>
                            )}
                        </Group>
                    );
                })()}

            {isSelected && (
                <Rect
                    x={-6}
                    y={-6}
                    width={width + 12}
                    height={height + 12}
                    stroke="#6ad3ff"
                    strokeWidth={2}
                    cornerRadius={8}
                    listening={false}
                />
            )}
        </Group>
    );
}
