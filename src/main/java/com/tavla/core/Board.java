package com.tavla.core;

public class Board { //comment

    // 24 hane
    private final Point[] points = new Point[24];

    // Bar'daki taş sayıları (kırılmış taşlar)
    private int whiteBar = 0;
    private int blackBar = 0;

    // Toplanan taşlar (bear-off)
    private int whiteBornOff = 0;
    private int blackBornOff = 0;

    public Board() {
        for (int i = 0; i < 24; i++) {
            points[i] = new Point(i);
        }
        initStartingPosition();
    }

    /**
     * Klasik tavla başlangıç dizilimi (0-indexli):
     *
     * WHITE: 23'te 2, 12'de 5, 7'de 3, 5'te 5
     * BLACK: 0'da 2, 11'de 5, 16'da 3, 18'de 5
     */
    private void initStartingPosition() {
        // WHITE
        addCheckers(23, Player.WHITE, 2); // 24. nokta
        addCheckers(12, Player.WHITE, 5); // 13. nokta
        addCheckers(7,  Player.WHITE, 3); // 8. nokta
        addCheckers(5,  Player.WHITE, 5); // 6. nokta

        // BLACK
        addCheckers(0,  Player.BLACK, 2); // 1. nokta
        addCheckers(11, Player.BLACK, 5); // 12. nokta
        addCheckers(16, Player.BLACK, 3); // 17. nokta
        addCheckers(18, Player.BLACK, 5); // 19. nokta
    }

    private void addCheckers(int index, Player player, int count) {
        for (int i = 0; i < count; i++) {
            points[index].addChecker(player);
        }
    }

    public Point getPoint(int index) {
        return points[index];
    }

    public int getWhiteBar() {
        return whiteBar;
    }

    public int getBlackBar() {
        return blackBar;
    }

    public int getWhiteBornOff() {
        return whiteBornOff;
    }

    public int getBlackBornOff() {
        return blackBornOff;
    }

    public void moveToBar(Player player) {
        if (player == Player.WHITE) {
            whiteBar++;
        } else {
            blackBar++;
        }
    }

    public void removeFromBar(Player player) {
        if (player == Player.WHITE) {
            if (whiteBar == 0) throw new IllegalStateException("White bar boş!");
            whiteBar--;
        } else {
            if (blackBar == 0) throw new IllegalStateException("Black bar boş!");
            blackBar--;
        }
    }

    public void bearOff(Player player) {
        if (player == Player.WHITE) {
            whiteBornOff++;
        } else {
            blackBornOff++;
        }
    }
}
