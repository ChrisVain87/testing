import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useGameStore } from '../../store/gameStore';
import { api } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface FormData {
  systemPrompt: string;
}

export function PromptModal() {
  const { activeModal, setActiveModal, myCreature, updateMyCreature, addNotification } = useGameStore();
  const [error, setError] = useState('');

  const { register, handleSubmit, watch, formState } = useForm<FormData>({
    defaultValues: { systemPrompt: myCreature?.systemPrompt ?? '' },
  });

  const prompt = watch('systemPrompt');

  if (activeModal !== 'prompt') return null;

  const cooldownEndsAt = myCreature?.promptCooldownEndsAt
    ? new Date(myCreature.promptCooldownEndsAt)
    : null;
  const cooldownActive = cooldownEndsAt && cooldownEndsAt > new Date();

  if (cooldownActive) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">Cooldown Active</h2>
          <p className="text-gray-400 mb-4">
            You can update your creature's prompt{' '}
            <span className="text-primary-400 font-semibold">
              {formatDistanceToNow(cooldownEndsAt, { addSuffix: true })}
            </span>.
          </p>
          <p className="text-gray-500 text-sm">
            Your creature is currently following its existing behavior plan.
          </p>
          <button onClick={() => setActiveModal('none')} className="btn-secondary mt-6 px-8">
            Close
          </button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const res = await api.updatePrompt({ systemPrompt: data.systemPrompt });
      updateMyCreature({
        systemPrompt: data.systemPrompt,
        promptCooldownEndsAt: res.data.cooldownEndsAt,
      });
      addNotification({
        type: 'success',
        title: 'Prompt Updated!',
        message: 'Your creature is computing a new behavior plan...',
      });
      setActiveModal('none');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to update prompt');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Update System Prompt</h2>
            <p className="text-gray-400 text-sm">Next update available in 4 hours</p>
          </div>
          <button onClick={() => setActiveModal('none')} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label flex justify-between">
              <span>System Prompt</span>
              <span className={`text-xs ${prompt?.length > 1800 ? 'text-red-400' : 'text-gray-500'}`}>
                {prompt?.length ?? 0}/2000
              </span>
            </label>
            <textarea
              {...register('systemPrompt', { required: true, minLength: 10, maxLength: 2000 })}
              className="input h-64 resize-none"
              placeholder="Describe your creature's personality, goals, and strategy..."
              maxLength={2000}
            />
            <div className="mt-2 text-xs text-gray-500">
              <p>💡 Tips for effective prompts:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600">
                <li>Define a clear personality (peaceful, aggressive, curious, etc.)</li>
                <li>Specify primary goals (build, explore, claim land, trade)</li>
                <li>Mention how to handle other creatures (ally, avoid, fight)</li>
                <li>Describe resource priorities (food, materials, energy)</li>
              </ul>
            </div>
          </div>

          {/* Current plan preview */}
          {myCreature?.currentBehaviorPlan && (
            <div className="bg-game-elevated rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Current active plan:</p>
              <p className="text-gray-300 text-sm italic">"{myCreature.currentBehaviorPlan.summary}"</p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setActiveModal('none')} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="btn-primary flex-1"
            >
              {formState.isSubmitting ? '🤖 Processing...' : '🧠 Update Prompt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
