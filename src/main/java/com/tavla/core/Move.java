package com.tavla.core;

/**
 * Tek bir taşı bir haneden başka bir haneye taşıyan hamleyi temsil eder.
 * fromIndex ve toIndex 0–23 arası nokta indexleridir.
 * İleride bar veya bear-off için özel değerler tanımlanabilir.
 */
public class Move {

    public static final int BAR_INDEX = -1;
    public static final int BEAR_OFF_INDEX = 24;

    private final int fromIndex; // 0–23
    private final int toIndex;   // 0–23
    private final int step;      // Hamlede kullanılan zar adımı (örn: 3, 4, 6)

    public Move(int fromIndex, int toIndex, int step) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.step = step;
    }

    public int getFromIndex() {
        return fromIndex;
    }

    public int getToIndex() {
        return toIndex;
    }

    public int getStep() {
        return step;
    }

    @Override
    public String toString() {
        return "Move{" +
                "fromIndex=" + fromIndex +
                ", toIndex=" + toIndex +
                ", step=" + step +
                '}';
    }
}
