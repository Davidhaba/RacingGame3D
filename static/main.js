const controlTypeSelect = document.getElementById('controlTypeSelect');
        function openTab(evt, tabName) {
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents?.forEach(tab => tab.style.display = 'none');
            const tabLinks = document.querySelectorAll('.tab-link');
            tabLinks?.forEach(link => link?.classList?.remove('active'));
            const tabEl = document.getElementById(tabName);
            if (tabEl) tabEl.style.display = 'block';
            evt?.currentTarget?.classList?.add('active');
        }
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.tab-link').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    openTab(e, this.dataset.tab);
                });
            });
            document.querySelector('.tab-link').click();
            controlTypeSelect.addEventListener('change', (e) => {
                setControlType(e.target.value);
            });        
        });

document.getElementById('shadowQuality').addEventListener('change', (e) => {
    const quality = e.target.value;
    if (quality === 'off') {
        light.castShadow = false;
    } else {
        light.castShadow = true;
        let shadowMapSize;
        switch (quality) {
            case 'low': shadowMapSize = 512; break;
            case 'medium': shadowMapSize = 1024; break;
            case 'high': shadowMapSize = 2048; break;
        }
        light.shadow.mapSize.width = shadowMapSize;
        light.shadow.mapSize.height = shadowMapSize;
        light.shadow.map.dispose();
        light.shadow.map = null;
    }
});

document.getElementById('textureQuality').addEventListener('change', (e) => {
    const quality = e.target.value;
    let filter;
    switch (quality) {
        case 'low': filter = THREE.NearestFilter; break;
        case 'medium': filter = THREE.LinearFilter; break;
        case 'high': filter = THREE.LinearMipmapLinearFilter; break;
    }
    Object.values(textures).forEach(t => {
        t.magFilter = filter;
        t.minFilter = filter;
        t.needsUpdate = true;
    });
});

document.getElementById('renderScale').addEventListener('change', (e) => {
    const scale = parseFloat(e.target.value);
    renderer.setPixelRatio(window.devicePixelRatio * scale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
});

document.getElementById('masterVolume').addEventListener('input', (e) => {
    carSoundVolume = parseFloat(e.target.value);
});

let carSoundVolume = 0.5, tiltHandler = null, cameraTouchIds = [], isCameraDragging = false, lastCameraX, lastCameraY, pinchStartDist, isPointerLocked = false;
const safeStorage = { set: (k, v) => { try { localStorage.setItem(k, v) } catch {} }, get: k => { try { return localStorage.getItem(k) } catch { return null } } };

const controls = { forward: false, backward: false, left: false, right: false, brake: false };
const carSettings = { acceleration: 5000, brakeForce: 8000, maxSpeed: 20, steeringSpeed: 0.05, maxSteering: 0.35 };
let currentSteering = 0, cameraDistance = 15, cameraTheta = Math.PI / 4, cameraPhi = Math.PI / 2, lastTime = performance.now(), timeScale = 1, paused = true;

const audioContext = new (window.AudioContext || window.webkitAudioContext)(), oscillator = audioContext.createOscillator(), gainNode = audioContext.createGain();
oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(200, audioContext.currentTime); oscillator.connect(gainNode); gainNode.connect(audioContext.destination); gainNode.gain.setValueAtTime(0, audioContext.currentTime);

const initialPosition = new CANNON.Vec3(0, 10, 0), initialQuaternion = new CANNON.Quaternion();

const initControl = {
    joystick: () => {
        const j = document.getElementById('joystick'), jc = document.getElementById('joystick-container'), jr = jc.offsetWidth / 2, js = j.offsetWidth / 2;
        let active = false, activeTouchId = null;
        const getActiveTouch = touches => Array.from(touches).find(t => t.identifier === activeTouchId);
        const updatePos = e => {
            e.preventDefault();
            let clientX, clientY;
            if (e.touches) { const touch = getActiveTouch(e.touches); if (!touch) return; clientX = touch.clientX; clientY = touch.clientY; } else { clientX = e.clientX; clientY = e.clientY; }
            const rect = jc.getBoundingClientRect(), dx = clientX - (rect.left + jr), dy = clientY - (rect.top + jr), dist = Math.sqrt(dx ** 2 + dy ** 2);
            [controls.left, controls.right] = [dx < -js, dx > js]; [controls.forward, controls.backward] = [dy < -js, dy > js];
            const limitedX = dx * (dist > jr ? jr / dist : 1), limitedY = dy * (dist > jr ? jr / dist : 1);
            j.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
        };
        const resetJoystick = () => { active = false; activeTouchId = null; j.style.transition = 'transform 0.2s ease-out'; j.style.transform = 'translate(0, 0)'; Object.keys(controls).forEach(k => controls[k] = false); };
        jc.addEventListener('mousedown', e => { active = true; j.style.transition = 'none'; updatePos(e); });
        jc.addEventListener('touchstart', e => {
            const touch = Array.from(e.changedTouches).reverse().find(t => {
                const rect = jc.getBoundingClientRect();
                return t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom;
            });
            if (touch) { activeTouchId = touch.identifier; active = true; j.style.transition = 'none'; updatePos(e); }
        });
        document.addEventListener('mousemove', e => active && updatePos(e));
        document.addEventListener('touchmove', e => active && updatePos(e));
        document.addEventListener('mouseup', resetJoystick);
        document.addEventListener('touchend', e => Array.from(e.changedTouches).some(t => t.identifier === activeTouchId) && resetJoystick());
    },
    buttons: () => Object.keys(controls).forEach(k => { ['touchstart', 'mousedown'].forEach(ev => document.getElementById(k).addEventListener(ev, () => !paused && (controls[k] = true))); ['touchend', 'mouseup'].forEach(ev => document.getElementById(k).addEventListener(ev, () => !paused && (controls[k] = false))); }),
    tilt: () => {
        tiltHandler = e => { if (paused) return; const acc = e.accelerationIncludingGravity, sensitivity = 2; controls.left = acc.x > sensitivity; controls.right = acc.x < -sensitivity; controls.forward = acc.y < -sensitivity; controls.backward = acc.y > sensitivity; };
        if (typeof DeviceMotionEvent?.requestPermission === 'function') DeviceMotionEvent.requestPermission().then(p => p === 'granted' && window.addEventListener('devicemotion', tiltHandler)); else window.addEventListener('devicemotion', tiltHandler);
    }
};

const setControlType = type => {
    if (tiltHandler) { window.removeEventListener('devicemotion', tiltHandler); tiltHandler = null; }
    document.getElementById('joystick-container').style.display = type === 'joystick' ? 'flex' : 'none'; document.getElementById('controls').style.display = type === 'buttons' ? 'grid' : 'none';
    initControl[type](); safeStorage.set('controlType', type);
    controlTypeSelect.value = type;
};

const loadingManager = new THREE.LoadingManager(() => { document.querySelector('.loading-text').textContent = "Loading completed!"; document.getElementById('continue-btn').classList.remove('hide'); }, (url, loaded, total) => { document.getElementById('loading-bar').style.width = `${(loaded / total) * 100}%`; });

function startGame() {
    initCameraControls();
    initSpecialButtons();
    setControlType(safeStorage.get('controlType') || 'joystick');
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.opacity = '0';
    loadingScreen.style.pointerEvents = 'none';
    oscillator.start();
    paused = false;
    setTimeout(() => loadingScreen.style.display = 'none', 500);
}

const keyBindings = { forward: 'ArrowUp', backward: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', brake: 'Space', reset: 'KeyR', slow: 'Tab' };

document.getElementById('settings-btn').addEventListener('click', () => { document.getElementById('settingsOverlay').style.display = 'flex'; updateKeyDisplay(); paused = true; });

function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; paused = false; }

document.getElementById('settingsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('settingsOverlay')) closeSettings(); });

function updateKeyDisplay() { document.querySelectorAll('.key-input').forEach(input => { input.value = keyBindings[input.dataset.action].replace('Key', ''); }); }

document.querySelectorAll('.key-input').forEach((input) => {
    input.addEventListener('click', function () {
      updateKeyDisplay();
      this.value = 'Press any key...';
    });
    input.addEventListener('blur', () => updateKeyDisplay());
    input.addEventListener('keydown', (e) => {
        e.preventDefault();
        keyBindings[input.dataset.action] = e.code;
        input.blur();
      });
});
  
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000), renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = 'renderCanvas'; renderer.setSize(window.innerWidth, window.innerHeight); renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader(loadingManager);
const textures = { sky: textureLoader.load('textures/sky_texture.jpg'), ground: textureLoader.load('textures/diff_texture.jpg'), car: textureLoader.load('textures/car_texture.jpg'), cube: textureLoader.load('textures/disp_texture.png') };
Object.values(textures).forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });

scene.background = new THREE.Color(0x87CEEB); scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 60, 40), new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide })));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight(0xffffff, 0.8); light.position.set(10, 20, 10); light.castShadow = true; light.shadow.camera.left = -100; light.shadow.camera.right = 100; light.shadow.camera.top = 100; light.shadow.camera.bottom = -100; light.shadow.camera.near = 0.1; light.shadow.camera.far = 200; light.shadow.mapSize.width = 4096; light.shadow.mapSize.height = 4096; light.shadow.camera.updateProjectionMatrix(); scene.add(light);

const world = new CANNON.World(); world.gravity.set(0, -9.82, 0); world.solver.iterations = 10;

const createPhysicsObject = (meshParams, bodyParams, materialParams) => {
    const mesh = new THREE.Mesh(meshParams.geometry, new THREE.MeshStandardMaterial(materialParams)); mesh.castShadow = meshParams.castShadow; mesh.receiveShadow = meshParams.receiveShadow; mesh.position.set(...meshParams.position);
    const body = new CANNON.Body({ mass: bodyParams.mass, position: new CANNON.Vec3(...bodyParams.position), shape: bodyParams.shape, material: bodyParams.material, ...bodyParams.extraParams });
    return { mesh, body };
};
function createCar() {
    const car = createPhysicsObject({ geometry: new THREE.BoxGeometry(2, 1, 4), position: [0, 10, 0], castShadow: true, receiveShadow: false }, { mass: 130, position: [0, 10, 0], shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)), material: new CANNON.Material(), extraParams: { linearDamping: 0.05, angularDamping: 0.5 } }, { map: textures.car, metalness: 0.3, roughness: 0.6 });
    scene.add(car.mesh); world.addBody(car.body);
    return car;
}

const platform = createPhysicsObject({ geometry: new THREE.BoxGeometry(200, 1, 200), position: [0, -0.5, 0], castShadow: false, receiveShadow: true }, { mass: 0, position: [0, -0.5, 0], shape: new CANNON.Box(new CANNON.Vec3(100, 0.5, 100)), material: new CANNON.Material() }, { map: textures.ground, roughness: 0.8, metalness: 0.2 });
scene.add(platform.mesh); world.addBody(platform.body);

const car = createCar();

const obstacles = [{x:10,z:10}, {x:-15,z:20}, {x:5,z:-15}, {x:-20,z:-10}].map(pos => {
    const obstacle = createPhysicsObject({ geometry: new THREE.BoxGeometry(3, 3, 3), position: [pos.x, 1.5, pos.z], castShadow: true, receiveShadow: true }, { mass: 0, position: [pos.x, 1.5, pos.z], shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)), material: new CANNON.Material() }, { map: textures.cube, roughness: 0.7, metalness: 0.1, color: 0x808080 });
    scene.add(obstacle.mesh); world.addBody(obstacle.body); return obstacle;
});

[[platform.body.material, car.body.material, 0.01, 0.1], [car.body.material, obstacles[0].body.material, 0.3, 0.5]].forEach(([m1, m2, f, r]) => world.addContactMaterial(new CANNON.ContactMaterial(m1, m2, { friction: f, restitution: r })));

const initCameraControls = () => {
    const getTouch = (touches, id) => Array.from(touches).find(t => t.identifier === id);
    const getPinchDist = touches => touches.length < 2 ? null : Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const handleStart = e => {
        if (e.touches) {
            const lastTouch = e.touches[e.touches.length - 1];
            if (document.elementFromPoint(lastTouch.clientX, lastTouch.clientY)?.closest('#renderCanvas')) cameraTouchIds.push(lastTouch.identifier);
            if (cameraTouchIds.length === 1) { isCameraDragging = true; const touch = getTouch(e.touches, cameraTouchIds[0]); [lastCameraX, lastCameraY] = [touch.clientX, touch.clientY]; } else if (cameraTouchIds.length >= 2) { pinchStartDist = getPinchDist(e.touches); isCameraDragging = false; }
        } else {
            if (e.button === 1 || e.ctrlKey) { isPointerLocked = !isPointerLocked; if (isPointerLocked) { renderer.domElement.requestPointerLock(); } else { document.exitPointerLock(); } } else if (document.elementFromPoint(e.clientX, e.clientY)?.closest('#renderCanvas')) { isCameraDragging = true; [lastCameraX, lastCameraY] = [e.clientX, e.clientY]; }
        }
    };
    const handleMove = e => {
        if (paused) return; e.preventDefault();
        if (e.touches && cameraTouchIds.length) {
            const validTouches = Array.from(e.touches).filter(t => cameraTouchIds.includes(t.identifier));
            if (validTouches.length === 1 && isCameraDragging) { const touch = validTouches[0]; updateCameraAngles(touch.clientX - lastCameraX, touch.clientY - lastCameraY); [lastCameraX, lastCameraY] = [touch.clientX, touch.clientY]; } else if (validTouches.length >= 2) { const pinchDist = getPinchDist(validTouches); if (pinchDist && pinchStartDist) { const delta = (pinchStartDist - pinchDist) * 0.1; cameraDistance = THREE.MathUtils.clamp(cameraDistance + delta, 5, 50); pinchStartDist = pinchDist; } }
        } else if (isCameraDragging || isPointerLocked) updateCameraAngles(e.movementX, e.movementY);
    };
    const handleEnd = e => {
        if (e.touches) { cameraTouchIds = Array.from(e.touches).filter(t => cameraTouchIds.includes(t.identifier)).map(t => t.identifier); if (!cameraTouchIds.length) { isCameraDragging = false; pinchStartDist = null; } else if (cameraTouchIds.length === 1) { isCameraDragging = true; const touch = getTouch(e.touches, cameraTouchIds[0]); [lastCameraX, lastCameraY] = [touch.clientX, touch.clientY]; } } else isCameraDragging = false;
    };
    const handleWheel = e => { e.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + (e.deltaY > 0 ? 2 : -2), 5, 50); };
    renderer.domElement.addEventListener('wheel', handleWheel);
    ['mousedown', 'touchstart'].forEach(ev => renderer.domElement.addEventListener(ev, handleStart));
    ['mousemove', 'touchmove'].forEach(ev => document.addEventListener(ev, handleMove, { passive: false }));
    ['mouseup', 'touchend'].forEach(ev => document.addEventListener(ev, handleEnd));
};

window.addEventListener('keydown', e => { if (document.getElementById('settingsOverlay').style.display === 'flex') return; const key = e.code; if (key === keyBindings.forward) controls.forward = true; if (key === keyBindings.backward) controls.backward = true; if (key === keyBindings.left) controls.left = true; if (key === keyBindings.right) controls.right = true; if (key === keyBindings.brake) controls.brake = true; if (key === keyBindings.reset) resetCar(); if (key === keyBindings.slow) timeScale = 0.05; });
window.addEventListener('keyup', e => { const key = e.code; if (key === keyBindings.forward) controls.forward = false; if (key === keyBindings.backward) controls.backward = false; if (key === keyBindings.left) controls.left = false; if (key === keyBindings.right) controls.right = false; if (key === keyBindings.brake) controls.brake = false; if (key === keyBindings.slow) timeScale = 1; });

const initSpecialButtons = () => {
    const handleButtonAction = (id, action) => { const btn = document.getElementById(id); let activeTouchId = null; const startHandler = e => { if (e.touches) activeTouchId = e.changedTouches[0].identifier; action(true); }; const endHandler = e => { if (e.touches && !Array.from(e.changedTouches).some(t => t.identifier === activeTouchId)) return; activeTouchId = null; action(false); }; btn.addEventListener('mousedown', startHandler); btn.addEventListener('touchstart', startHandler); btn.addEventListener('mouseup', endHandler); btn.addEventListener('touchend', endHandler); btn.addEventListener('mouseleave', endHandler); };
    handleButtonAction('reset-btn', state => state && resetCar());
    handleButtonAction('slow', state => timeScale = state ? 0.05 : 1);
};

function updateCameraAngles(dx, dy) { const s = 0.01; cameraPhi += dx * s; cameraTheta = Math.max(0.015, Math.min(Math.PI / 2, cameraTheta - dy * s)); }

function resetCar() { car.body.position.copy(initialPosition); car.body.quaternion.copy(initialQuaternion); car.body.velocity.set(0, 0, 0); car.body.angularVelocity.set(0, 0, 0); }

function updatePhysics(d) {
    world.step(d * timeScale); const lf = new CANNON.Vec3(0, 0, -1), wf = new CANNON.Vec3(); car.body.quaternion.vmult(lf, wf); currentSteering *= 0.9;
    let speed = car.body.velocity.dot(wf), isMovingBackward = speed < 0, steeringInput = 0;
    if (controls.left) steeringInput -= carSettings.steeringSpeed; if (controls.right) steeringInput += carSettings.steeringSpeed; if (isMovingBackward) steeringInput = -steeringInput;
    currentSteering = THREE.MathUtils.clamp(currentSteering + steeringInput, -carSettings.maxSteering, carSettings.maxSteering);
    const f = new CANNON.Vec3(0, 0, 0); if (controls.forward) f.z -= carSettings.acceleration; if (controls.backward) f.z += carSettings.acceleration * 0.8;
    if (controls.brake) car.body.velocity.scale(0.95, car.body.velocity); else { const worldForce = new CANNON.Vec3(); car.body.quaternion.vmult(f, worldForce); car.body.applyForce(worldForce, car.body.position); }
    car.body.angularVelocity.y = -currentSteering * Math.min(Math.abs(speed) / 10, 1) * 4; oscillator.frequency.setValueAtTime(200 + speed * 2, audioContext.currentTime);
    car.mesh.position.copy(car.body.position); car.mesh.quaternion.copy(car.body.quaternion); obstacles.forEach(o => { o.mesh.position.copy(o.body.position); o.mesh.quaternion.copy(o.body.quaternion); });
    if (car.body.position.y < -10) resetCar();
}

function updateCamera() { const p = car.mesh.position; camera.position.lerp(new THREE.Vector3(p.x + cameraDistance * Math.sin(cameraTheta) * Math.cos(cameraPhi), p.y + cameraDistance * Math.cos(cameraTheta), p.z + cameraDistance * Math.sin(cameraTheta) * Math.sin(cameraPhi)), 0.1); camera.lookAt(p); }

function updateHUD() { document.getElementById('speed').textContent = (car.body.velocity.length() * 3.6).toFixed(1); document.getElementById('steering').textContent = Math.round((currentSteering / carSettings.maxSteering) * 100); }

function animate() {
    const n = performance.now(), d = Math.min((n - lastTime) / 1000, 0.1); lastTime = n;
    if (!paused) { gainNode.gain.linearRampToValueAtTime(carSoundVolume, audioContext.currentTime + 0.1); updatePhysics(d); updateCamera(); sendState(); } else gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
    updateHUD(); renderer.render(scene, camera); requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
