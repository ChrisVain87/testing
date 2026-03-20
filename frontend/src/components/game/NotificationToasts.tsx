import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Notification } from '../../types';

export function NotificationToasts() {
  const { notifications } = useGameStore();
  const [visible, setVisible] = useState<Notification[]>([]);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest) return;

    setVisible((prev) => {
      if (prev.find((n) => n.id === latest.id)) return prev;
      return [latest, ...prev].slice(0, 4);
    });

    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((n) => n.id !== latest.id));
    }, 4000);

    return () => clearTimeout(timer);
  }, [notifications]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {visible.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={() => setVisible((p) => p.filter((x) => x.id !== n.id))} />
      ))}
    </div>
  );
}

function ToastItem({ notification: n, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const borderColors: Record<string, string> = {
    success: 'border-green-500',
    warning: 'border-yellow-500',
    error: 'border-red-500',
    event: 'border-purple-500',
    info: 'border-blue-500',
  };

  const icons: Record<string, string> = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    event: '🌟',
    info: 'ℹ️',
  };

  return (
    <div
      className={`glass rounded-xl p-3 w-72 border-l-4 pointer-events-auto animate-slide-in ${borderColors[n.type]}`}
      style={{ animation: 'slideIn 0.2s ease-out' }}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0">{icons[n.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium">{n.title}</div>
          <div className="text-gray-400 text-xs mt-0.5 truncate">{n.message}</div>
        </div>
        <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 shrink-0 text-sm">✕</button>
      </div>
    </div>
  );
}
