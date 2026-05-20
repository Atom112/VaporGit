import { Component, createEffect, createSignal, Show, For } from 'solid-js';
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
const MARGIN_TOP = 16;
const GRAPH_RIGHT_PAD = 10;
const DASH_LEN = 20;
const INFO_GAP = 6;
const INFO_WIDTH = 340;
const INFO_HEIGHT = 34;
const HALF_H = H_SPACE / 2;

interface CommitGraphProps {
  graphData: CommitGraphData;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}

const CommitGraph: Component<CommitGraphProps> = (props) => {
  let canvasRef!: HTMLCanvasElement;
  let containerRef!: HTMLDivElement;

  const [hoveredNode, setHoveredNode] = createSignal<GraphNode | null>(null);
  const [hoveredLane, setHoveredLane] = createSignal<number | null>(null);
  const [tooltipPos, setTooltipPos] = createSignal({ x: 0, y: 0 });

  const maxLane = () => Math.max(...props.graphData.nodes.map((n) => n.lane), 0);

  const graphWidth = () => (maxLane() + 1) * H_SPACE + MARGIN_LEFT + GRAPH_RIGHT_PAD;
  const infoX = () => graphWidth() + DASH_LEN + INFO_GAP;
  const cw = () => infoX() + INFO_WIDTH + 8;
  const ch = () => props.graphData.nodes.length * V_SPACE + MARGIN_TOP * 2;

  function nodePos(node: GraphNode) {
    return {
      x: node.lane * H_SPACE + MARGIN_LEFT,
      y: node.row * V_SPACE + MARGIN_TOP,
    };
  }

  function infoRect(node: GraphNode) {
    const pos = nodePos(node);
    return {
      x: infoX(),
      y: pos.y - INFO_HEIGHT / 2,
      w: INFO_WIDTH,
      h: INFO_HEIGHT,
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

  function hitTestInfo(mx: number, my: number): GraphNode | null {
    const rect = canvasRef.getBoundingClientRect();
    const px = mx - rect.left;
    const py = my - rect.top;
    for (let i = props.graphData.nodes.length - 1; i >= 0; i--) {
      const node = props.graphData.nodes[i];
      const r = infoRect(node);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return node;
    }
    return null;
  }

  function hitTestLane(mx: number, _my: number): number | null {
    const rect = canvasRef.getBoundingClientRect();
    const px = mx - rect.left;
    const graphRight = graphWidth();
    if (px < 0 || px > graphRight) return null;
    for (let lane = 0; lane <= maxLane(); lane++) {
      const cx = lane * H_SPACE + MARGIN_LEFT;
      if (px >= cx - HALF_H && px < cx + HALF_H) return lane;
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

  function draw() {
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = cw();
    const height = ch();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // ── 1. Draw edges ──
    // Precompute which commits are merges (have multiple parents in the graph)
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
      // For merge commits, color each edge by the parent's lane
      // (e.g. the "merged back" edge gets the feature branch color)
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

    // ── 2. Draw node circles ──
    for (const node of props.graphData.nodes) {
      const pos = nodePos(node);
      const color = COLORS[node.color % COLORS.length];
      const isSelected = node.id === props.selectedNodeId;
      const isHovered = hoveredNode()?.id === node.id;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected || isHovered ? NODE_R + 3 : NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ── 3. Draw dashed connector lines ──
    const ix = infoX();
    for (const node of props.graphData.nodes) {
      const pos = nodePos(node);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pos.x + NODE_R + 4, pos.y);
      ctx.lineTo(ix - 2, pos.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 4. Draw info block backgrounds ──
    for (const node of props.graphData.nodes) {
      const r = infoRect(node);
      const isSelected = node.id === props.selectedNodeId;
      const isHovered = hoveredNode()?.id === node.id;
      const color = COLORS[node.color % COLORS.length];

      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 6);
      if (isSelected) {
        ctx.fillStyle = color + '1a';
        ctx.fill();
        ctx.strokeStyle = color + '66';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (isHovered) {
        ctx.fillStyle = color + '0d';
        ctx.fill();
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ── 5. Draw info block text ──
    for (const node of props.graphData.nodes) {
      const r = infoRect(node);
      const isSelected = node.id === props.selectedNodeId;
      const color = COLORS[node.color % COLORS.length];

      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'start';
      const tx = r.x + 10;

      ctx.fillStyle = isSelected ? color : 'rgba(255,255,255,0.85)';
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      const maxTextW = r.w - 20;
      const msg =
        ctx.measureText(node.message).width > maxTextW
          ? node.message.slice(0, Math.floor(node.message.length * (maxTextW / ctx.measureText(node.message).width))) + '…'
          : node.message;
      const textY = r.y + r.h / 2 - 5;
      ctx.fillText(msg, tx, textY);

      ctx.fillStyle = isSelected ? color : 'rgba(255,255,255,0.3)';
      ctx.globalAlpha = isSelected ? 0.7 : 1;
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      const subY = r.y + r.h / 2 + 10;
      const author = node.author.length > 20 ? node.author.slice(0, 20) + '…' : node.author;
      ctx.fillText(`${node.shortId} · ${author}`, tx, subY);
      ctx.restore();
    }
  }

  createEffect(() => {
    props.graphData;
    props.selectedNodeId;
    draw();
  });

  const handleMouseMove = (e: MouseEvent) => {
    const node = hitTestNode(e.clientX, e.clientY) || hitTestInfo(e.clientX, e.clientY);

    if (node) {
      canvasRef.style.cursor = 'pointer';
      setHoveredLane(null);
      const rect = containerRef.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + containerRef.scrollLeft,
        y: e.clientY - rect.top + containerRef.scrollTop,
      });
      setHoveredNode(node);
    } else {
      canvasRef.style.cursor = 'default';
      setHoveredNode(null);
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
    setHoveredNode(null);
    setHoveredLane(null);
  };

  const handleClick = (e: MouseEvent) => {
    const node = hitTestNode(e.clientX, e.clientY) || hitTestInfo(e.clientX, e.clientY);
    if (node) props.onSelectNode(node.id);
  };

  return (
    <div ref={containerRef} class="relative h-full overflow-auto">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        class="block"
      />

      {/* Node tooltip */}
      <Show when={hoveredNode()}>
        <div
          class="absolute z-10 px-3 py-2 rounded-lg bg-black/85 backdrop-blur border border-white/10 text-xs shadow-xl pointer-events-none max-w-xs"
          style={{
            left: `${tooltipPos().x + 14}px`,
            top: `${tooltipPos().y - 10}px`,
          }}
        >
          <Show when={hoveredNode()!.branchLabels.length > 0}>
            <div class="flex flex-wrap gap-1 mb-1.5">
              <For each={hoveredNode()!.branchLabels}>
                {(label) => {
                  const laneColor = COLORS[hoveredNode()!.color % COLORS.length];
                  return (
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        'background-color': laneColor + '22',
                        color: laneColor,
                      } as any}
                    >{label}</span>
                  );
                }}
              </For>
            </div>
          </Show>
          <div class="font-semibold text-white truncate">{hoveredNode()!.message}</div>
          <div class="text-cyan-400 font-mono mt-0.5">{hoveredNode()!.shortId}</div>
          <div class="opacity-60 mt-0.5">
            {hoveredNode()!.author} · {new Date(hoveredNode()!.timestamp * 1000).toLocaleString()}
          </div>
        </div>
      </Show>

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
  );
};

export default CommitGraph;
