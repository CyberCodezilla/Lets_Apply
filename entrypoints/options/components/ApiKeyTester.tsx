import { useState, useEffect } from 'react';
import { Key, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { testApiConnection } from '../../../src/utils/groq-service';

interface ApiKeyTesterProps {
  apiKey: string;
  model: string;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}

const MODELS = [
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Recommended - High Quality)' },
  { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Ultra Fast - 0.03s)' },
  { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (High Reasoning)' },
  { value: 'groq/compound', label: 'Groq Compound (Agentic)' },
];

export default function ApiKeyTester({ apiKey, model, onApiKeyChange, onModelChange }: ApiKeyTesterProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Auto-migrate legacy/decommissioned models to the active default
  useEffect(() => {
    if (!model || model.includes('llama') || !MODELS.some((m) => m.value === model)) {
      onModelChange('openai/gpt-oss-120b');
    }
  }, [model, onModelChange]);

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    const result = await testApiConnection(apiKey, model);

    setTestStatus(result.success ? 'success' : 'error');
    setTestMessage(result.message);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="la-label flex items-center gap-2">
          <Key className="w-4 h-4 text-la-400" />
          Groq API Key
        </label>
        <div className="flex gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              onApiKeyChange(e.target.value);
              setTestStatus('idle');
            }}
            placeholder="gsk_..."
            className="la-input flex-1 font-mono text-sm"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className="la-btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            {testStatus === 'testing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Test Connection
          </button>
        </div>
        {testStatus !== 'idle' && testStatus !== 'testing' && (
          <div
            className={`flex items-center gap-2 mt-2 text-sm animate-fade-in ${
              testStatus === 'success' ? 'text-accent-green' : 'text-accent-red'
            }`}
          >
            {testStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {testMessage}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Get your free API key at{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-la-400 hover:text-la-300 underline"
          >
            console.groq.com/keys
          </a>
        </p>
      </div>

      <div>
        <label className="la-label">AI Model</label>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="la-input cursor-pointer"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
          {!MODELS.some((m) => m.value === model) && model && (
            <option value={model}>{model}</option>
          )}
        </select>
      </div>
    </div>
  );
}
