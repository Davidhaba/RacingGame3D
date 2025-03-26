const socket = io();
let playerId = null;
const otherPlayers = {};

socket.on('init', (data) => {
    playerId = data.id;
    console.log('Ваш ID:', playerId);
    data.players.forEach(id => {
        if (id !== playerId) {
            addPlayer(id);
        }
    });
});

socket.on('new_player', (data) => {
    if (data.id !== playerId) {
        addPlayer(data.id);
    }
});

socket.on('state_update', (data) => {
    if (otherPlayers[data.id]) {
        updatePlayer(data.id, data.state);
    }
});

socket.on('player_left', (data) => {
    removePlayer(data.id);
});

function sendState() {
    if (playerId && window.car?.body) {
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

function addPlayer(id) {
    if (otherPlayers[id]) return;
    const { mesh, body } = createCar();
    const text = createTextSprite(id);
    text.position.set(0, 2, 0);
    mesh.add(text);
    otherPlayers[id] = { mesh, body };
    scene.add(mesh);
    world.addBody(body);
}
function updatePlayer(id, state) {
    const player = otherPlayers[id];
    if (!player) return;
    player.body.position.set(
        state.position.x,
        state.position.y,
        state.position.z
    );
    player.mesh.position.copy(player.body.position);
    player.mesh.quaternion.set(
        state.quaternion.x,
        state.quaternion.y,
        state.quaternion.z,
        state.quaternion.w
    );
}

function removePlayer(id) {
    if (!otherPlayers[id]) return;
    scene.remove(otherPlayers[id].mesh);
    world.removeBody(otherPlayers[id].body);
    delete otherPlayers[id];
}

function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(text, 10, 20);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true })
    );
}
