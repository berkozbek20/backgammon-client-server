package com.tavla.server.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tavla.core.Player;
import com.tavla.core.TavlaGame;
import com.tavla.server.rooms.Room;
import com.tavla.server.rooms.RoomManager;
import com.tavla.server.ws.dto.*;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Map;

/**
 * Production'a yakın minimal WS server:
 * - JSON parse/serialize: Jackson (string arama yok)
 * - Room sistemi: create_room / join_room
 * - Oda dolunca TavlaGame başlar
 * - roll / move komutları sadece oyuncu sırasındaysa kabul edilir
 *
 * Client -> Server:
 *  {"type":"create_room"}
 *  {"type":"join_room","payload":{"roomId":"abc123"}}
 *  {"type":"roll"}
 *  {"type":"move","payload":{"from":23,"to":18,"step":5}}
 *
 * Server -> Client:
 *  {"type":"room_created","payload":{"roomId":"abc123","player":"WHITE"}}
 *  {"type":"room_joined","payload":{"roomId":"abc123","player":"BLACK"}}
 *  {"type":"state","payload":{...}}
 *  {"type":"error","payload":{"message":"..."}}
 */
public class TavlaWebSocketServer extends WebSocketServer {

    private final ObjectMapper mapper = new ObjectMapper();
    private final RoomManager roomManager = new RoomManager();

    public TavlaWebSocketServer(int port) {
        super(new InetSocketAddress(port));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("Bağlandı: " + conn.getRemoteSocketAddress());
        send(conn, new ServerMessage<>("info", Map.of("message", "create_room veya join_room gönder")));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println("Bağlantı kapandı: " + conn.getRemoteSocketAddress() + " reason=" + reason);
        roomManager.removeSocket(conn);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            ClientMessage msg = mapper.readValue(message, ClientMessage.class);
            if (msg.type == null || msg.type.isBlank()) {
                sendError(conn, "Mesajda type yok.");
                return;
            }

            switch (msg.type) {
                case "create_room" -> handleCreateRoom(conn);

                case "join_room" -> {
                    JoinRoomPayload p = requirePayload(conn, msg, JoinRoomPayload.class);
                    if (p == null) return;
                    handleJoinRoom(conn, p);
                }

                case "roll" -> handleRoll(conn);

                case "move" -> {
                    MovePayload p = requirePayload(conn, msg, MovePayload.class);
                    if (p == null) return;
                    handleMove(conn, p);
                }

                default -> sendError(conn, "Bilinmeyen type: " + msg.type);
            }

        } catch (Exception e) {
            sendError(conn, "JSON parse/handle hatası: " + e.getMessage());
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.out.println("WebSocket error: " + ex.getMessage());
        ex.printStackTrace();
        if (conn != null) {
            sendError(conn, "Sunucu hatası: " + ex.getMessage());
        }
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server started on " + getAddress());
    }

    // ---------------- Handlers ----------------

    private void handleCreateRoom(WebSocket conn) {
        try {
            Room room = roomManager.createRoom(conn);

            // ownerSocket createRoom içinde WHITE olarak ekleniyor (minimum model)
            send(conn, new ServerMessage<>("room_created",
                    Map.of("roomId", room.getRoomId(), "player", "WHITE")));

        } catch (Exception e) {
            sendError(conn, e.getMessage());
        }
    }

    private void handleJoinRoom(WebSocket conn, JoinRoomPayload payload) {
        if (payload.roomId == null || payload.roomId.isBlank()) {
            sendError(conn, "roomId boş olamaz.");
            return;
        }

        try {
            Room room = roomManager.joinRoom(payload.roomId, conn);

            // join eden BLACK varsayıyoruz (minimum model)
            send(conn, new ServerMessage<>("room_joined",
                    Map.of("roomId", room.getRoomId(), "player", "BLACK")));

            // oda dolunca oyun başlat + state gönder
            synchronized (room) {
                if (!room.hasStarted()) {
                    room.startGame();
                }
                broadcastState(room);
            }

        } catch (Exception e) {
            sendError(conn, e.getMessage());
        }
    }

    private void handleRoll(WebSocket conn) {
        Room room = roomManager.getRoomBySocket(conn);
        if (room == null) {
            sendError(conn, "Herhangi bir odada değilsin. create_room/join_room yap.");
            return;
        }
        if (!room.hasStarted()) {
            sendError(conn, "Oyun başlamadı. İkinci oyuncu bekleniyor.");
            return;
        }

        synchronized (room) {
            TavlaGame game = room.getGame();
            Player sender = room.getPlayerBySocket(conn);
            if (sender == null) {
                sendError(conn, "Odadaki oyuncu bulunamadı.");
                return;
            }

            if (sender != game.getCurrentPlayer()) {
                sendError(conn, "Sıra sende değil. Sıra: " + game.getCurrentPlayer());
                return;
            }

            game.rollDice();
            broadcastState(room);
        }
    }

    private void handleMove(WebSocket conn, MovePayload payload) {
        Room room = roomManager.getRoomBySocket(conn);
        if (room == null) {
            sendError(conn, "Herhangi bir odada değilsin. create_room/join_room yap.");
            return;
        }
        if (!room.hasStarted()) {
            sendError(conn, "Oyun başlamadı. İkinci oyuncu bekleniyor.");
            return;
        }

        synchronized (room) {
            TavlaGame game = room.getGame();
            Player sender = room.getPlayerBySocket(conn);
            if (sender == null) {
                sendError(conn, "Odadaki oyuncu bulunamadı.");
                return;
            }

            if (sender != game.getCurrentPlayer()) {
                sendError(conn, "Sıra sende değil. Sıra: " + game.getCurrentPlayer());
                return;
            }

            // basic validation
            if (payload.step <= 0) {
                sendError(conn, "step pozitif olmalı.");
                return;
            }

            if (!game.isMoveLegal(payload.from, payload.to, payload.step)) {
                sendError(conn, "Geçersiz hamle.");
                return;
            }

            try {
                game.applyMove(payload.from, payload.to, payload.step);
                broadcastState(room);
            } catch (IllegalStateException e) {
                sendError(conn, "Hamle uygulanamadı: " + e.getMessage());
            }
        }
    }

    // ---------------- Helpers ----------------

    private <T> T requirePayload(WebSocket conn, ClientMessage msg, Class<T> clazz) {
        try {
            if (msg.payload == null || msg.payload.isNull()) {
                sendError(conn, "payload eksik.");
                return null;
            }
            return mapper.treeToValue(msg.payload, clazz);
        } catch (Exception e) {
            sendError(conn, "payload parse edilemedi: " + e.getMessage());
            return null;
        }
    }

    private void broadcastState(Room room) {
        TavlaGame game = room.getGame();
        StatePayload payload = StateMapper.toPayload(game);

        ServerMessage<StatePayload> stateMsg = new ServerMessage<>("state", payload);

        WebSocket w = room.getSocket(Player.WHITE);
        WebSocket b = room.getSocket(Player.BLACK);

        if (w != null) send(w, stateMsg);
        if (b != null) send(b, stateMsg);
    }

    private void send(WebSocket conn, Object msgObj) {
        try {
            conn.send(mapper.writeValueAsString(msgObj));
        } catch (Exception e) {
            // en son çare
            conn.send("{\"type\":\"error\",\"payload\":{\"message\":\"serialization error\"}}");
        }
    }

    private void sendError(WebSocket conn, String message) {
        send(conn, new ServerMessage<>("error", Map.of("message", message)));
    }

    public static void main(String[] args) {
        int port = 8080;
        new TavlaWebSocketServer(port).start();
        System.out.println("WS server başladı: ws://localhost:" + port);
    }
}
