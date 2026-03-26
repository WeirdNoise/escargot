import { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, HelpCircle, X } from 'lucide-react';
import OldFilmEffect from './components/OldFilmEffect';

// --- Types & Constants ---
type GameState = 'START' | 'COUNTDOWN' | 'RACING' | 'RESULT';
type Difficulty = 'FACILE' | 'NORMAL' | 'DIFFICILE';

interface Snail {
  id: number;
  x: number;
  y: number;
  speed: number;
  isPlayer: boolean;
  finished: boolean;
  finishTime?: number;
}

const SNAIL_COUNT = 6;
const START_LINE_OFFSET = 60;
const FINISH_LINE_OFFSET = 100;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [countdown, setCountdown] = useState(5);
  const [winner, setWinner] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  
  // Paramètres réglables
  const [spamAmount, setSpamAmount] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snailsRef = useRef<Snail[]>([]);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);

  // --- Gestion du Responsive ---
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Si on redimensionne pendant la course, on ajuste proportionnellement les positions X
      if (snailsRef.current.length > 0) {
        const ratio = width / canvasSize.width;
        snailsRef.current.forEach(s => {
          s.x *= ratio;
          // On recalcule aussi Y pour les couloirs
          const laneHeight = height / (SNAIL_COUNT + 1);
          s.y = laneHeight * s.id;
        });
      }
      
      setCanvasSize({ width, height });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasSize.width]);

  // --- Initialisation des escargots ---
  const initSnails = useCallback(() => {
    const laneHeight = canvasSize.height / (SNAIL_COUNT + 1);
    const newSnails: Snail[] = [];
    for (let i = 0; i < SNAIL_COUNT; i++) {
      newSnails.push({
        id: i + 1,
        x: START_LINE_OFFSET,
        y: laneHeight * (i + 1),
        speed: 0,
        isPlayer: i === 0,
        finished: false,
      });
    }
    snailsRef.current = newSnails;
  }, [canvasSize]);

  // --- Dessin d'un escargot ---
  const drawSnail = (ctx: CanvasRenderingContext2D, snail: Snail) => {
    const { x, y } = snail;
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 3; // Un peu plus épais

    // Corps (Grossi)
    ctx.beginPath();
    ctx.moveTo(x - 25, y + 12);
    ctx.lineTo(x + 25, y + 12);
    ctx.quadraticCurveTo(x + 32, y + 12, x + 32, y + 6);
    ctx.lineTo(x + 28, y - 8);
    ctx.moveTo(x + 32, y + 6);
    ctx.lineTo(x + 36, y - 8);
    ctx.stroke();

    // Coquille (Grossie)
    ctx.beginPath();
    const centerX = x - 8;
    const centerY = y;
    const radius = 18; // Plus grand
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Spirale
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = 0.5 * i;
      const r = (i / 20) * radius;
      const sx = centerX + r * Math.cos(angle);
      const sy = centerY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Dossard (Bib) - Grossi
    const bibSize = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(centerX - bibSize/2, centerY - bibSize/2, bibSize, bibSize);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - bibSize/2, centerY - bibSize/2, bibSize, bibSize);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial'; // Plus gros numéro
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(snail.id.toString(), centerX, centerY);
  };

  // --- Boucle de jeu principale ---
  const animate = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const finishLineX = canvasSize.width - FINISH_LINE_OFFSET;

    // Effacer l'écran
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessin de la ligne d'arrivée (plus grosse : 4 colonnes)
    const boxSize = 15;
    const columns = 4;
    for (let col = 0; col < columns; col++) {
      for (let i = 0; i < canvas.height / boxSize; i++) {
        ctx.fillStyle = (i + col) % 2 === 0 ? '#FFFFFF' : '#000000';
        ctx.fillRect(finishLineX + (col * boxSize), i * boxSize, boxSize, boxSize);
      }
    }

    // Dessin des lignes de séparation
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const laneHeight = canvas.height / (SNAIL_COUNT + 1);
    for (let i = 0; i <= SNAIL_COUNT; i++) {
      const ly = laneHeight * i + laneHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(canvas.width, ly);
      ctx.stroke();
    }

    // Multiplicateur de difficulté (réduit pour être plus facile)
    const diffMult = difficulty === 'FACILE' ? 0.2 : difficulty === 'NORMAL' ? 0.4 : 0.8;

    // Mise à jour et dessin
    snailsRef.current.forEach((snail) => {
      if (gameState === 'RACING' && !snail.finished) {
        if (!snail.isPlayer) {
          const baseSpeed = (canvasSize.width / 15000) * diffMult;
          const fluctuation = Math.random() * (canvasSize.width / 10000) * diffMult;
          snail.x += (baseSpeed + fluctuation) * deltaTime;
        }

        if (snail.x >= finishLineX) {
          snail.finished = true;
          snail.finishTime = Date.now();
          if (winner === null) {
            setWinner(snail.id);
            setGameState('RESULT');
          }
        }
      }
      
      drawSnail(ctx, snail);
    });

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, winner, difficulty, canvasSize]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // --- Actions ---
  const startGame = () => {
    initSnails();
    setWinner(null);
    setCountdown(5);
    setGameState('COUNTDOWN');
  };

  const handleSpam = useCallback(() => {
    if (gameState !== 'RACING') return;
    const playerSnail = snailsRef.current.find(s => s.isPlayer);
    if (playerSnail && !playerSnail.finished) {
      playerSnail.x += spamAmount; // Vitesse par clic réglable
    }
  }, [gameState, spamAmount]);

  // Gestion du clavier (Espace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSpam();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpam]);

  // Compte à rebours
  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('RACING');
      }
    }
  }, [gameState, countdown]);

  // Retour à l'accueil après 4 secondes en fin de partie
  useEffect(() => {
    if (gameState === 'RESULT') {
      const timer = setTimeout(() => {
        setGameState('START');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  return (
    <div className="min-h-screen bg-[#111] text-white font-mono flex flex-col items-center justify-center p-4 select-none overflow-hidden relative">
      <OldFilmEffect />
      
      {/* Header Icons */}
      <div className="absolute top-6 right-6 flex gap-4 z-50">
        <button 
          onClick={() => setShowHelp(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          <HelpCircle size={24} />
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Main Game Area */}
      {gameState === 'START' ? (
        <div className="flex flex-col items-center justify-center animate-in fade-in duration-700">
          <h1 className="text-7xl md:text-9xl font-bold italic uppercase mb-12 title-glow font-sketch px-4 text-center animate-float">
            L'ESCARGOT
          </h1>
          
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={startGame}
              className="px-12 py-4 border-2 border-white text-3xl font-bold hover:bg-white hover:text-black transition-all duration-300 cursor-pointer tracking-widest uppercase font-sketch"
            >
              Prêt pour la course ?
            </button>
            <span className="text-xs opacity-40 tracking-widest font-mono">v1.0.0</span>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full bg-black flex items-center justify-center p-8">
          <div className="border-4 border-white overflow-hidden bg-[#111] relative w-full h-full">
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="block w-full h-full"
            />

          {/* Overlay: Countdown */}
          {gameState === 'COUNTDOWN' && ( countdown > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <span className="text-9xl font-bold animate-ping text-white font-sketch">{countdown}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-9xl font-bold animate-bounce text-white font-sketch">GO!</span>
            </div>
          ))}

          {/* Overlay: Result */}
          {gameState === 'RESULT' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
              <h2 className="text-5xl md:text-7xl font-bold uppercase italic font-sketch title-glow leading-tight mb-4">
                L'escargot n°{winner} a gagné !
              </h2>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#222] border-2 border-white p-8 w-full max-w-md relative animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-black uppercase italic mb-8 border-b border-white/20 pb-2">Réglages</h2>
            
            <div className="space-y-8">
              <div>
                <label className="block text-sm uppercase tracking-widest mb-4 opacity-70">
                  Quantité de spam ({spamAmount}px)
                </label>
                <input 
                  type="range" 
                  min="2" 
                  max="20" 
                  step="1"
                  value={spamAmount}
                  onChange={(e) => setSpamAmount(parseInt(e.target.value))}
                  className="w-full accent-white"
                />
              </div>
              
              <div>
                <label className="block text-sm uppercase tracking-widest mb-4 opacity-70">
                  Difficulté Solo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['FACILE', 'NORMAL', 'DIFFICILE'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`py-2 text-xs font-bold border ${
                        difficulty === d ? 'bg-white text-black border-white' : 'border-white/30 hover:border-white'
                      } transition-all`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-10 py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
            >
              Valider
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#222] border-2 border-white p-8 w-full max-w-md relative animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-black uppercase italic mb-8 border-b border-white/20 pb-2">Règles du jeu</h2>
            
            <div className="space-y-4 text-sm leading-relaxed">
              <p>C'est une course d'escargots. Vous contrôlez l'escargot <span className="font-bold border-b">n°1</span>.</p>
              <div className="bg-white/5 p-4 border-l-4 border-white">
                <p className="font-bold uppercase mb-1">Contrôles :</p>
                <p>Appuyez de manière répétée sur la <span className="bg-white text-black px-1 font-bold">BARRE D'ESPACE</span> pour faire avancer votre escargot.</p>
              </div>
              <p className="opacity-60 italic mt-4">Note : Les contrôleurs MIDI seront configurés ultérieurement pour jouer à 6.</p>
            </div>
            
            <button
              onClick={() => setShowHelp(false)}
              className="w-full mt-10 py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
            >
              Compris !
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
