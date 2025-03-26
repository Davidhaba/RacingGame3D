const socket = io();

let playerId;
const otherPlayers = {};

socket.on('init', (data) => {
    playerId = data.id;
    Object.keys(data.players).forEach(id => {
        if(id !== playerId) addPlayer(id);
    });
});

socket.on('new_player', (data) => {
    if(data.id !== playerId) addPlayer(data.id);
});

socket.on('state_update', (data) => {
    if(otherPlayers[data.id]) {
        updatePlayerPosition(data.id, data.state);
    }
});

socket.on('player_left', (data) => {
    removePlayer(data.id);
});

function sendState() {
    if(playerId && window.car?.body) {
        const state = {
            position: {
                x: car.body.position.x,
                y: car.body.position.y,
                z: car.body.position.z
            },
            quaternion: {
                x: car.body.quaternion.x,
                y: car.body.quaternion.y,
                z: car.body.quaternion.z,
                w: car.body.quaternion.w
            }
        };
        socket.emit('update_state', state);
    }
}

setInterval(sendState, 50);
