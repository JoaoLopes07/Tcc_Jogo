import os
import webbrowser
import requests
from threading import Timer, Thread
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
CORS(app)

# --- MUDANÇA CRÍTICA PARA VELOCIDADE ---
# Usando a versão 1.5b (Muito mais leve)
OLLAMA_MODEL = "qwen2.5:1.5b" 
OLLAMA_API_URL = "http://localhost:11434/api/chat"

@app.route('/')
def home():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"<h1>Erro</h1><p>{e}</p>"

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        system_context = data.get('system_context', '')
        
        if not messages: return jsonify({"error": "Vazio"}), 400

        ollama_messages = []
        if system_context:
            ollama_messages.append({"role": "system", "content": system_context})

        for msg in messages:
            role = msg.get('role')
            if role == 'model': role = 'assistant'
            ollama_messages.append({"role": role, "content": msg.get('content')})

        payload = {
            "model": OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": False,
            "keep_alive": "60m",
            "options": {
                "temperature": 0.7, 
                "top_p": 0.9,
                # --- O SEGREDO DA VELOCIDADE ---
                # Reduzimos de 4096 para 2048. 
                # Menos contexto para processar = resposta mais rápida.
                "num_ctx": 2048, 
                "repeat_penalty": 1.2
            }
        }

        print(f"🧠 Mestre ({OLLAMA_MODEL}) pensando rápido...")
        response = requests.post(OLLAMA_API_URL, json=payload)
        
        if response.status_code != 200:
            return jsonify({"error": f"Erro no Ollama: {response.text}"}), 500

        api_json = response.json()
        ai_text = api_json.get('message', {}).get('content', '')
        
        return jsonify({"content": ai_text, "role": "assistant"}), 200

    except Exception as e:
        print(f"❌ Erro: {e}")
        return jsonify({"error": str(e)}), 500

def warmup_ollama():
    print(f"🔥 Aquecendo IA ({OLLAMA_MODEL})...")
    try:
        # Envia um 'oi' simples para carregar o modelo na RAM antes do jogo abrir
        requests.post(OLLAMA_API_URL, json={
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": "oi"}],
            "keep_alive": "60m"
        })
        print(f"✅ IA Pronta para a apresentação!")
    except:
        print("⚠️ Aviso: Não consegui aquecer a IA")

def open_browser():
    print("🚀 Abrindo jogo...")
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == '__main__':
    Thread(target=warmup_ollama).start()
    Timer(1.5, open_browser).start()
    app.run(debug=True, port=5000, use_reloader=False)