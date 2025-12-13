package com.tavla.server.rooms;

import com.tavla.core.Player;
import com.tavla.core.TavlaGame;
import org.java_websocket.WebSocket;

public class Room {

    private final String roomId;

    private WebSocket whiteSocket;
    private WebSocket blackSocket;

    private TavlaGame game; // oda dolunca yaratılacak

    public Room(String roomId) {
        this.roomId = roomId;
    }

    public String getRoomId() {
        return roomId;
    }

    public boolean isFull() {
        return whiteSocket != null && blackSocket != null;
    }

    public boolean hasStarted() {
        return game != null;
    }

    public Player addPlayer(WebSocket socket) {
        if (whiteSocket == null) {
            whiteSocket = socket;
            return Player.WHITE;
        }
        if (blackSocket == null) {
            blackSocket = socket;
            return Player.BLACK;
        }
        throw new IllegalStateException("Oda dolu");
    }

    public void startGame() {
        if (!isFull()) {
            throw new IllegalStateException("Oda dolmadan oyun başlayamaz");
        }
        this.game = new TavlaGame();
    }

    public TavlaGame getGame() {
        return game;
    }

    public WebSocket getSocket(Player player) {
        return player == Player.WHITE ? whiteSocket : blackSocket;
    }

    public Player getPlayerBySocket(WebSocket socket) {
        if (socket == whiteSocket) return Player.WHITE;
        if (socket == blackSocket) return Player.BLACK;
        return null;
    }
}
