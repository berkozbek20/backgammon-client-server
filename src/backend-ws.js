// backend-ws.js
// ==========================================
// REAL BACKEND ADAPTER (WebSocket)
// ==========================================

export const Player = { WHITE: "WHITE", BLACK: "BLACK" };

export class TavlaGame {
    constructor({ url = "ws://localhost:8080" } = {}) {
        this.url = url;

        this.ws = null;

        // Backend’den gelen son state
        this.lastState = null;

        // UI tarafında "event" gibi kullanmak için
        this.onState = null;   // (state) => void
        this.onError = null;   // (message) => void
        this.onInfo = null;    // (message) => void

        // Oda bilgisi
        this.roomId = null;
        this.player = null; // "WHITE" / "BLACK"
    }

    // ---------- Connection ----------
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            // bağlandı
        };

        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);

                if (msg.type === "state") {
                    // Server state payload formatı: { gameOver, currentPlayer, winner, dice, board }
                    // Biz bunu mock'taki snapshot'a benzeteceğiz.
                    this.lastState = this._mapServerStateToSnapshot(msg.payload);

                    if (this.onState) this.onState(this.lastState);
                    return;
                }

                if (msg.type === "room_created" || msg.type === "room_joined") {
                    this.roomId = msg.payload.roomId;
                    this.player = msg.payload.player; // "WHITE"/"BLACK"
                    // UI isterse bu bilgiyi kullanabilir
                    return;
                }

                if (msg.type === "error") {
                    if (this.onError) this.onError(msg.payload?.message ?? "Unknown error");
                    return;
                }

                if (msg.type === "info") {
                    if (this.onInfo) this.onInfo(msg.payload?.message ?? "");
                    return;
                }

            } catch (err) {
                if (this.onError) this.onError("Mesaj parse edilemedi: " + err.message);
            }
        };

        this.ws.onerror = () => {
            if (this.onError) this.onError("WebSocket bağlantı hatası.");
        };

        this.ws.onclose = () => {
            // bağlantı kapandı
        };
    }

    // ---------- Room ----------
    createRoom() {
        this._send({ type: "create_room" });
    }

    joinRoom(roomId) {
        this._send({ type: "join_room", payload: { roomId } });
    }

    // ---------- Game actions (mock ile aynı isimler) ----------
    rollDice() {
        this._send({ type: "roll" });
    }

    applyMove(fromIndex, toIndex, step) {
        // Backend bizde yön ve legality kontrolünü yapıyor.
        // Burada sadece gönderiyoruz.
        this._send({
            type: "move",
            payload: { from: fromIndex, to: toIndex, step }
        });
        // mock boolean dönüyordu; gerçek backend async.
        // İstersen true döndürüp UI’yı bloklamayabilirsin:
        return true;
    }

    // ---------- UI'nin beklediği snapshot ----------
    getBoardSnapshot() {
        // mock: {points, whiteBar, blackBar, whiteOff, blackOff, dice, winner}
        return this.lastState;
    }

    getCurrentPlayer() {
        return this.lastState?.currentPlayer ?? Player.WHITE;
    }

    getRemainingSteps() {
        return this.lastState?.dice ?? [];
    }

    checkWinner() {
        return this.lastState?.winner ?? null;
    }

    // ---------- Legal move highlight (şimdilik client-side hesap) ----------
    // Senin server’da "getLegalMoves" mesajı yok, o yüzden UI highlight için
    // mock’taki mantığı, gelen state üzerinden burada hesaplıyoruz.
    getLegalMoves(fromIndex) {
        if (!this.lastState) return [];
        return computeLegalMovesFromSnapshot(this.lastState, fromIndex);
    }

    getAllLegalMoves() {
        if (!this.lastState) return [];
        return computeAllLegalMovesFromSnapshot(this.lastState);
    }

    // ---------- Internals ----------
    _send(obj) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // bağlantı yoksa otomatik bağlanmayı deneyelim
            this.connect();
            // connect olur olmaz göndermek race yaratabilir; basit çözüm:
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(obj));
                } else {
                    if (this.onError) this.onError("WebSocket henüz açık değil.");
                }
            }, 100);
            return;
        }
        this.ws.send(JSON.stringify(obj));
    }

    _mapServerStateToSnapshot(payload) {
        // Server payload:
        // { gameOver, currentPlayer, winner, dice:{die1,die2,remainingSteps}, board:{whiteBar,blackBar,whiteBornOff,blackBornOff,points:[{index,owner,count}]}}
        const points = payload.board.points.map(p => ({
            index: p.index,
            owner: p.owner, // "WHITE"/"BLACK"/null
            count: p.count
        }));

        return {
            points,
            whiteBar: payload.board.whiteBar,
            blackBar: payload.board.blackBar,
            whiteOff: payload.board.whiteBornOff,
            blackOff: payload.board.blackBornOff,
            dice: payload.dice.remainingSteps ?? [],
            winner: payload.winner,
            currentPlayer: payload.currentPlayer
        };
    }
}

// --------------------
// CLIENT-SIDE LEGAL MOVES (UI highlight için)
// Bu hesap backend ile birebir olmak zorunda; biz senin backend kuralına göre yazıyoruz:
// WHITE: index azaltır, BLACK: index artırır
// Bar/bearing off'u şimdilik minimum tutuyoruz. (İstersen sonra server’dan "legalMoves" isteği ekleriz.)
// --------------------

function canBearOff(snapshot, player) {
    if (player === Player.WHITE) {
        if (snapshot.whiteBar > 0) return false;
        for (let i = 6; i < 24; i++) {
            if (snapshot.points[i].owner === Player.WHITE) return false;
        }
        return true;
    } else {
        if (snapshot.blackBar > 0) return false;
        for (let i = 0; i < 18; i++) {
            if (snapshot.points[i].owner === Player.BLACK) return false;
        }
        return true;
    }
}

function computeLegalMovesFromSnapshot(snapshot, fromIndex) {
    const moves = [];
    const dice = snapshot.dice ?? [];
    const uniqueDice = [...new Set(dice)];

    const current = snapshot.currentPlayer;
    const direction = current === Player.WHITE ? -1 : 1;
    const canOff = canBearOff(snapshot, current);

    const fromPoint = snapshot.points[fromIndex];
    if (!fromPoint || fromPoint.owner !== current || fromPoint.count <= 0) return moves;

    for (const die of uniqueDice) {
        const targetIdx = fromIndex + (die * direction);

        if (targetIdx >= 0 && targetIdx <= 23) {
            const target = snapshot.points[targetIdx];
            if (!target.owner || target.owner === current || target.count === 1) {
                moves.push(targetIdx);
            }
        } else if (canOff) {
            // Server tarafında bearing off’u nasıl temsil ettiğine göre ayarlamak gerekir.
            // Şimdilik UI için 'off' gösterebiliriz.
            if ((current === Player.WHITE && targetIdx === -1) || (current === Player.BLACK && targetIdx === 24)) {
                moves.push("off");
            }
        }
    }

    return moves;
}

function computeAllLegalMovesFromSnapshot(snapshot) {
    const allMoves = [];
    const dice = snapshot.dice ?? [];
    const uniqueDice = [...new Set(dice)];

    const current = snapshot.currentPlayer;
    const direction = current === Player.WHITE ? -1 : 1;
    const canOff = canBearOff(snapshot, current);

    // Bar önceliği: UI’da istersen ekleyebilirsin.
    const hasBar = (current === Player.WHITE && snapshot.whiteBar > 0) ||
        (current === Player.BLACK && snapshot.blackBar > 0);

    if (hasBar) {
        for (const die of uniqueDice) {
            const targetIdx = current === Player.WHITE ? 24 - die : die - 1;
            if (targetIdx >= 0 && targetIdx <= 23) {
                const target = snapshot.points[targetIdx];
                if (!target.owner || target.owner === current || target.count === 1) {
                    allMoves.push({ from: "bar", to: targetIdx, die });
                }
            }
        }
        return allMoves;
    }

    for (const p of snapshot.points) {
        if (p.owner === current && p.count > 0) {
            for (const die of uniqueDice) {
                const targetIdx = p.index + (die * direction);

                if (targetIdx >= 0 && targetIdx <= 23) {
                    const target = snapshot.points[targetIdx];
                    if (!target.owner || target.owner === current || target.count === 1) {
                        allMoves.push({ from: p.index, to: targetIdx, die });
                    }
                } else if (canOff) {
                    if ((current === Player.WHITE && targetIdx === -1) ||
                        (current === Player.BLACK && targetIdx === 24)) {
                        allMoves.push({ from: p.index, to: "off", die });
                    }
                }
            }
        }
    }

    return allMoves;
}
