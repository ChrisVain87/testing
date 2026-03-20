import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';

export function TopBar() {
  const { myCreature, notifications, unreadCount, markNotificationsRead, setActiveModal, setSidebarOpen, sidebarOpen } = useGameStore();
  const { logout } = useAuthStore();

  const cooldownEndsAt = myCreature?.promptCooldownEndsAt
    ? new Date(myCreature.promptCooldownEndsAt)
    : null;
  const cooldownActive = cooldownEndsAt && cooldownEndsAt > new Date();

  return (
    <div className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 gap-3 z-20">
      {/* Left: Logo + toggle */}
      <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="text-xl">🌍</span>
        <span className="text-white font-bold text-sm hidden sm:block">Creature World</span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-2 text-gray-400 hover:text-white transition-colors"
          title="Toggle sidebar"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Center: My creature quick stats */}
      {myCreature && (
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-4 flex-1 max-w-md mx-auto">
          <span className="text-xl">{myCreature.emoji}</span>
          <span className="text-white text-sm font-medium hidden sm:block">{myCreature.name}</span>

          <div className="flex gap-3 ml-auto">
            {/* HP */}
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 text-xs">❤️</span>
              <div className="w-16 progress-bar">
                <div
                  className="progress-fill bg-red-500"
                  style={{ width: `${(myCreature.stats.health / myCreature.stats.maxHealth) * 100}%` }}
                />
              </div>
            </div>
            {/* Energy */}
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400 text-xs">⚡</span>
              <div className="w-16 progress-bar">
                <div
                  className="progress-fill bg-yellow-500"
                  style={{ width: `${(myCreature.stats.energy / myCreature.stats.maxEnergy) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Update Prompt button */}
        <button
          onClick={() => setActiveModal('prompt')}
          disabled={!!cooldownActive}
          className={`glass rounded-xl px-3 py-2 text-sm font-medium transition-all ${
            cooldownActive
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-primary-400 hover:text-primary-300 hover:glow-blue'
          }`}
          title={cooldownActive
            ? `Prompt available ${formatDistanceToNow(cooldownEndsAt!, { addSuffix: true })}`
            : 'Update creature prompt'
          }
        >
          {cooldownActive ? `⏳ ${formatDistanceToNow(cooldownEndsAt!)}` : '✏️ Prompt'}
        </button>

        {/* Notifications */}
        <button
          onClick={markNotificationsRead}
          className="glass rounded-xl p-2 relative text-gray-400 hover:text-white transition-colors"
        >
          🔔
          {unreadCount > 0 && (
            <span className="notification-dot flex items-center justify-center text-white text-xs font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveModal('settings')}
          className="glass rounded-xl p-2 text-gray-400 hover:text-white transition-colors"
        >
          ⚙️
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="glass rounded-xl p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Logout"
        >
          🚪
        </button>
      </div>

      {/* Hidden notification list for hover */}
      {unreadCount > 0 && (
        <div className="fixed top-16 right-4 z-30 w-80 space-y-2 pointer-events-auto">
          {notifications.filter((n) => !n.read).slice(0, 3).map((n) => (
            <div
              key={n.id}
              className={`glass rounded-xl p-3 border-l-2 ${
                n.type === 'success' ? 'border-green-500' :
                n.type === 'warning' ? 'border-yellow-500' :
                n.type === 'error' ? 'border-red-500' :
                n.type === 'event' ? 'border-purple-500' : 'border-blue-500'
              }`}
            >
              <div className="text-white text-sm font-medium">{n.title}</div>
              <div className="text-gray-400 text-xs mt-0.5">{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
