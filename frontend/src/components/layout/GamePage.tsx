import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, destroyGame } from '../../game/GameManager';
import { socketService } from '../../services/socket';
import { api } from '../../services/api';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { CreatureSidebar } from '../game/CreatureSidebar';
import { TopBar } from '../game/TopBar';
import { NotificationToasts } from '../game/NotificationToasts';
import { PromptModal } from '../game/PromptModal';

export function GamePage() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameReady, setGameReady] = useState(false);
  const navigate = useNavigate();
  const { setMyCreature } = useGameStore();
  const { user } = useAuthStore();

  // Load creature
  useEffect(() => {
    if (!user?.creature) {
      navigate('/create');
      return;
    }

    api.getMyCreature()
      .then(({ data }) => {
        setMyCreature(data);
        window.dispatchEvent(new CustomEvent('game:creature_updated'));
      })
      .catch(() => navigate('/create'));
  }, [user, navigate, setMyCreature]);

  // Init Phaser
  useEffect(() => {
    if (!gameContainerRef.current) return;

    const handleLoaded = () => setGameReady(true);
    window.addEventListener('game:loaded', handleLoaded);

    const game = createGame(gameContainerRef.current);

    return () => {
      window.removeEventListener('game:loaded', handleLoaded);
      destroyGame();
      void game;
    };
  }, []);

  // Connect WebSocket
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Phaser canvas */}
      <div id="game-container" ref={gameContainerRef} />

      {/* Loading overlay */}
      {!gameReady && (
        <div className="absolute inset-0 bg-game-dark flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-float">🌍</div>
            <p className="text-white font-bold text-lg mb-2">Loading World...</p>
            <p className="text-gray-400 text-sm">Generating your corner of the universe</p>
          </div>
        </div>
      )}

      {/* UI Overlay */}
      {gameReady && (
        <div className="ui-overlay">
          <TopBar />
          <CreatureSidebar />
          <NotificationToasts />
          <PromptModal />
        </div>
      )}
    </div>
  );
}
