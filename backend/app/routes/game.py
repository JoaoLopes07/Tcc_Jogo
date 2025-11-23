from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import db, GameRoom
from app.services.ai_service import ai_engine

game_bp = Blueprint('game', __name__)

@game_bp.route('/queue_action', methods=['POST'])
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

@game_bp.route('/resolve_turn', methods=['POST'])
@login_required
def resolve_turn():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room or room.creator_id != current_user.id: 
        return jsonify({'error': 'Acesso negado'}), 403
    
    pending = room.get_pending_actions()
    if not pending: return jsonify({'error': 'Sem ações'}), 400

    data = request.get_json()
    # Atualiza stats vindo do front
    if data.get('stats'):
        s = data['stats']
        room.hp = s.get('hp', room.hp)
        room.floor = s.get('floor', room.floor)
        room.set_inventory(s.get('inventory', []))

    history = room.get_history()
    group_action = "\n".join(pending)
    history.append({"role": "user", "content": f"**TURNO GRUPO:**\n{group_action}"})
    
    # CHAMA O SERVICE DE IA
    ai_text = ai_engine.gerar_narrativa(data.get('system_context', ''), history, group_action)

    history.append({"role": "assistant", "content": ai_text})
    room.set_history(history)
    room.set_pending_actions([]) # Limpa fila
    db.session.commit()
    return jsonify({"content": ai_text}), 200

@game_bp.route('/start_campaign', methods=['POST'])
@login_required
def start_campaign():
    room = db.session.get(GameRoom, current_user.room_id)
    if not room or room.creator_id != current_user.id: return jsonify({'error': 'Apenas líder'}), 403

    room.set_history([]) 
    room.set_pending_actions([]) 
    room.hp = 20; room.floor = 1
    
    ai_text = ai_engine.gerar_narrativa("Mestre de RPG.", [], "INICIAR AVENTURA. Descreva o salão inicial.")
    
    room.set_history([{"role": "assistant", "content": ai_text}])
    db.session.commit()
    return jsonify({"content": ai_text}), 200

@game_bp.route('/poll', methods=['GET'])
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

@game_bp.route('/reset', methods=['POST'])
@login_required
def reset_game():
    room = db.session.get(GameRoom, current_user.room_id)
    if room:
        room.hp = 20; room.floor = 1; room.set_history([]); room.set_pending_actions([])
        db.session.commit()
    return jsonify({"status": "resetado"})