# Важливо: eventlet має бути імпортований та патчений ПЕРШИМ
import eventlet
eventlet.monkey_patch()  # Викликати перед будь-якими іншими імпортами

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import uuid

# Ініціалізація Flask після патчингу
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

players = {}

@socketio.on('connect')
def handle_connect():
    # Використовуємо контекст додатка
    with app.app_context():
        player_id = str(uuid.uuid4())
        players[player_id] = {'position': [0,0,0], 'quaternion': [0,0,0,1]}
        
        emit('init', {'id': player_id, 'players': players})
        emit('new_player', {'id': player_id}, broadcast=True, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    with app.app_context():
        player_id = request.sid
        if player_id in players:
            del players[player_id]
            emit('player_left', {'id': player_id}, broadcast=True)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
