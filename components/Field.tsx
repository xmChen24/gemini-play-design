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

type InteractionType = 'player' | 'route' | 'field' | null;

const PLAYER_COLORS: Record<string, string> = {
  Q: '#c62828',
  C: '#1f232c',
  X: '#1e6fd8',
  Y: '#1f9c5a',
  Z: '#f97316'
};

const LABEL_ALIASES: Record<string, string> = {
  QB: 'Q',
  Q: 'Q',
  CENTER: 'C',
  C: 'C',
  WR: 'X',
  WR1: 'X',
  L: 'X',
  SL: 'Y',
  SLOT: 'Y',
  WR3: 'Y',
  RB: 'Y',
  Y: 'Y',
  WR2: 'Z',
  R: 'Z',
  SR: 'Z',
  Z: 'Z'
};

const getDisplayLabel = (player: Player) => {
  if (player.role === PlayerRole.DEFENSE) {
    return player.label.substring(0, 1).toUpperCase();
  }
  const candidate = LABEL_ALIASES[player.label.toUpperCase()] || player.label.substring(0, 1).toUpperCase();
  return ['Q', 'C', 'X', 'Y', 'Z'].includes(candidate) ? candidate : candidate.substring(0, 1);
};

const getPlayerColor = (player: Player) => {
  if (player.role === PlayerRole.DEFENSE) return player.color;
  const label = getDisplayLabel(player);
  return PLAYER_COLORS[label] || player.color;
};

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
  const interactionRef = useRef<{
    pointerId: number | null;
    type: InteractionType;
    playerId?: string;
    routeIndex?: number;
    startPoint: Point | null;
    moved: boolean;
  }>({ pointerId: null, type: null, startPoint: null, moved: false });
  const pendingFrameRef = useRef<number | null>(null);
  const latestPointRef = useRef<Point | null>(null);
  const pendingRouteFrame = useRef<number | null>(null);

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

  const handlePointerDown = (
    e: React.PointerEvent,
    player?: Player,
    routeHandle?: { playerId: string; pointIndex: number }
  ) => {
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
        moved: false
      };
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } else if (routeHandle) {
      interactionRef.current = {
        pointerId: e.pointerId,
        type: 'route',
        playerId: routeHandle.playerId,
        routeIndex: routeHandle.pointIndex,
        startPoint: point,
        moved: false
      };
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } else {
      interactionRef.current = {
        pointerId: e.pointerId,
        type: 'field',
        startPoint: point,
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

    if (interaction.type === 'route' && interaction.playerId != null && interaction.routeIndex !== undefined) {
      const clamped = {
        x: Math.max(2, Math.min(FIELD_WIDTH - 2, point.x)),
        y: Math.max(2, Math.min(FIELD_HEIGHT - 2, point.y))
      };
      if (pendingRouteFrame.current === null) {
        const { playerId, routeIndex } = interaction;
        pendingRouteFrame.current = requestAnimationFrame(() => {
          pendingRouteFrame.current = null;
          const player = play.players.find(p => p.id === playerId);
          if (!player) return;
          const updatedRoute = player.route.map((pt, idx) => idx === routeIndex ? clamped : pt);
          onUpdatePlayer({ ...player, route: updatedRoute });
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const interaction = interactionRef.current;
    if (interaction.pointerId !== e.pointerId) return;

    if (interaction.type === 'player') {
      setIsDragging(false);
      setDragTrail([]);
    }

    if (interaction.type === 'field' && !interaction.moved && selectedPlayerId) {
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

    interactionRef.current = { pointerId: null, type: null, startPoint: null, moved: false };
  };

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
      if (pendingRouteFrame.current !== null) {
        cancelAnimationFrame(pendingRouteFrame.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden select-none touch-none relative">
      <svg
        id="play-field-svg"
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
        className="w-full h-full cursor-crosshair"
        onPointerDown={(e) => handlePointerDown(e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="route-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="4.8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
          </marker>

          <linearGradient id="field-base" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f4f7" />
          </linearGradient>

          <filter id="player-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.65" floodColor="#0f172a" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Clean playing surface */}
        <rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#field-base)" />

        {/* Upper / lower stripes */}
        <line x1={0} y1={5} x2={FIELD_WIDTH} y2={5} stroke="#5c6474" strokeWidth={1.6} strokeLinecap="round" />
        <line
          x1={0}
          y1={FIELD_HEIGHT - 5}
          x2={FIELD_WIDTH}
          y2={FIELD_HEIGHT - 5}
          stroke="#5c6474"
          strokeWidth={1.6}
          strokeLinecap="round"
        />

        {/* Center blue stripe */}
        <line
          x1={0}
          y1={FIELD_HEIGHT / 2}
          x2={FIELD_WIDTH}
          y2={FIELD_HEIGHT / 2}
          stroke="#2f7beb"
          strokeWidth={2.6}
        />

        {/* Section separators */}
        <g stroke="#c9cfd8" strokeWidth={0.7}>
          {[1, 2].map(i => {
            const y = 5 + i * ((FIELD_HEIGHT - 10) / 3);
            return <line key={`section-${i}`} x1={0} y1={y} x2={FIELD_WIDTH} y2={y} />;
          })}
        </g>

        {/* Yard markers */}
        <g stroke="#8d939f" strokeWidth={1.3} strokeLinecap="round">
          {Array.from({ length: 9 }).map((_, i) => {
            const y = 8 + i * ((FIELD_HEIGHT - 16) / 8);
            return (
              <React.Fragment key={`hash-${i}`}>
                <line x1={3} y1={y} x2={10} y2={y} />
                <line x1={FIELD_WIDTH - 10} y1={y} x2={FIELD_WIDTH - 3} y2={y} />
              </React.Fragment>
            );
          })}
        </g>

        {/* Optional subtle grid */}
        {showGrid && (
          <g stroke="#e2e5ee" strokeWidth={0.45} opacity={0.45}>
            {Array.from({ length: 5 }).map((_, i) => {
              const x = i * (FIELD_WIDTH / 4);
              return <line key={`grid-v-${i}`} x1={x} y1={6} x2={x} y2={FIELD_HEIGHT - 6} />;
            })}
            {Array.from({ length: 4 }).map((_, i) => {
              const y = 6 + i * ((FIELD_HEIGHT - 12) / 3);
              return <line key={`grid-h-${i}`} x1={0} y1={y} x2={FIELD_WIDTH} y2={y} />;
            })}
          </g>
        )}

        {/* Routes */}
        {play.players.map(player => {
          if (player.route.length === 0) return null;
          const points = [`${player.x},${player.y}`, ...player.route.map(p => `${p.x},${p.y}`)].join(' ');
          const color = getPlayerColor(player);
          return (
            <polyline
              key={`route-${player.id}`}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={1.35}
              markerEnd="url(#route-arrow)"
              className="pointer-events-none transition-all duration-300"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          );
        })}

        {/* Route handles */}
        {play.players.map(player => {
          if (player.route.length === 0 || selectedPlayerId !== player.id) return null;
          const color = getPlayerColor(player);
          return player.route.map((point, index) => (
            <circle
              key={`handle-${player.id}-${index}`}
              cx={point.x}
              cy={point.y}
              r={0.8}
              fill="#f8fafc"
              stroke={color}
              strokeWidth={0.4}
              className="cursor-pointer"
              onPointerDown={(e) => handlePointerDown(e, undefined, { playerId: player.id, pointIndex: index })}
            />
          ));
        })}

        {/* Drag Trail */}
        {dragTrail.length > 1 && (
          <polyline
            points={dragTrail.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#a5b4fc"
            strokeWidth={0.48}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
        )}

        {/* Players */}
        {play.players.map(player => {
          const isSelected = selectedPlayerId === player.id;
          const isOffense = player.role === PlayerRole.OFFENSE;
          const label = isOffense ? getDisplayLabel(player) : player.label.substring(0, 1).toUpperCase();
          const iconColor = isOffense ? getPlayerColor(player) : '#3f4759';

          return (
            <g
              key={player.id}
              transform={`translate(${player.x}, ${player.y})`}
              className={`cursor-pointer transition-transform duration-150 ${isDragging && isSelected ? 'scale-110' : ''}`}
              onPointerDown={(e) => handlePointerDown(e, player)}
            >
              <circle
                r="2.6"
                fill={iconColor}
                stroke={isSelected ? '#ffffff' : '#e3e9f4'}
                strokeWidth="0.6"
                filter="url(#player-shadow)"
              />
              <text
                y="0.8"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="1.7"
                fontWeight="bold"
                className="pointer-events-none font-sans tracking-tight"
              >
                {label}
              </text>

              {isSelected && !readOnly && (
                <circle r="4" fill="none" stroke="#22d3ee" strokeWidth="0.3" strokeDasharray="1 0.8" className="animate-pulse" />
              )}
            </g>
          );
        })}
      </svg>

    </div>
  );
};

export default Field;
