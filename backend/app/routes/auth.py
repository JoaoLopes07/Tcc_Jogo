from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/me', methods=['GET'])
def check_session():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'username': current_user.username, 'id': current_user.id, 'room_id': current_user.room_id})
    return jsonify({'authenticated': False}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first(): return jsonify({'error': 'Usuário existe'}), 400
    new_user = User(username=data['username'], password=generate_password_hash(data['password'], method='pbkdf2:sha256'))
    db.session.add(new_user)
    db.session.commit()
    login_user(new_user)
    return jsonify({'success': True})

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password, data['password']):
        login_user(user)
        return jsonify({'success': True, 'room_id': user.room_id})
    return jsonify({'error': 'Erro login'}), 401

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})