import { Component, createEffect, createMemo, createSignal, Show, For, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { GraphNode, CommitGraphData } from '../lib/types';

const COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#818cf8', '#2dd4bf', '#fb923c', '#e879f9', '#38bdf8', '#a3e635',
];

const H_SPACE = 28;
const V_SPACE = 52;
const NODE_R = 5;
const CORNER_R = 10;
const MARGIN_LEFT = 24;
const MARGIN_TOP = 40;
const GRAPH_RIGHT_PAD = 10;
const DASH_LEN = 20;
const INFO_GAP = 6;
const INFO_HEIGHT = 42;

interface CommitGraphProps {
  graphData: CommitGraphData;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  repoPath?: string;
  onCheckout?: (commitId: string) => void;
  onCreateBranch?: (commitId: string) => void;
  onCherryPick?: (commitId: string) => void;
  onCreatePullRequest?: (commitId: string) => void;
}

const CommitGraph: Component<CommitGraphProps> = (props) => {
  let canvasRef!: HTMLCanvasElement;
  let containerRef!: HTMLDivElement;

  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [hoverProgress, setHoverProgress] = createSignal(0);

  // Context menu state with animation phase
  const [ctxMenu, setCtxMenu] = createSignal<{
    x: number;
    y: number;
    node: GraphNode;
    phase: 'enter' | 'exit';
  } | null>(null);

  let hoverAnimId: number | null = null;

  function animateHover(targetProgress: number) {
    if (hoverAnimId !== null) cancelAnimationFrame(hoverAnimId);
    const start = hoverProgress();
    const startTime = performance.now();
    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / 150, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setHoverProgress(start + (targetProgress - start) * eased);
      if (t < 1) {
        hoverAnimId = requestAnimationFrame(tick);
      } else {
        hoverAnimId = null;
        if (targetProgress === 0) setHoveredNodeId(null);
      }
    }
    hoverAnimId = requestAnimationFrame(tick);
  }

  const maxLane = () => Math.max(...props.graphData.nodes.map((n) => n.lane), 0);

  const graphWidth = () => (maxLane() + 1) * H_SPACE + MARGIN_LEFT + GRAPH_RIGHT_PAD;
  const canvasWidth = () => graphWidth() + DASH_LEN + INFO_GAP;
  const totalHeight = () => props.graphData.nodes.length * V_SPACE + MARGIN_TOP * 2;

  // Infer branch names for commits without explicit labels by walking the
  // graph from newest → oldest, propagating along same-lane parent chains.
  const inferredLabels = createMemo(() => {
    // Build children lookup: parent ID → child nodes
    const childrenOf = new Map<string, GraphNode[]>();
    for (const edge of props.graphData.edges) {
      const child = props.graphData.nodes.find((n) => n.id === edge.from);
      if (!child) continue;
      const arr = childrenOf.get(edge.to);
      if (arr) arr.push(child);
      else childrenOf.set(edge.to, [child]);
    }

    const sorted = [...props.graphData.nodes].sort((a, b) => a.row - b.row);
    const result = new Map<string, string[]>();

    for (const node of sorted) {
      if (node.branchLabels.length > 0) {
        result.set(node.id, [...node.branchLabels]);
      } else {
        const children = childrenOf.get(node.id);
        if (!children || children.length === 0) continue;
        // Prefer same-lane child (main lineage), fall back to any child
        const source = children.find((c) => c.lane === node.lane) || children[0];
        const labels = result.get(source.id);
        if (labels && labels.length > 0) {
          result.set(node.id, [labels[0]]);
        }
      }
    }

    return result;
  });

  function nodePos(node: GraphNode) {
    return {
      x: node.lane * H_SPACE + MARGIN_LEFT,
      y: node.row * V_SPACE + MARGIN_TOP,
    };
  }

  function hitTestNode(mx: number, my: number): GraphNode | null {
    const rect = canvasRef.getBoundingClientRect();
    const px = mx - rect.left;
    const py = my - rect.top;
    for (let i = props.graphData.nodes.length - 1; i >= 0; i--) {
      const node = props.graphData.nodes[i];
      const pos = nodePos(node);
      const dx = px - pos.x;
      const dy = py - pos.y;
      if (dx * dx + dy * dy < (NODE_R + 6) * (NODE_R + 6)) return node;
    }
    return null;
  }

  let cacheCanvas: HTMLCanvasElement | null = null;
  let cacheKey = '';

  function drawEdges(ctx: CanvasRenderingContext2D) {
    // Build a lookup for merge commits (nodes with multiple outgoing parent edges)
    const mergeFrom = new Set<string>();
    for (const e of props.graphData.edges) {
      if (mergeFrom.has(e.from)) continue;
      const count = props.graphData.edges.filter((ee) => ee.from === e.from).length;
      if (count > 1) mergeFrom.add(e.from);
    }

    for (const edge of props.graphData.edges) {
      const fromNode = props.graphData.nodes.find((n) => n.id === edge.from);
      const toNode = props.graphData.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const from = nodePos(fromNode); // child (newer commit)
      const to = nodePos(toNode);     // parent (older commit)

      // GitKraken colour rule: merge edges take the colour of the
      // *destination* lane (the branch being merged into); regular edges
      // take the colour of the *source* lane.
      const colorLane = mergeFrom.has(edge.from) ? toNode.lane : fromNode.lane;
      const color = COLORS[colorLane % COLORS.length];

      ctx.beginPath();
      if (fromNode.lane === toNode.lane) {
        // Same-lane: straight vertical line
        ctx.moveTo(from.x, from.y + NODE_R);
        ctx.lineTo(to.x, to.y - NODE_R);
      } else if (mergeFrom.has(edge.from)) {
        // Merge edge (child has multiple parents, this is the extra parent):
        // draw in reverse — from parent (below) toward child (above).
        // vertical in parent's lane up to child's row, then rounded corner,
        // then horizontal into child's lane.
        const dir = from.x < to.x ? 1 : -1;
        const cornerY = from.y; // horizontal segment sits at child's row height
        ctx.moveTo(to.x, to.y - NODE_R);
        ctx.lineTo(to.x, cornerY + CORNER_R);
        ctx.quadraticCurveTo(to.x, cornerY, to.x - dir * CORNER_R, cornerY);
        ctx.lineTo(from.x + dir * NODE_R, cornerY);
      } else {
        // Branch/fork edge (child has one parent, different lane):
        // draw from PARENT (fork point) — horizontal to child's lane,
        // then rounded corner, then vertical to child.
        // The horizontal sits at the parent's row height (the fork point),
        // matching GitKraken's branch rendering.
        const dir = from.x < to.x ? 1 : -1;
        const startY = to.y;
        ctx.moveTo(to.x, startY);
        ctx.lineTo(from.x + dir * CORNER_R, startY);
        ctx.quadraticCurveTo(from.x, startY, from.x, startY - CORNER_R);
        ctx.lineTo(from.x, from.y + NODE_R);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  function drawDashedLines(ctx: CanvasRenderingContext2D) {
    const dashEnd = canvasWidth() - 2;
    for (const node of props.graphData.nodes) {
      const pos = nodePos(node);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pos.x + NODE_R + 4, pos.y);
      ctx.lineTo(dashEnd, pos.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawBaseNodes(ctx: CanvasRenderingContext2D) {
    for (const node of props.graphData.nodes) {
      const pos = nodePos(node);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[node.color % COLORS.length];
      ctx.fill();
    }
  }

  /** Draw a golden ring around the HEAD commit node */
  function drawHeadNode(ctx: CanvasRenderingContext2D) {
    for (const node of props.graphData.nodes) {
      if (!node.isHead) continue;
      const pos = nodePos(node);
      // Outer glow ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_R + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      // Inner subtle glow
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_R + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawNodeOverlay(ctx: CanvasRenderingContext2D) {
    for (const node of props.graphData.nodes) {
      const isSelected = node.id === props.selectedNodeId;
      const isHovered = node.id === hoveredNodeId();
      if (!isSelected && !isHovered) continue;

      const pos = nodePos(node);
      const color = COLORS[node.color % COLORS.length];
      const radius = isSelected ? NODE_R + 3 : NODE_R + hoverProgress() * 3;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.globalAlpha = isSelected ? 1 : 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvasWidth();
    const height = totalHeight();

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const newKey = `${width}x${height}:${props.graphData.nodes.length}:${props.graphData.edges.length}`;

    if (!cacheCanvas || cacheKey !== newKey) {
      cacheKey = newKey;
      if (!cacheCanvas) cacheCanvas = document.createElement('canvas');
      cacheCanvas.width = width * dpr;
      cacheCanvas.height = height * dpr;

      const cctx = cacheCanvas.getContext('2d')!;
      cctx.scale(dpr, dpr);
      cctx.clearRect(0, 0, width, height);
      drawEdges(cctx);
      drawDashedLines(cctx);
      drawBaseNodes(cctx);
      drawHeadNode(cctx); // HEAD highlight in cached layer
    }

    // Blit cached static content
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cacheCanvas, 0, 0);

    // Draw dynamic overlay (selected/hovered nodes)
    ctx.scale(dpr, dpr);
    drawNodeOverlay(ctx);
  }

  createEffect(() => {
    props.graphData;
    props.selectedNodeId;
    hoveredNodeId();
    hoverProgress();
    draw();
  });

  const handleMouseMove = (e: MouseEvent) => {
    const node = hitTestNode(e.clientX, e.clientY);
    if (node) {
      canvasRef.style.cursor = 'pointer';
      if (hoveredNodeId() !== node.id) {
        setHoveredNodeId(node.id);
        animateHover(1);
      }
    } else {
      canvasRef.style.cursor = 'default';
      if (hoveredNodeId() !== null) animateHover(0);
    }
  };

  const handleMouseLeave = () => {
    if (hoveredNodeId() !== null) animateHover(0);
  };

  const handleCanvasClick = (e: MouseEvent) => {
    const node = hitTestNode(e.clientX, e.clientY);
    if (node) props.onSelectNode(node.id);
    closeContextMenu();
  };

  // ── Context menu handlers ──
  const handleCanvasContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const node = hitTestNode(e.clientX, e.clientY);
    if (node) {
      setCtxMenu({ x: e.clientX, y: e.clientY, node, phase: 'enter' });
    }
  };

  const handleInfoContextMenu = (e: MouseEvent, node: GraphNode) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, node, phase: 'enter' });
  };

  const closeContextMenu = () => {
    const menu = ctxMenu();
    if (!menu || menu.phase === 'exit') return;
    setCtxMenu({ ...menu, phase: 'exit' });
    setTimeout(() => setCtxMenu(null), 120);
  };

  const handleContextCheckout = () => {
    const menu = ctxMenu();
    if (!menu) return;
    props.onCheckout?.(menu.node.id);
    closeContextMenu();
  };

  const handleContextCreateBranch = () => {
    const menu = ctxMenu();
    if (!menu) return;
    props.onCreateBranch?.(menu.node.id);
    closeContextMenu();
  };

  const handleContextCherryPick = () => {
    const menu = ctxMenu();
    if (!menu) return;
    props.onCherryPick?.(menu.node.id);
    closeContextMenu();
  };

  const handleContextCopySha = async () => {
    const menu = ctxMenu();
    if (!menu) return;
    try {
      await navigator.clipboard.writeText(menu.node.id);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = menu.node.id;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    closeContextMenu();
  };

  const handleContextCreatePullRequest = () => {
    const menu = ctxMenu();
    if (!menu) return;
    props.onCreatePullRequest?.(menu.node.id);
    closeContextMenu();
  };

  // Close context menu on Escape
  createEffect(() => {
    if (!ctxMenu()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
  });

  return (
    <>
    <div ref={containerRef} class="relative h-full overflow-auto">
      <div class="flex items-start" style="min-width: 100%;">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          onContextMenu={handleCanvasContextMenu}
          class="block shrink-0"
        />

        {/* Info blocks as HTML elements with CSS transitions */}
        <div
          class="relative"
          style={{
            flex: 1,
            'min-width': '280px',
            height: `${totalHeight()}px`,
          }}
        >
          <For each={props.graphData.nodes}>
            {(node) => {
              const y = node.row * V_SPACE + MARGIN_TOP;
              const isSelected = node.id === props.selectedNodeId;
              const color = COLORS[node.color % COLORS.length];
              const dt = new Date(node.timestamp * 1000);
              const dtStr = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
              const author =
                node.author.length > 24 ? node.author.slice(0, 24) + '…' : node.author;
              const branchLabels = inferredLabels().get(node.id) || [];

              return (
                <div
                  class="rounded-lg cursor-pointer transition-all duration-300"
                  style={{
                    position: 'absolute',
                    top: `${y - INFO_HEIGHT / 2}px`,
                    left: '4px',
                    right: '4px',
                    height: `${INFO_HEIGHT}px`,
                    padding: '4px 10px',
                    display: 'flex',
                    'flex-direction': 'column',
                    'justify-content': 'center',
                    overflow: 'hidden',
                    'background-color': isSelected
                      ? `${color}1a`
                      : node.isHead
                        ? 'rgba(251,191,36,0.08)'
                        : 'rgba(255,255,255,0.035)',
                    border: isSelected
                      ? `1px solid ${color}66`
                      : node.isHead
                        ? '1px solid rgba(251,191,36,0.35)'
                        : '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !node.isHead) {
                      e.currentTarget.style.backgroundColor = `${color}0d`;
                      e.currentTarget.style.borderColor = `${color}33`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !node.isHead) {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.035)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    }
                  }}
                  onClick={() => props.onSelectNode(node.id)}
                  onContextMenu={(e) => handleInfoContextMenu(e, node)}
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <Show when={node.isHead}>
                      <span class="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                        HEAD
                      </span>
                    </Show>
                    <div
                      class="text-xs font-semibold truncate"
                      style={{ color: isSelected ? color : 'rgba(255,255,255,0.85)' }}
                    >
                      {node.message}
                    </div>
                    <Show when={branchLabels.length > 0}>
                      <div class="flex items-center gap-1 ml-auto shrink-0 overflow-hidden">
                        <For each={branchLabels}>
                          {(label) => (
                            <span
                              class="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                              style={{
                                color: color,
                                'background-color': `${color}20`,
                              }}
                            >
                              {label}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                  <div
                    class="text-[10px]"
                    style={{ color: isSelected ? color : 'rgba(255,255,255,0.35)' }}
                  >
                    {node.shortId} · {author} · {dtStr}
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

    </div>

    <Portal>
      <Show when={ctxMenu()}>
        {(menu) => (
          <div
            class="fixed inset-0 z-50"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          >
            <div
              class={`fixed w-48 py-1 rounded-xl bg-white/10 backdrop-blur-2xl border border-white/10 shadow-2xl text-sm overflow-hidden ${
                menu().phase === 'enter'
                  ? 'animate-context-menu-enter'
                  : 'animate-context-menu-exit'
              }`}
              style={{
                left: `${menu().x}px`,
                top: `${menu().y}px`,
              }}
            >
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={handleContextCheckout}
              >
                <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                检出到此提交
              </button>
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={handleContextCreateBranch}
              >
                <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                从此创建分支
              </button>
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={handleContextCherryPick}
              >
                <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Cherry-pick 此提交
              </button>
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={handleContextCreatePullRequest}
              >
                <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                从此发起 Pull Request
              </button>
              <div class="border-t border-white/10 my-1" />
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={handleContextCopySha}
              >
                <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制 SHA
              </button>
            </div>
          </div>
        )}
      </Show>
    </Portal>
    </>
  );
};

export default CommitGraph;
