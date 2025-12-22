package com.tavla.core;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tavla oyun motoru için temel unit testler.
 */
public class GameLogicTest {

    @Test
    void initialBoardSetup_isCorrect() {
        Board board = new Board();

        // WHITE
        assertEquals(2, board.getPoint(23).getCount());
        assertEquals(Player.WHITE, board.getPoint(23).getOwner());

        assertEquals(5, board.getPoint(12).getCount());
        assertEquals(Player.WHITE, board.getPoint(12).getOwner());

        assertEquals(3, board.getPoint(7).getCount());
        assertEquals(Player.WHITE, board.getPoint(7).getOwner());

        assertEquals(5, board.getPoint(5).getCount());
        assertEquals(Player.WHITE, board.getPoint(5).getOwner());

        // BLACK
        assertEquals(2, board.getPoint(0).getCount());
        assertEquals(Player.BLACK, board.getPoint(0).getOwner());

        assertEquals(5, board.getPoint(11).getCount());
        assertEquals(Player.BLACK, board.getPoint(11).getOwner());

        assertEquals(3, board.getPoint(16).getCount());
        assertEquals(Player.BLACK, board.getPoint(16).getOwner());

        assertEquals(5, board.getPoint(18).getCount());
        assertEquals(Player.BLACK, board.getPoint(18).getOwner());
    }

    @Test
    void blockedMove_isIllegal() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();

        // Varsayılan dizilimde:
        // WHITE 23'te 2 taş, BLACK 18'de 5 taş (blok)
        // Zar 5 geldiğini varsayalım → 23 -> 18 denemesi yasak olmalı.
        state.getDice().setRemainingStepsForTest(5);

        Move move = new Move(23, 18, 5);

        assertFalse(logic.isMoveLegal(state, move),
                "BLACK'in 18'de bloğu varken WHITE 23->18 oynayamaz");
    }

    @Test
    void hitSingleOpponentChecker_movesItToBar() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();
        Board board = state.getBoard();

        // Tahtayı tamamen temizle
        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            while (!p.isEmpty()) {
                p.removeChecker(p.getOwner());
            }
        }

        // WHITE 7'de 1 taş, BLACK 5'te 1 taş olsun
        board.getPoint(7).addChecker(Player.WHITE);
        board.getPoint(5).addChecker(Player.BLACK);

        // Zar: 2 (7 -> 5)
        state.getDice().setRemainingStepsForTest(2);

        Move move = new Move(7, 5, 2);
        assertTrue(logic.isMoveLegal(state, move), "7->5 hamlesi yasal olmalı (rakibin tek taşı kırılır)");

        logic.applyMove(state, move);

        // 5. noktada artık WHITE olmalı
        assertEquals(Player.WHITE, board.getPoint(5).getOwner());
        assertEquals(1, board.getPoint(5).getCount());

        // Rakip taş bara gitmeli
        assertEquals(1, board.getBlackBar());
    }

    @Test
    void mustMoveFromBarIfHasCheckerOnBar() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();
        Board board = state.getBoard();

        // BLACK'in bar'ında bir taş olsun
        board.moveToBar(Player.BLACK);
        state.switchTurn(); // sıra BLACK'e geçsin

        // Zar: 1 (BLACK için giriş noktası: index 0)
        state.getDice().setRemainingStepsForTest(1);

        // Bar'da taş varken normal hamle yapmaya çalışma → illegal
        Move badMove = new Move(18, 19, 1); // ne olduğu önemli değil, tahtadan
        assertFalse(logic.isMoveLegal(state, badMove),
                "Bar'da taş varken önce bar'dan çıkılmalı, normal hamle yasak");

        // Geçerli deneme: bar'dan giriş
        Move fromBar = new Move(Move.BAR_INDEX, 0, 1);
        assertTrue(logic.isMoveLegal(state, fromBar));
    }


    @Test
    void bearingOffExactRoll_isAllowed() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();
        Board board = state.getBoard();

        // Tahtayı tamamen temizle
        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            while (!p.isEmpty()) {
                p.removeChecker(p.getOwner());
            }
        }

        // WHITE'in evinde sadece 0. indexte 1 taş olsun
        board.getPoint(0).addChecker(Player.WHITE);

        // Zar: 1 → 0'dan tam bearing off
        state.getDice().setRemainingStepsForTest(1);

        Move bearOff = new Move(0, Move.BEAR_OFF_INDEX, 1);

        assertTrue(logic.isMoveLegal(state, bearOff),
                "Tüm taşlar evdeyken 0. indexteki taşı zar=1 ile bearing off yapabilmeli");

        logic.applyMove(state, bearOff);

        assertEquals(1, board.getWhiteBornOff());
    }

    @Test
    void bearingOffOvershoot_notAllowedIfCheckerFurtherFromExitExists() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();
        Board board = state.getBoard();

        // Tahtayı temizle
        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            while (!p.isEmpty()) {
                p.removeChecker(p.getOwner());
            }
        }

        // White evde iki taş: 5 ve 3 indexlerinde (5 daha geride)
        board.getPoint(5).addChecker(Player.WHITE); // daha geride
        board.getPoint(3).addChecker(Player.WHITE); // daha önde

        // Zar: 5
        state.getDice().setRemainingStepsForTest(5);

        Move badBearOff = new Move(3, Move.BEAR_OFF_INDEX, 5);

        assertFalse(logic.isMoveLegal(state, badBearOff),
                "5. indexte taş varken 3'ten overshoot bearing off YASAK olmalı");
    }

    @Test
    void bearingOffOvershoot_allowedIfNoCheckerFurtherFromExit() {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();
        Board board = state.getBoard();

        // Tahtayı temizle
        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            while (!p.isEmpty()) {
                p.removeChecker(p.getOwner());
            }
        }

        // White evde tek taş: 3. indexte
        board.getPoint(3).addChecker(Player.WHITE);

        // Zar: 5 → overshoot, ama önünde taş yok
        state.getDice().setRemainingStepsForTest(5);

        Move goodBearOff = new Move(3, Move.BEAR_OFF_INDEX, 5);

        assertTrue(logic.isMoveLegal(state, goodBearOff),
                "Önünde taş yoksa overshoot bearing off serbest olmalı");

        logic.applyMove(state, goodBearOff);

        assertEquals(1, board.getWhiteBornOff());
    }
}
