// --- ESTADO ---
let gameState = {
    floor: window.serverFloor || 1, 
    hp: window.serverHp || 20,
    hpMax: 20,
    inventory: window.serverInventory || [],
    lastHistoryLength: (window.serverHistory || []).length 
};

const chatContainer = document.getElementById('chatContainer');
const playerInput = document.getElementById('playerInput');
const sendButton = document.getElementById('sendButton');
const resetButton = document.getElementById('resetButton');
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const startOverlay = document.getElementById('startOverlay');
const btnStartGame = document.getElementById('btnStartGame');

function rollDice() { return Math.floor(Math.random() * 20) + 1; }
function getDiceResult(roll) {
    if (roll === 20) return "CRÍTICO! (20)";
    if (roll === 1) return "FALHA CRÍTICA! (1)";
    if (roll >= 15) return `Sucesso (${roll})`;
    if (roll >= 10) return `Normal (${roll})`;
    return `Falha (${roll})`;
}

function formatText(text) {
    if (!text) return "";
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^[\*\-]\s+/gm, '• ');
}

function parseOptions(text) {
    let clean = text.replace(/([^\n>])(?=\d\.\s)/g, '$1<br><br>');
    return clean.replace(/(\d\.\s.*?)(?=(\d\.\s|$|\n|<br>))/g, '<div class="game-option">$1</div>');
}

function addMessage(content, role, extraInfo = '') {
    const messageDiv = document.createElement('div');
    const isAI = role === 'assistant';
    const typeClass = isAI ? 'message-ai' : 'message-player';
    
    let header = isAI ? 'Mestre' : 'Jogador';
    let text = content;

    if (!isAI && content.includes(': ')) {
        const parts = content.split(': ');
        header = parts[0]; 
        text = parts.slice(1).join(': '); 
    }

    messageDiv.className = `message ${typeClass}`;
    let formattedText = isAI ? parseOptions(formatText(text)) : formatText(text);
    let diceBadge = extraInfo ? `<div style="font-size:0.8em; color:#fbbf24; margin-bottom:5px;">🎲 ${extraInfo}</div>` : '';

    messageDiv.innerHTML = `<div class="message-header">${header}</div>${diceBadge}<div>${formattedText}</div>`;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateStats() {
    const pct = (gameState.hp / gameState.hpMax) * 100;
    if(hpFill) hpFill.style.width = `${Math.max(0, pct)}%`;
    if(hpText) hpText.textContent = `${gameState.hp}/${gameState.hpMax}`;
    document.getElementById('floorVal').textContent = gameState.floor;
    document.getElementById('inventoryVal').textContent = gameState.inventory.length;
}

async function pollGame() {
    try {
        const response = await fetch('/api/poll');
        if (!response.ok) return;
        const data = await response.json();

        gameState.hp = data.hp;
        gameState.floor = data.floor;
        gameState.inventory = data.inventory;
        updateStats();

        const newHistory = data.history;
        
        // SE TEM HISTÓRICO, ESCONDE O OVERLAY PARA TODOS
        if (newHistory.length > 0) {
            startOverlay.style.display = 'none';
        }

        if (newHistory.length > gameState.lastHistoryLength) {
            const newMessages = newHistory.slice(gameState.lastHistoryLength);
            newMessages.forEach(msg => addMessage(msg.content, msg.role));
            gameState.lastHistoryLength = newHistory.length;
            
            const loading = document.getElementById('loadingMessage');
            if (loading) loading.remove();
            
            playerInput.disabled = false;
            sendButton.disabled = false;
        }
    } catch (e) { console.error("Poll error", e); }
}
setInterval(pollGame, 2000);

async function sendAction(action, isHidden = false) {
    let messagePayload = action;
    let systemContext = `RPG Multiplayer. HP Grupo: ${gameState.hp}.`;

    if (!isHidden) {
        const roll = getDiceResult(rollDice());
        messagePayload = `${action} [${roll}]`;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingMessage';
        loadingDiv.className = 'message message-ai';
        loadingDiv.innerHTML = `<div class="message-header">Mestre</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        playerInput.disabled = true;
        sendButton.disabled = true;
        playerInput.value = '';
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messagePayload,
                system_context: systemContext,
                stats: { hp: gameState.hp, floor: gameState.floor, inventory: gameState.inventory }
            })
        });

        // Se falhar, o catch pega e mostra erro
        if (!response.ok) throw new Error("Erro na API");
        return true;

    } catch (e) { 
        console.error(e);
        const loading = document.getElementById('loadingMessage');
        if (loading) loading.remove();
        
        if (isHidden) {
            alert("Erro ao iniciar: A IA falhou. Tente de novo.");
        } else {
            addMessage(`❌ Erro de conexão.`, 'error');
        }
        return false;
    }
}

if (btnStartGame) {
    btnStartGame.addEventListener('click', async () => {
        btnStartGame.disabled = true;
        btnStartGame.textContent = "Invocando...";
        const success = await sendAction("Início do jogo. Descreva o salão com 3 portas e dê opções.", true);
        if (!success) {
            btnStartGame.disabled = false;
            btnStartGame.textContent = "Tentar Novamente";
        }
    });
}

document.addEventListener('click', (e) => {
    if(e.target && e.target.classList.contains('game-option')) {
        sendAction(e.target.innerText.replace(/^\d+\.\s/, ''));
    }
});

sendButton.addEventListener('click', () => sendAction(playerInput.value));
playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAction(playerInput.value);
});

resetButton.addEventListener('click', async () => {
    if(confirm("Resetar sala?")) {
        await fetch('/api/reset', {method: 'POST'});
        location.reload();
    }
});

function init() {
    updateStats();
    if (window.serverHistory && window.serverHistory.length > 0) {
        startOverlay.style.display = 'none';
        window.serverHistory.forEach(msg => addMessage(msg.content, msg.role));
    } else {
        startOverlay.style.display = 'flex';
    }
}
init();