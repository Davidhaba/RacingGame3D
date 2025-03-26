from flask import Flask, render_template, send_from_directory, request
from flask_socketio import SocketIO, emit
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

players = {}

@socketio.on('connect')
def handle_connect():
    player_id = str(uuid.uuid4())
    players[player_id] = {
        'position': [0, 0, 0],
        'quaternion': [0, 0, 0, 1]
    }
    emit('init', {
        'id': player_id,
        'players': list(players.keys())
    })
    emit('new_player', {'id': player_id}, broadcast=True, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    if player_id in players:
        del players[player_id]
        emit('player_left', {'id': player_id}, broadcast=True)

@socketio.on('update_state')
def handle_state_update(data):
    try:
        player_id = request.sid
        players[player_id] = data
        emit('state_update', {
            'id': player_id,
            'state': data
        }, broadcast=True)
        
    except Exception as e:
        print(f"Помилка оновлення стану: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/textures/<path:filename>')
def serve_textures(filename):
    return send_from_directory('textures', filename)

if __name__ == '__main__':
    socketio.run(app, 
                host='0.0.0.0', 
                port=5000, 
                debug=True, 
                allow_unsafe_werkzeug=True)
