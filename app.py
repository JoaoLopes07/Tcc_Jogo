import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai

from models import db, User, GameRoom

# --- CONFIGURAÇÃO ---
print(f"\n📂 PASTA ATUAL: {os.getcwd()}")
basedir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(basedir, 'templates')
static_dir = os.path.join(basedir, 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
app.config['SECRET_KEY'] = 'chave_secreta_tcc_final' 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'rpg_database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)

# --- IA (GEMINI) ---
GEMINI_API_KEY = "AIzaSyDpf2lmpd43ryiId6tJnTpfzCZfSdxoSAg" 
genai.configure(api_key=GEMINI_API_KEY)

# Tenta pegar o melhor modelo disponível
try:
    available = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    # Prioriza Flash > Pro > Qualquer um
    selected = next((m for m in available if 'flash' in m), next((m for m in available if 'pro' in m), 'gemini-pro'))
    print(f"🤖 MODELO IA: {selected}")
    model = genai.GenerativeModel(selected)
except:
    print("⚠️ Usando fallback: gemini-pro")
    model = genai.GenerativeModel('gemini-pro')

# --- INIT ---
db.init_app(app)
login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

with app.app_context():
    db.create_all()

# --- ROTAS BÁSICAS ---
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
            flash('Login inválido.', 'error')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# --- LOBBY E SALAS ---
@app.route('/lobby', methods=['GET', 'POST'])
@login_required
def lobby():
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'create':
            # Define o usuário atual como CRIADOR
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
    return render_template('lobby.html', user=current_user)

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

# --- API DO JOGO ---
@app.route('/api/chat', methods=['POST'])
@login_required
def chat_handler():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room: return jsonify({'error': 'No Room'}), 404

    data = request.get_json()
    user_msg = data.get('message', '')
    system_context = data.get('system_context', '')
    
    # Atualiza stats se vieram do cliente
    client_stats = data.get('stats', {})
    if client_stats:
        room.hp = client_stats.get('hp', room.hp)
        room.floor = client_stats.get('floor', room.floor)
        room.set_inventory(client_stats.get('inventory', []))

    history = room.get_history()
    player_entry = f"{current_user.username}: {user_msg}"
    history.append({"role": "user", "content": player_entry})
    
    ai_text = ""
    try:
        chat_session = model.start_chat(history=[])
        full_prompt = f"{system_context}\n\nHistórico Recente:\n"
        for h in history[-8:]: full_prompt += f"{h['content']}\n"
        full_prompt += f"JOGADOR ({current_user.username}): {user_msg}\nMESTRE:"
        
        response = chat_session.send_message(full_prompt)
        ai_text = response.text

    except Exception as e:
        print(f"ERRO IA: {e}")
        # Fallback para não travar o jogo no Loading
        ai_text = "⚠️ **O Mestre tropeçou (Erro de Conexão).**\nMas a aventura continua.\n\nO que vocês fazem?\n1. Seguir em frente\n2. Investigar\n3. Descansar"

    history.append({"role": "assistant", "content": ai_text})
    room.set_history(history)
    db.session.commit()

    return jsonify({"content": ai_text, "role": "assistant"}), 200

@app.route('/api/poll', methods=['GET'])
@login_required
def poll_game():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room: return jsonify({'error': 'No room'}), 404
    return jsonify({
        'history': room.get_history(),
        'hp': room.hp,
        'floor': room.floor,
        'inventory': room.get_inventory(),
        'code': room.code
    })

@app.route('/api/reset', methods=['POST'])
@login_required
def reset_game():
    room = db.session.get(GameRoom, current_user.room_id)
    if room:
        room.hp = 20
        room.floor = 1
        room.set_inventory(["mapa antigo", "tocha"])
        room.set_history([])
        db.session.commit()
    return jsonify({"status": "resetado"})

if __name__ == '__main__':
    print("🚀 SERVIDOR TCC ONLINE: http://127.0.0.1:5050")
    app.run(debug=True, port=5050)