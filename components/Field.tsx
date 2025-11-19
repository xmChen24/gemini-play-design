import React, { useEffect, useRef, useState } from 'react';
import { Play, Player, PlayerRole, Point } from '../types';

interface FieldProps {
  play: Play;
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
  onUpdatePlayer: (player: Player) => void;
  readOnly?: boolean;
  showGrid?: boolean;
}

// Using 100x80 to match the 1.25 aspect ratio common in UI and roughly a short field
const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 80;

type InteractionType = 'player' | 'pan' | null;

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

const Field: React.FC<FieldProps> = ({
  play,
  selectedPlayerId,
  onSelectPlayer,
  onUpdatePlayer,
  readOnly = false,
  showGrid = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTrail, setDragTrail] = useState<Point[]>([]);
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const interactionRef = useRef<{
    pointerId: number | null;
    type: InteractionType;
    playerId?: string;
    startPoint: Point | null;
    startViewport: ViewportState;
    moved: boolean;
  }>({ pointerId: null, type: null, startPoint: null, startViewport: { x: 0, y: 0, zoom: 1 }, moved: false });
  const pendingFrameRef = useRef<number | null>(null);
  const latestPointRef = useRef<Point | null>(null);

  const clampViewport = (candidate: ViewportState) => {
    const width = FIELD_WIDTH / candidate.zoom;
    const height = FIELD_HEIGHT / candidate.zoom;
    const minX = -FIELD_WIDTH * 0.25;
    const maxX = FIELD_WIDTH - width + FIELD_WIDTH * 0.25;
    const minY = -FIELD_HEIGHT * 0.25;
    const maxY = FIELD_HEIGHT - height + FIELD_HEIGHT * 0.25;

    return {
      ...candidate,
      x: Math.min(Math.max(candidate.x, minX), maxX),
      y: Math.min(Math.max(candidate.y, minY), maxY)
    };
  };

  const setViewportClamped = (updater: (prev: ViewportState) => ViewportState) => {
    setViewport(prev => clampViewport(updater(prev)));
  };

  const viewBoxWidth = FIELD_WIDTH / viewport.zoom;
  const viewBoxHeight = FIELD_HEIGHT / viewport.zoom;

  // Convert screen coordinates to SVG coordinates
  const getSvgPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (clientX - CTM.e) / CTM.a,
      y: (clientY - CTM.f) / CTM.d
    };
  };

  const schedulePlayerUpdate = (playerId: string, point: Point) => {
    latestPointRef.current = point;

    if (pendingFrameRef.current === null) {
      pendingFrameRef.current = requestAnimationFrame(() => {
        pendingFrameRef.current = null;
        if (!latestPointRef.current) return;

        const player = play.players.find(p => p.id === playerId);
        if (player) {
          onUpdatePlayer({ ...player, x: latestPointRef.current.x, y: latestPointRef.current.y });
          setDragTrail(prev => {
            const updated = [...prev, latestPointRef.current as Point].slice(-10);
            return updated;
          });
        }
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent, player?: Player) => {
    if (readOnly) return;
    e.stopPropagation();
    const point = getSvgPoint(e.clientX, e.clientY);

    if (player) {
      onSelectPlayer(player.id);
      setIsDragging(true);
      interactionRef.current = {
        pointerId: e.pointerId,
        type: 'player',
        playerId: player.id,
        startPoint: point,
        startViewport: viewport,
        moved: false
      };
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } else {
      interactionRef.current = {
        pointerId: e.pointerId,
        type: 'pan',
        startPoint: point,
        startViewport: viewport,
        moved: false
      };
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const interaction = interactionRef.current;
    if (readOnly || interaction.pointerId !== e.pointerId || interaction.type === null) return;
    e.preventDefault();

    const point = getSvgPoint(e.clientX, e.clientY);
    interaction.moved = true;

    if (interaction.type === 'player' && interaction.playerId) {
      const x = Math.max(2, Math.min(FIELD_WIDTH - 2, point.x));
      const y = Math.max(2, Math.min(FIELD_HEIGHT - 2, point.y));
      schedulePlayerUpdate(interaction.playerId, { x, y });
    }

    if (interaction.type === 'pan' && interaction.startPoint) {
      const deltaX = point.x - interaction.startPoint.x;
      const deltaY = point.y - interaction.startPoint.y;

      setViewportClamped(() => ({
        ...interaction.startViewport,
        x: interaction.startViewport.x - deltaX,
        y: interaction.startViewport.y - deltaY,
        zoom: interaction.startViewport.zoom
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const interaction = interactionRef.current;
    if (interaction.pointerId !== e.pointerId) return;

    if (interaction.type === 'player') {
      setIsDragging(false);
      setDragTrail([]);
    }

    if (interaction.type === 'pan' && !interaction.moved && selectedPlayerId) {
      const point = getSvgPoint(e.clientX, e.clientY);
      const currentPlayer = play.players.find(p => p.id === selectedPlayerId);

      if (currentPlayer && currentPlayer.role === PlayerRole.OFFENSE) {
        const x = Math.max(0, Math.min(FIELD_WIDTH, point.x));
        const y = Math.max(0, Math.min(FIELD_HEIGHT, point.y));
        const newRoute = [...currentPlayer.route, { x, y }];
        onUpdatePlayer({ ...currentPlayer, route: newRoute });
      } else {
        onSelectPlayer(null);
      }
    }

    if ((e.target as Element).releasePointerCapture) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore release errors
      }
    }

    interactionRef.current = {
      pointerId: null,
      type: null,
      startPoint: null,
      startViewport: viewport,
      moved: false
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const zoomDelta = direction > 0 ? 1.08 : 0.92;
    const focusPoint = getSvgPoint(e.clientX, e.clientY);

    setViewportClamped(prev => {
      const newZoom = Math.min(2.5, Math.max(0.6, prev.zoom * zoomDelta));

      const prevWidth = FIELD_WIDTH / prev.zoom;
      const prevHeight = FIELD_HEIGHT / prev.zoom;
      const newWidth = FIELD_WIDTH / newZoom;
      const newHeight = FIELD_HEIGHT / newZoom;

      const scaleX = (focusPoint.x - prev.x) / prevWidth;
      const scaleY = (focusPoint.y - prev.y) / prevHeight;

      const newX = focusPoint.x - scaleX * newWidth;
      const newY = focusPoint.y - scaleY * newHeight;

      return {
        x: newX,
        y: newY,
        zoom: newZoom
      };
    });
  };

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden select-none touch-none relative">
      <svg
        id="play-field-svg"
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${viewport.x} ${viewport.y} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full cursor-crosshair"
        onPointerDown={(e) => handlePointerDown(e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="#4b5563" />
          </marker>

          <linearGradient id="turf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b5aa2" />
            <stop offset="100%" stopColor="#0b4b88" />
          </linearGradient>

          <pattern id="turfTexture" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="2" height="2" fill="#0b4f95" opacity="0.18" />
            <rect x="2" y="2" width="2" height="2" fill="#0d66b7" opacity="0.18" />
          </pattern>
        </defs>

        {/* Field Base */}
        <rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#turf)" />
        <rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#turfTexture)" />

        {/* End Zones */}
        <rect x={0} y={0} width={8} height={FIELD_HEIGHT} fill="#e21f26" opacity={0.92} />
        <rect x={FIELD_WIDTH - 8} y={0} width={8} height={FIELD_HEIGHT} fill="#0b1f41" opacity={0.95} />
        <text
          x={4}
          y={FIELD_HEIGHT / 2}
          textAnchor="middle"
          fill="white"
          fontWeight="700"
          fontSize="8"
          letterSpacing="0.5"
          transform={`rotate(-90 4 ${FIELD_HEIGHT / 2})`}
          opacity={0.9}
        >
          NFL FLAG
        </text>
        <text
          x={FIELD_WIDTH - 4}
          y={FIELD_HEIGHT / 2}
          textAnchor="middle"
          fill="white"
          fontWeight="700"
          fontSize="8"
          letterSpacing="0.5"
          transform={`rotate(90 ${FIELD_WIDTH - 4} ${FIELD_HEIGHT / 2})`}
          opacity={0.9}
        >
          NFL FLAG
        </text>

        {/* Yard Lines + Numbers */}
        <g stroke="white" strokeWidth={0.6} opacity={0.95}>
          {Array.from({ length: Math.floor((FIELD_WIDTH - 16) / 5) + 1 }).map((_, i) => {
            const x = 8 + i * 5;
            return (
              <line key={`yl-${i}`} x1={x} y1={0} x2={x} y2={FIELD_HEIGHT} strokeDasharray={i % 2 === 0 ? undefined : '1 2'} />
            );
          })}
        </g>

        <g fill="#cfe7ff" fontSize="3" fontWeight="700" opacity={0.95}>
          {Array.from({ length: 6 }).map((_, i) => {
            const value = (i + 1) * 5;
            const x = 8 + value;
            return (
              <React.Fragment key={`num-${value}`}>
                <text x={x} y={8} textAnchor="middle">{value}</text>
                <text x={x} y={FIELD_HEIGHT - 4} textAnchor="middle" transform={`scale(1 -1) translate(0 ${-FIELD_HEIGHT})`}>
                  {value}
                </text>
              </React.Fragment>
            );
          })}
        </g>

        {/* Hash Marks */}
        <g stroke="white" strokeWidth={0.8} opacity={0.9}>
          {Array.from({ length: Math.floor((FIELD_WIDTH - 16) / 5) + 1 }).map((_, i) => {
            const x = 8 + i * 5;
            return (
              <React.Fragment key={`hash-${i}`}>
                <line x1={x - 1.3} y1={FIELD_HEIGHT / 2 - 10} x2={x - 1.3} y2={FIELD_HEIGHT / 2 - 8} />
                <line x1={x - 1.3} y1={FIELD_HEIGHT / 2 + 8} x2={x - 1.3} y2={FIELD_HEIGHT / 2 + 10} />
                <line x1={x + 1.3} y1={FIELD_HEIGHT / 2 - 10} x2={x + 1.3} y2={FIELD_HEIGHT / 2 - 8} />
                <line x1={x + 1.3} y1={FIELD_HEIGHT / 2 + 8} x2={x + 1.3} y2={FIELD_HEIGHT / 2 + 10} />
              </React.Fragment>
            );
          })}
        </g>

        {/* Midfield Logo Placeholder */}
        <g transform={`translate(${FIELD_WIDTH / 2}, ${FIELD_HEIGHT / 2})`}>
          <circle r={6} fill="#0c2b52" opacity={0.75} />
          <circle r={5.2} fill="none" stroke="#d3e5ff" strokeWidth={0.7} strokeDasharray="1.2 1.2" />
          <text textAnchor="middle" fill="#f8fafc" fontSize="3.2" fontWeight="700" letterSpacing="0.5">FLAG</text>
        </g>

        {/* Optional Grid */}
        {showGrid && (
          <g className="opacity-25" stroke="#e2e8f0" strokeWidth={0.25}>
            {Array.from({ length: Math.ceil(FIELD_WIDTH / 10) + 1 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 10} y1={0} x2={i * 10} y2={FIELD_HEIGHT} />
            ))}
            {Array.from({ length: Math.ceil(FIELD_HEIGHT / 10) + 1 }).map((_, i) => (
              <line key={`h-${i}`} x1={0} y1={i * 10} x2={FIELD_WIDTH} y2={i * 10} />
            ))}
          </g>
        )}

        {/* LOS / Midfield indicators - Center line */}
        <line x1={8} y1={FIELD_HEIGHT / 2} x2={FIELD_WIDTH - 8} y2={FIELD_HEIGHT / 2} stroke="#cfe7ff" strokeWidth="0.7" strokeDasharray="2 3" opacity={0.7} />

        {/* Legend Badge */}
        <g transform={`translate(${FIELD_WIDTH - 18}, 10)`}>
          <rect x={-10} y={-6} width={20} height={12} rx={2} fill="#0f172a" opacity={0.7} />
          <text x={0} y={0.8} textAnchor="middle" fill="white" fontSize="3" fontWeight="700">PLAY LAB</text>
          <text x={0} y={4} textAnchor="middle" fill="#cfe7ff" fontSize="2">NFL FLAG STYLE</text>
        </g>

        {/* Routes */}
        {play.players.map(player => {
          if (player.route.length === 0) return null;
          const points = [`${player.x},${player.y}`, ...player.route.map(p => `${p.x},${p.y}`)].join(' ');
          return (
            <polyline
              key={`route-${player.id}`}
              points={points}
              fill="none"
              stroke={player.color}
              strokeWidth="0.8"
              markerEnd="url(#arrowhead)"
              className="pointer-events-none transition-all duration-300"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Drag Trail */}
        {dragTrail.length > 1 && (
          <polyline
            points={dragTrail.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#93c5fd"
            strokeWidth={0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
        )}

        {/* Players */}
        {play.players.map(player => (
          <g
            key={player.id}
            transform={`translate(${player.x}, ${player.y})`}
            className={`cursor-pointer transition-transform duration-100 ${isDragging && selectedPlayerId === player.id ? 'scale-110' : ''}`}
            onPointerDown={(e) => handlePointerDown(e, player)}
          >
            {player.role === PlayerRole.OFFENSE ? (
              <>
                <circle
                  r="3"
                  fill={selectedPlayerId === player.id ? '#0ea5e9' : player.color}
                  stroke="white"
                  strokeWidth="0.6"
                  className="shadow-sm"
                />
                <text
                  y="0.8"
                  textAnchor="middle"
                  fill="white"
                  fontSize="2"
                  fontWeight="bold"
                  className="pointer-events-none font-sans"
                >
                  {player.label.substring(0, 2)}
                </text>
              </>
            ) : (
              <>
                <rect
                  x="-2.5"
                  y="-2.5"
                  width="5"
                  height="5"
                  fill={player.color}
                  stroke="white"
                  strokeWidth="0.6"
                  rx="1"
                />
                <text
                  y="0.8"
                  textAnchor="middle"
                  fill="white"
                  fontSize="2"
                  fontWeight="bold"
                  className="pointer-events-none font-sans"
                >
                  {player.label.substring(0, 1)}
                </text>
              </>
            )}
            {/* Highlight Ring */}
            {selectedPlayerId === player.id && !readOnly && (
              <circle r="4.7" fill="none" stroke="#22d3ee" strokeWidth="0.35" strokeDasharray="1 0.7" className="animate-pulse" />
            )}
          </g>
        ))}
      </svg>

      <div className="absolute top-2 right-2 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-slate-200 px-2 py-1 text-xs text-slate-700">
        <button
          className="px-2 py-1 rounded hover:bg-slate-100"
          onClick={() => setViewportClamped(prev => ({ ...prev, zoom: Math.min(2.5, prev.zoom * 1.1) }))}
        >
          +
        </button>
        <button
          className="px-2 py-1 rounded hover:bg-slate-100"
          onClick={() => setViewportClamped(prev => ({ ...prev, zoom: Math.max(0.6, prev.zoom / 1.1) }))}
        >
          –
        </button>
        <button
          className="px-2 py-1 rounded hover:bg-slate-100"
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
        >
          Reset View
        </button>
      </div>
    </div>
  );
};

export default Field;
