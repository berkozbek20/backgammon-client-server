package com.tavla.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Frontend'in kullanması için basit bir arayüz (facade) sağlar.
 * İçeride GameState ve GameLogic'i saklar.
 *
 * UI tarafı:
 * - zar atmak için rollDice()
 * - hamle denemek için isMoveLegal/applyMove
 * - tahtayı çizmek için getBoardSnapshot()
 * gibi metodları kullanır.
 */
public class TavlaGame {

    private final GameState state;
    private final GameLogic logic;

    public TavlaGame() {
        this.state = new GameState();
        this.logic = new GameLogic();
    }

    // --- Genel durum ---

    public Player getCurrentPlayer() {
        return state.getCurrentPlayer();
    }

    public boolean isGameOver() {
        return state.isGameOver();
    }

    public Player getWinner() {
        return state.getWinner();
    }

    // --- Zar ---

    /** Zar atar ve Dice'ı günceller. */
    public void rollDice() {
        logic.rollDice(state);
    }

    /** Gösterim için zar yüzlerini döndürür (ör: "5-3"). */
    public int getDie1() {
        return state.getDice().getDie1();
    }

    public int getDie2() {
        return state.getDice().getDie2();
    }

    /** Kalan adımları (ör: [5,3] veya [4,4,4,4]) döndürür. */
    public List<Integer> getRemainingSteps() {
        return state.getDice().getRemainingSteps();
    }

    // --- Hamleler ---

    /** UI'dan gelen from/to/step bilgisiyle hamlenin geçerli olup olmadığını kontrol eder. */
    public boolean isMoveLegal(int fromIndex, int toIndex, int step) {
        Move move = new Move(fromIndex, toIndex, step);
        return logic.isMoveLegal(state, move);
    }

    /** Geçerli olduğu bilinen bir hamleyi uygular. Geçersizse IllegalStateException fırlatır. */
    public void applyMove(int fromIndex, int toIndex, int step) {
        Move move = new Move(fromIndex, toIndex, step);
        logic.applyMove(state, move);
    }

    // --- Tahta görünümü (UI için read-only snapshot) ---

    /** Tek bir hanenin (point) UI için sade hali. */
    public static class PointView {
        public final int index;       // 0..23
        public final Player owner;    // null olabilir
        public final int count;       // 0..15

        public PointView(int index, Player owner, int count) {
            this.index = index;
            this.owner = owner;
            this.count = count;
        }
    }

    /** Tüm tahtanın snapshot'ı. UI bunu kullanarak çizim yapabilir. */
    public static class BoardView {
        public final List<PointView> points;
        public final int whiteBar;
        public final int blackBar;
        public final int whiteBornOff;
        public final int blackBornOff;

        public BoardView(List<PointView> points,
                         int whiteBar,
                         int blackBar,
                         int whiteBornOff,
                         int blackBornOff) {
            this.points = points;
            this.whiteBar = whiteBar;
            this.blackBar = blackBar;
            this.whiteBornOff = whiteBornOff;
            this.blackBornOff = blackBornOff;
        }
    }

    public BoardView getBoardSnapshot() {
        List<PointView> list = new ArrayList<>();
        Board board = state.getBoard();
        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            Player owner = p.isEmpty() ? null : p.getOwner();
            int count = p.getCount();
            list.add(new PointView(i, owner, count));
        }
        return new BoardView(
                list,
                board.getWhiteBar(),
                board.getBlackBar(),
                board.getWhiteBornOff(),
                board.getBlackBornOff()
        );
    }


    /** İleride UI testleri / reset için gerekirse oyunu baştan başlatmak için kullanılabilir. */
    public GameState getInternalState() {
        return state;
    }
}
