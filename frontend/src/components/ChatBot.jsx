import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  sendMessage,
  endChatSession,
  getChatMessages,
  getChatSessions,
  getMovies,
} from "../services/api";
import ReactMarkdown from "react-markdown";

const INITIAL_MESSAGE = (name) => ({
  role: "assistant",
  content: `Hi ${name || "there"}! 👋 I'm your movie assistant. Ask me to recommend movies or help you find a forgotten film!`,
});

export default function ChatBot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([
    INITIAL_MESSAGE(user?.display_name),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Parse movie titles from bold markdown **Title** and search DB
  const loadMoviesForMessage = useCallback(async (content) => {
    try {
      const matches = content.match(/\*\*([^*]+)\*\*/g);
      if (!matches) return [];

      const titles = matches.map((m) => m.replace(/\*\*/g, "").trim());
      const movies = [];

      for (const title of titles) {
        const res = await getMovies({ search: title, limit: 1 });
        if (res.data.data?.length > 0) {
          movies.push(res.data.data[0]);
        }
      }
      return movies;
    } catch {
      return [];
    }
  }, []);

  // Load last chat session OR reset when user changes
  useEffect(() => {
    if (!user?.user_id) {
      // User logged out → reset
      setSessionId(null);
      setMessages([INITIAL_MESSAGE(null)]);
      return;
    }

    const loadLastSession = async () => {
      try {
        const sessionsRes = await getChatSessions();
        const sessions = sessionsRes.data;

        if (sessions.length === 0) {
          // No history → show fresh welcome message
          setSessionId(null);
          setMessages([INITIAL_MESSAGE(user?.display_name)]);
          return;
        }

        // Get last session
        const lastSession = sessions[0];
        setSessionId(lastSession.session_id);

        // Load messages of last session
        const msgsRes = await getChatMessages(lastSession.session_id);
        const dbMessages = msgsRes.data;

        if (dbMessages.length === 0) {
          setMessages([INITIAL_MESSAGE(user?.display_name)]);
          return;
        }

        // Load movies for each assistant message
        const messagesWithMovies = await Promise.all(
          dbMessages.map(async (m) => {
            const movies =
              m.role === "assistant"
                ? await loadMoviesForMessage(m.content)
                : [];
            return {
              role: m.role,
              content: m.content,
              movies,
            };
          }),
        );

        setMessages([
          INITIAL_MESSAGE(user?.display_name),
          ...messagesWithMovies,
        ]);
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setMessages([INITIAL_MESSAGE(user?.display_name)]);
      }
    };

    loadLastSession();
  }, [user?.user_id, loadMoviesForMessage]);

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
        session_id: sessionId,
      });

      // Save session_id from first response
      if (res.data.session_id && !sessionId) {
        setSessionId(res.data.session_id);
      }

      // Add AI response with movie chips
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.response,
          movies: res.data.recommended_movies || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again!",
          movies: [],
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

  // Toggle open/close — preserve chat history, update ended_at
  const handleToggle = () => {
    if (isOpen && sessionId) {
      endChatSession(sessionId).catch(() => {});
    }
    setIsOpen(!isOpen);
  };

  // Start a new chat session — reset UI only, DB history preserved
  const handleNewChat = () => {
    if (sessionId) {
      endChatSession(sessionId).catch(() => {});
    }
    setSessionId(null);
    setMessages([INITIAL_MESSAGE(user?.display_name)]);
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="text-red-200 hover:text-white text-xs border border-red-400 hover:border-white px-2 py-1 rounded-lg transition"
                title="Start new chat"
              >
                + New
              </button>
              <button
                onClick={handleToggle}
                className="text-white hover:text-red-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>
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

                  {/* Movie chips — clickable links to movie detail page */}
                  {msg.movies?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-700">
                      {msg.movies.map((m) => (
                        <button
                          key={m.movie_id}
                          onClick={() => navigate(`/movies/${m.movie_id}`)}
                          className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs px-2 py-1 rounded-full transition border border-red-600/30"
                        >
                          🎬 {m.title}
                        </button>
                      ))}
                    </div>
                  )}
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
          <span className="text-white text-xl font-bold">✕</span>
        ) : (
          <span className="text-2xl">🤖</span>
        )}
      </button>
    </>
  );
}