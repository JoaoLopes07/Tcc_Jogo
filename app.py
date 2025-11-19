import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai

# Importa as tabelas do banco de dados
from models import db, User, GameState

# --- CORREÇÃO MÁGICA DE CAMINHOS ---
# Pega o caminho exato da pasta onde este arquivo app.py está salvo
basedir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(basedir, 'templates')
static_dir = os.path.join(basedir, 'static')

# Força o Flask a usar esses caminhos exatos
app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# --- CONFIGURAÇÕES ---
app.config['SECRET_KEY'] = 'chave_secreta_do_tcc' 
# Banco de dados também usa caminho absoluto para evitar criar arquivo em lugar errado
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'rpg_database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)

# --- API DO GEMINI ---
GEMINI_API_KEY = "AIzaSyDpf2lmpd43ryiId6tJnTpfzCZfSdxoSAg" 
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# --- INICIALIZAÇÃO ---
db.init_app(app)
login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

with app.app_context():
    db.create_all()

# --- ROTAS (IGUAIS ÀS ANTERIORES) ---

@app.route('/')
def home():
    if current_user.is_authenticated:
        return redirect(url_for('game'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if User.query.filter_by(username=username).first():
            flash('Este usuário já existe.', 'error')
            return redirect(url_for('register'))

        new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
        db.session.add(new_user)
        db.session.commit()
        
        new_game = GameState(user_id=new_user.id)
        db.session.add(new_game)
        db.session.commit()

        login_user(new_user)
        return redirect(url_for('game'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('game'))
        else:
            flash('Usuário ou senha incorretos.', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/game')
@login_required
def game():
    state = current_user.game_state
    return render_template('index.html', user=current_user, state=state)

@app.route('/api/chat', methods=['POST'])
@login_required
def chat_handler():
    try:
        data = request.get_json()
        user_msg = data.get('message', '')
        system_context = data.get('system_context', '')
        
        state = current_user.game_state
        history = state.get_history()
        
        client_stats = data.get('stats', {})
        if client_stats:
            state.hp = client_stats.get('hp', state.hp)
            state.floor = client_stats.get('floor', state.floor)
            state.set_inventory(client_stats.get('inventory', []))
        
        chat_session = model.start_chat(history=[])
        full_prompt = f"{system_context}\n\nHistórico:\n"
        for h in history[-6:]:
            full_prompt += f"{h['role']}: {h['content']}\n"
        full_prompt += f"User: {user_msg}\nAssistant:"

        response = chat_session.send_message(full_prompt)
        ai_text = response.text

        history.append({"role": "user", "content": user_msg})
        history.append({"role": "assistant", "content": ai_text})
        state.set_history(history)
        db.session.commit()

        return jsonify({"content": ai_text, "role": "assistant"}), 200

    except Exception as e:
        print(f"Erro API: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset', methods=['POST'])
@login_required
def reset_game():
    state = current_user.game_state
    state.hp = 10
    state.floor = 1
    state.set_inventory(["espada curta", "poção de cura"])
    state.set_history([])
    db.session.commit()
    return jsonify({"status": "resetado"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)