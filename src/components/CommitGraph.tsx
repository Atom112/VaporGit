import { Component, createEffect, createSignal, Show, For, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { GraphNode, CommitGraphData } from '../lib/types';

const COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#818cf8', '#2dd4bf', '#fb923c', '#e879f9', '#38bdf8', '#a3e635',
];

const H_SPACE = 28;
const V_SPACE = 52;
const NODE_R = 5;
const CORNER_R = 8;
const MARGIN_LEFT = 24;
const MARGIN_TOP = 40;
const GRAPH_RIGHT_PAD = 10;
const DASH_LEN = 20;
const INFO_GAP = 6;
const INFO_HEIGHT = 42;
const HALF_H = H_SPACE / 2;

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
  const [hoveredLane, setHoveredLane] = createSignal<number | null>(null);
  const [tooltipPos, setTooltipPos] = createSignal({ x: 0, y: 0 });

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

  function hitTestLane(mx: number, my: number): number | null {
    const rect = canvasRef.getBoundingClientRect();
    const px = mx - rect.left;
    const py = my - rect.top;
    const graphRight = graphWidth();
    if (px < 0 || px > graphRight) return null;
    for (let lane = 0; lane <= maxLane(); lane++) {
      const cx = lane * H_SPACE + MARGIN_LEFT;
      if (px < cx - HALF_H || px >= cx + HALF_H) continue;
      const ranges: { minY: number; maxY: number }[] = [];
      for (const node of props.graphData.nodes) {
        if (node.lane !== lane) continue;
        const pos = nodePos(node);
        ranges.push({ minY: pos.y - V_SPACE / 2, maxY: pos.y + V_SPACE / 2 });
      }
      for (const edge of props.graphData.edges) {
        const fromNode = props.graphData.nodes.find((n) => n.id === edge.from);
        const toNode = props.graphData.nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) continue;
        if (fromNode.lane !== lane || toNode.lane !== lane) continue;
        const fp = nodePos(fromNode);
        const tp = nodePos(toNode);
        ranges.push({ minY: Math.min(fp.y, tp.y), maxY: Math.max(fp.y, tp.y) });
      }
      if (ranges.length === 0) continue;
      ranges.sort((a, b) => a.minY - b.minY);
      const merged = [ranges[0]];
      for (let i = 1; i < ranges.length; i++) {
        if (ranges[i].minY <= merged[merged.length - 1].maxY) {
          merged[merged.length - 1].maxY = Math.max(merged[merged.length - 1].maxY, ranges[i].maxY);
        } else {
          merged.push(ranges[i]);
        }
      }
      if (merged.some((r) => py >= r.minY && py <= r.maxY)) return lane;
    }
    return null;
  }

  function branchNamesForLane(lane: number): string[] {
    const names = new Set<string>();
    for (const node of props.graphData.nodes) {
      if (node.lane === lane) {
        for (const label of node.branchLabels) {
          names.add(label);
        }
      }
    }
    return Array.from(names);
  }

  let cacheCanvas: HTMLCanvasElement | null = null;
  let cacheKey = '';

  function drawEdges(ctx: CanvasRenderingContext2D) {
    const mergeSet = new Set<string>();
    for (const e of props.graphData.edges) {
      if (mergeSet.has(e.from)) continue;
      const count = props.graphData.edges.filter((ee) => ee.from === e.from).length;
      if (count > 1) mergeSet.add(e.from);
    }

    for (const edge of props.graphData.edges) {
      const fromNode = props.graphData.nodes.find((n) => n.id === edge.from);
      const toNode = props.graphData.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const from = nodePos(fromNode);
      const to = nodePos(toNode);
      const colorLane = mergeSet.has(edge.from) ? toNode.lane : fromNode.lane;
      const color = COLORS[colorLane % COLORS.length];

      ctx.beginPath();
      if (fromNode.lane === toNode.lane) {
        ctx.moveTo(from.x, from.y + NODE_R);
        ctx.lineTo(to.x, to.y - NODE_R);
      } else {
        const midY = (from.y + to.y) / 2;
        const dir = from.x < to.x ? 1 : -1;
        ctx.moveTo(from.x, from.y + NODE_R);
        ctx.lineTo(from.x, midY - CORNER_R);
        ctx.quadraticCurveTo(from.x, midY, from.x + dir * CORNER_R, midY);
        ctx.lineTo(to.x - dir * CORNER_R, midY);
        ctx.quadraticCurveTo(to.x, midY, to.x, midY + CORNER_R);
        ctx.lineTo(to.x, to.y - NODE_R);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
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
      setHoveredLane(null);
    } else {
      canvasRef.style.cursor = 'default';
      if (hoveredNodeId() !== null) animateHover(0);
      const lane = hitTestLane(e.clientX, e.clientY);
      if (lane !== null && branchNamesForLane(lane).length > 0) {
        setHoveredLane(lane);
        const rect = containerRef.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left + containerRef.scrollLeft,
          y: e.clientY - rect.top + containerRef.scrollTop,
        });
      } else {
        setHoveredLane(null);
      }
    }
  };

  const handleMouseLeave = () => {
    if (hoveredNodeId() !== null) animateHover(0);
    setHoveredLane(null);
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

      {/* Lane tooltip */}
      <Show when={hoveredLane() !== null}>
        <div
          class="absolute z-10 px-3 py-2 rounded-lg bg-black/85 backdrop-blur border text-xs shadow-xl pointer-events-none"
          style={{
            left: `${tooltipPos().x + 14}px`,
            top: `${tooltipPos().y - 10}px`,
            'border-color': COLORS[hoveredLane()! % COLORS.length] + '55',
          } as any}
        >
          <For each={branchNamesForLane(hoveredLane()!)}>
            {(label) => {
              const laneColor = COLORS[hoveredLane()! % COLORS.length];
              return (
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    style={{ 'background-color': laneColor } as any}
                  />
                  <span style={{ color: laneColor }} class="font-medium">{label}</span>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

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
