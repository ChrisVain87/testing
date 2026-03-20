import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CREATURE_PRESETS, LLM_PROVIDERS, type CreaturePreset, type LLMProvider } from '../../types';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';

const schema = z.object({
  name: z.string().min(1, 'Required').max(20, 'Max 20 characters'),
  preset: z.string(),
  colorVariant: z.number().int().min(0).max(4),
  llmProvider: z.enum(['openai', 'anthropic', 'google', 'xai']),
  apiKey: z.string().min(10, 'API key too short'),
  systemPrompt: z.string().min(10, 'Write at least a short prompt').max(2000, 'Max 2000 characters'),
});

type FormData = z.infer<typeof schema>;

const EXAMPLE_PROMPTS = [
  "I am a peaceful builder. My goal is to create beautiful structures and form alliances with everyone I meet. I prioritize exploration and discovery over conflict.",
  "I am an aggressive conqueror. I claim as much land as possible, build defensive towers, and challenge any creature that enters my territory.",
  "I am a scientist explorer. I invent new biomes and terrain types, documenting the world's wonders. I avoid conflict and trade knowledge for resources.",
  "I am a merchant diplomat. I build markets and establish trade routes. I form alliances strategically and use economics rather than force.",
];

export function CreateCreaturePage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser, user } = useAuthStore();
  const { setMyCreature } = useGameStore();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      preset: 'blobbo',
      colorVariant: 0,
      llmProvider: 'openai',
      systemPrompt: EXAMPLE_PROMPTS[0],
    },
  });

  const preset = form.watch('preset') as CreaturePreset;
  const provider = form.watch('llmProvider') as LLMProvider;
  const systemPrompt = form.watch('systemPrompt');

  const handleSubmit = async (data: FormData) => {
    try {
      setError('');
      const res = await api.createCreature({
        name: data.name,
        preset: data.preset as CreaturePreset,
        colorVariant: data.colorVariant,
        llmProvider: data.llmProvider as LLMProvider,
        apiKey: data.apiKey,
        systemPrompt: data.systemPrompt,
      });
      setMyCreature(res.data);
      if (user) {
        setUser({ ...user, creature: res.data });
      }
      navigate('/game');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to create creature');
    }
  };

  const steps = ['Choose Creature', 'Connect AI', 'Write Prompt', 'Launch!'];

  return (
    <div className="min-h-screen bg-game-dark overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✨</div>
          <h1 className="text-3xl font-bold text-white">Create Your Creature</h1>
          <p className="text-gray-400 mt-2">You can only have one creature, so choose wisely!</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                i <= step ? 'bg-primary-600 text-white' : 'bg-game-elevated text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 transition-colors ${i < step ? 'bg-primary-600' : 'bg-game-border'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {/* Step 0: Choose creature */}
          {step === 0 && (
            <div className="card space-y-6">
              <div>
                <label className="label">Creature Name</label>
                <input
                  {...form.register('name')}
                  className="input"
                  placeholder="Give your creature a unique name"
                  maxLength={20}
                />
                {form.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="label">Choose Your Species</label>
                <div className="grid grid-cols-4 gap-3">
                  {(Object.entries(CREATURE_PRESETS) as [CreaturePreset, typeof CREATURE_PRESETS[CreaturePreset]][]).map(([key, data]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => form.setValue('preset', key)}
                      className={`p-3 rounded-xl border-2 text-center transition-all hover:scale-105 ${
                        preset === key
                          ? 'border-primary-500 bg-primary-900/30'
                          : 'border-game-border bg-game-elevated hover:border-game-border/80'
                      }`}
                    >
                      <div className="text-3xl mb-1">{data.emoji}</div>
                      <div className="text-xs text-gray-300 font-medium">{data.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Show selected creature info */}
              {CREATURE_PRESETS[preset] && (
                <div className="bg-game-elevated rounded-lg p-4 flex gap-4 items-start">
                  <div className="text-4xl">{CREATURE_PRESETS[preset].emoji}</div>
                  <div>
                    <h3 className="text-white font-semibold">{CREATURE_PRESETS[preset].name}</h3>
                    <p className="text-gray-400 text-sm">{CREATURE_PRESETS[preset].description}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!form.watch('name')}
                className="btn-primary w-full py-3"
              >
                Next: Connect AI →
              </button>
            </div>
          )}

          {/* Step 1: Connect AI */}
          {step === 1 && (
            <div className="card space-y-6">
              <div>
                <label className="label">AI Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(LLM_PROVIDERS) as [LLMProvider, typeof LLM_PROVIDERS[LLMProvider]][]).map(([key, data]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => form.setValue('llmProvider', key)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        provider === key
                          ? 'border-primary-500 bg-primary-900/30'
                          : 'border-game-border bg-game-elevated hover:border-primary-500/30'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full mb-2"
                        style={{ backgroundColor: data.color }}
                      />
                      <div className="text-white text-sm font-medium">{data.name}</div>
                      <div className="text-gray-500 text-xs mt-1">{data.models[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">API Key</label>
                <input
                  {...form.register('apiKey')}
                  type="password"
                  className="input font-mono"
                  placeholder="sk-..."
                />
                <p className="text-gray-500 text-xs mt-1">
                  🔒 Your key is AES-encrypted and never logged. Only used to power your creature.
                </p>
                {form.formState.errors.apiKey && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.apiKey.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1 py-3">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary flex-1 py-3"
                >
                  Next: Write Prompt →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: System prompt */}
          {step === 2 && (
            <div className="card space-y-4">
              <div>
                <label className="label">System Prompt</label>
                <p className="text-gray-500 text-xs mb-2">
                  This defines your creature's personality and strategy. Be specific!
                </p>
                <textarea
                  {...form.register('systemPrompt')}
                  className="input h-48 resize-none"
                  placeholder="I am a peaceful builder..."
                  maxLength={2000}
                />
                <div className="flex justify-between mt-1">
                  {form.formState.errors.systemPrompt && (
                    <p className="text-red-400 text-xs">{form.formState.errors.systemPrompt.message}</p>
                  )}
                  <p className="text-gray-500 text-xs ml-auto">{systemPrompt?.length ?? 0}/2000</p>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-2 font-medium">Example prompts:</p>
                <div className="space-y-2">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => form.setValue('systemPrompt', p)}
                      className="w-full text-left text-xs text-gray-400 hover:text-gray-200 bg-game-elevated rounded-lg p-3 border border-game-border hover:border-primary-500/50 transition-colors"
                    >
                      {p.substring(0, 80)}...
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary flex-1 py-3"
                >
                  Review & Launch →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="card space-y-4">
              <h2 className="text-lg font-bold text-white text-center">Ready to launch? 🚀</h2>

              <div className="bg-game-elevated rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{CREATURE_PRESETS[preset]?.emoji}</div>
                  <div>
                    <div className="text-white font-semibold">{form.watch('name')}</div>
                    <div className="text-gray-400 text-sm">{CREATURE_PRESETS[preset]?.name} • {LLM_PROVIDERS[provider]?.name}</div>
                  </div>
                </div>
                <div className="border-t border-game-border pt-3">
                  <p className="text-gray-300 text-sm italic">"{systemPrompt?.substring(0, 150)}..."</p>
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-yellow-300 text-xs">
                ⚠️ You can only create one creature. Choose your path wisely. Next prompt update available in 4 hours after creation.
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">
                  ← Edit
                </button>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="btn-primary flex-1 py-3 glow-blue"
                >
                  {form.formState.isSubmitting ? 'Spawning creature...' : '🌍 Launch Creature!'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
