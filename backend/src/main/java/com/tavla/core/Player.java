package com.tavla.core;

public enum Player {
    WHITE,  // Beyaz
    BLACK;  // Siyah

    public Player opponent() {
        return this == WHITE ? BLACK : WHITE;
    }
}
