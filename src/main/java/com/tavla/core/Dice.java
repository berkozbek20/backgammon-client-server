package com.tavla.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Tavla oyunundaki iki zarı temsil eder.
 * - roll() ile zar atılır.
 * - Çift gelirse 4 hareket hakkı oluşturulur.
 * - remainingSteps listesi, kullanılmamış zar adımlarını tutar.
 */
public class Dice {

    // Zar değerleri
    private int die1;
    private int die2;

    // Kullanılmayı bekleyen adımlar (ör: [6, 6, 6, 6] veya [3, 5])
    private final List<Integer> remainingSteps = new ArrayList<>();

    // Zar atıldı mı? (true → hamle yapılabilir, false → önce zar atılmalı)
    private boolean rolled = false;

    private final Random random = new Random();

    /**
     * Zarları atar ve remainingSteps listesini günceller.
     * Çift durumda 4 hak verir, aksi halde 2 hak verir.
     */
    public void roll() {
        die1 = random.nextInt(6) + 1;
        die2 = random.nextInt(6) + 1;

        remainingSteps.clear();

        if (die1 == die2) {
            // Çift geldi → 4 hareket hakkı
            for (int i = 0; i < 4; i++) {
                remainingSteps.add(die1);
            }
        } else {
            remainingSteps.add(die1);
            remainingSteps.add(die2);
        }

        rolled = true;
    }

    /**
     * Zarlar atılmış mı?
     */
    public boolean isRolled() {
        return rolled;
    }

    /**
     * Kullanılmamış zar adımlarını geri döndürür.
     * Dışarıya kopya veriyoruz, orijinal listeyi bozmamak için.
     */
    public List<Integer> getRemainingSteps() {
        return new ArrayList<>(remainingSteps);
    }

    /**
     * Bir hamlede kullanılan zar adımını listeden siler.
     * Örn: remainingSteps [3,5] iken useStep(3) çağrılırsa, geriye [5] kalır.
     */
    public void useStep(int step) {
        boolean removed = remainingSteps.remove(Integer.valueOf(step));
        if (!removed) {
            throw new IllegalStateException("Kalan zar haklarında bu adım yok: " + step);
        }

        // Tüm adımlar kullanıldıysa zar atma hakkı biter
        if (remainingSteps.isEmpty()) {
            rolled = false;
        }
    }

    public int getDie1() {
        return die1;
    }

    public int getDie2() {
        return die2;


    }

    /**
     * SADECE TESTLERDE KULLANMAK İÇİN.
     * Kalan zar adımlarını manuel olarak ayarlamamızı sağlar.
     * GameLogicTest ile aynı pakette olduğu için erişilebilir (modifier yok).
     */
    void setRemainingStepsForTest(int... steps) {
        remainingSteps.clear();
        for (int s : steps) {
            remainingSteps.add(s);
        }
        rolled = remainingSteps.size() > 0;
        if (remainingSteps.size() == 1) {
            die1 = remainingSteps.get(0);
            die2 = 0;
        } else if (remainingSteps.size() >= 2) {
            die1 = remainingSteps.get(0);
            die2 = remainingSteps.get(1);
        }
    }


    @Override
    public String toString() {
        return "Dice{" +
                "die1=" + die1 +
                ", die2=" + die2 +
                ", remainingSteps=" + remainingSteps +
                ", rolled=" + rolled +
                '}';
    }
}
