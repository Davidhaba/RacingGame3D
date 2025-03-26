from flask import Flask, render_template, send_from_directory, request
from flask_socketio import SocketIO, emit
import uuid

app = Flask(__name__)
app.config["SECRET_KEY"] = "your-secret-key"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

players = {}

@socketio.on("connect")
def handle_connect():
    """Обробка підключення нового гравця"""
    try:
        player_id = str(uuid.uuid4())
        players[player_id] = {
            "position": [0, 0, 0],
            "quaternion": [0, 0, 0, 1]
        }
        emit("init", {
            "id": player_id,
            "players": list(players.keys())
        })
        emit("new_player", {"id": player_id}, broadcast=True, include_self=False)
        print(f"🟢 Підключено: {player_id} | Всього гравців: {len(players)}")
        
    except Exception as e:
        print(f"🚨 Помилка підключення: {e}")

@socketio.on("disconnect")
def handle_disconnect():
    """Обробка відключення гравця"""
    try:
        player_id = request.sid
        
        if player_id in players:
            del players[player_id]
            emit("player_left", {"id": player_id}, broadcast=True)
            print(f"🔴 Відключено: {player_id} | Залишилось: {len(players)}")
            
    except Exception as e:
        print(f"🚨 Помилка відключення: {e}")

@socketio.on("update_state")
def handle_state_update(data):
    """Оновлення стану гравця"""
    try:
        player_id = request.sid
        
        if player_id in players:
            players[player_id] = data
            emit("state_update", {
                "id": player_id,
                "state": data
            }, broadcast=True, include_self=False)
            
    except Exception as e:
        print(f"🚨 Помилка оновлення стану: {e}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/textures/<path:filename>')
def serve_textures(filename):
    return send_from_directory('textures', filename)

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True
    )
