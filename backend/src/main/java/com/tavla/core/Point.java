package com.tavla.core;

public class Point {
    private final int index;   // 0–23
    private Player owner;      // Bu noktadaki taşların sahibi (null ise boş)
    private int count;         // Taş sayısı

    public Point(int index) {
        this.index = index;
        this.owner = null;
        this.count = 0;
    }

    public int getIndex() {
        return index;
    }

    public Player getOwner() {
        return owner;
    }

    public int getCount() {
        return count;
    }

    public boolean isEmpty() {
        return count == 0;
    }

    public void addChecker(Player player) {
        if (isEmpty()) {
            owner = player;
            count = 1;
        } else if (owner == player) {
            count++;
        } else {
            throw new IllegalStateException("Farklı oyuncunun hanesine taş eklenemez!");
        }
    }

    public void removeChecker(Player player) {
        if (owner != player || count == 0) {
            throw new IllegalStateException("Bu noktadan bu oyuncu taş alamaz!");
        }
        count--;
        if (count == 0) {
            owner = null;
        }
    }

    @Override
    public String toString() {
        return "Point{" +
                "index=" + index +
                ", owner=" + owner +
                ", count=" + count +
                '}';
    }
}
