package com.tavla.core;

import java.util.List;

/**
 * Tavla oyun kurallarını içeren sınıftır.
 * Board, Point, Dice gibi veri sınıflarını kullanarak:
 * - Zar atma
 * - Hamlenin geçerli olup olmadığını kontrol etme
 * - Hamleyi tahtaya uygulama
 * işlerini yapar.
 *
 * Bu ilk versiyonda:
 * - Bar'dan çıkma
 * - Bearing off (taş toplama)
 * henüz yoktur. Sadece tahtadaki normal hareketler ve kırma kuralı uygulanır.
 */
public class GameLogic {

    /**
     * Zar atar ve verilen GameState içindeki Dice nesnesini günceller.
     */
    public void rollDice(GameState state) {
        state.getDice().roll();
    }

    /**
     * Verilen hamlenin tavla kurallarına göre geçerli olup olmadığını kontrol eder.
     *
     * Kontroller:
     * 1) Oyun bitmiş mi?
     * 2) Zar atılmış mı ve bu step mevcut mu?
     * 3) fromIndex ve toIndex tahtanın içinde mi? (0–23)
     * 4) fromPoint'te currentPlayer'a ait taş var mı?
     * 5) Hamle yönü doğru mu? (WHITE: sağdan sola, BLACK: soldan sağa)
     * 6) Hedef noktaya tavla kuralına göre gidilebilir mi? (blok kontrolü)
     *
     */
    public boolean isMoveLegal(GameState state, Move move) {
        if (state.isGameOver()) {
            return false;
        }

        Dice dice = state.getDice();
        if (!dice.isRolled()) {
            return false;
        }

        int step = move.getStep();
        List<Integer> remainingSteps = dice.getRemainingSteps();
        if (!remainingSteps.contains(step)) {
            return false;
        }

        Board board = state.getBoard();
        Player current = state.getCurrentPlayer();
        int from = move.getFromIndex();
        int to = move.getToIndex();

        boolean hasBarChecker = hasCheckerOnBar(board, current);

        // 1) Eğer bar'da taş varsa, önce o taşlar çıkmalı
        if (hasBarChecker) {
            // Bar'dan çıkmıyorsa → geçersiz
            if (from != Move.BAR_INDEX) {
                return false;
            }

            // Zar adımına göre beklenen giriş noktası
            int expectedTo = entryPointFromBar(current, step);
            if (!isIndexOnBoard(expectedTo)) {
                return false;
            }

            // toIndex doğru mu?
            if (to != expectedTo) {
                return false;
            }

            // Hedef nokta kural olarak uygun mu? (blok vs.)
            return canLandOn(state, to);
        }

        // 2) Bearing off denemesi mi? (taş toplama)
        if (to == Move.BEAR_OFF_INDEX) {

            // from mutlaka tahtada olmalı
            if (!isIndexOnBoard(from)) {
                return false;
            }

            // from oyuncunun ev bölgesinde olmalı
            if (!isInHomeBoard(current, from)) {
                return false;
            }

            // Tüm taşlar evde mi?
            if (!allCheckersInHome(board, current)) {
                return false;
            }

            Point fromPoint = board.getPoint(from);
            if (fromPoint.isEmpty() || fromPoint.getOwner() != current) {
                return false;
            }

            int needed = stepsToBearOff(current, from);

            if (step < needed) {
                // Zar bu taştan çıkmak için küçük, normal hamle olmalıydı
                return false;
            } else if (step == needed) {
                // Tam isabet → her zaman serbest
                return true;
            } else {
                // step > needed → overshoot
                boolean hasFurther = hasCheckersFurtherFromExit(board, current, from);
                return !hasFurther;  // önünde taş yoksa serbest
            }
        }

        // 3) Normal hareket (bearing off değil)
        // Bu durumda from ve to 0–23 arasında olmalı
        if (!isIndexOnBoard(from) || !isIndexOnBoard(to)) {
            return false;
        }

        Point fromPoint = board.getPoint(from);

        if (fromPoint.isEmpty() || fromPoint.getOwner() != current) {
            return false;
        }

        int expectedTo = computeToIndexForStep(current, from, step);
        if (to != expectedTo) {
            return false;
        }

        if (!canLandOn(state, to)) {
            return false;
        }

        return true;
    }


    // Barda taş olup olmadığını kontrol eder
    private boolean hasCheckerOnBar(Board board, Player player) {
        if (player == Player.WHITE) {
            return board.getWhiteBar() > 0;
        } else {
            return board.getBlackBar() > 0;
        }
    }

    /**
     * Verilen hamle geçerliyse tahtaya uygular, zar adımını tüketir.
     * - Gidilen noktada rakibin tek taşı varsa kırar ve bar'a gönderir.
     * - Kaynak noktadan taşı azaltır, hedef noktaya ekler.
     * - Kullanılan zar adımını Dice'tan düşer.
     * - Zar hakları bittiğinde otomatik olarak sırayı diğer oyuncuya geçirir.
     */


    // bardan çıkış için giriş noktası hesaplar
    private int entryPointFromBar(Player player, int step) {
        if (player == Player.WHITE) {
            return 24 - step; // 1 → 23, 6 → 18
        } else {
            return step - 1;  // 1 → 0, 6 → 5
        }
    }
    public void applyMove(GameState state, Move move) {
        if (!isMoveLegal(state, move)) {
            throw new IllegalStateException("Geçersiz hamle: " + move);
        }

        Board board = state.getBoard();
        Player current = state.getCurrentPlayer();

        int from = move.getFromIndex();
        int to = move.getToIndex();
        int step = move.getStep();

        // 1) Bearing off durumu
        if (to == Move.BEAR_OFF_INDEX) {
            // from her zaman tahtada (0–23)
            Point fromPoint = board.getPoint(from);
            fromPoint.removeChecker(current);

            // Taşı dışarı al
            board.bearOff(current);

            // Zar adımını tüket
            state.getDice().useStep(step);

            // Kazandı mı? (15 taş topladıysa)
            if (current == Player.WHITE && board.getWhiteBornOff() == 15) {
                state.endGame(current);
            } else if (current == Player.BLACK && board.getBlackBornOff() == 15) {
                state.endGame(current);
            }

            // Zar hakları bittiyse ve oyun bitmediyse sırayı değiştir
            if (!state.getDice().isRolled() && !state.isGameOver()) {
                state.switchTurn();
            }
            return; // bearing off tamam, aşağıya inmeyelim
        }

        // 2) Normal hamle + kırma + bar
        Point toPoint = board.getPoint(to);

        // Hedef noktada rakibin tek taşı varsa kır
        if (!toPoint.isEmpty() && toPoint.getOwner() != current) {
            if (toPoint.getCount() == 1) {
                Player opponent = toPoint.getOwner();
                toPoint.removeChecker(opponent);
                board.moveToBar(opponent);
            } else {
                throw new IllegalStateException("Rakibin blok yaptığı haneye hareket uygulanamaz!");
            }
        }

        // Bar'dan mı çıkıyoruz?
        if (from == Move.BAR_INDEX) {
            board.removeFromBar(current);
        } else {
            Point fromPoint = board.getPoint(from);
            fromPoint.removeChecker(current);
        }

        // Hedef noktaya kendi taşımızı ekle
        toPoint.addChecker(current);

        // Zar adımını tüket
        state.getDice().useStep(step);

        // Eğer zar hakları bittiyse sırayı değiştir
        if (!state.getDice().isRolled()) {
            state.switchTurn();
        }
    }



    /**
     * Hedef noktaya tavla kurallarına göre gidilip gidilemeyeceğini kontrol eder.
     *
     * Kurallar:
     * - Boş nokta → gidilebilir
     * - Kendi taşlarının olduğu nokta → gidilebilir
     * - Rakibin 1 taşı olan nokta → kırarak gidilebilir
     * - Rakibin 2 veya daha fazla taşı olan nokta → gidilemez (blok)
     */
    private boolean canLandOn(GameState state, int toIndex) {
        Point p = state.getBoard().getPoint(toIndex);

        // Boş nokta → serbest
        if (p.isEmpty()) {
            return true;
        }

        Player current = state.getCurrentPlayer();

        // Kendi taşımız varsa üstüne binebiliriz
        if (p.getOwner() == current) {
            return true;
        }

        // Rakibin taşı varsa:
        int opponentCount = p.getCount();

        // Tek taş → kırılabilir
        if (opponentCount == 1) {
            return true;
        }

        // 2 veya daha fazla taş → blok
        return false;
    }

    /**
     * Tahta üzerindeki index geçerli mi? (0–23 arası)
     */
    private boolean isIndexOnBoard(int index) {
        return index >= 0 && index < 24;
    }

    /**
     * Verilen oyuncu, fromIndex ve zar adımı için hedef index'i hesaplar.
     * WHITE: 23 → 0'a doğru azalır (sağdan sola)
     * BLACK: 0 → 23'e doğru artar (soldan sağa)
     */
    private int computeToIndexForStep(Player player, int fromIndex, int step) {
        if (player == Player.WHITE) {
            return fromIndex - step;
        } else {
            return fromIndex + step;
        }
    }

    // Oyuncunun ev bölgesinde mi (home board)?
    private boolean isInHomeBoard(Player player, int index) {
        if (!isIndexOnBoard(index)) return false;
        if (player == Player.WHITE) {
            return index >= 0 && index <= 5;
        } else {
            return index >= 18 && index <= 23;
        }
    }

    // Oyuncunun tüm taşları evde mi? (bar dahil kontrol)
    private boolean allCheckersInHome(Board board, Player player) {
        // Bar'da taş varsa zaten evde değil
        if (player == Player.WHITE && board.getWhiteBar() > 0) return false;
        if (player == Player.BLACK && board.getBlackBar() > 0) return false;

        for (int i = 0; i < 24; i++) {
            Point p = board.getPoint(i);
            if (!p.isEmpty() && p.getOwner() == player) {
                // Ev bölgesi dışında kendi taşın varsa bearing off yapamazsın
                if (!isInHomeBoard(player, i)) {
                    return false;
                }
            }
        }
        return true;
    }

    // Bu index'teki taştan dışarı çıkmak için gereken tam zar adımı
    private int stepsToBearOff(Player player, int fromIndex) {
        if (player == Player.WHITE) {
            // index 0 -> 1, index 5 -> 6
            return fromIndex + 1;
        } else {
            // index 18 -> 1, index 23 -> 6
            return fromIndex - 17;
        }
    }

    // Overshoot durumunda: bu taşın "önünde" (exit'e daha uzak) taş var mı?
    private boolean hasCheckersFurtherFromExit(Board board, Player player, int fromIndex) {
        if (player == Player.WHITE) {
            // White için ev: 0..5, exit'e daha uzak olanlar: fromIndex+1 .. 5
            for (int i = fromIndex + 1; i <= 5; i++) {
                Point p = board.getPoint(i);
                if (!p.isEmpty() && p.getOwner() == player) {
                    return true; // önünde taş var
                }
            }
        } else {
            // Black için ev: 18..23, exit'e daha uzak olanlar: 18 .. fromIndex-1
            for (int i = 18; i < fromIndex; i++) {
                Point p = board.getPoint(i);
                if (!p.isEmpty() && p.getOwner() == player) {
                    return true;
                }
            }
        }
        return false;
    }

}
