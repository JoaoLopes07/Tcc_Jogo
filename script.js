// --- ESTADO DO JOGO ---
const gameState = {
    floor: 1, 
    actions: 0,
    hp: 10,
    hpMax: 10,
    gameStarted: false,
    inventory: ['espada curta', 'escudo de madeira', 'poção de cura'],
    conversationHistory: []
};

// --- ELEMENTOS DO DOM ---
const chatContainer = document.getElementById('chatContainer');
const playerInput = document.getElementById('playerInput');
const sendButton = document.getElementById('sendButton');

// --- FUNÇÕES DE UI ---

// Formata negrito e listas do Markdown
function formatText(text) {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^[\*\-]\s+/gm, '• ');
    return formatted;
}

// Adiciona mensagens na tela
function addMessage(text, type = 'ai') {
    const messageDiv = document.createElement('div');
    
    if (type === 'loading') {
        messageDiv.id = 'loadingMessage';
        messageDiv.className = 'message message-ai';
        messageDiv.innerHTML = `<div class="message-header">Mestre Pensando</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
    } else {
        messageDiv.className = `message message-${type}`;
        const header = type === 'ai' ? 'Mestre da Dungeon' : 'Você';
        const content = formatText(text);
        
        // Se for sistema ou erro, não tem header
        if(type === 'system' || type === 'error') {
            messageDiv.innerHTML = `<div>${content}</div>`;
        } else {
            messageDiv.innerHTML = `<div class="message-header">${header}</div><div>${content}</div>`;
        }
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeLoading() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

// Atualiza os números no topo da tela
function updateStats() {
    document.getElementById('floorVal').textContent = gameState.floor;
    document.getElementById('actionsVal').textContent = `${gameState.actions}/15`;
    document.getElementById('hpVal').textContent = `${gameState.hp}/${gameState.hpMax}`;
}

// --- LÓGICA DE INTELIGÊNCIA ARTIFICIAL ---

// Processa comandos especiais da IA [HP: -x] e [ITEM: nome]
function parseAIResponse(text) {
    let cleanText = text;

    // 1. Detectar Item: [ITEM: nome do item]
    const itemRegex = /\[ITEM:\s*(.*?)\]/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
        const item = match[1].toLowerCase().trim();
        if (item && !gameState.inventory.includes(item)) {
            gameState.inventory.push(item);
        }
        cleanText = cleanText.replace(match[0], `<br><em>(Você obteve: ${item})</em>`);
    }

    // 2. Detectar Remoção: [REMOVE: nome do item]
    const removeRegex = /\[REMOVE:\s*(.*?)\]/gi;
    while ((match = removeRegex.exec(text)) !== null) {
        const item = match[1].toLowerCase().trim();
        const index = gameState.inventory.indexOf(item);
        if (index > -1) {
            gameState.inventory.splice(index, 1);
        }
        cleanText = cleanText.replace(match[0], `<br><em>(Você perdeu/usou: ${item})</em>`);
    }

    // 3. Detectar Dano/Cura: [HP: +x] ou [HP: -x]
    const hpRegex = /\[HP:\s*([+-]?\d+)\]/gi;
    while ((match = hpRegex.exec(text)) !== null) {
        const val = parseInt(match[1]);
        gameState.hp += val;
        if (gameState.hp > gameState.hpMax) gameState.hp = gameState.hpMax;
        if (gameState.hp < 0) gameState.hp = 0;
        
        const color = val < 0 ? 'red' : 'green';
        cleanText = cleanText.replace(match[0], `<span style="color:${color}; font-weight:bold">(${val > 0 ? '+' : ''}${val} HP)</span>`);
    }
    
    updateStats();
    
    // Verifica Game Over
    if (gameState.hp <= 0) {
        sendButton.disabled = true;
        playerInput.disabled = true;
        cleanText += "<br><br><strong>💀 VOCÊ MORREU. Recarregue a página para tentar novamente.</strong>";
    }

    return cleanText;
}

async function callOllamaAPI(userMessage) {
    const apiUrl = '/api/chat'; // Rota do Python
    
    // Contexto do sistema turbinado para Qwen2
    const systemContext = `
Você é um Mestre de RPG de Fantasia Medieval Sombria.
ESTADO DO JOGADOR:
- Vida: ${gameState.hp}/${gameState.hpMax}
- Inventário: ${gameState.inventory.join(', ')}
- Andar da Dungeon: ${gameState.floor}

REGRAS CRUCIAIS (Siga rigorosamente):
1. Use [HP: -X] para dano e [HP: +X] para cura. Ex: "O golpe te corta! [HP: -2]"
2. Use [ITEM: Nome] ao dar itens. Ex: "No baú há uma adaga. [ITEM: Adaga]"
3. Use [REMOVE: Nome] ao tirar itens.
4. NUNCA repita descrições recentes.
5. Mantenha respostas curtas (max 3 parágrafos).
6. SEMPRE termine perguntando o que o jogador fará.
7. NÃO tome ações pelo jogador. Apenas descreva o resultado e PARE.
`;

    if (userMessage) {
        gameState.conversationHistory.push({ role: 'user', content: userMessage });
    }

    addMessage('', 'loading');

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: gameState.conversationHistory,
                system_context: systemContext,
            })
        });

        removeLoading();

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na API');
        
        if (data.content) {
            const aiRawResponse = data.content;
            gameState.conversationHistory.push({ role: 'assistant', content: aiRawResponse });
            return parseAIResponse(aiRawResponse);
        }
        throw new Error('Resposta vazia.');

    } catch (error) {
        removeLoading();
        if (userMessage) gameState.conversationHistory.pop();
        return `(Erro: ${error.message})`;
    }
}

// --- CONTROLE DE FLUXO ---

async function processPlayerMessage(message) {
    if (!message.trim()) return;
    
    addMessage(message, 'player');
    playerInput.value = '';
    playerInput.disabled = true;
    sendButton.disabled = true;

    const aiResponse = await callOllamaAPI(message);
    addMessage(aiResponse, 'ai');

    if (gameState.hp > 0) {
        gameState.actions++;
        updateStats();
        playerInput.disabled = false;
        sendButton.disabled = false;
        playerInput.focus();

        // Lógica de subir de andar
        if (gameState.actions >= 15) {
            gameState.floor++;
            gameState.actions = 0;
            updateStats();
            addMessage(`🎉 Você encontrou as escadas! Subindo para o Andar ${gameState.floor}...`, 'system');
            
            // Pequeno delay para a IA descrever o novo andar
            setTimeout(async () => {
                const newDesc = await callOllamaAPI("O jogador subiu as escadas. Descreva o novo andar e seus perigos."); 
                addMessage(newDesc, 'ai');
            }, 1000);
        }
    }
}

async function startGame() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    updateStats();
    
    addMessage('🎮 Conectando ao Mestre...', 'system');
    sendButton.disabled = true;
    playerInput.disabled = true;
    
    // Prompt Inicial "Blindado" contra Auto-Play
    const promptInicial = `
INÍCIO DO JOGO.
Descreva APENAS o cenário inicial:
"Você acorda em um salão de pedra úmida. Tochas iluminam 3 portas destrancadas:
1. Porta Amarela (Emite zumbido mágico)
2. Porta Vermelha (Irradia calor)
3. Porta Verde (Cheiro de mar)"
PARE a descrição aqui.
Pergunte: "Qual porta você escolhe?"
NÃO narre o que acontece depois de entrar. Aguarde o jogador.
`;
    
    const intro = await callOllamaAPI(promptInicial);
    addMessage(intro, 'ai');
    
    sendButton.disabled = false;
    playerInput.disabled = false;
    playerInput.focus();
}

// --- EVENT LISTENERS ---
sendButton.addEventListener('click', () => processPlayerMessage(playerInput.value));
playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) processPlayerMessage(playerInput.value);
});

// Inicia o jogo quando a página carregar
window.addEventListener('load', startGame);