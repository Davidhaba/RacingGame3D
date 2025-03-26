const socket = io();

let playerId;
const otherPlayers = {};

const addPlayer = id => {
    if (id !== playerId && !otherPlayers[id]) {
        const { mesh, body } = createCar();
        const text = createTextSprite(id);
        text.position.set(0, 0, 0);
        mesh.add(text);
        otherPlayers[id] = { mesh, body };
    }
}, 

createTextSprite = t => {
    const s = 10, f = 3, 
          canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d"),
          renderSize = f * s;
    
    ctx.font = `Bold ${renderSize}px Arial`;
    const width = Math.ceil(ctx.measureText(t).width * 1.1),
          height = Math.ceil(renderSize * 1.5);
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = (width/s) + "px";
    canvas.style.height = (height/s) + "px";
    
    ctx.font = `Bold ${renderSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.textBaseline = "top";
    ctx.fillText(t, 0, 0);
    
    const texture = new THREE.Texture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
    );
    sprite.scale.set(width/s*0.1, height/s*0.1, 1);
    return sprite;
},

updatePlayer = (id, { position, quaternion }) => {
    if (id === playerId || !otherPlayers[id]) return;
    otherPlayers[id].body.position.copy(position);
    otherPlayers[id].body.quaternion.copy(quaternion);
    otherPlayers[id].mesh.position.copy(position);
    otherPlayers[id].mesh.quaternion.copy(quaternion);
},

removePlayer = id => {
    if (!otherPlayers[id]) return;
    scene.remove(otherPlayers[id].mesh);
    world.removeBody(otherPlayers[id].body);
    delete otherPlayers[id];
};

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
