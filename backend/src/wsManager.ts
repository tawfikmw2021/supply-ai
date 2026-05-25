/**
 * WebSocket manager — keyed by userId (verified via JWT).
 * A user can have multiple desktop sockets (tabs) and one mobile socket.
 * Mobile → photo → broadcast to all desktops of same user.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer }  from 'http';
import { Server as HttpsServer } from 'https';
import jwt from 'jsonwebtoken';

type Role = 'desktop' | 'mobile';

interface UserSockets {
  desktops: Set<WebSocket>;
  mobile:   WebSocket | null;
}

const byUser = new Map<number, UserSockets>();

function getUser(userId: number): UserSockets {
  if (!byUser.has(userId)) byUser.set(userId, { desktops: new Set(), mobile: null });
  return byUser.get(userId)!;
}

function send(ws: WebSocket | null | undefined, data: object) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcast(sockets: Set<WebSocket>, data: object) {
  for (const ws of sockets) send(ws, data);
}

function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

export function attachWsServer(server: HttpServer | HttpsServer, label: string) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url   = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') ?? '';
    const role  = url.searchParams.get('role') as Role;

    const userId = verifyToken(token);
    if (!userId || (role !== 'desktop' && role !== 'mobile')) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const user = getUser(userId);

    if (role === 'desktop') {
      user.desktops.add(ws);
      send(ws, { type: 'ready' });
      // Tell desktop if mobile is already online
      if (user.mobile?.readyState === WebSocket.OPEN) {
        send(ws, { type: 'mobile_online' });
      }
    } else {
      // Close any previous mobile connection for this user
      user.mobile?.close();
      user.mobile = ws;
      send(ws, { type: 'ready' });
      broadcast(user.desktops, { type: 'mobile_online' });
    }

    ws.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // Mobile → Desktop: relay photo
      if (msg.type === 'photo' && role === 'mobile') {
        broadcast(user.desktops, {
          type:     'photo',
          data:     msg.data,
          mimeType: msg.mimeType ?? 'image/jpeg',
        });
        send(ws, { type: 'ack' });   // confirm to mobile immediately
        return;
      }
    });

    ws.on('close', () => {
      if (role === 'desktop') {
        user.desktops.delete(ws);
      } else {
        if (user.mobile === ws) user.mobile = null;
        broadcast(user.desktops, { type: 'mobile_offline' });
      }
      // Clean up empty entries
      if (!user.desktops.size && !user.mobile) byUser.delete(userId);
    });
  });

  wss.on('listening', () => console.log(`WS [${label}] → /ws`));
}
