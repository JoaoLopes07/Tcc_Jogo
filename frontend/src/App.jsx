import { useState, useEffect, useRef } from 'react';

// --- CSS CORRIGIDO E CENTRALIZADO ---
const styles = `
/* Base */
#root { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; background: #0f172a; }
body { margin: 0; overflow: hidden; font-family: 'Segoe UI', sans-serif; color: #e2e8f0; }

/* Containers Principais */
.auth-container, .lobby-container { 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    height: 100%; 
    width: 100%; 
    animation: fadeIn 0.5s ease;
}

.card { 
    background: #1e293b; 
    padding: 2.5rem; 
    border-radius: 16px; 
    border: 1px solid #334155; 
    width: 100%; 
    max-width: 400px; 
    text-align: center; 
    box-shadow: 0 20px 50px rgba(0,0,0,0.5); 
}

/* Jogo Container - Centralização Fixa */
.game-container { 
    width: 100%; 
    max-width: 900px; 
    height: 95vh; /* Margem nas bordas */
    max-height: 900px;
    display: flex; 
    flex-direction: column; 
    position: relative; 
    background: #0f172a;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #334155;
    box-shadow: 0 0 30px rgba(0,0,0,0.5);
}

/* OVERLAY DE START (Correção de Proporção) */
.start-overlay { 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%; 
    background: rgba(15, 23, 42, 0.98); 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
    align-items: center; 
    z-index: 100; /* Fica acima de tudo */
    text-align: center;
    backdrop-filter: blur(5px);
}

.code-display { 
    font-size: 3em; 
    color: #fbbf24; 
    letter-spacing: 5px; 
    font-weight: 800; 
    margin: 20px 0; 
    background: rgba(0,0,0,0.3); 
    padding: 15px 40px; 
    border-radius: 12px; 
    border: 2px dashed #fbbf24; 
    user-select: all;
    cursor: pointer;
}

/* HUD e Barras */
.hud { background: #1e293b; padding: 15px 20px; border-bottom: 1px solid #334155; z-index: 10; }
.hud-top { display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: bold; align-items: center; }
.room-code { color: #fbbf24; font-weight: bold; letter-spacing: 1px; font-size: 0.9em; background: rgba(251, 191, 36, 0.1); padding: 4px 8px; border-radius: 4px; }

.hp-bar-container { display: flex; align-items: center; gap: 12px; color: #ef4444; font-weight: bold; font-size: 0.9em; }
.hp-bar-bg { flex: 1; height: 14px; background: #0f172a; border-radius: 7px; overflow: hidden; border: 1px solid #334155; }
.hp-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #b91c1c); transition: width 0.5s ease-out; }

/* Chat */
.chat-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; background: #0f172a; }
.message { padding: 15px 20px; border-radius: 12px; max-width: 85%; line-height: 1.6; animation: fadeIn 0.3s; font-size: 0.95rem; }
.message.ai { background: #1e293b; border-left: 4px solid #818cf8; align-self: flex-start; text-align: left; border-top-left-radius: 0; }
.message.player { background: #064e3b; border-right: 4px solid #34d399; align-self: flex-end; text-align: right; border-top-right-radius: 0; }
.msg-header { font-size: 0.7rem; text-transform: uppercase; margin-bottom: 6px; opacity: 0.7; font-weight: bold; letter-spacing: 0.5px; }

/* Botões e Inputs */
input { width: 100%; padding: 12px; margin: 10px 0; background: #020617; border: 1px solid #475569; color: white; border-radius: 8px; outline: none; font-size: 1rem; box-sizing: border-box; }
input:focus { border-color: #818cf8; }

button { width: 100%; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; transition: transform 0.1s, background 0.2s; font-size: 1rem; }
button:active { transform: scale(0.98); }

.btn-primary { background: #4f46e5; color: white; }
.btn-primary:hover { background: #4338ca; }
.btn-success { background: #10b981; color: white; }
.btn-danger { background: #ef4444; color: white; width: auto; padding: 6px 16px; font-size: 0.85rem; margin: 0; }
.btn-secondary { background: #334155; color: white; }
.btn-solo { background: #8b5cf6; color: white; }
.btn-text { background: transparent; color: #94a3b8; font-weight: normal; font-size: 0.9rem; }
.btn-text:hover { color: white; text-decoration: underline; }

/* Ações Especiais */
.game-option { background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; padding: 12px 16px; margin-top: 10px; border-radius: 8px; cursor: pointer; text-align: left; color: #e0f2fe; transition: 0.2s; }
.game-option:hover { background: rgba(56, 189, 248, 0.25); transform: translateX(5px); }

.pending-box { background: #1e293b; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin-top: 10px; text-align: left; }
.btn-resolve { background: #fbbf24; color: #0f172a; margin-top: 10px; }
.btn-pulse { animation: pulse 2s infinite; background: #818cf8; width: auto; padding: 15px 40px; font-size: 1.2em; margin-top: 20px; }

/* Input Area */
.input-area { padding: 15px; background: #1e293b; display: flex; gap: 10px; border-top: 1px solid #334155; }
.input-area input { margin: 0; flex: 1; text-align: left; }
.input-area button { width: auto; margin: 0; padding: 0 25px; }

/* Listas */
.saved-rooms { margin-top: 20px; width: 100%; max-height: 250px; overflow-y: auto; text-align: left; }
.room-item { background: #020617; padding: 15px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #334155; }
.btn-play-small { background: #0ea5e9; color: white; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; padding: 0; margin-right: 5px; }
.btn-trash-small { background: #334155; color: #ef4444; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; padding: 0; border: 1px solid #ef4444; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
`;

const API_URL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [gameMode, setGameMode] = useState('multi');

  useEffect(() => {
    fetch(`${API_URL}/me`, { credentials: 'include' })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Not logged');
    })
    .then(data => {
      if (data.authenticated) {
        setUser(data);
        if (data.room_id) setView('game');
        else setView('lobby');
      } else {
        setView('login');
      }
    })
    .catch(() => setView('login'));
  }, []);

  let content;
  if (view === 'loading') content = <div style={{color:'white', fontSize:'1.5em'}}>Carregando...</div>;
  else if (view === 'login') content = <Login setView={setView} setUser={setUser} />;
  else if (view === 'register') content = <Register setView={setView} setUser={setUser} />;
  else if (view === 'lobby') content = <Lobby setView={setView} setUser={setUser} user={user} setGameMode={setGameMode} />;
  else if (view === 'game') content = <GameRoom setView={setView} user={user} gameMode={gameMode} />;
  else content = <div style={{color: 'white'}}>Erro de Rota</div>;

  return (
    <>
      <style>{styles}</style>
      {content}
    </>
  );
}

// --- COMPONENTES (IGUAIS, SÓ CSS APLICADO) ---

function Login({ setView, setUser }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ username: data.user });
        if (data.room_id) setView('game'); else setView('lobby');
      } else setError(data.error || 'Erro no login');
    } catch { setError('Erro de conexão com o servidor (Backend offline?)'); }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h1 style={{marginBottom: '20px'}}>🛡️ Entrar</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Usuário" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          <input type="password" placeholder="Senha" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <button type="submit" className="btn-primary">Jogar</button>
        </form>
        <button onClick={() => setView('register')} className="btn-text">Não tem conta? Criar agora</button>
      </div>
    </div>
  );
}

function Register({ setView, setUser }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form)
      });
      if (res.ok) {
        setUser({ username: form.username });
        setView('lobby');
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch { setError('Erro de conexão'); }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h1>📝 Criar Conta</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Usuário" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          <input type="password" placeholder="Senha (min 6)" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <button type="submit" className="btn-success">Cadastrar</button>
        </form>
        <button onClick={() => setView('login')} className="btn-text">Voltar para Login</button>
      </div>
    </div>
  );
}

function Lobby({ setView, user, setUser, setGameMode }) {
  const [code, setCode] = useState('');
  const [myRooms, setMyRooms] = useState([]);
  const [tab, setTab] = useState('menu'); 

  const fetchRooms = () => {
    fetch(`${API_URL}/rooms`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setMyRooms(data))
      .catch(err => console.error("Erro ao buscar salas:", err));
  };

  useEffect(() => { fetchRooms(); }, []);

  const handleCreate = async (mode) => {
    try {
      const res = await fetch(`${API_URL}/lobby`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create' })
      });
      if (res.ok) {
        setGameMode(mode); 
        setView('game');
      } else alert("Erro ao criar sala");
    } catch { alert("Erro de conexão"); }
  };

  const handleJoin = async () => {
    try {
        const res = await fetch(`${API_URL}/lobby`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ action: 'join', code })
        });
        if (res.ok) {
            setGameMode('multi');
            setView('game');
        } else alert("Sala não encontrada");
    } catch { alert("Erro de conexão"); }
  };

  const handleDelete = async (roomId) => {
    if(!confirm("Tem certeza? A sala será apagada para sempre.")) return;
    try {
        const res = await fetch(`${API_URL}/delete_room`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ room_id: roomId })
        });
        if(res.ok) fetchRooms();
        else alert("Erro ao excluir");
    } catch { alert("Erro de conexão"); }
  };

  const handleRejoin = async (roomId) => {
      try {
        const res = await fetch(`${API_URL}/lobby`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ action: 'rejoin', room_id: roomId })
        });
        if (res.ok) setView('game');
        else alert("Erro ao entrar");
      } catch { alert("Erro de conexão"); }
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setView('login');
  };

  return (
    <div className="lobby-container">
      <div className="header-lobby">
        <h2>Olá, <span style={{color: '#fbbf24'}}>{user.username}</span></h2>
        <button onClick={handleLogout} className="btn-danger">Sair</button>
      </div>

      <div className="card">
        {tab === 'menu' && (
            <>
                <button onClick={() => handleCreate('solo')} className="btn-solo full-width" style={{width:'100%'}}>
                    👤 Jogar Sozinho
                </button>
                
                <button onClick={() => handleCreate('multi')} className="btn-primary full-width" style={{width:'100%'}}>
                    ⚔️ Criar Sala Multiplayer
                </button>
                
                <button onClick={() => setTab('join')} className="btn-secondary full-width" style={{width:'100%'}}>
                    🔗 Entrar com Código
                </button>
                
                {myRooms.length > 0 && (
                    <div style={{marginTop: '20px', textAlign: 'left', borderTop: '1px solid #334155', paddingTop: '10px'}}>
                        <h3 style={{color: '#94a3b8', fontSize:'0.9em'}}>Salas Salvas:</h3>
                        <div className="saved-rooms">
                            {myRooms.map(r => (
                                <div key={r.id} className="room-item">
                                    <div>
                                        <div className="room-code-tag">{r.code}</div>
                                        <div style={{fontSize:'0.8em', color:'#64748b'}}>Nível {r.floor} • HP {r.hp}</div>
                                    </div>
                                    <div style={{display:'flex', gap:'8px'}}>
                                        <button onClick={() => handleRejoin(r.id)} className="btn-play-small" title="Jogar">▶</button>
                                        <button onClick={() => handleDelete(r.id)} className="btn-trash-small" title="Excluir">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {tab === 'join' && (
            <div style={{animation: 'fadeIn 0.3s'}}>
                <h3>Digitar Código</h3>
                <input type="text" placeholder="EX: A1B2" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoFocus />
                <button onClick={handleJoin} className="btn-success full-width" style={{width:'100%'}}>Entrar</button>
                <button onClick={() => setTab('menu')} className="btn-text">Voltar</button>
            </div>
        )}
      </div>
    </div>
  );
}

function GameRoom({ setView, user, gameMode }) {
  const [state, setState] = useState({ 
    hp: 20, hpMax: 20, floor: 1, inventory: [], history: [], pending_actions: [], code: '', is_creator: false 
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_URL}/poll`, { credentials: 'include' })
        .then(res => {
          if (res.status === 404) {
            alert("Sala encerrada.");
            setView('lobby');
            return null;
          }
          return res.json();
        })
        .then(data => {
          if(data) setState(prev => ({ ...prev, ...data }));
        });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.history, state.pending_actions]);

  const sendAction = async (text, isHidden = false) => {
    if (!text.trim()) return;
    if (!isHidden) setInput('');
    
    const roll = Math.floor(Math.random() * 20) + 1;
    let result = roll === 20 ? "CRÍTICO!" : (roll === 1 ? "FALHA!" : (roll >= 15 ? "Sucesso" : "Normal"));
    const msg = isHidden ? text : `${text} [Dado: ${result}]`;

    try {
        if (text === "RESOLVER_TURNO") {
            setLoading(true);
            await fetch(`${API_URL}/resolve_turn`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ 
                    system_context: `RPG. HP: ${state.hp}.`,
                    stats: { hp: state.hp, floor: state.floor, inventory: state.inventory }
                })
            });
            setLoading(false);
        } else if (text === "INICIAR_CAMPANHA") {
            setLoading(true);
            await fetch(`${API_URL}/start_campaign`, { method: 'POST', credentials: 'include' });
            setLoading(false);
        } else {
            await fetch(`${API_URL}/queue_action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ message: msg })
            });
        }
    } catch(e) {
        setLoading(false);
        alert("Erro de conexão.");
    }
  };

  const handleLeave = async () => {
    await fetch(`${API_URL}/leave_room`, { method: 'POST', credentials: 'include' });
    setView('lobby');
  };

  const renderMessage = (msg, i) => {
    const isAI = msg.role === 'assistant';
    let content = msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/^[\*\-]\s+/gm, '• ');

    if (isAI && (content.includes('1.') || content.includes('2.'))) {
        const parts = content.split(/(\d\.\s.*)/g);
        return (
            <div key={i} className={`message ${isAI ? 'ai' : 'player'}`}>
                <div className="msg-header">{isAI ? 'Mestre' : 'Jogador'}</div>
                {parts.map((part, idx) => {
                    if (part.match(/^\d\.\s/)) {
                        return <div key={idx} className="game-option" onClick={() => sendAction(part.replace(/^\d\.\s/, ''))}>{part}</div>
                    }
                    if(part.trim()) return <div key={idx} dangerouslySetInnerHTML={{__html: part.replace(/\n/g, '<br>')}} />
                    return null;
                })}
            </div>
        );
    }
    return (
      <div key={i} className={`message ${isAI ? 'ai' : 'player'}`}>
        <div className="msg-header">{isAI ? 'Mestre' : msg.content.split(':')[0] || 'Jogador'}</div>
        <div dangerouslySetInnerHTML={{__html: content.replace(/\n/g, '<br>')}} />
      </div>
    );
  };

  return (
    <div className="game-container">
      <div className="hud">
        <div className="hud-top">
          <div className="room-code">
            {gameMode === 'solo' ? <span style={{color:'#8b5cf6'}}>Aventura Solo</span> : <span>SALA: {state.code}</span>}
          </div>
          <button onClick={handleLeave} className="btn-danger">Sair</button>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'10px', color:'#ef4444', fontWeight:'bold'}}>
            <span>HP</span>
            <div className="hp-bar-bg"><div className="hp-fill" style={{width: `${Math.min(100, Math.max(0, (state.hp/state.hpMax)*100))}%`}}></div></div>
            <span>{state.hp}/{state.hpMax}</span>
        </div>
      </div>

      <div className="chat-area">
        {state.history.length === 0 && state.is_creator && (
            <div className="start-overlay">
                {gameMode === 'solo' ? (
                    <>
                        <h2>👤 Modo Solo</h2>
                        <p style={{color: '#94a3b8'}}>Sua aventura está pronta.</p>
                    </>
                ) : (
                    <>
                        <h2>🏰 Sala Criada!</h2>
                        <div className="code-display" onClick={() => {navigator.clipboard.writeText(state.code); alert('Código copiado!')}} title="Clique para copiar">{state.code}</div>
                        <p style={{color:'#94a3b8'}}>Envie este código para amigos.</p>
                    </>
                )}
                
                <button disabled={loading} onClick={() => sendAction("INICIAR_CAMPANHA")} className="btn-pulse">
                    {loading ? "Invocando..." : "INICIAR AVENTURA"}
                </button>
            </div>
        )}
        
        {state.history.length === 0 && !state.is_creator && (
            <div className="start-overlay">
                <h2>⏳ Aguardando o Líder...</h2>
            </div>
        )}

        {state.history.map((msg, i) => renderMessage(msg, i))}
        
        {state.pending_actions.length > 0 && (
            <div className="pending-box">
                <div className="pending-title">⏳ Ações na Fila:</div>
                {state.pending_actions.map((a, i) => <div key={i}>{a}</div>)}
                {state.is_creator && (
                    <button disabled={loading} onClick={() => sendAction("RESOLVER_TURNO")} className="btn-resolve">
                        {loading ? "Processando..." : (gameMode === 'solo' ? "CONTINUAR" : "EXECUTAR TURNO")}
                    </button>
                )}
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="input-area">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAction(input)} placeholder="Sua ação..." disabled={loading} />
        <button onClick={() => sendAction(input)} disabled={loading} style={{width:'auto', margin:0}}>Enviar</button>
      </div>
    </div>
  );
}

export default App;