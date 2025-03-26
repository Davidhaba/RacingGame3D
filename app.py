import os
import json
import uuid
import asyncio
import websockets
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

HTTP_PORT = 8000
WS_PORT = 8001
clients = {}

async def websocket_handler(websocket):
    try:
        client_id = str(uuid.uuid4())
        clients[client_id] = websocket
        
        await websocket.send(json.dumps({
            'type': 'init',
            'id': client_id,
            'players': [pid for pid in clients if pid != client_id]
        }))
        
        await broadcast({
            'type': 'newPlayer',
            'id': client_id
        })

        async for message in websocket:
            data = json.loads(message)
            if data['type'] == 'state':
                await broadcast({
                    'type': 'update',
                    'id': client_id,
                    'state': data['state']
                })
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if client_id in clients:
            await broadcast({'type': 'removePlayer', 'id': client_id})
            del clients[client_id]

async def broadcast(message):
    for ws in list(clients.values()):
        try:
            await ws.send(json.dumps(message))
        except:
            pass

def start_http_server():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=os.getcwd(), **kwargs)
    
    httpd = ThreadingHTTPServer(("", HTTP_PORT), Handler)
    print(f"HTTP server running on port {HTTP_PORT}")
    httpd.serve_forever()

async def start_websocket_server():
    async with websockets.serve(websocket_handler, "0.0.0.0", WS_PORT):
        print(f"WebSocket server running on port {WS_PORT}")
        await asyncio.Future()

if __name__ == '__main__':
    Thread(target=start_http_server, daemon=True).start()
    asyncio.run(start_websocket_server())
