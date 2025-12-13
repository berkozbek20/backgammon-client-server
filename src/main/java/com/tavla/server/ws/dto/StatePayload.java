package com.tavla.server.ws.dto;

import java.util.List;

public class StatePayload {
    public boolean gameOver;
    public String currentPlayer;
    public String winner; // null olabilir

    public DiceDto dice;
    public BoardDto board;

    public static class DiceDto {
        public boolean rolled;
        public int die1;
        public int die2;
        public List<Integer> remainingSteps;
    }

    public static class BoardDto {
        public int whiteBar;
        public int blackBar;
        public int whiteBornOff;
        public int blackBornOff;
        public List<PointDto> points;
    }

    public static class PointDto {
        public int index;
        public String owner; // "WHITE"/"BLACK" veya null
        public int count;
    }
}
