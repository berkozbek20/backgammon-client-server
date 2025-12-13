package com.tavla.server.ws.dto;

import com.fasterxml.jackson.databind.JsonNode;

public class ClientMessage {
    public String type;
    public JsonNode payload; // payload her type için farklı olacağı için JsonNode iyi
}
