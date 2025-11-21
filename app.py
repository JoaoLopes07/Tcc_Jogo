import os
import json
import requests
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai
from dotenv import load_dotenv

from models import db, User, GameRoom

# --- CONFIGURAÇÃO HÍBRIDA ---
USE_LOCAL_AI = False 
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen2.5:1.5b"

# --- CONFIGURAÇÃO FLASK ---
load_dotenv()
print(f"\n📂 PASTA ATUAL: {os.getcwd()}")
basedir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(basedir, 'templates')
static_dir = os.path.join(basedir, 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'chave_dev') 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'rpg_database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)

# --- CONFIGURAÇÃO IA (SELETOR INTELIGENTE 2.0) ---
model = None

if not USE_LOCAL_AI:
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        genai.configure(api_key=api_key)
        print("☁️ Conectando ao Google Gemini...")
        
        try:
            # 1. Pega a lista real de modelos que sua conta tem acesso
            # Filtra apenas os que geram texto (remove embedding-gecko que deu erro antes)
            todos_modelos = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            
            # 2. Lista de preferência baseada no que vimos no seu log
            preferencias = [
                'models/gemini-2.5-flash',          # O mais novo e rápido
                'models/gemini-2.0-flash',          # Ótima alternativa
                'models/gemini-flash-latest',       # Genérico flash
                'models/gemini-1.5-flash',          # Versão anterior
                'models/gemini-pro'                 # Fallback clássico
            ]
            
            modelo_final = None
            
            # Tenta encontrar o melhor modelo da lista de preferências nos seus modelos disponíveis
            for pref in preferencias:
                if pref in todos_modelos:
                    modelo_final = pref
                    break
            
            # Se não achou nenhum da lista, pega o primeiro que tiver "flash" no nome
            if not modelo_final:
                for m in todos_modelos:
                    if 'flash' in m:
                        modelo_final = m
                        break
            
            # Se ainda não achou, pega qualquer um que gere texto
            if not modelo_final and todos_modelos:
                modelo_final = todos_modelos[0]

            if modelo_final:
                print(f"✅ SUCESSO! Usando modelo: {modelo_final}")
                model = genai.GenerativeModel(modelo_final)
            else:
                print("❌ ERRO: Nenhum modelo de texto encontrado na sua lista.")

        except Exception as e:
            print(f"❌ Erro na seleção automática: {e}")
            # Fallback de emergência
            model = genai.GenerativeModel('gemini-pro')

    else:
        print("❌ SEM CHAVE API. Mude USE_LOCAL_AI para True.")
else:
    print(f"🏠 MODO LOCAL: Ollama ({OLLAMA_MODEL})")

# --- RAG (Base de Conhecimento) ---
def carregar_lore():
    try:
        with open(os.path.join(basedir, 'lore.json'), 'r', encoding='utf-8') as f:
            return json.load(f)
    except: return {}

LORE_DB = carregar_lore()

def sistema_rag(msg):
    msg = msg.lower()
    contexto = []
    if "monstros" in LORE_DB:
        for k, v in LORE_DB["monstros"].items():
            if k in msg: contexto.append(f"[INFO MONSTRO: {k.upper()}]: {v}")
    if "locais" in LORE_DB:
        for k, v in LORE_DB["locais"].items():
            if k in msg: contexto.append(f"[INFO LOCAL]: {v}")
    return "\n".join(contexto)

def gerar_texto_ia(system_context, history, user_msg):
    if not USE_LOCAL_AI and not model: 
        return "Erro Crítico: IA não conectada. Verifique o terminal."
    
    rag_info = sistema_rag(user_msg)
    if rag_info: system_context += f"\n\nCONHECIMENTO:\n{rag_info}"

    full_prompt = f"{system_context}\n\nHistórico:\n"
    for h in history[-3:]: full_prompt += f"{h['content']}\n"
    full_prompt += f"\nAÇÃO:\n{user_msg}\n\nMESTRE:"

    if USE_LOCAL_AI:
        try:
            payload = {
                "model": OLLAMA_MODEL,
                "messages": [{"role": "system", "content": system_context}, {"role": "user", "content": full_prompt}],
                "stream": False, "options": {"temperature": 0.7, "num_ctx": 2048}
            }
            resp = requests.post(OLLAMA_URL, json=payload)
            return resp.json().get('message', {}).get('content', '')
        except: return "Erro no Ollama."
    else:
        try:
            chat = model.start_chat(history=[])
            return chat.send_message(full_prompt).text
        except Exception as e:
            erro = str(e)
            if "429" in erro: return "⚠️ Mestre ocupado (Muitas requisições). Tente em 30s."
            return f"Erro API: {erro[:100]}..."

# --- INIT FLASK ---
db.init_app(app)
login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

with app.app_context():
    db.create_all()

# --- ROTAS ---
@app.route('/')
def home():
    if current_user.is_authenticated:
        return redirect(url_for('game') if current_user.room_id else url_for('lobby'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if len(password) < 6:
            flash('Senha curta (min 6).', 'error')
            return redirect(url_for('register'))
        if User.query.filter_by(username=username).first():
            flash('Usuário já existe.', 'error')
            return redirect(url_for('register'))
        new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('lobby'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('game') if user.room_id else url_for('lobby'))
        else:
            flash('Dados incorretos.', 'error')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/lobby', methods=['GET', 'POST'])
@login_required
def lobby():
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'create':
            new_room = GameRoom(creator_id=current_user.id)
            db.session.add(new_room)
            db.session.commit()
            current_user.room_id = new_room.id
            db.session.commit()
            return redirect(url_for('game'))
        elif action == 'join':
            code = request.form.get('room_code').upper().strip()
            room = GameRoom.query.filter_by(code=code).first()
            if room:
                current_user.room_id = room.id
                db.session.commit()
                return redirect(url_for('game'))
            else:
                flash('Sala não encontrada!', 'error')
        elif action == 'rejoin':
            room = db.session.get(GameRoom, int(request.form.get('room_id')))
            if room:
                current_user.room_id = room.id
                db.session.commit()
                return redirect(url_for('game'))
    my_rooms = GameRoom.query.filter_by(creator_id=current_user.id).all()
    return render_template('lobby.html', user=current_user, my_rooms=my_rooms)

@app.route('/leave_room')
@login_required
def leave_room():
    current_user.room_id = None
    db.session.commit()
    return redirect(url_for('lobby'))

@app.route('/game')
@login_required
def game():
    if not current_user.room_id: return redirect(url_for('lobby'))
    room = db.session.get(GameRoom, current_user.room_id)
    if not room:
        current_user.room_id = None
        db.session.commit()
        return redirect(url_for('lobby'))
    return render_template('index.html', user=current_user, room=room)

@app.route('/api/queue_action', methods=['POST'])
@login_required
def queue_action():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room: return jsonify({'error': 'No Room'}), 404
    data = request.get_json()
    pending = room.get_pending_actions()
    pending.append(f"{current_user.username}: {data.get('message', '')}")
    room.set_pending_actions(pending)
    db.session.commit()
    return jsonify({"status": "queued"}), 200

@app.route('/api/resolve_turn', methods=['POST'])
@login_required
def resolve_turn():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room or room.creator_id != current_user.id:
        return jsonify({'error': 'Acesso negado'}), 403
    
    pending = room.get_pending_actions()
    if not pending: return jsonify({'error': 'Sem ações'}), 400

    data = request.get_json()
    if data.get('stats'):
        s = data['stats']
        room.hp = s.get('hp', room.hp)
        room.floor = s.get('floor', room.floor)
        room.set_inventory(s.get('inventory', []))

    history = room.get_history()
    group_action = "\n".join(pending)
    history.append({"role": "user", "content": f"**TURNO GRUPO:**\n{group_action}"})
    
    ai_text = gerar_texto_ia(data.get('system_context', ''), history, group_action)

    history.append({"role": "assistant", "content": ai_text})
    room.set_history(history)
    room.set_pending_actions([])
    db.session.commit()
    return jsonify({"content": ai_text}), 200

@app.route('/api/start_campaign', methods=['POST'])
@login_required
def start_campaign():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room or room.creator_id != current_user.id:
        return jsonify({'error': 'Apenas o líder pode iniciar'}), 403

    room.set_history([]) 
    room.set_pending_actions([]) 
    room.hp = 20
    room.floor = 1
    
    intro_prompt = "Você é um Mestre de RPG. Descreva o cenário inicial: um salão antigo e úmido com 3 portas misteriosas (Amarela, Vermelha, Verde). Termine listando 3 opções numeradas. Seja imersivo."
    
    ai_text = gerar_texto_ia(intro_prompt, [], "INICIAR AVENTURA")
    
    history = [{"role": "assistant", "content": ai_text}]
    room.set_history(history)
    db.session.commit()
    
    return jsonify({"content": ai_text}), 200

@app.route('/api/poll', methods=['GET'])
@login_required
def poll_game():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room: return jsonify({'error': 'No room'}), 404
    return jsonify({
        'history': room.get_history(),
        'pending_actions': room.get_pending_actions(),
        'hp': room.hp, 'floor': room.floor, 'inventory': room.get_inventory(),
        'code': room.code, 'is_creator': (room.creator_id == current_user.id)
    })

@app.route('/api/reset', methods=['POST'])
@login_required
def reset_game():
    room = db.session.get(GameRoom, current_user.room_id)
    if room:
        room.hp = 20; room.floor = 1; room.set_history([]); room.set_pending_actions([])
        db.session.commit()
    return jsonify({"status": "resetado"})

if __name__ == '__main__':
    print("🚀 SERVIDOR TCC RODANDO: http://127.0.0.1:5050")
    app.run(debug=True, port=5050)