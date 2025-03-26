from flask import Flask, render_template
from flask_socketio import SocketIO
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

players = {}

@socketio.on('connect')
def handle_connect():
    player_id = str(uuid.uuid4())
    players[player_id] = {'position': [0, 0, 0], 'quaternion': [0, 0, 0, 1]}
    
    emit('init', {'id': player_id, 'players': players})
    emit('new_player', {'id': player_id}, broadcast=True, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    if player_id in players:
        del players[player_id]
        emit('player_left', {'id': player_id}, broadcast=True)

@socketio.on('update_state')
def handle_state_update(data):
    player_id = request.sid
    if player_id in players:
        players[player_id] = data
        emit('state_update', {'id': player_id, 'state': data}, broadcast=True, include_self=False)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
