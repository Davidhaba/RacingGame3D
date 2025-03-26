let ws, playerId, otherPlayers = {};

const handleNetworkMessage = (type, data) => {
    switch(type) {
        case 'init':
            playerId = data.id;
            data.players.forEach(id => {
                if(id !== playerId) addPlayer(id);
            });
            break;
        case 'newPlayer':
            addPlayer(data.id);
            break;
        case 'update':
            if(otherPlayers[data.id]) {
                otherPlayers[data.id].body.position.copy(data.state.position);
                otherPlayers[data.id].mesh.position.copy(data.state.position);
                otherPlayers[data.id].mesh.quaternion.copy(data.state.quaternion);
            }
            break;
        case 'removePlayer':
            removePlayer(data.id);
            break;
    }
},

addPlayer = id => {
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
},

sendState = () => {
    if (ws?.readyState === WebSocket.OPEN && playerId) {
        ws.send(JSON.stringify({
            type: 'state',
            state: {
                position: car.body.position,
                quaternion: car.body.quaternion
            }
        }));
    }
},

connectWebSocket = () => {
    ws = new WebSocket('ws://localhost:8001');
    
    ws.onopen = () => console.log('Connected!');
    
    ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        handleNetworkMessage(msg.type, msg);
    };
    
    ws.onclose = () => setTimeout(connectWebSocket, 1000);
};

connectWebSocket();
