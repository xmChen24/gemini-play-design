import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Save, 
  Trash2, 
  Copy, 
  Share2, 
  ChevronLeft, 
  Users,
  Wand2,
  Menu,
  X as CloseIcon,
  Download,
  ArrowUpRight,
  ArrowRight,
  ArrowUp,
  CornerUpRight,
  Repeat
} from 'lucide-react';
import Field from './components/Field';
import { 
  Play, 
  Player, 
  PlayerRole, 
  ViewMode,
  Point
} from './types';
import { 
  getPlays, 
  savePlay, 
  deletePlay, 
  createEmptyPlay 
} from './services/storage';
import { getCoachingInsights } from './services/geminiService';

// --- Route Templates ---

type RouteType = 'fly' | 'slant' | 'out' | 'in' | 'corner' | 'post' | 'hitch' | 'flat' | 'wheel';

interface RouteTemplate {
  label: string;
  icon: React.ReactNode;
  // Function returns relative path points based on direction (1 for right, -1 for left)
  getPoints: (x: number, y: number, insideDir: number, outsideDir: number) => Point[];
}

const ROUTE_PRESETS: Record<RouteType, RouteTemplate> = {
  fly: {
    label: 'Go / Fly',
    icon: <ArrowUp size={16} />,
    getPoints: (x, y) => [{ x, y: Math.max(5, y - 40) }]
  },
  slant: {
    label: 'Slant',
    icon: <ArrowUpRight size={16} className="rotate-45" />,
    getPoints: (x, y, inDir) => [
        { x, y: y - 5 },
        { x: x + (inDir * 15), y: y - 20 }
    ]
  },
  flat: {
    label: 'Flat',
    icon: <ArrowRight size={16} />,
    getPoints: (x, y, inDir, outDir) => [
        { x, y: y - 5 },
        { x: x + (outDir * 15), y: y - 5 }
    ]
  },
  out: {
    label: 'Out',
    icon: <CornerUpRight size={16} />,
    getPoints: (x, y, inDir, outDir) => [
        { x, y: y - 15 },
        { x: x + (outDir * 15), y: y - 15 }
    ]
  },
  in: {
    label: 'In / Dig',
    icon: <CornerUpRight size={16} className="-scale-x-100" />,
    getPoints: (x, y, inDir) => [
        { x, y: y - 15 },
        { x: x + (inDir * 15), y: y - 15 }
    ]
  },
  hitch: {
    label: 'Hitch',
    icon: <Repeat size={16} className="rotate-90" />,
    getPoints: (x, y) => [
        { x, y: y - 15 },
        { x, y: y - 12 } // Come back slightly
    ]
  },
  corner: {
    label: 'Corner',
    icon: <ArrowUpRight size={16} />,
    getPoints: (x, y, inDir, outDir) => [
        { x, y: y - 15 },
        { x: x + (outDir * 20), y: y - 40 }
    ]
  },
  post: {
    label: 'Post',
    icon: <ArrowUpRight size={16} className="-scale-x-100" />,
    getPoints: (x, y, inDir) => [
        { x, y: y - 15 },
        { x: x + (inDir * 20), y: y - 45 }
    ]
  },
  wheel: {
    label: 'Wheel',
    icon: <ArrowUpRight size={16} />, // Simplified icon
    getPoints: (x, y, inDir, outDir) => [
        { x: x + (outDir * 10), y: y - 5 }, // Out to flat
        { x: x + (outDir * 10), y: y - 35 } // Turn up field
    ]
  }
};

// --- Main App Component ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PLAYBOOK);
  const [plays, setPlays] = useState<Play[]>([]);
  const [currentPlay, setCurrentPlay] = useState<Play | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    setPlays(getPlays());
  }, [viewMode]);

  // --- Actions ---

  const handleCreatePlay = () => {
    const newPlay = createEmptyPlay();
    setCurrentPlay(newPlay);
    setViewMode(ViewMode.EDITOR);
    setShowMobileMenu(false);
  };

  const handleEditPlay = (play: Play) => {
    setCurrentPlay(JSON.parse(JSON.stringify(play))); // Deep copy
    setViewMode(ViewMode.EDITOR);
  };

  const handleDuplicatePlay = (e: React.MouseEvent, play: Play) => {
    e.stopPropagation();
    const duplicate: Play = {
      ...JSON.parse(JSON.stringify(play)),
      id: Math.random().toString(36).substring(2, 15),
      name: `${play.name} (Copy)`,
      updatedAt: Date.now(),
      createdAt: Date.now()
    };
    savePlay(duplicate);
    setPlays(getPlays());
  };

  const handleDeletePlay = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this play?')) {
      deletePlay(id);
      setPlays(getPlays());
    }
  };

  const handleSavePlay = () => {
    if (currentPlay) {
      savePlay(currentPlay);
      // Ideally show a toast here
      setViewMode(ViewMode.PLAYBOOK);
    }
  };

  const handleExportImage = () => {
    const svgElement = document.getElementById('play-field-svg');
    if (!svgElement) {
        alert('Could not find play field to export.');
        return;
    }

    try {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentPlay?.name || 'play'}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed', e);
        alert('Failed to export image.');
    }
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    if (!currentPlay) return;
    const updatedPlayers = currentPlay.players.map(p => 
      p.id === updatedPlayer.id ? updatedPlayer : p
    );
    setCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  const applyRoutePreset = (template: RouteTemplate) => {
    if (!currentPlay || !selectedPlayerId) return;
    const player = currentPlay.players.find(p => p.id === selectedPlayerId);
    if (!player) return;

    // Determine direction based on position relative to center (x=50)
    // If player is on left (<50), inside is +, outside is -
    // If player is on right (>50), inside is -, outside is +
    const isLeft = player.x < 50;
    const inDir = isLeft ? 1 : -1;
    const outDir = isLeft ? -1 : 1;

    const newRoute = template.getPoints(player.x, player.y, inDir, outDir);
    
    // Clamp points to field boundaries
    const clampedRoute = newRoute.map(p => ({
        x: Math.max(2, Math.min(98, p.x)),
        y: Math.max(2, Math.min(78, p.y))
    }));

    handleUpdatePlayer({ ...player, route: clampedRoute });
  };

  const handleAddDefender = () => {
    if (!currentPlay) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newDefender: Player = {
      id,
      label: 'D',
      role: PlayerRole.DEFENSE,
      x: 50,
      y: 30,
      color: '#dc2626',
      route: []
    };
    setCurrentPlay({
      ...currentPlay,
      players: [...currentPlay.players, newDefender]
    });
  };

  const handleDeletePlayer = () => {
      if (!currentPlay || !selectedPlayerId) return;
      const newPlayers = currentPlay.players.filter(p => p.id !== selectedPlayerId);
      setCurrentPlay({ ...currentPlay, players: newPlayers });
      setSelectedPlayerId(null);
  }

  const handleClearRoutes = () => {
    if (!currentPlay) return;
    const updatedPlayers = currentPlay.players.map(p => ({ ...p, route: [] }));
    setCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  const handleGenerateInsights = async () => {
    if (!currentPlay) return;
    setIsLoadingAI(true);
    const insights = await getCoachingInsights(currentPlay);
    setCurrentPlay({ ...currentPlay, notes: (currentPlay.notes ? currentPlay.notes + '\n\n' : '') + "🤖 AI Coach:\n" + insights });
    setIsLoadingAI(false);
  };

  // --- Views Render Functions ---
  // Defined as helper functions rather than components to avoid focus loss issues 
  // when defined inside the parent component's body.

  const renderPlaybookView = () => (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">My Playbook</h2>
            <p className="text-slate-500">Manage your formations and plays</p>
        </div>
        <button 
          onClick={handleCreatePlay}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
        >
          <Plus size={20} />
          <span>New Play</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {plays.map(play => (
          <div 
            key={play.id} 
            onClick={() => handleEditPlay(play)}
            className="group bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-full"
          >
            {/* Placeholder Preview */}
            <div className="h-32 bg-slate-100 relative flex items-center justify-center border-b border-slate-100">
                <div className="opacity-30 font-bold text-4xl text-slate-300 select-none">
                    {play.formation.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute inset-0 p-4 opacity-60">
                     {play.players.slice(0,3).map((p, i) => (
                         <div key={i} className="absolute w-2 h-2 rounded-full bg-indigo-400" style={{ left: `${p.x}%`, top: `${p.y}%`}} />
                     ))}
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-900 truncate pr-2">{play.name}</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">{play.formation}</span>
              </div>
              <div className="flex gap-1 flex-wrap mb-4">
                  {play.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">{tag}</span>
                  ))}
              </div>
              <div className="mt-auto pt-4 flex justify-between items-center border-t border-slate-50 text-slate-400">
                 <span className="text-xs">Updated {new Date(play.updatedAt).toLocaleDateString()}</span>
                 <div className="flex gap-2">
                    <button 
                        onClick={(e) => handleDuplicatePlay(e, play)}
                        className="hover:text-indigo-600 transition-colors p-1"
                        title="Duplicate"
                    >
                        <Copy size={16} />
                    </button>
                    <button 
                        onClick={(e) => handleDeletePlay(e, play.id)}
                        className="hover:text-red-600 transition-colors p-1"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                 </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {plays.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <LayoutDashboard size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">Your playbook is empty</p>
                <button onClick={handleCreatePlay} className="mt-4 text-indigo-600 hover:underline">Create your first play</button>
            </div>
        )}
      </div>
    </div>
  );

  const renderEditorView = () => {
    if (!currentPlay) return null;
    
    const activePlayer = currentPlay.players.find(p => p.id === selectedPlayerId);

    return (
      <div className="flex flex-col h-[calc(100vh-64px)] lg:flex-row bg-slate-50 overflow-hidden">
        {/* Left Sidebar - Details */}
        <div className="w-full lg:w-80 bg-white border-r border-slate-200 p-5 overflow-y-auto z-10 shadow-sm lg:h-full no-scrollbar">
           <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Play Name</label>
                    <input 
                        type="text" 
                        value={currentPlay.name}
                        onChange={(e) => setCurrentPlay({ ...currentPlay, name: e.target.value })}
                        className="w-full border-slate-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none border"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Formation</label>
                    <input 
                        type="text" 
                        value={currentPlay.formation}
                        onChange={(e) => setCurrentPlay({ ...currentPlay, formation: e.target.value })}
                        className="w-full border-slate-200 rounded-md p-2 text-sm outline-none border focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Trips Left"
                    />
                </div>
                <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes / Coaching Points</label>
                     <textarea 
                        value={currentPlay.notes}
                        onChange={(e) => setCurrentPlay({ ...currentPlay, notes: e.target.value })}
                        className="w-full border-slate-200 rounded-md p-2 text-sm h-24 lg:h-32 resize-none outline-none border focus:ring-2 focus:ring-indigo-500"
                        placeholder="Add coaching details here..."
                     />
                     <button 
                        onClick={handleGenerateInsights}
                        disabled={isLoadingAI}
                        className="mt-2 w-full flex items-center justify-center gap-2 text-xs bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 py-2 rounded border border-indigo-100 transition-colors"
                     >
                        <Wand2 size={14} />
                        {isLoadingAI ? 'Thinking...' : 'Ask AI Coach'}
                     </button>
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Tools</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleAddDefender} className="flex items-center justify-center gap-1 bg-white border border-slate-200 p-2 rounded hover:bg-slate-50 text-xs font-medium text-slate-700">
                            <Users size={14} /> Add Defense
                        </button>
                         <button onClick={handleClearRoutes} className="flex items-center justify-center gap-1 bg-white border border-slate-200 p-2 rounded hover:bg-slate-50 text-xs font-medium text-slate-700">
                            <Trash2 size={14} /> Clear Routes
                        </button>
                    </div>
                </div>
           </div>
        </div>

        {/* Center - Field */}
        <div className="flex-1 bg-slate-100 p-2 sm:p-4 lg:p-8 relative overflow-hidden flex items-center justify-center">
             {/* Aspect ratio of 100/80 = 1.25 */}
             <div className="w-full max-w-4xl aspect-[1.25] shadow-xl rounded-lg border-4 border-white bg-white relative">
                <Field 
                    play={currentPlay} 
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                    onUpdatePlayer={handleUpdatePlayer}
                />
                
                {/* Instructions Overlay */}
                <div className="absolute top-4 left-4 right-4 sm:right-auto bg-white/90 backdrop-blur-sm px-3 py-2 rounded text-xs text-slate-500 pointer-events-none shadow-sm border border-slate-100 z-10">
                    <p className="hidden sm:block">Drag players to move • Click to select • Click field to add route</p>
                    <p className="sm:hidden">Tap player to select • Drag to move • Tap field for route</p>
                </div>
             </div>
        </div>

        {/* Right Sidebar - Contextual */}
        <div className="hidden lg:block w-64 bg-white border-l border-slate-200 p-5 overflow-y-auto">
            {activePlayer ? (
                <div className="animate-fade-in">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span 
                            className="w-3 h-3 rounded-full block" 
                            style={{ backgroundColor: activePlayer.color === '#dc2626' ? '#dc2626' : '#2563eb' }}
                        />
                        {activePlayer.role === PlayerRole.OFFENSE ? 'Offensive Player' : 'Defender'}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Label</label>
                             <input 
                                type="text" 
                                value={activePlayer.label}
                                maxLength={3}
                                onChange={(e) => handleUpdatePlayer({...activePlayer, label: e.target.value})}
                                className="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                        </div>

                        {/* Quick Routes (Only for Offense) */}
                        {activePlayer.role === PlayerRole.OFFENSE && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Quick Routes</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.values(ROUTE_PRESETS).map((preset) => (
                                        <button
                                            key={preset.label}
                                            onClick={() => applyRoutePreset(preset)}
                                            className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors gap-1 group"
                                            title={preset.label}
                                        >
                                            <div className="text-slate-500 group-hover:text-indigo-600">
                                                {preset.icon}
                                            </div>
                                            <span className="text-[10px] font-medium">{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                         <div>
                             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Color</label>
                             <div className="flex gap-2 flex-wrap">
                                 {['#2563eb', '#dc2626', '#ea580c', '#16a34a', '#9333ea', '#000000'].map(c => (
                                     <button 
                                        key={c}
                                        onClick={() => handleUpdatePlayer({...activePlayer, color: c})}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${activePlayer.color === c ? 'border-slate-400 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                     />
                                 ))}
                             </div>
                        </div>
                        <div className="pt-2 space-y-2">
                            <button 
                                onClick={() => handleUpdatePlayer({ ...activePlayer, route: [] })}
                                className="w-full py-2 text-xs text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50"
                            >
                                Reset Route
                            </button>
                            <button 
                                onClick={handleDeletePlayer}
                                className="w-full py-2 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                            >
                                Delete Player
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-slate-400 mt-10">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a player to edit properties.</p>
                </div>
            )}
        </div>
      </div>
    );
  };

  // --- Main Render ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            {viewMode === ViewMode.EDITOR && (
                <button onClick={() => setViewMode(ViewMode.PLAYBOOK)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                    <ChevronLeft size={20} />
                </button>
            )}
            <div className="flex items-center gap-2">
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                    <LayoutDashboard size={20} />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-800 hidden sm:block">PlayMaker <span className="text-indigo-600">5v5</span></h1>
                <h1 className="text-lg font-bold tracking-tight text-slate-800 sm:hidden">PlayMaker</h1>
            </div>
        </div>

        <div className="flex items-center gap-2">
           {viewMode === ViewMode.EDITOR && (
               <>
                 <button 
                    onClick={handleExportImage} 
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full hidden sm:flex items-center gap-1" 
                    title="Export as SVG"
                 >
                    <Download size={20} />
                 </button>
                 <button 
                    onClick={handleSavePlay}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                 >
                    <Save size={16} />
                    <span>Save</span>
                 </button>
               </>
           )}
           {/* Mobile Menu Toggle */}
           <div className="sm:hidden ml-2">
               <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-slate-600">
                   {showMobileMenu ? <CloseIcon size={24} /> : <Menu size={24} />}
               </button>
           </div>
        </div>
      </header>
      
      {/* Mobile Drawer */}
      {showMobileMenu && (
          <div className="sm:hidden fixed inset-0 z-40 bg-white pt-16 px-4 animate-fade-in">
              <nav className="space-y-2 mt-4">
                  <button onClick={() => { setViewMode(ViewMode.PLAYBOOK); setShowMobileMenu(false); }} className="w-full text-left p-3 rounded-lg bg-slate-100 font-medium">Playbook</button>
                  <button onClick={handleCreatePlay} className="w-full text-left p-3 rounded-lg text-indigo-600 font-medium">Create New Play</button>
                  {viewMode === ViewMode.EDITOR && (
                      <button onClick={() => { handleExportImage(); setShowMobileMenu(false); }} className="w-full text-left p-3 rounded-lg text-slate-600 font-medium">Download Image</button>
                  )}
                  <div className="border-t my-2"></div>
                  <p className="text-xs text-slate-400 text-center mt-4">PlayMaker 5v5 MVP</p>
              </nav>
          </div>
      )}

      {/* Content Area */}
      <main className="h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden">
        {viewMode === ViewMode.PLAYBOOK && renderPlaybookView()}
        {viewMode === ViewMode.EDITOR && renderEditorView()}
      </main>
    </div>
  );
};

export default App;