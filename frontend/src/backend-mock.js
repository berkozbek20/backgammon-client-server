// backend-mock.js
// ==========================================
// TAVLA OYUN MANTIĞI (MOCK BACKEND)
// ==========================================
// Bu sınıf, gerçek bir backend server'ı simüle eder.
// Oyun kuralları, hamle geçerliliği, zar atma ve kazanma
// durumları burada hesaplanır. Network entegrasyonu yapılana
// kadar frontend'in bağımsız çalışmasını sağlar.

export const Player = { WHITE: 'WHITE', BLACK: 'BLACK' };

export class TavlaGame {
  constructor() {
    this.initGame();
  }

  // Oyunu başlangıç pozisyonuna getirir
  initGame() {
    this.currentPlayer = Player.WHITE;
    this.dice = []; 
    // 24 hane (point) oluşturulur
    this.points = Array(24).fill(null).map((_, i) => ({ index: i, owner: null, count: 0 }));
    
    // Kırılan taşlar (Bar) ve Toplanan taşlar (Off) sayaçları
    this.whiteBar = 0;
    this.blackBar = 0;
    this.whiteOff = 0;
    this.blackOff = 0;

    // --- Klasik Tavla Başlangıç Dizilişi ---
    this._setPoint(23, Player.WHITE, 2); 
    this._setPoint(12, Player.WHITE, 5); 
    this._setPoint(7, Player.WHITE, 3); 
    this._setPoint(5, Player.WHITE, 5); 

    this._setPoint(0, Player.BLACK, 2); 
    this._setPoint(11, Player.BLACK, 5); 
    this._setPoint(16, Player.BLACK, 3); 
    this._setPoint(18, Player.BLACK, 5); 
  }

  // Yardımcı fonksiyon: Belirli bir noktaya taş atar
  _setPoint(idx, owner, count) {
    this.points[idx] = { index: idx, owner, count };
  }

  getCurrentPlayer() { return this.currentPlayer; }
  
  // Rastgele zar atar (Çift gelme durumunu simüle eder)
  rollDice() {
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    // Çift gelirse 4 hamle hakkı verir
    if (d1 === d2) this.dice = [d1, d1, d1, d1];
    else this.dice = [d1, d2];
  }

  getRemainingSteps() { return this.dice; }

  // Oyuncunun taş toplama (Bearing Off) aşamasına gelip gelmediğini kontrol eder
  canBearOff(player) {
    if (player === Player.WHITE) {
        if (this.whiteBar > 0) return false; // Kırık taş varsa toplayamaz
        // Beyazın evi 0-5 arasıdır. Dışarıda taş kalmamalı.
        for (let i = 6; i < 24; i++) {
            if (this.points[i].owner === Player.WHITE) return false;
        }
        return true;
    } else {
        if (this.blackBar > 0) return false;
        // Siyahın evi 18-23 arasıdır.
        for (let i = 0; i < 18; i++) {
            if (this.points[i].owner === Player.BLACK) return false;
        }
        return true;
    }
  }

  // Olası TÜM legal hamleleri hesaplar (Pas geçme durumu kontrolü için kritik)
  getAllLegalMoves() {
      const allMoves = [];
      const isCurrentPlayerInBar = (this.currentPlayer === Player.WHITE && this.whiteBar > 0) || 
                                   (this.currentPlayer === Player.BLACK && this.blackBar > 0);
      const uniqueDice = [...new Set(this.dice)];
      const direction = this.currentPlayer === Player.WHITE ? -1 : 1;
      const canOff = this.canBearOff(this.currentPlayer);

      if (isCurrentPlayerInBar) {
          // Bar'dan oyuna girme kuralları
          const barCount = this.currentPlayer === Player.WHITE ? this.whiteBar : this.blackBar;
          if (barCount > 0) {
              uniqueDice.forEach(die => {
                  const targetIdx = this.currentPlayer === Player.WHITE ? 24 - die : die - 1;
                  if (targetIdx >= 0 && targetIdx <= 23) {
                      const target = this.points[targetIdx];
                      // Hedef boşsa, kendisininse veya rakibin tek taşı varsa (kırma)
                      if (!target.owner || target.owner === this.currentPlayer || target.count === 1) {
                          allMoves.push({ from: 'bar', to: targetIdx, die }); 
                      }
                  }
              });
          }
      } else {
          // Tahta üzerindeki hamleler
          this.points.forEach(p => {
              if (p.owner === this.currentPlayer && p.count > 0) {
                  uniqueDice.forEach(die => {
                      const targetIdx = p.index + (die * direction);
                      
                      // 1. Normal Hamle
                      if(targetIdx >= 0 && targetIdx <= 23) {
                          const target = this.points[targetIdx];
                          if (!target.owner || target.owner === this.currentPlayer || target.count === 1) {
                              allMoves.push({ from: p.index, to: targetIdx, die });
                          }
                      } 
                      // 2. Taş Toplama (Bearing Off)
                      else if (canOff) {
                          if ((this.currentPlayer === Player.WHITE && targetIdx === -1) ||
                              (this.currentPlayer === Player.BLACK && targetIdx === 24)) {
                                  allMoves.push({ from: p.index, to: 'off', die });
                          }
                      }
                  });
              }
          });
      }
      return allMoves;
  }

  // Kazanma durumu kontrolü (15 taş toplandı mı?)
  checkWinner() {
    if (this.whiteOff === 15) return Player.WHITE;
    if (this.blackOff === 15) return Player.BLACK;
    return null;
  }

  // Hamleyi uygular ve board state'ini günceller
  applyMove(fromIndex, toIndex, step) {
    const dieIndex = this.dice.indexOf(step);
    if (dieIndex === -1) return false;

    // --- BEAR OFF (TOPLAMA) ---
    if (toIndex === 'off') {
        const source = this.points[fromIndex];
        if (!source || source.owner !== this.currentPlayer) return false;
        
        source.count--;
        if (source.count === 0) source.owner = null;
        
        if (this.currentPlayer === Player.WHITE) this.whiteOff++;
        else this.blackOff++;

        this.dice.splice(dieIndex, 1);
        return true;
    }

    // --- NORMAL HAMLE ---
    const source = this.points[fromIndex];
    const target = this.points[toIndex];

    if (!source || source.count <= 0 || source.owner !== this.currentPlayer) return false;
    if (target.owner && target.owner !== this.currentPlayer && target.count > 1) return false;

    const expectedTarget = this.currentPlayer === Player.WHITE ? fromIndex - step : fromIndex + step;
    if (toIndex !== expectedTarget) return false;

    // Kaynaktan al
    source.count--;
    if (source.count === 0) source.owner = null;

    // Hedefe koy (Kırma kontrolü dahil)
    if (target.owner && target.owner !== this.currentPlayer && target.count === 1) {
      // Rakip kırıldı -> Bar'a gönder
      if (target.owner === Player.WHITE) this.whiteBar++; 
      else this.blackBar++;
      target.count = 0; 
    }

    target.owner = this.currentPlayer;
    target.count++;
    
    // Zarı düş
    this.dice.splice(dieIndex, 1);
    
    return true;
  }
  
  // Sırayı diğer oyuncuya geçirir
  switchTurn() {
       this.currentPlayer = this.currentPlayer === Player.WHITE ? Player.BLACK : Player.WHITE;
       this.dice = [];
  }

  // Frontend'e gönderilecek anlık durum kopyası
  getBoardSnapshot() {
    return {
      points: JSON.parse(JSON.stringify(this.points)),
      whiteBar: this.whiteBar,
      blackBar: this.blackBar,
      whiteOff: this.whiteOff,
      blackOff: this.blackOff,
      dice: [...this.dice],
      winner: this.checkWinner()
    };
  }
  
  // Belirli bir noktadan yapılabilecek hamleleri döndürür (Highlight için)
  getLegalMoves(fromIndex) {
    const moves = [];
    const uniqueDice = [...new Set(this.dice)];
    const direction = this.currentPlayer === Player.WHITE ? -1 : 1;
    const canOff = this.canBearOff(this.currentPlayer);

    uniqueDice.forEach(die => {
      const targetIdx = fromIndex + (die * direction);
      
      if(targetIdx >= 0 && targetIdx <= 23) {
        const target = this.points[targetIdx];
        if (!target.owner || target.owner === this.currentPlayer || target.count === 1) {
          moves.push(targetIdx);
        }
      } 
      else if (canOff) {
          if ((this.currentPlayer === Player.WHITE && targetIdx === -1) ||
              (this.currentPlayer === Player.BLACK && targetIdx === 24)) {
              moves.push('off'); 
          }
      }
    });
    return moves;
  }
}