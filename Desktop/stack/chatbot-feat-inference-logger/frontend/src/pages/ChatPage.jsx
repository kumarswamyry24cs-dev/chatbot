import React, { useState, useEffect, useRef } from 'react';

function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const loadConversation = async (id) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      const data = await res.json();
      setActiveConv(data);
      setMessages(data.messages || []);
      setShowChat(true);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const startNewChat = () => {
    setActiveConv(null);
    setMessages([]);
    setShowChat(true);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, id: Date.now() }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConv?.id || null,
          message: userMessage
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessages(prev => [...prev, data.message]);
        if (!activeConv) {
          setActiveConv({ id: data.conversationId, title: userMessage.substring(0, 50), status: 'active' });
        }
        fetchConversations();
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error || 'Failed to get response'}`, 
          id: Date.now() 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err.message}`, 
        id: Date.now() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const cancelConversation = async () => {
    if (!activeConv) return;
    try {
      await fetch(`/api/chat/conversations/${activeConv.id}/cancel`, { method: 'PATCH' });
      setActiveConv(prev => ({ ...prev, status: 'cancelled' }));
      fetchConversations();
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  };

  const resumeConversation = async () => {
    if (!activeConv) return;
    try {
      await fetch(`/api/chat/conversations/${activeConv.id}/resume`, { method: 'PATCH' });
      setActiveConv(prev => ({ ...prev, status: 'active' }));
      fetchConversations();
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  };

  const isCancelled = activeConv?.status === 'cancelled';

  return (
    <div className="chat-page">
      <div className="conversations-panel">
        <div className="conversations-header">
          <h2>Conversations</h2>
          <button className="btn-new-chat" onClick={startNewChat}>+ New</button>
        </div>
        <div className="conversations-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`conversation-item ${activeConv?.id === conv.id ? 'active' : ''}`}
              onClick={() => loadConversation(conv.id)}
            >
              <div className="title">{conv.title}</div>
              <div className="meta">
                <span>{conv.message_count} msgs</span>
                <span className={`status-badge status-${conv.status}`}>{conv.status}</span>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No conversations yet. Start a new chat!
            </div>
          )}
        </div>
      </div>

      <div className="chat-area">
        {showChat ? (
          <>
            <div className="chat-header">
              <h2>{activeConv?.title || 'New Conversation'}</h2>
              <div className="chat-actions">
                {activeConv && !isCancelled && (
                  <button className="btn-action danger" onClick={cancelConversation}>
                    Cancel
                  </button>
                )}
                {activeConv && isCancelled && (
                  <button className="btn-action" onClick={resumeConversation}>
                    Resume
                  </button>
                )}
              </div>
            </div>
            <div className="messages-container">
              {messages.length === 0 && (
                <div className="empty-state">
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</p>
                    <p>Type a message below to start chatting!</p>
                  </div>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`message ${msg.role}`}>
                  {msg.content}
                </div>
              ))}
              {loading && <div className="typing-indicator">AI is thinking...</div>}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={sendMessage}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isCancelled ? 'Conversation cancelled - resume to continue' : 'Type a message...'}
                disabled={loading || isCancelled}
                autoFocus
              />
              <button type="submit" className="btn-send" disabled={loading || !input.trim() || isCancelled}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</p>
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
