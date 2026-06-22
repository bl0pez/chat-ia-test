import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './index.css'

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

const API_URL = 'http://localhost:5001/api';
const STORE_ID = 'nuvole-mascotas';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'global' | 'store'>('global');
  const [conversationId, setConversationId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncCategories = async () => {
    setIsSyncing(true);
    try {
      const syncEndpoint = mode === 'global' 
        ? `${API_URL}/ai-assistant/global/sync`
        : `${API_URL}/ai-assistant/knowledge/sync/${STORE_ID}`;

      const response = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        alert('Categorías sincronizadas correctamente.');
      } else {
        alert('Hubo un problema al sincronizar las categorías.');
      }
    } catch (error) {
      console.error('Error syncing categories:', error);
      alert('Error de conexión al intentar sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const botMessageId = `bot-${Date.now()}`;
    const initialBotMessage: Message = { id: botMessageId, sender: 'bot', text: '' };
    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const endpoint = mode === 'global' 
        ? `${API_URL}/ai-assistant/global/chat`
        : `${API_URL}/ai-assistant/chat/${STORE_ID}`;

      const body = {
        message: userMessage.text,
        conversation_id: conversationId || (mode === 'global' ? 'global-session' : `customer-session-${STORE_ID}`)
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.body) throw new Error('Readable stream not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let botResponseText = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                done = true;
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  botResponseText += parsed.text;
                }
              } catch (e) {
                console.error('Error parsing chunk:', data);
              }
            }
          }
          
          setMessages(prev => prev.map(msg => 
            msg.id === botMessageId ? { ...msg, text: botResponseText } : msg
          ));
        }
      }

    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId ? { ...msg, text: 'Ocurrió un error de conexión.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Ya no sobrescribimos el ID de la sesión para que el usuario pueda mantener su identificador.
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>✨ AI Assistant Tester</h1>
        <div className="header-controls">
          <button 
            className="sync-btn"
            onClick={handleSyncCategories}
            disabled={isSyncing}
            title="Subir nuevas categorías"
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Categorías'}
          </button>
          <div className="mode-selector">
            <button 
              className={`mode-btn ${mode === 'global' ? 'active' : ''}`}
              onClick={() => { setMode('global'); clearChat(); }}
            >
              Global
            </button>
            <button 
              className={`mode-btn ${mode === 'store' ? 'active' : ''}`}
              onClick={() => { setMode('store'); clearChat(); }}
            >
              Tienda ({STORE_ID})
            </button>
          </div>
          <div className="session-selector">
            <input
              type="text"
              className="session-input"
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
              placeholder="Tu Nombre / ID"
              title="Ingresa tu nombre o ID para mantener una conversación única"
            />
          </div>
        </div>
      </div>
      
      <div className="chat-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
            Envía un mensaje para comenzar a probar el chat {mode === 'global' ? 'global' : `de ${STORE_ID}`}.
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-bubble">
              {msg.text ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (msg.sender === 'bot' && isLoading && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <form className="input-form" onSubmit={handleSend}>
          <input 
            type="text" 
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Escribe tu mensaje al chat ${mode === 'global' ? 'global' : 'de la tienda'}...`}
            disabled={isLoading}
          />
          <button type="submit" className="send-btn" disabled={!input.trim() || isLoading}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
