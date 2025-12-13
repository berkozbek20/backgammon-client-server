package com.tavla.core;

import java.util.List;

/**
 * GameLogic, GameState, Board vs. sınıflarını test etmek için basit bir Main sınıfıdır.
 * Bu test:
 * 1) Başlangıç tahtasını yazdırır.
 * 2) Zar atar.
 * 3) White oyuncusu için 23. haneden bir hamle dener (step kadar geri).
 * 4) Hamle geçerliyse uygular ve tahtayı tekrar yazdırır.
 */
public class Main {

    public static void main(String[] args) {
        GameState state = new GameState();
        GameLogic logic = new GameLogic();

        System.out.println("=== Oyun Başlıyor ===");
        System.out.println("Sıra: " + state.getCurrentPlayer());
        printBoard(state);

        // Zar at
        System.out.println("\n=== Zar Atılıyor ===");
        logic.rollDice(state);
        Dice dice = state.getDice();
        System.out.println("Zarlar: " + dice.getDie1() + " - " + dice.getDie2());
        List<Integer> steps = dice.getRemainingSteps();
        System.out.println("Kullanılabilir adımlar: " + steps);

        if (steps.isEmpty()) {
            System.out.println("Hiç adım yok, bir şey yapamıyoruz.");
            return;
        }

        // Basit test: WHITE için 23. hanedeki bir taşı oynatmaya çalışıyoruz
        int fromIndex = 23; // WHITE için 24. nokta (0-index: 23)
        int step = steps.get(0);
        int toIndex = fromIndex - step; // WHITE geri doğru hareket ediyor (23'ten 0'a doğru)

        Move move = new Move(fromIndex, toIndex, step);
        System.out.println("\nDenenecek hamle: " + move);

        boolean legal = logic.isMoveLegal(state, move);
        System.out.println("Hamle geçerli mi? " + legal);

        if (legal) {
            System.out.println("\n=== Hamle uygulanıyor ===");
            logic.applyMove(state, move);
            System.out.println("Hamle uygulandı.");
        } else {
            System.out.println("Hamle geçersiz, uygulanmadı.");
        }

        System.out.println("\n=== Hamleden Sonraki Tahta ===");
        System.out.println("Sıra: " + state.getCurrentPlayer());
        printBoard(state);
    }

    /**
     * Tahtayı konsola basit şekilde yazdırır.
     * Her hane için: index, owner, count gösterilir.
     */
    private static void printBoard(GameState state) {
        Board board = state.getBoard();
        System.out.println("Tahta durumu:");
        for (int i = 23; i >= 0; i--) { // Üstten alta doğru yazdırıyoruz
            Point p = board.getPoint(i);
            System.out.printf("Index %2d -> owner=%-5s count=%d%n",
                    i,
                    p.getOwner() == null ? "-" : p.getOwner().name(),
                    p.getCount());
        }
        System.out.println("White bar: " + board.getWhiteBar()
                + ", Black bar: " + board.getBlackBar());
        System.out.println("White borne off: " + board.getWhiteBornOff()
                + ", Black borne off: " + board.getBlackBornOff());
    }
}
