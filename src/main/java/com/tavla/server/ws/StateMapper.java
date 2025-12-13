package com.tavla.server.ws;

import com.tavla.core.TavlaGame;
import com.tavla.server.ws.dto.StatePayload;

import java.util.ArrayList;

public final class StateMapper {
    private StateMapper() {}

    public static StatePayload toPayload(TavlaGame game) {
        TavlaGame.BoardView view = game.getBoardSnapshot();

        StatePayload payload = new StatePayload();
        payload.gameOver = game.isGameOver();
        payload.currentPlayer = game.getCurrentPlayer().name();
        payload.winner = (game.getWinner() == null) ? null : game.getWinner().name();

        // dice
        var dice = new StatePayload.DiceDto();
        var steps = game.getRemainingSteps();
        dice.rolled = !steps.isEmpty();
        dice.die1 = game.getDie1();
        dice.die2 = game.getDie2();
        dice.remainingSteps = steps;
        payload.dice = dice;

        // board
        var board = new StatePayload.BoardDto();
        board.whiteBar = view.whiteBar;
        board.blackBar = view.blackBar;
        board.whiteBornOff = view.whiteBornOff;
        board.blackBornOff = view.blackBornOff;

        board.points = new ArrayList<>();
        for (var p : view.points) {
            var pd = new StatePayload.PointDto();
            pd.index = p.index;
            pd.owner = (p.owner == null) ? null : p.owner.name();
            pd.count = p.count;
            board.points.add(pd);
        }
        payload.board = board;

        return payload;
    }
}
