package com.tavla.server.ws.dto;

public class ServerMessage<T> {
    public String type;
    public T payload;

    public ServerMessage(String type, T payload) {
        this.type = type;
        this.payload = payload;
    }
}
