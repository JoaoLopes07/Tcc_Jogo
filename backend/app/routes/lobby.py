from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import db, GameRoom

lobby_bp = Blueprint('lobby', __name__)

@lobby_bp.route('/rooms', methods=['GET'])
@login_required
def get_my_rooms():
    rooms = GameRoom.query.filter_by(creator_id=current_user.id).all()
    return jsonify([{ 'id': r.id, 'code': r.code, 'floor': r.floor } for r in rooms])

@lobby_bp.route('/lobby', methods=['POST'])
@login_required
def lobby_action():
    data = request.get_json()
    action = data.get('action')
    if action == 'create':
        new_room = GameRoom(creator_id=current_user.id)
        db.session.add(new_room)
        db.session.commit()
        current_user.room_id = new_room.id
        db.session.commit()
        return jsonify({'success': True, 'room_id': new_room.id})
    elif action == 'join':
        code = data.get('code', '').upper().strip()
        room = GameRoom.query.filter_by(code=code).first()
        if room:
            current_user.room_id = room.id
            db.session.commit()
            return jsonify({'success': True})
        return jsonify({'error': 'Sala não encontrada'}), 404
    elif action == 'rejoin':
        room = db.session.get(GameRoom, int(data.get('room_id')))
        if room:
            current_user.room_id = room.id
            db.session.commit()
            return jsonify({'success': True})
    return jsonify({'error': 'Ação inválida'}), 400

# --- NOVA ROTA PARA EXCLUIR SALA ---
@lobby_bp.route('/delete_room', methods=['POST'])
@login_required
def delete_room():
    data = request.get_json()
    room_id = data.get('room_id')
    room = db.session.get(GameRoom, int(room_id))
    
    if not room: return jsonify({'error': 'Sala não encontrada'}), 404
    if room.creator_id != current_user.id: return jsonify({'error': 'Apenas o dono pode excluir'}), 403
    
    try:
        # Se o usuário estiver nela, tira ele
        if current_user.room_id == room.id:
            current_user.room_id = None
        db.session.delete(room)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@lobby_bp.route('/leave_room', methods=['POST'])
@login_required
def leave_room():
    current_user.room_id = None
    db.session.commit()
    return jsonify({'success': True})