package com.tavla.server.rooms;

import org.java_websocket.WebSocket;

import java.util.*;

public class RoomManager {

    private final Map<String, Room> rooms = new HashMap<>();
    private final Map<WebSocket, Room> roomBySocket = new HashMap<>();

    public Room createRoom(WebSocket ownerSocket) {
        String roomId = UUID.randomUUID().toString().substring(0, 6);
        Room room = new Room(roomId);

        room.addPlayer(ownerSocket);

        rooms.put(roomId, room);
        roomBySocket.put(ownerSocket, room);

        return room;
    }

    public Room joinRoom(String roomId, WebSocket socket) {
        Room room = rooms.get(roomId);
        if (room == null) {
            throw new IllegalStateException("Oda bulunamadı");
        }
        if (room.isFull()) {
            throw new IllegalStateException("Oda dolu");
        }

        room.addPlayer(socket);
        roomBySocket.put(socket, room);

        return room;
    }

    public Room getRoomBySocket(WebSocket socket) {
        return roomBySocket.get(socket);
    }

    public void removeSocket(WebSocket socket) {
        Room room = roomBySocket.remove(socket);
        if (room == null) return;

        // minimum sistem: socket çıkınca odayı komple sil
        rooms.remove(room.getRoomId());
    }
}
