package com.tavla.core;

/**
 * Tavla oyunundaki o anki tam durumu temsil eder.
 * - Tahta (Board)
 * - Zarlar (Dice)
 * - Sıra kimde (currentPlayer)
 * - Oyun bitti mi, kazanan kim
 */
public class GameState {

    private final Board board;
    private final Dice dice;
    private Player currentPlayer;
    private boolean gameOver;
    private Player winner;

    public GameState() {
        this.board = new Board();
        this.dice = new Dice();
        this.currentPlayer = Player.WHITE; // Varsayılan olarak beyaz başlasın
        this.gameOver = false;
        this.winner = null;
    }

    public Board getBoard() {
        return board;
    }

    public Dice getDice() {
        return dice;
    }

    public Player getCurrentPlayer() {
        return currentPlayer;
    }

    public boolean isGameOver() {
        return gameOver;
    }

    public Player getWinner() {
        return winner;
    }

    /**
     * Sırayı diğer oyuncuya geçirir.
     */
    public void switchTurn() {
        this.currentPlayer = this.currentPlayer.opponent();
    }

    /**
     * Oyunu bitirir ve kazananı set eder.
     */
    public void endGame(Player winner) {
        this.gameOver = true;
        this.winner = winner;
    }

    @Override
    public String toString() {
        return "GameState{" +
                "board=" + board +
                ", dice=" + dice +
                ", currentPlayer=" + currentPlayer +
                ", gameOver=" + gameOver +
                ", winner=" + winner +
                '}';
    }
}
