"use client";

import { useState, useRef, useEffect } from "react";
import {
  parseIntent,
  simpleGenerate,
  streamBacktest,
  getConfidenceScore,
  translateResult,
  type ParsedIntent,
  type TranslatedResult,
} from "@/lib/api";
import { useToast } from "@/components/Toast";

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  intent?: ParsedIntent;
  strategy?: Record<string, unknown>;
  strategyId?: string;
  backtest?: Record<string, unknown>;
  translation?: TranslatedResult;
  confidence?: Record<string, unknown>;
  loading?: boolean;
  source?: string;
}

type Phase = "chat" | "parsing" | "followup" | "generating" | "backtesting" | "translating" | "done";

const QUICK_PROMPTS = [
  { label: "Protect my savings", emoji: "\uD83D\uDEE1\uFE0F", prompt: "I want to protect my savings from a market crash" },
  { label: "Steady growth", emoji: "\uD83D\uDCC8", prompt: "I want steady growth with moderate risk, US stocks" },
  { label: "High growth", emoji: "\uD83D\uDE80", prompt: "I want aggressive growth riding momentum in tech stocks" },
  { label: "Buy the dip", emoji: "\uD83D\uDCB0", prompt: "I want to buy quality stocks when they dip" },
  { label: "Indian stocks", emoji: "\uD83C\uDDEE\uD83C\uDDF3", prompt: "I have 5 lakhs to invest in Indian stocks, moderate risk" },
  { label: "Gold safety", emoji: "\u2728", prompt: "I want to park money in gold for safety" },
];

export function SimpleMode({
  onSwitchToExpert,
}: {
  onSwitchToExpert: (strategy?: Record<string, unknown>, strategyId?: string) => void;
}) {
  const nextMessageIdRef = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Tell me what you're looking for in plain English. For example: \"I have $50,000 and I'm worried about a recession\" or \"I want to ride momentum in tech stocks.\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("chat");
  const [provider, setProvider] = useState("gemini");
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(message: Omit<ChatMessage, "id">) {
    const id = `msg_${nextMessageIdRef.current}`;
    nextMessageIdRef.current += 1;
    setMessages((prev) => [...prev, { ...message, id }]);
    return id;
  }

  function updateMessage(id: string, updates: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...updates } : message)));
  }

  async function handleSubmit(text?: string) {
    const userText = (text || input).trim();
    if (!userText || phase !== "chat") return;
    setInput("");

    addMessage({ role: "user", content: userText });

    setPhase("parsing");
    const thinkingId = addMessage({ role: "assistant", content: "Understanding your request...", loading: true });

    try {
      const intent = await parseIntent(userText, provider);

      updateMessage(thinkingId, {
        content: intent.plain_summary,
        intent,
        loading: false,
      });

      if (intent.needs_followup && intent.followup_questions?.length) {
        addMessage({
          role: "assistant",
          content: intent.followup_questions.join("\n\n"),
        });
        setPhase("chat");
        return;
      }

      await generateAndBacktest(intent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      updateMessage(thinkingId, { content: `Sorry, I couldn't understand that: ${message}`, loading: false });
      toast(message);
      setPhase("chat");
    }
  }

  async function generateAndBacktest(intent: ParsedIntent) {
    setPhase("generating");
    const generationId = addMessage({ role: "assistant", content: "Creating your strategy...", loading: true });

    try {
      const generationResult = await simpleGenerate(intent, provider);
      const strategy = generationResult.strategy;
      const strategyId = generationResult.strategyId;
      const source = generationResult.source;

      const strategyName = (strategy?.name as string) || "Strategy";
      const sourceLabel = source === "template" ? "from our pre-tested templates" : "with AI";

      updateMessage(generationId, {
        content: `Created "${strategyName}" ${sourceLabel}. Now backtesting it...`,
        strategy,
        strategyId,
        source,
        loading: false,
      });

      setPhase("backtesting");
      const backtestId = addMessage({ role: "assistant", content: "Running backtest...", loading: true });

      const backtestResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
        streamBacktest(
          strategy,
          strategyId,
          (_stage, message) => {
            updateMessage(backtestId, { content: message, loading: true });
          },
          (result) => resolve(result),
          (message) => reject(new Error(message)),
        );
      });

      setPhase("translating");
      updateMessage(backtestId, { content: "Analyzing results...", loading: true });

      const summary = backtestResult.summary as Record<string, unknown>;
      const score = backtestResult.score as Record<string, unknown>;
      const currency = ((strategy?.backtest_config as Record<string, unknown>)?.currency as string) || "USD";
      const timeframe = (strategy?.timeframe as string) || "1d";

      let translation: TranslatedResult;
      try {
        translation = await translateResult(summary, score, currency, timeframe);
      } catch {
        translation = {
          headline: `Backtest complete - Grade ${(score?.grade as string) || "?"} (${score?.overall || "?"}/100)`,
          verdict: "okay",
          bullets: [`Total return: ${(summary?.total_return_percent as number)?.toFixed(1)}%`],
          risk_warning: "Past performance does not guarantee future results.",
          comparison: "",
          suggestion: "Check the detailed results below.",
        };
      }

      updateMessage(backtestId, {
        content: translation.headline,
        backtest: backtestResult,
        translation,
        strategy,
        strategyId,
        loading: false,
      });

      try {
        const confidence = await getConfidenceScore(strategy, backtestResult, strategyId);
        updateMessage(backtestId, { confidence: confidence.confidence ?? confidence });
      } catch {
        // Best-effort enrichment.
      }

      setPhase("done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      addMessage({
        role: "assistant",
        content: `Something went wrong: ${message}. Try describing your idea differently, or switch to Expert Mode.`,
      });
      toast(message);
      setPhase("chat");
    }
  }

  function handleReset() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Tell me what you're looking for in plain English. For example: \"I have $50,000 and I'm worried about a recession\" or \"I want to ride momentum in tech stocks.\"",
      },
    ]);
    nextMessageIdRef.current = 1;
    setPhase("chat");
    setInput("");
  }

  const isProcessing = phase !== "chat" && phase !== "done";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onSwitchToExpert={onSwitchToExpert} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {phase === "chat" && messages.length <= 1 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-slate-400">Quick start:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => handleSubmit(prompt.prompt)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="mb-0.5 block text-base">{prompt.emoji}</span>
                <span className="font-medium text-slate-700">{prompt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Try another idea
          </button>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && handleSubmit()}
            placeholder={isProcessing ? "Working on it..." : "Describe your investment idea..."}
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isProcessing}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isProcessing ? <Spinner /> : "Send"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">AI:</span>
            {["gemini", "openrouter", "claude", "openai"].map((item) => (
              <button
                key={item}
                onClick={() => setProvider(item)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  provider === item
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {item === "gemini" ? "Gemini" : item === "openrouter" ? "OpenRouter" : item === "claude" ? "Claude" : "GPT-4o"}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">For educational purposes only.</p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSwitchToExpert,
}: {
  message: ChatMessage;
  onSwitchToExpert: (strategy?: Record<string, unknown>, strategyId?: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"
        }`}
      >
        {message.loading && (
          <span className="inline-flex items-center gap-2">
            <Spinner className={isUser ? "text-white" : "text-blue-500"} />
            {message.content}
          </span>
        )}

        {!message.loading && <p className="whitespace-pre-wrap">{message.content}</p>}

        {message.intent && !message.loading && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.intent.market && <Chip>{message.intent.market === "IN" ? "India" : "US"}</Chip>}
            {message.intent.risk_tolerance && <Chip>{message.intent.risk_tolerance} risk</Chip>}
            {message.intent.time_horizon && <Chip>{message.intent.time_horizon} term</Chip>}
            {message.intent.capital && message.intent.currency && (
              <Chip>
                {message.intent.currency === "INR" ? "\u20B9" : "$"}
                {message.intent.capital.toLocaleString()}
              </Chip>
            )}
            {message.intent.suggested_template && (
              <Chip variant="blue">{message.intent.suggested_template.replace(/_/g, " ")}</Chip>
            )}
          </div>
        )}

        {message.translation && !message.loading && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={message.translation.verdict} />
              <span className="text-xs text-slate-500">{message.translation.comparison}</span>
            </div>

            <ul className="space-y-1.5">
              {message.translation.bullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <span className="shrink-0 text-slate-400">-</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message.translation.suggestion}</p>
            <p className="text-xs italic text-slate-400">{message.translation.risk_warning}</p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => onSwitchToExpert(message.strategy, message.strategyId)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                View full details
              </button>
              {message.strategy && (
                <button
                  onClick={() => {
                    const name = ((message.strategy?.name as string) || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    const blob = new Blob([JSON.stringify(message.strategy, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `${name}.json`;
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Export JSON
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "blue" }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        variant === "blue" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: "great" | "good" | "okay" | "poor" }) {
  const styles: Record<typeof verdict, string> = {
    great: "bg-green-100 text-green-800",
    good: "bg-blue-100 text-blue-800",
    okay: "bg-amber-100 text-amber-800",
    poor: "bg-red-100 text-red-800",
  };
  const labels: Record<typeof verdict, string> = {
    great: "Strong",
    good: "Decent",
    okay: "Mixed",
    poor: "Weak",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[verdict]}`}>
      {labels[verdict]}
    </span>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}
