import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { api } from '../../services/api';
import type { Creature, CreatureMemory } from '../../types';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'creature' | 'memories' | 'leaderboard' | 'events';

export function CreatureSidebar() {
  const { sidebarOpen, myCreature, globalEvents, topBiomes, setTopBiomes } = useGameStore();
  const [tab, setTab] = useState<Tab>('creature');
  const [memories, setMemories] = useState<CreatureMemory[]>([]);
  const [leaderboard, setLeaderboard] = useState<Creature[]>([]);

  useEffect(() => {
    api.getTopBiomes().then(({ data }) => setTopBiomes(data)).catch(() => {});
  }, [setTopBiomes]);

  useEffect(() => {
    if (tab === 'memories') {
      api.getMyMemories().then((res) => setMemories(res.items)).catch(() => {});
    }
    if (tab === 'leaderboard') {
      api.getLeaderboard().then((res) => setLeaderboard(res.items)).catch(() => {});
    }
  }, [tab]);

  if (!sidebarOpen || !myCreature) return null;

  return (
    <div className="fixed left-0 top-14 bottom-0 w-80 glass border-r border-game-border z-20 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-game-border shrink-0">
        {([
          { key: 'creature', icon: '🐾', label: 'Creature' },
          { key: 'memories', icon: '🧠', label: 'Memory' },
          { key: 'leaderboard', icon: '🏆', label: 'Top' },
          { key: 'events', icon: '📡', label: 'Events' },
        ] as { key: Tab; icon: string; label: string }[]).map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs flex flex-col items-center gap-0.5 transition-colors ${
              tab === key ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">

        {tab === 'creature' && (
          <CreatureTab creature={myCreature} />
        )}

        {tab === 'memories' && (
          <MemoriesTab memories={memories} />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardTab creatures={leaderboard} myId={myCreature.id} />
        )}

        {tab === 'events' && (
          <EventsTab events={globalEvents} />
        )}
      </div>

      {/* Bottom: Biomes invented */}
      {topBiomes.length > 0 && tab === 'creature' && (
        <div className="border-t border-game-border p-3 shrink-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">🌍 Recent Biome Inventions</p>
          <div className="flex gap-2 overflow-x-auto">
            {topBiomes.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex-shrink-0 rounded-lg px-2 py-1 text-xs text-white border border-game-border"
                style={{ backgroundColor: `#${b.color.toString(16).padStart(6, '0')}33` }}
              >
                {b.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatureTab({ creature }: { creature: Creature }) {
  const stats = creature.stats;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="text-5xl">{creature.emoji}</div>
        <div>
          <h2 className="text-white font-bold text-lg">{creature.name}</h2>
          <p className="text-gray-400 text-sm">Lvl {stats.level} • {creature.ownerUsername}</p>
          <div className="flex gap-1 mt-1">
            <span className="badge badge-blue">Lv {stats.level}</span>
            {creature.isOnline && <span className="badge badge-green">Online</span>}
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>XP</span>
          <span>{stats.experience}/{stats.experienceToNext}</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill bg-gradient-to-r from-purple-500 to-primary-500"
            style={{ width: `${(stats.experience / stats.experienceToNext) * 100}%` }}
          />
        </div>
      </div>

      {/* Vital stats */}
      <div className="space-y-2">
        <StatBar label="❤️ Health" value={stats.health} max={stats.maxHealth} color="bg-red-500" />
        <StatBar label="⚡ Energy" value={stats.energy} max={stats.maxEnergy} color="bg-yellow-500" />
        <StatBar label="🌾 Food" value={stats.food} max={stats.maxFood} color="bg-green-500" />
        <StatBar label="🪵 Materials" value={stats.materials} max={stats.maxMaterials} color="bg-amber-700" />
      </div>

      {/* Territory stats */}
      <div className="card-elevated space-y-2">
        <h3 className="text-white text-sm font-semibold">Territory</h3>
        <div className="stat-row"><span className="stat-label">Tiles Owned</span><span className="stat-value">{creature.totalTilesOwned.toLocaleString()}</span></div>
        <div className="stat-row"><span className="stat-label">Structures</span><span className="stat-value">{creature.totalStructures}</span></div>
        <div className="stat-row"><span className="stat-label">Biomes Invented</span><span className="stat-value">{creature.biomeInventions}</span></div>
        <div className="stat-row"><span className="stat-label">Alliances</span><span className="stat-value">{creature.alliances.length}</span></div>
      </div>

      {/* Current behavior plan */}
      {creature.currentBehaviorPlan && (
        <div className="card-elevated">
          <h3 className="text-white text-sm font-semibold mb-2">🧠 Current Plan</h3>
          <p className="text-gray-300 text-xs italic mb-2">"{creature.currentBehaviorPlan.summary}"</p>
          <p className="text-gray-500 text-xs">Goal: {creature.currentBehaviorPlan.goal}</p>
          <div className="mt-2 space-y-1">
            {creature.currentBehaviorPlan.actions.slice(0, 3).map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={action.completed ? 'text-green-400' : 'text-gray-500'}>
                  {action.completed ? '✓' : '○'}
                </span>
                <span className={action.completed ? 'text-gray-500 line-through' : 'text-gray-300'}>
                  {action.type.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position */}
      <div className="text-xs text-gray-500 text-center">
        📍 Position: ({creature.position.x}, {creature.position.y})
        {' '}• Chunk ({creature.position.chunkX}, {creature.position.chunkY})
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function MemoriesTab({ memories }: { memories: CreatureMemory[] }) {
  const categoryColors: Record<string, string> = {
    exploration: 'badge-blue',
    combat: 'badge-red',
    building: 'badge-yellow',
    social: 'badge-green',
    discovery: 'badge-blue',
    economy: 'badge-yellow',
  };

  if (memories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">🧠</div>
        <p className="text-sm">No memories yet. Your creature will form memories as it explores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-gray-500 text-xs">Your creature's most important memories</p>
      {memories.map((m) => (
        <div key={m.id} className="card-elevated">
          <div className="flex justify-between items-start mb-2">
            <span className={`badge ${categoryColors[m.category] ?? 'badge-blue'}`}>{m.category}</span>
            <span className="text-gray-600 text-xs">
              {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-gray-300 text-sm">{m.content}</p>
          <div className="mt-2 flex items-center gap-1 text-yellow-400 text-xs">
            {'⭐'.repeat(Math.min(5, m.importance))}
            <span className="text-gray-600 ml-1">importance {m.importance}/10</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderboardTab({ creatures, myId }: { creatures: Creature[]; myId: string }) {
  if (creatures.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">🏆</div>
        <p className="text-sm">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {creatures.map((c, idx) => (
        <div
          key={c.id}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            c.id === myId
              ? 'border-primary-500/50 bg-primary-900/20'
              : 'border-game-border bg-game-elevated'
          }`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
            idx === 0 ? 'bg-yellow-500 text-black' :
            idx === 1 ? 'bg-gray-400 text-black' :
            idx === 2 ? 'bg-amber-700 text-white' :
            'bg-game-darker text-gray-400'
          }`}>
            {idx + 1}
          </div>
          <div className="text-xl">{c.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{c.name}</div>
            <div className="text-gray-500 text-xs">@{c.ownerUsername} • Lv {c.stats.level}</div>
          </div>
          <div className="text-right">
            <div className="text-yellow-400 text-xs font-bold">{c.totalTilesOwned.toLocaleString()}</div>
            <div className="text-gray-600 text-xs">tiles</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsTab({ events }: { events: ReturnType<typeof useGameStore.getState>['globalEvents'] }) {
  const typeIcons: Record<string, string> = {
    biome_invented: '🌍',
    structure_built: '🏗️',
    land_claimed: '🚩',
    battle: '⚔️',
    alliance: '🤝',
    level_up: '⭐',
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">📡</div>
        <p className="text-sm">World events will appear here as they happen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={`${e.creatureId}-${i}`} className="card-elevated text-xs">
          <div className="flex items-start gap-2">
            <span className="text-lg">{typeIcons[e.type] ?? '📌'}</span>
            <div className="flex-1">
              <span className="text-primary-400 font-medium">{e.creatureName}</span>
              <span className="text-gray-400"> {e.type.replace(/_/g, ' ')}</span>
              {e.type === 'biome_invented' && (
                <span className="text-green-400"> "{(e.details as { biomeName?: string }).biomeName}"</span>
              )}
            </div>
            <span className="text-gray-600 shrink-0">
              {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
