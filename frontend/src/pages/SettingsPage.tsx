import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api/settings';
import { useAuth } from '../hooks/useAuth';

const MAX_QUESTIONS = 5;

export function SettingsPage() {
  const { user, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const isAnonymous = user?.isAnonymous === true;

  const [questions, setQuestions] = useState<string[]>([]);
  const [highPriorityLimit, setHighPriorityLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const s = await getSettings();
        setQuestions(s.starter_questions ?? []);
        setHighPriorityLimit(s.high_priority_daily_limit ?? 3);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  function updateQuestion(idx: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, '']);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    if (idx === questions.length - 1) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings({ starter_questions: questions.filter((q) => q.trim()), high_priority_daily_limit: Math.max(1, highPriorityLimit) });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleSignIn() {
    setAccountError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!magicLinkEmail.trim()) return;
    setAccountError(null);
    try {
      await sendMagicLink(magicLinkEmail.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to send sign-in link');
    }
  }

  async function handleSignOut() {
    setAccountError(null);
    try {
      await signOut();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Sign-out failed');
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Configure your chat starter questions</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
          Settings saved successfully
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* High-priority limit */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">High Priority Daily Limit</h3>
            <p className="text-xs text-gray-500 mb-2">
              Max high-priority tasks allowed per day in Today and Tomorrow. A warning is shown when this is exceeded.
            </p>
            <input
              type="number"
              min={1}
              max={20}
              value={highPriorityLimit}
              onChange={(e) => setHighPriorityLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Starter Questions
                <span className="ml-2 text-gray-400 font-normal">
                  ({questions.length}/{MAX_QUESTIONS})
                </span>
              </h3>
              <button
                onClick={addQuestion}
                disabled={questions.length >= MAX_QUESTIONS}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add question
              </button>
            </div>

            {questions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
                No starter questions yet. Add one above.
              </p>
            )}

            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === questions.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={q}
                    onChange={(e) => updateQuestion(idx, e.target.value)}
                    placeholder={`Question ${idx + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />

                  <button
                    onClick={() => removeQuestion(idx)}
                    className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </>
      )}

      {/* Account */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Account</h3>

        {accountError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-3">
            {accountError}
          </div>
        )}

        {isAnonymous ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              You're using anonymous mode. Sign in to access your account from other devices.
            </p>

            {magicLinkSent ? (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                Sign-in link sent to <span className="font-medium">{magicLinkEmail}</span>
              </div>
            ) : showEmailInput ? (
              <form onSubmit={handleMagicLink} className="space-y-2">
                <input
                  type="email"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!magicLinkEmail.trim()}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send sign-in link
                </button>
              </form>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign in with email
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{user?.displayName || user?.email || 'Signed in'}</p>
              {user?.email && user?.displayName && (
                <p className="text-xs text-gray-500">{user.email}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
