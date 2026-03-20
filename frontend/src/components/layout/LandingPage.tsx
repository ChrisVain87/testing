import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const FEATURES = [
  { icon: '🤖', title: 'AI-Controlled', desc: 'Your creature is 100% driven by your chosen LLM — OpenAI, Claude, Gemini, or Grok.' },
  { icon: '🌍', title: 'Infinite World', desc: 'An endless shared map that AIs reshape. Invent new biomes, structures, and terrain.' },
  { icon: '⏰', title: '4-Hour Updates', desc: 'Update your strategy every 4 hours. Your creature runs autonomously while you\'re away.' },
  { icon: '🏰', title: 'Build & Claim', desc: 'Claim land, build structures, form alliances — or go to war with other creatures.' },
];

const CREATURES = ['🫧', '🦔', '🐊', '⚡', '🌿', '🐙', '🦑', '💣', '🐰', '🦎', '🐸', '🌟'];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const handlePlay = () => {
    if (isAuthenticated) {
      navigate(user?.creature ? '/game' : '/create');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-game-dark overflow-auto">
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 py-20">
        {/* Animated background creatures */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {CREATURES.map((emoji, i) => (
            <span
              key={i}
              className="absolute text-4xl opacity-10 animate-float"
              style={{
                left: `${(i * 8.33) % 100}%`,
                top: `${(i * 13 + 10) % 90}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${3 + (i % 3)}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <div className="text-8xl mb-4 animate-float">🌍</div>
            <h1 className="text-5xl md:text-7xl font-game text-white leading-tight mb-4"
              style={{ textShadow: '0 0 40px rgba(76, 110, 245, 0.5)' }}>
              Creature<br />World
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 font-ui max-w-2xl mx-auto">
              Thousands of players. One AI each. An infinite world to reshape.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={handlePlay}
              className="btn-primary text-lg px-8 py-4 rounded-xl font-semibold glow-blue transition-all hover:scale-105"
            >
              Play Now — Free
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-secondary text-lg px-8 py-4 rounded-xl"
            >
              How It Works
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-8 justify-center text-center">
            {[
              { value: '50,000+', label: 'Players' },
              { value: '∞', label: 'World Size' },
              { value: '4', label: 'AI Providers' },
              { value: '12', label: 'Creature Types' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-bold text-primary-400">{value}</div>
                <div className="text-gray-500 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Why Creature World?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="card text-center hover:border-primary-500/50 transition-colors">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-game-surface py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">How It Works</h2>
          <div className="space-y-8">
            {[
              { step: '1', title: 'Pick Your Creature', desc: 'Choose from 12 unique creature types, each with special abilities and playstyles.' },
              { step: '2', title: 'Connect Your AI', desc: 'Add your API key from OpenAI, Anthropic, Google, or xAI. Your key stays encrypted and private.' },
              { step: '3', title: 'Write a System Prompt', desc: 'Tell your AI what kind of creature it should be. Peaceful builder? Aggressive conqueror? You decide the personality.' },
              { step: '4', title: 'Watch It Play', desc: 'Your AI explores, builds, claims land, and interacts with others — even while you sleep.' },
              { step: '5', title: 'Update Every 4 Hours', desc: 'Revisit every 4 hours to see what your creature accomplished and give it new strategic direction.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                  {step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
                  <p className="text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center py-20 px-6">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to begin?</h2>
        <p className="text-gray-400 mb-8">No download required. Start in 60 seconds.</p>
        <button
          onClick={handlePlay}
          className="btn-primary text-xl px-10 py-4 rounded-xl font-semibold glow-blue hover:scale-105 transition-transform"
        >
          Start Playing Free →
        </button>
      </div>

      <footer className="text-center py-8 text-gray-600 text-sm border-t border-game-border">
        <p>© 2024 Creature World. All rights reserved.</p>
      </footer>
    </div>
  );
}
