import React, { useRef, useState } from 'react';
import { Play, Player, PlayerRole } from '../types';

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

  const handleMouseDown = (e: React.MouseEvent, player?: Player) => {
    if (readOnly) return;
    e.stopPropagation();

    if (player) {
      onSelectPlayer(player.id);
      setIsDragging(true);
    } else {
      // Clicked on empty field
      if (selectedPlayerId) {
        // If a player is selected, add a route point
        const point = getSvgPoint(e.clientX, e.clientY);
        const currentPlayer = play.players.find(p => p.id === selectedPlayerId);
        if (currentPlayer && currentPlayer.role === PlayerRole.OFFENSE) {
            // Constrain point to field
            const x = Math.max(0, Math.min(FIELD_WIDTH, point.x));
            const y = Math.max(0, Math.min(FIELD_HEIGHT, point.y));
            const newRoute = [...currentPlayer.route, {x, y}];
            onUpdatePlayer({ ...currentPlayer, route: newRoute });
        } else {
            onSelectPlayer(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (readOnly || !isDragging || !selectedPlayerId) return;
    e.preventDefault();
    
    const point = getSvgPoint(e.clientX, e.clientY);
    // Constrain to field with slight padding
    const x = Math.max(2, Math.min(FIELD_WIDTH - 2, point.x));
    const y = Math.max(2, Math.min(FIELD_HEIGHT - 2, point.y));
    
    const player = play.players.find(p => p.id === selectedPlayerId);
    if (player) {
      onUpdatePlayer({ ...player, x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent, player?: Player) => {
      if(readOnly) return;
      e.stopPropagation();
      if(player) {
          onSelectPlayer(player.id);
          setIsDragging(true);
      }
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
       if (readOnly || !isDragging || !selectedPlayerId) return;
       // Prevent scrolling while dragging items
       if(e.cancelable) e.preventDefault();

       const touch = e.touches[0];
       const point = getSvgPoint(touch.clientX, touch.clientY);
       
       const x = Math.max(2, Math.min(FIELD_WIDTH - 2, point.x));
       const y = Math.max(2, Math.min(FIELD_HEIGHT - 2, point.y));
       
       const player = play.players.find(p => p.id === selectedPlayerId);
       if (player) {
            onUpdatePlayer({ ...player, x, y });
        }
  }

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden select-none touch-none">
      <svg
        id="play-field-svg"
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
        className="w-full h-full cursor-crosshair"
        style={{ backgroundColor: '#f8fafc' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={(e) => handleMouseDown(e)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        // Ensure no distortion
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
        </defs>

        {/* Grid Lines */}
        {showGrid && (
          <g className="opacity-10">
            {/* Vertical Lines - every 10 units */}
            {Array.from({ length: Math.ceil(FIELD_WIDTH / 10) + 1 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 10} y1={0} x2={i * 10} y2={FIELD_HEIGHT} stroke="black" strokeWidth="0.2" />
            ))}
            {/* Horizontal Lines - every 10 units */}
             {Array.from({ length: Math.ceil(FIELD_HEIGHT / 10) + 1 }).map((_, i) => (
              <line key={`h-${i}`} x1={0} y1={i * 10} x2={FIELD_WIDTH} y2={i * 10} stroke="black" strokeWidth="0.2" />
            ))}
          </g>
        )}

        {/* LOS / Midfield indicators - Center line */}
        <line x1={0} y1={FIELD_HEIGHT / 2} x2={FIELD_WIDTH} y2={FIELD_HEIGHT / 2} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2" />

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

        {/* Players */}
        {play.players.map(player => (
          <g
            key={player.id}
            transform={`translate(${player.x}, ${player.y})`}
            className={`cursor-pointer transition-transform duration-100 ${isDragging && selectedPlayerId === player.id ? 'scale-110' : ''}`}
            onMouseDown={(e) => handleMouseDown(e, player)}
            onTouchStart={(e) => handleTouchStart(e, player)}
          >
            {player.role === PlayerRole.OFFENSE ? (
                <>
                    <circle
                    r="3"
                    fill={selectedPlayerId === player.id ? '#1e40af' : player.color}
                    stroke="white"
                    strokeWidth="0.5"
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
                        fill={selectedPlayerId === player.id ? '#991b1b' : '#dc2626'} // Red for defense
                        stroke="white"
                        strokeWidth="0.5"
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
               <circle r="4.5" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeDasharray="1 0.5" className="animate-pulse" />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default Field;