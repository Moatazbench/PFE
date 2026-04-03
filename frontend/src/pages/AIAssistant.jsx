import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../components/AuthContext';

function AIAssistant() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', text: `Hi ${user?.name || 'there'}! 👋 I'm your AI Performance Assistant. I'm here to help you shine! Whether you need to brainstorm career goals, track your progress, or write a glowing performance update, just ask. What would you like to focus on today?` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { id: Date.now(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axios.post('/api/ai/assist', { prompt: input });
            const assistantMsg = { 
                id: Date.now() + 1, 
                role: 'assistant', 
                text: res.data.result || "I'm sorry, I couldn't process that request right now." 
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err) {
            console.error('AI Error:', err);
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                role: 'assistant', 
                text: "Oops! I encountered a small hiccup while thinking about that. Could you try asking me again?" 
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-area" style={{ width: '100%', maxWidth: '900px', margin: '0 auto', flex: 1 }}>
            
            {/* Header / Suggestions Area */}
            <div style={{ padding: '24px 24px 0 24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '-0.5px', marginBottom: '8px' }}>AI Assistant</h1>
                <p style={{ color: 'var(--apple-text-secondary)', marginBottom: '16px' }}>Get automated suggestions for goals and performance</p>
                
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                    <button className="btn-apple-secondary" onClick={() => setInput("Suggest 3 career development goals")}>Suggest Goals</button>
                    <button className="btn-apple-secondary" onClick={() => setInput("How can I improve my KPI tracking?")}>Improve KPIs</button>
                    <button className="btn-apple-secondary" onClick={() => setInput("Help me write a performance update")}>Write Update</button>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="messages-container">
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`chat-message-bubble ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-ai'}`}
                    >
                        {msg.text}
                    </div>
                ))}
                
                {loading && (
                    <div className="chat-message-bubble chat-message-ai">
                        <span style={{ animation: 'blink 1s infinite' }}>●</span>
                        <span style={{ animation: 'blink 1s infinite', animationDelay: '0.2s', margin: '0 4px' }}>●</span>
                        <span style={{ animation: 'blink 1s infinite', animationDelay: '0.4s' }}>●</span>
                    </div>
                )}
                <div ref={messagesEndRef} style={{ height: '24px' }} />
            </div>

            {/* Input Area */}
            <div className="chat-input-wrapper">
                <form className="chat-input-box" onSubmit={handleSend}>
                    <input 
                        className="chat-input-field"
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your question here..." 
                        disabled={loading}
                    />
                    <button 
                        type="submit" 
                        className="chat-send-btn" 
                        disabled={loading || !input.trim()}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        ↑
                    </button>
                </form>
            </div>
            
        </div>
    );
}

export default AIAssistant;
