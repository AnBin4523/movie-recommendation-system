import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { sendMessage } from "../services/api";
import ReactMarkdown from "react-markdown";

export default function ChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi ${user?.display_name || "there"}! 👋 I'm your movie assistant. Ask me to recommend movies or help you find a forgotten film!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // Track current chat session
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message to UI
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // Build conversation history for context (last 6 messages)
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Send message with session_id to maintain conversation thread
      const res = await sendMessage({
        message: userMessage,
        history,
        session_id: sessionId,  // Send current session_id (null on first message)
      });

      // Save session_id from response (set on first message, reuse after)
      if (res.data.session_id) {
        setSessionId(res.data.session_id);
      }

      // Add AI response to UI
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.response,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Reset session when chat window is closed and reopened
  const handleToggle = () => {
    if (isOpen) {
      // Reset chat when closing
      setIsOpen(false);
      setSessionId(null);
      setMessages([
        {
          role: "assistant",
          content: `Hi ${user?.display_name || "there"}! 👋 I'm your movie assistant. Ask me to recommend movies or help you find a forgotten film!`,
        },
      ]);
    } else {
      setIsOpen(true);
    }
  };

  // Don't show chatbot for admin
  if (user?.role === "admin") return null;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[500px] bg-zinc-900 rounded-2xl shadow-2xl flex flex-col z-50 border border-zinc-700">

          {/* Header */}
          <div className="bg-red-600 rounded-t-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">MovieFlix AI</p>
                <p className="text-red-200 text-xs">Always here to help</p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              className="text-white hover:text-red-200 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
              >
                {/* Bot avatar */}
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <span className="text-sm">🤖</span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-red-600 text-white rounded-br-sm"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-1 last:mb-0">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-white">
                          {children}
                        </strong>
                      ),
                      li: ({ children }) => (
                        <li className="ml-4 list-disc">{children}</li>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-1">{children}</ul>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about movies..."
              disabled={loading}
              className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2 rounded-full outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition disabled:opacity-50"
            >
              <span className="text-white text-sm">➤</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full shadow-lg flex items-center justify-center z-50 transition hover:scale-110"
      >
        {isOpen ? (
          <span className="text-white text-xl">✕</span>
        ) : (
          <span className="text-2xl">🤖</span>
        )}
      </button>
    </>
  );
}