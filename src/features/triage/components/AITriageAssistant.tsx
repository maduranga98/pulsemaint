import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiTriageAssistantResponse {
  reply: string;
}

const callAiTriageAssistant = httpsCallable<
  { message: string; history: ChatMessage[]; machineName?: string; categoryTitle?: string },
  AiTriageAssistantResponse
>(functions, 'aiTriageAssistant');

export function AITriageAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const result = await callAiTriageAssistant({ message: text, history: messages });
      setMessages([...nextMessages, { role: 'assistant', content: result.data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Triage Assistant is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>
          AI Triage Assistant
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
          Describe the problem you're seeing — get quick troubleshooting steps before dispatching a technician.
        </p>
      </div>

      <div
        className="flex-1 overflow-y-auto rounded-xl p-4 space-y-3"
        style={{ background: '#0a0f1c', border: '1px solid #1a2840', minHeight: 260 }}
      >
        {messages.length === 0 && (
          <div className="text-sm text-center py-10" style={{ color: '#3d5070' }}>
            Ask about a machine issue to get started.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
              style={
                m.role === 'user'
                  ? { background: '#1a56db', color: '#fff' }
                  : { background: '#111d2e', color: '#e2e8f0', border: '1px solid #1a2840' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#111d2e', color: '#6b7fa3', border: '1px solid #1a2840' }}>
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#2a1414', color: '#f87171', border: '1px solid #7f1d1d' }}>
          {error}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="e.g. Compressor is overheating and tripping the breaker…"
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: '#111d2e', border: '1px solid #1a2840', color: '#e2e8f0' }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#1a56db' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AITriageAssistant;
