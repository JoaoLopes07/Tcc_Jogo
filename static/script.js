// --- ESTADO DO JOGO ---
const gameState = {
    // Carrega dados vindos do Banco de Dados (via index.html)
    floor: window.serverFloor || 1, 
    actions: 0,
    hp: window.serverHp || 10,
    hpMax: 10,
    inventory: window.serverInventory || ['espada curta'],
    conversationHistory: [] // O backend gerencia o histórico persistente
};

const chatContainer = document.getElementById('chatContainer');
const playerInput = document.getElementById('playerInput');
const sendButton = document.getElementById('sendButton');
const resetButton = document.getElementById('resetButton');

// --- REUTILIZA AS FUNÇÕES DE UI E PARSER DA VERSÃO ANTERIOR ---
// (Copie as funções formatText, addMessage, removeLoading, updateStats, parseAIResponse do script.js anterior)
// Vou colocar apenas as partes que mudaram para comunicação com a nova API/Banco

function formatText(text) {
    if (!text) return "";
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^[\*\-]\s+/gm, '• ');
    return formatted;
}

function addMessage(text, type = 'ai') {
    const messageDiv = document.createElement('div');
    if (type === 'loading') {
        messageDiv.id = 'loadingMessage';
        messageDiv.className = 'message message-ai';
        messageDiv.innerHTML = `<div class="message-header">Mestre Pensando</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
    } else {
        messageDiv.className = `message message-${type}`;
        const header = type === 'ai' ? 'Mestre' : (type === 'system' ? 'Sistema' : 'Você');
        if(type === 'system') {
            messageDiv.innerHTML = `<div>${formatText(text)}</div>`;
        } else {
            messageDiv.innerHTML = `<div class="message-header">${header}</div><div>${parseOptions(formatText(text))}</div>`;
        }
    }
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function parseOptions(text) {
    return text.replace(/(\d\.\s.*?)(?=(\d\.\s|$|\n))/g, '<div class="game-option">$1</div>');
}

function removeLoading() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

function updateStats() {
    document.getElementById('floorVal').textContent = gameState.floor;
    document.getElementById('actionsVal').textContent = `${gameState.actions}/15`;
    document.getElementById('hpVal').textContent = `${gameState.hp}/${gameState.hpMax}`;
}

// Parse para identificar itens/dano na resposta da API
function parseLogic(text) {
    // Lógica idêntica ao anterior para ITEM, HP, REMOVE
    // ... (Use a mesma lógica do script anterior para regex de [HP], [ITEM])
    
    // Detectar HP
    const hpRegex = /\[HP:\s*([+-]?\d+)\]/gi;
    let match;
    while ((match = hpRegex.exec(text)) !== null) {
        const val = parseInt(match[1]);
        gameState.hp += val;
        if (gameState.hp > gameState.hpMax) gameState.hp = gameState.hpMax;
        if (gameState.hp < 0) gameState.hp = 0;
    }
    updateStats();
    return text; // Retorna o texto para ser exibido
}

// --- COMUNICAÇÃO COM O NOVO BACKEND ---

async function callBackend(userMessage) {
    const apiUrl = '/api/chat'; // Rota Flask
    
    const systemContext = `
Você é um Mestre de RPG.
JOGADOR: HP ${gameState.hp}/${gameState.hpMax}. Inventário: ${gameState.inventory.join(', ')}.
INSTRUÇÕES:
1. Descreva o resultado (curto).
2. Dê 3 opções numeradas.
3. Use [HP: -X] ou [ITEM: Nome] se necessário.
`;

    if (userMessage) addMessage(userMessage, 'player');
    addMessage('', 'loading');
    
    playerInput.disabled = true;
    sendButton.disabled = true;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage, // Mandamos só a msg atual, o banco tem o histórico
                system_context: systemContext,
                // Enviamos os stats atuais para o banco salvar
                stats: {
                    hp: gameState.hp,
                    floor: gameState.floor,
                    inventory: gameState.inventory
                }
            })
        });

        removeLoading();
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const aiText = parseLogic(data.content); // Aplica lógica de jogo
        addMessage(aiText, 'ai');

    } catch (error) {
        removeLoading();
        addMessage(`Erro: ${error.message}`, 'error');
    } finally {
        playerInput.disabled = false;
        sendButton.disabled = false;
        playerInput.focus();
        playerInput.value = '';
    }
}

// --- INICIALIZAÇÃO ---

// Carrega o histórico antigo se existir (persistência)
function loadHistory() {
    if (window.serverHistory && window.serverHistory.length > 0) {
        window.serverHistory.forEach(msg => {
            addMessage(msg.content, msg.role === 'user' ? 'player' : 'ai');
        });
        addMessage("Jogo carregado. O que deseja fazer?", 'system');
    } else {
        // Jogo Novo
        callBackend("Início do jogo. Descreva o salão com 3 portas e dê opções.");
    }
    updateStats();
}

resetButton.addEventListener('click', async () => {
    if(confirm("Tem certeza que deseja apagar todo o progresso?")) {
        await fetch('/api/reset', {method: 'POST'});
        location.reload();
    }
});

sendButton.addEventListener('click', () => callBackend(playerInput.value));
playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') callBackend(playerInput.value);
});

window.addEventListener('load', loadHistory);