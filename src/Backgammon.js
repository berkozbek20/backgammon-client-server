// Backgammon.js
// ==========================================
// 3D TAVLA FRONTEND - REACT THREE FIBER
// ==========================================
// Bu bileşen oyunun tüm görselleştirmesini, animasyonlarını
// ve kullanıcı etkileşimlerini (drag & drop) yönetir.
// Backend-mock.js ile haberleşerek oyun durumunu günceller.

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Html, useCursor, Text } from "@react-three/drei";
import * as THREE from "three";
import { TavlaGame, Player } from "./backend-mock";

// ================= 1. GÖRSEL AYARLAR & SABİTLER =================
// Tahta boyutları ve taş oranları buradan ayarlanır
const BOARD_SPECS = {
  width: 15,
  height: 11,
  barWidth: 1.2,
  checkerRadius: 0.44,
  checkerHeight: 0.12,
};

// Renk paleti
const COLORS = {
  board: "#eaddcf",
  frameMain: "#3b2512",
  frameRim: "#7b5740",
  pointDark: "#5e4034",
  pointLight: "#c2b091",
  checkerWhite: "#f5f5f5",
  checkerBlack: "#151515",
  hover: "#ffaa00", // Mouse üzerine gelince parlayan renk
  highlight: "#2ecc71", // Gidilebilecek yerleri gösteren yeşil halka
  ghost: "rgba(255, 255, 255, 0.4)", // Sürüklerken beliren hayalet taş rengi
};

// ================= 2. YARDIMCI FONKSİYONLAR =================

// CanvasTexture kullanarak dinamik tavla tahtası deseni oluşturur (2D Çizim)
const createBoardTexture = () => {
  const width = 2048;
  const height = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Zemin
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, width, height);

  // Üçgenlerin (Points) Hesaplanması ve Çizimi
  const scaleX = width / BOARD_SPECS.width;
  const scaleY = height / BOARD_SPECS.height;
  const panelWidth = (BOARD_SPECS.width - BOARD_SPECS.barWidth - 1.0) / 2;
  const triWidth3D = panelWidth / 6;
  const triW = triWidth3D * scaleX;
  const triH = BOARD_SPECS.height * 0.45 * scaleY;
  const marginX = 0.5 * scaleX;
  const barW = BOARD_SPECS.barWidth * scaleX;

  const drawTri = (x, isTop, color) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    if (isTop) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + triW, 0);
      ctx.lineTo(x + triW / 2, triH);
    } else {
      ctx.moveTo(x, height);
      ctx.lineTo(x + triW, height);
      ctx.lineTo(x + triW / 2, height - triH);
    }
    ctx.fill();
  };

  // Sol ve Sağ panellerdeki üçgenleri döngüyle çiz
  const startXLeft = marginX;
  const startXRight = marginX + panelWidth * scaleX + barW;

  for (let i = 0; i < 6; i++) {
    let c1 = i % 2 === 0 ? COLORS.pointLight : COLORS.pointDark;
    let c2 = i % 2 === 0 ? COLORS.pointDark : COLORS.pointLight;
    drawTri(startXLeft + i * triW, false, c2);
    drawTri(startXLeft + i * triW, true, c1);
    drawTri(startXRight + i * triW, false, c1);
    drawTri(startXRight + i * triW, true, c2);
  }

  // Orta Bar ve Çerçeve
  const barCenterX = width / 2;
  ctx.fillStyle = "#6d4c41"; // <--- Daha açık, ahşap rengi
  ctx.fillRect(barCenterX - barW / 2, 0, barW, height);
  ctx.strokeStyle = "#3e2b1f";
  ctx.lineWidth = 20;
  ctx.strokeRect(0, 0, width, height);

  return canvas;
};

// Tavla tahtasındaki 0-23 arası indekslerin 3D dünyadaki (x,z) koordinatlarını hesaplar
const getPointBasePosition = (index) => {
  if (index === "off") {
    return { x: 10, zBase: 0, direction: 0, isOff: true };
  }

  const { width, height, barWidth } = BOARD_SPECS;
  const margin = 0.5;
  const panelWidth = (width - barWidth - margin * 2) / 2;
  const triWidth = panelWidth / 6;
  const halfTri = triWidth / 2;
  const zEdge = height / 2 - 0.7;

  // Sol/Sağ ve Alt/Üst panellere göre X ve Z hesaplaması
  const leftPanelStartX = -(width / 2) + margin;
  const rightPanelStartX = barWidth / 2;

  if (index >= 0 && index <= 5) {
    // Sağ Alt (Beyaz Ev)
    return {
      x: rightPanelStartX + (5 - index) * triWidth + halfTri,
      zBase: zEdge,
      direction: -1,
    };
  } else if (index >= 6 && index <= 11) {
    // Sol Alt
    return {
      x: leftPanelStartX + (11 - index) * triWidth + halfTri,
      zBase: zEdge,
      direction: -1,
    };
  } else if (index >= 12 && index <= 17) {
    // Sol Üst
    return {
      x: leftPanelStartX + (index - 12) * triWidth + halfTri,
      zBase: -zEdge,
      direction: 1,
    };
  } else {
    // Sağ Üst (Siyah Ev)
    return {
      x: rightPanelStartX + (index - 18) * triWidth + halfTri,
      zBase: -zEdge,
      direction: 1,
    };
  }
};

// Taşların üst üste dizilmesi (Stacking) için Yükseklik ve Z ofseti hesaplar
const getSlotPosition = (index, stackIndex) => {
  if (index === "off") {
    return { x: 9.5, z: 0, y: BOARD_SPECS.checkerHeight / 2 };
  }
  const baseInfo = getPointBasePosition(index);
  const diameter = BOARD_SPECS.checkerRadius * 2;
  const standardSpacing = diameter + 0.05;

  // 5 taştan sonra sıkıştırma (compression) uygular
  let zOffset = 0;
  if (stackIndex < 5) {
    zOffset = stackIndex * standardSpacing;
  } else {
    const compressedSpacing = standardSpacing / 2.5;
    zOffset = 4 * standardSpacing + (stackIndex - 4) * compressedSpacing;
  }
  if (zOffset > 5.0) zOffset = 5.0; // Taşma önlemi

  const z = baseInfo.zBase + zOffset * baseInfo.direction;
  return { x: baseInfo.x, z, y: BOARD_SPECS.checkerHeight / 2 };
};

// Kırılan taşların (Bar) konumu
const getBarPosition = (color, index) => {
  const x = 0;
  const y = 0.2 + index * BOARD_SPECS.checkerHeight * 1.05;
  const z = color === Player.WHITE ? 2.5 : -2.5;
  return [x, y, z];
};

// Toplanan taşların (Bearing Off) konumu - Sağ tarafta biriktirme
const getOffPosition = (color, index) => {
  const x = BOARD_SPECS.width / 2 + 1.5;
  const zStart = color === Player.WHITE ? 4 : -4;
  const zDir = color === Player.WHITE ? -1 : 1;
  const stackLayer = Math.floor(index / 15);
  const posInLayer = index % 15;
  const z = zStart + posInLayer * zDir * 0.35;
  const y =
    BOARD_SPECS.checkerHeight / 2 + stackLayer * BOARD_SPECS.checkerHeight;
  return [x, y, z];
};

// ================= 3. REACT THREE FIBER BİLEŞENLERİ =================

// Zar üzerindeki siyah noktalar (Pips)
const Pip = ({ pos }) => (
  <mesh position={pos}>
    <cylinderGeometry args={[0.08, 0.08, 0.01, 32]} />
    <meshStandardMaterial color="black" />
  </mesh>
);

// 3D Zar Bileşeni - Fiziksel yüzey haritalaması içerir
const Dice = ({ value, position, rolling }) => {
  const ref = useRef();
  const startTime = useRef(0);

  // Zar değerine göre hangi yüzün yukarı bakacağını hesaplayan rotasyonlar
  const targetRot = useMemo(() => {
    switch (value) {
      case 1:
        return [0, 0, 0];
      case 6:
        return [Math.PI, 0, 0];
      case 2:
        return [-Math.PI / 2, 0, 0];
      case 5:
        return [Math.PI / 2, 0, 0];
      case 3:
        return [0, 0, Math.PI / 2];
      case 4:
        return [0, 0, -Math.PI / 2];
      default:
        return [0, 0, 0];
    }
  }, [value]);

  // Animasyon Döngüsü
  useFrame((state, delta) => {
    if (!ref.current) return;
    if (rolling && startTime.current === 0)
      startTime.current = state.clock.elapsedTime;
    else if (!rolling) startTime.current = 0;

    if (rolling) {
      // Yuvarlanma efekti: Rastgele dönüş ve zıplama (Sinus dalgası)
      ref.current.rotation.x += delta * 15;
      ref.current.rotation.y += delta * 12;
      ref.current.rotation.z += delta * 8;
      const rollTime = state.clock.elapsedTime - startTime.current;
      ref.current.position.y =
        1.0 + Math.abs(Math.sin(rollTime * 10 + position[0] * 3)) * 0.5;
    } else {
      // Durma efekti: Hedef rotasyona yumuşak geçiş (Lerp)
      ref.current.position.y = THREE.MathUtils.lerp(
        ref.current.position.y,
        0.3,
        delta * 10
      );
      ref.current.rotation.x = THREE.MathUtils.lerp(
        ref.current.rotation.x,
        targetRot[0],
        delta * 10
      );
      ref.current.rotation.y = THREE.MathUtils.lerp(
        ref.current.rotation.y,
        targetRot[1],
        delta * 10
      );
      ref.current.rotation.z = THREE.MathUtils.lerp(
        ref.current.rotation.z,
        targetRot[2],
        delta * 10
      );
    }
  });

  return (
    <group position={position}>
      <group ref={ref}>
        <RoundedBox args={[0.6, 0.6, 0.6]} radius={0.1} castShadow>
          <meshStandardMaterial color="white" />
          {/* Zar Yüzleri: 1, 6, 2, 5, 3, 4 */}
          <Pip pos={[0, 0.31, 0]} />
          <group rotation={[Math.PI, 0, 0]}>
            <Pip pos={[-0.18, 0.31, -0.18]} />
            <Pip pos={[-0.18, 0.31, 0]} />
            <Pip pos={[-0.18, 0.31, 0.18]} />
            <Pip pos={[0.18, 0.31, -0.18]} />
            <Pip pos={[0.18, 0.31, 0]} />
            <Pip pos={[0.18, 0.31, 0.18]} />
          </group>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <Pip pos={[0, 0.31, -0.15]} />
            <Pip pos={[0, 0.31, 0.15]} />
          </group>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Pip pos={[-0.15, 0.31, -0.15]} />
            <Pip pos={[0.15, 0.31, 0.15]} />
            <Pip pos={[0, 0.31, 0]} />
            <Pip pos={[-0.15, 0.31, 0.15]} />
            <Pip pos={[0.15, 0.31, -0.15]} />
          </group>
          <group rotation={[0, 0, -Math.PI / 2]}>
            <Pip pos={[-0.15, 0.31, -0.15]} />
            <Pip pos={[0, 0.31, 0]} />
            <Pip pos={[0.15, 0.31, 0.15]} />
          </group>
          <group rotation={[0, 0, Math.PI / 2]}>
            <Pip pos={[-0.15, 0.31, -0.15]} />
            <Pip pos={[0.15, 0.31, -0.15]} />
            <Pip pos={[-0.15, 0.31, 0.15]} />
            <Pip pos={[0.15, 0.31, 0.15]} />
          </group>
        </RoundedBox>
      </group>
    </group>
  );
};

// Taş (Checker) Bileşeni
const Checker = ({ color, position, isTopStack, onDragStart, opacity = 1 }) => {
  const isWhite = color === Player.WHITE;
  const [hover, setHover] = useState(false);
  // Sadece en üstteki taşlar etkileşime girebilir
  useCursor(hover && isTopStack);

  const mainColor = isWhite ? COLORS.checkerWhite : COLORS.checkerBlack;
  const hoverColor = hover && isTopStack ? COLORS.hover : mainColor;

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (isTopStack) setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => {
        if (isTopStack && onDragStart) {
          e.stopPropagation();
          onDragStart();
        }
      }}
    >
      <mesh>
        <cylinderGeometry
          args={[
            BOARD_SPECS.checkerRadius,
            BOARD_SPECS.checkerRadius,
            BOARD_SPECS.checkerHeight,
            48,
          ]}
        />
        <meshStandardMaterial
          color={hoverColor}
          roughness={0.4}
          metalness={0.3}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Siyah Taşlar için metalik çerçeve (Rim) */}
      {!isWhite && opacity === 1 && (
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BOARD_SPECS.checkerRadius, 0.05, 16, 48]} />
          <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
        </mesh>
      )}

      {/* İç Desen */}
      {opacity === 1 && (
        <mesh
          position={[0, BOARD_SPECS.checkerHeight / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry
            args={[
              BOARD_SPECS.checkerRadius * 0.4,
              BOARD_SPECS.checkerRadius * 0.7,
              32,
            ]}
          />
          <meshStandardMaterial
            color={isWhite ? "#ddd" : "#333"}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
};

// Gidilebilir yerleri gösteren yeşil halka
const MoveHighlight = ({ index, boardState }) => {
  let pos;
  if (index === "off") {
    pos = { x: 9.5, z: 0 };
  } else {
    const count = boardState.points[index].count;
    pos = getSlotPosition(index, count);
  }

  return (
    <group position={[pos.x, 0.03, pos.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, BOARD_SPECS.checkerRadius, 32]} />
        <meshBasicMaterial color={COLORS.highlight} opacity={0.4} transparent />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            BOARD_SPECS.checkerRadius,
            BOARD_SPECS.checkerRadius + 0.1,
            32,
          ]}
        />
        <meshBasicMaterial color={COLORS.highlight} />
      </mesh>
      {index === "off" && (
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          TOPLA
        </Text>
      )}
    </group>
  );
};

// ================= 4. OYUN SAHNESİ VE MANTIK ENTEGRASYONU =================
const GameScene = ({ isInteractive }) => {
  // Backend sınıfını başlat
  const gameRef = useRef(new TavlaGame());
  const [boardState, setBoardState] = useState(
    gameRef.current.getBoardSnapshot()
  );
  const [rolling, setRolling] = useState(false);
  const [visualDice, setVisualDice] = useState([]);
  const [remainingMoves, setRemainingMoves] = useState([]);
  const [msg, setMsg] = useState("Oyun Başlıyor...");
  const [winner, setWinner] = useState(null);

  // Drag & Drop State'leri
  const [dragging, setDragging] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragPos, setDragPos] = useState([0, 0, 0]);
  const [validMoves, setValidMoves] = useState([]);
  const [dropTarget, setDropTarget] = useState(null); // Hayalet taş hedefi

  // Tahta dokusunu bir kez oluştur (Memoize)
  const boardTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(createBoardTexture());
    texture.anisotropy = 16;
    return texture;
  }, []);

  const refresh = () => {
    const snap = gameRef.current.getBoardSnapshot();
    setBoardState(snap);
    if (snap.winner) setWinner(snap.winner);
  };

  const handleRestart = () => {
    gameRef.current = new TavlaGame();
    refresh();
    setVisualDice([]);
    setRemainingMoves([]);
    setValidMoves([]);
    setWinner(null);
    setMsg("Yeni Oyun");
  };

  // Zar Atma Fonksiyonu
  const handleRoll = () => {
    if (rolling || !isInteractive || winner) return;
    setRolling(true);
    setMsg("");
    setValidMoves([]);
    setDropTarget(null);

    setTimeout(() => {
      gameRef.current.rollDice();
      const steps = gameRef.current.getRemainingSteps();

      setVisualDice([...steps]);
      setRemainingMoves([...steps]);
      setRolling(false);
      refresh();

      // Legal hamle kontrolü
      const allLegalMoves = gameRef.current.getAllLegalMoves();

      if (allLegalMoves.length === 0) {
        const pl =
          gameRef.current.getCurrentPlayer() === Player.WHITE
            ? "BEYAZ"
            : "SİYAH";
        setMsg(`🚫 HAMLE YOK! ${pl} PAS GEÇİYOR...`);
        // Otomatik Pas
        gameRef.current.switchTurn();
        setTimeout(() => {
          setVisualDice([]);
          setRemainingMoves([]);
          const nextPl =
            gameRef.current.getCurrentPlayer() === Player.WHITE
              ? "BEYAZ"
              : "SİYAH";
          setMsg(`Sıra: ${nextPl}`);
        }, 2500);
      } else {
        const pl =
          gameRef.current.getCurrentPlayer() === Player.WHITE
            ? "BEYAZ"
            : "SİYAH";
        setMsg(`${pl} Hamlesi`);
      }
    }, 800);
  };

  // Sürükleme Başlangıcı
  const onDragStart = (index, owner) => {
    if (!isInteractive || rolling || winner) return;
    if (gameRef.current.dice.length === 0) return;
    if (owner !== gameRef.current.getCurrentPlayer()) return;

    const moves = gameRef.current.getLegalMoves(index);
    if (!moves || moves.length === 0) return;

    setValidMoves(moves);
    setDragging(true);
    setDragItem({ index, owner });

    const info = getPointBasePosition(index);
    setDragPos([info.x, 2, info.zBase]);
  };

  // Sürükleme Sırasında (Görünmez Zemin Üzerinde)
  const onPlanePointerMove = (e) => {
    if (dragging) {
      setDragPos([e.point.x, 2.5, e.point.z]);

      // En yakın geçerli hedefi bul (Hayalet taş için)
      let bestIdx = null;
      let minDist = 3.0;
      const targets = [...Array(24).keys(), "off"];

      for (let t of targets) {
        let info;
        if (t === "off") {
          info = { x: 9.5, zBase: 0 };
        } else {
          info = getPointBasePosition(t);
        }
        const dist = Math.sqrt(
          Math.pow(e.point.x - info.x, 2) + Math.pow(e.point.z - info.zBase, 2)
        );

        if (dist < 2.5 && validMoves.includes(t)) {
          if (dist < minDist) {
            minDist = dist;
            bestIdx = t;
          }
        }
      }
      setDropTarget(bestIdx);
    }
  };

  // Sürükleme Bitişi (Bırakma)
  const onPointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);

    if (dropTarget !== null && dragItem) {
      let step = 0;
      const bestIdx = dropTarget;

      // Hamle mesafesini (zar değerini) hesapla
      if (bestIdx === "off") {
        const distanceNeeded =
          gameRef.current.getCurrentPlayer() === Player.WHITE
            ? 24 - dragItem.index
            : dragItem.index - -1;
        const dice = gameRef.current.getRemainingSteps();
        if (dice.includes(distanceNeeded)) step = distanceNeeded;
        else step = dice.find((d) => d >= distanceNeeded) || dice[0];
      } else {
        if (gameRef.current.getCurrentPlayer() === Player.WHITE) {
          step = dragItem.index - bestIdx;
        } else {
          step = bestIdx - dragItem.index;
        }
      }

      // Backend'e hamleyi işlet
      const success = gameRef.current.applyMove(dragItem.index, bestIdx, step);
      if (success) {
        refresh();
        const newRemaining = [...gameRef.current.getRemainingSteps()];
        setRemainingMoves(newRemaining);
        setVisualDice(newRemaining);

        // Zarlar bittiyse sıra değiştir
        if (gameRef.current.dice.length === 0) {
          gameRef.current.switchTurn();
          setTimeout(() => {
            setVisualDice([]);
            setRemainingMoves([]);
            const nextPl =
              gameRef.current.getCurrentPlayer() === Player.WHITE
                ? "BEYAZ"
                : "SİYAH";
            setMsg(`Sıra: ${nextPl}`);
          }, 1000);
        }
      }
    }
    setDragItem(null);
    setValidMoves([]);
    setDropTarget(null);
  };

  const isDiceDisabled = rolling || remainingMoves.length > 0 || winner;
  const curPlayerName =
    gameRef.current.getCurrentPlayer() === Player.WHITE ? "BEYAZ" : "SİYAH";

  // Hayalet taşın nerede duracağını hesapla
  const getGhostPosition = () => {
    if (dropTarget === null) return [0, -10, 0];
    if (dropTarget === "off") return [9.5, 0.5, 0];

    const count = boardState.points[dropTarget].count;
    const pos = getSlotPosition(dropTarget, count);
    return [pos.x, pos.y, pos.z];
  };

  return (
    <>
      {/* --- ARKA PLAN RENGİNİ BURADAN DEĞİŞTİRDİM --- */}
      <color attach="background" args={["#e0d6c8"]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow />
      <spotLight position={[-10, 20, 0]} intensity={0.5} />

      {/* Sürükleme Zemini (Görünmez) */}
      {dragging && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          visible={false}
          onPointerMove={onPlanePointerMove}
          onPointerUp={onPointerUp}
        >
          <planeGeometry args={[50, 50]} />
          <meshBasicMaterial />
        </mesh>
      )}

      {/* Oyun Alanı Objeleri */}
      <group onPointerUp={dragging ? null : onPointerUp}>
        {/* Tahta Gövdesi */}
        <RoundedBox
          args={[BOARD_SPECS.width + 1.2, 1.2, BOARD_SPECS.height + 1.2]}
          position={[0, -0.62, 0]}
          radius={0.2}
          receiveShadow
        >
          <meshStandardMaterial color={COLORS.frameMain} />
        </RoundedBox>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[BOARD_SPECS.width, BOARD_SPECS.height]} />
          <meshStandardMaterial
            map={boardTexture}
            roughness={0.6}
            metalness={0.0}
          />
        </mesh>

        {/* Çerçeve Kenarları */}
        <RoundedBox
          args={[BOARD_SPECS.width + 1.2, 0.4, 0.6]}
          position={[0, 0.2, -BOARD_SPECS.height / 2 - 0.3]}
          radius={0.1}
        >
          <meshStandardMaterial color={COLORS.frameRim} />
        </RoundedBox>
        <RoundedBox
          args={[BOARD_SPECS.width + 1.2, 0.4, 0.6]}
          position={[0, 0.2, BOARD_SPECS.height / 2 + 0.3]}
          radius={0.1}
        >
          <meshStandardMaterial color={COLORS.frameRim} />
        </RoundedBox>
        <RoundedBox
          args={[0.6, 0.4, BOARD_SPECS.height]}
          position={[-BOARD_SPECS.width / 2 - 0.3, 0.2, 0]}
          radius={0.1}
        >
          <meshStandardMaterial color={COLORS.frameRim} />
        </RoundedBox>
        <RoundedBox
          args={[0.6, 0.4, BOARD_SPECS.height]}
          position={[BOARD_SPECS.width / 2 + 0.3, 0.2, 0]}
          radius={0.1}
        >
          <meshStandardMaterial color={COLORS.frameRim} />
        </RoundedBox>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry
            args={[BOARD_SPECS.barWidth, 0.15, BOARD_SPECS.height]}
          />
          <meshStandardMaterial color="#704f3a" />
        </mesh>
        {/* Zarların Render Edilmesi */}
        {visualDice.map((dVal, i) => (
          <Dice
            key={`dice-${i}`}
            value={dVal}
            position={[-1.5 + i * 1.0, 0.6, 0]}
            rolling={rolling}
          />
        ))}

        {/* Kırık Taşların Render Edilmesi */}
        {Array.from({ length: boardState.whiteBar }).map((_, i) => (
          <Checker
            key={`wb-${i}`}
            color={Player.WHITE}
            position={getBarPosition(Player.WHITE, i)}
            isTopStack={false}
          />
        ))}
        {Array.from({ length: boardState.blackBar }).map((_, i) => (
          <Checker
            key={`bb-${i}`}
            color={Player.BLACK}
            position={getBarPosition(Player.BLACK, i)}
            isTopStack={false}
          />
        ))}

        {/* Toplanan Taşların Render Edilmesi */}
        {Array.from({ length: boardState.whiteOff }).map((_, i) => (
          <Checker
            key={`wo-${i}`}
            color={Player.WHITE}
            position={getOffPosition(Player.WHITE, i)}
            isTopStack={false}
          />
        ))}
        {Array.from({ length: boardState.blackOff }).map((_, i) => (
          <Checker
            key={`bo-${i}`}
            color={Player.BLACK}
            position={getOffPosition(Player.BLACK, i)}
            isTopStack={false}
          />
        ))}

        {/* Hamle Hedeflerinin Gösterilmesi */}
        {validMoves.map((idx) => (
          <MoveHighlight
            key={`hl-${idx}`}
            index={idx}
            boardState={boardState}
          />
        ))}

        {/* Hayalet Taş (Drop Preview) */}
        {dragging && dropTarget !== null && dragItem && (
          <Checker
            color={dragItem.owner}
            position={getGhostPosition()}
            isTopStack={false}
            opacity={0.5}
          />
        )}

        {/* Tahta Üzerindeki Tüm Taşlar */}
        {boardState.points.map((p) => {
          const items = [];
          for (let i = 0; i < p.count; i++) {
            const isTop = i === p.count - 1;
            // Sürüklenen taşı yerde gösterme
            if (dragging && dragItem?.index === p.index && isTop) continue;

            const pos = getSlotPosition(p.index, i);
            const yPos = BOARD_SPECS.checkerHeight / 2 + i * 0.005;

            items.push(
              <Checker
                key={`pt-${p.index}-${i}-${p.owner}`}
                color={p.owner}
                position={[pos.x, yPos, pos.z]}
                isTopStack={isTop}
                onDragStart={() => onDragStart(p.index, p.owner)}
              />
            );
          }
          return <group key={p.index}>{items}</group>;
        })}

        {/* Aktif Sürüklenen Taş */}
        {dragging && dragItem && (
          <Checker
            color={dragItem.owner}
            position={dragPos}
            isTopStack={false}
          />
        )}
      </group>

      {/* 2D UI Katmanı (HTML Overlay) */}
      <Html fullscreen style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "25px",
            left: "30px",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(0,0,0,0.6)",
              padding: "8px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ fontSize: "32px" }}>🎲</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "24px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                TAVLA OYUNU
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
            <button
              onClick={handleRestart}
              style={{
                background: "#e74c3c",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
              }}
            >
              YENİ OYUN
            </button>
          </div>
        </div>

        {/* Kalan Zarlar Göstergesi */}
        {remainingMoves.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: "60px",
              transform: "translate(0, -50%)",
              background: "rgba(0,0,0,0.7)",
              padding: "20px",
              borderRadius: "16px",
              color: "white",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                marginBottom: "8px",
                color: "#ddd",
                textTransform: "uppercase",
              }}
            >
              Kalan Zarlar
            </div>
            {remainingMoves.map((m, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  width: "36px",
                  height: "36px",
                  lineHeight: "36px",
                  background: "#f1c40f",
                  color: "#111",
                  margin: "4px",
                  borderRadius: "6px",
                  fontWeight: "800",
                  fontSize: "20px",
                  boxShadow: "0 3px 6px rgba(0,0,0,0.4)",
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Chat Alanı */}
        <div
          style={{
            position: "absolute",
            bottom: "100px",
            left: "20px",
            background: "rgba(30, 20, 10, 0.85)",
            backdropFilter: "blur(10px)",
            padding: "0",
            borderRadius: "12px",
            border: "1px solid rgba(243, 156, 18, 0.3)",
            color: "#eee",
            width: "280px",
            height: "350px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
            overflow: "hidden",
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }}
        >
          <div
            style={{
              padding: "12px 15px",
              background: "rgba(243, 156, 18, 0.15)",
              borderBottom: "1px solid rgba(243, 156, 18, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "18px" }}>💬</span>
            <span
              style={{
                fontWeight: "600",
                color: "#f39c12",
                letterSpacing: "0.5px",
              }}
            >
              Oyun Sohbeti
            </span>
          </div>
          <div
            style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: "15px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#aaa",
                  marginBottom: "2px",
                  marginLeft: "4px",
                }}
              >
                Rakip
              </div>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  padding: "8px 12px",
                  borderRadius: "12px 12px 12px 2px",
                  fontSize: "13px",
                  lineHeight: "1.4",
                }}
              >
                Selam! Hazır mısın?
              </div>
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #d35400, #e67e22)",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: "12px 12px 2px 12px",
                  fontSize: "13px",
                  lineHeight: "1.4",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                Her zaman! Bol şans.
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "10px",
              background: "rgba(0,0,0,0.2)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              placeholder="Mesaj yazın..."
              style={{
                flexGrow: 1,
                padding: "10px 12px",
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.3)",
                color: "white",
                outline: "none",
                fontSize: "13px",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#f39c12")}
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
            <button
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "none",
                background: "linear-gradient(135deg, #f39c12, #d35400)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                fontSize: "14px",
              }}
            >
              ➤
            </button>
          </div>
        </div>

        {/* Bitiş Ekranı */}
        {winner && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
              zIndex: 999,
            }}
          >
            <div style={{ textAlign: "center", animation: "fadeIn 0.5s" }}>
              <h1
                style={{
                  color: winner === Player.WHITE ? "#fff" : "#aaa",
                  fontSize: "60px",
                  marginBottom: "10px",
                  textShadow: "0 0 20px rgba(255,255,255,0.5)",
                }}
              >
                {winner === Player.WHITE
                  ? "BEYAZ KAZANDI! 🎉"
                  : "SİYAH KAZANDI! 🎉"}
              </h1>
              <p
                style={{
                  color: "#ddd",
                  fontSize: "20px",
                  marginBottom: "30px",
                }}
              >
                Harika bir oyundu!
              </p>
              <button
                onClick={handleRestart}
                style={{
                  padding: "15px 40px",
                  fontSize: "20px",
                  background: "linear-gradient(to right, #e74c3c, #c0392b)",
                  color: "white",
                  border: "none",
                  borderRadius: "50px",
                  cursor: "pointer",
                  boxShadow: "0 5px 15px rgba(231, 76, 60, 0.4)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
                onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
              >
                TEKRAR OYNA
              </button>
            </div>
          </div>
        )}

        {/* Alt Bilgi Barı */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(20, 20, 20, 0.9)",
              color: "#fff",
              padding: "12px 30px",
              borderRadius: "50px",
              pointerEvents: "auto",
              textAlign: "center",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              style={{
                fontSize: "1.2em",
                fontWeight: "bold",
                color: "#f39c12",
                minWidth: "140px",
              }}
            >
              {msg || `Sıra: ${curPlayerName}`}
            </span>
            <div
              style={{
                width: "1px",
                height: "25px",
                background: "rgba(255,255,255,0.2)",
              }}
            ></div>
            <button
              onClick={handleRoll}
              disabled={isDiceDisabled}
              style={{
                padding: "10px 30px",
                background: isDiceDisabled
                  ? "#555"
                  : "linear-gradient(135deg, #f39c12, #d35400)",
                color: isDiceDisabled ? "#aaa" : "#fff",
                border: "none",
                borderRadius: "25px",
                cursor: isDiceDisabled ? "default" : "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                letterSpacing: "1px",
                boxShadow: isDiceDisabled
                  ? "none"
                  : "0 4px 10px rgba(243, 156, 18, 0.4)",
                transition: "all 0.2s ease",
                opacity: isDiceDisabled ? 0.7 : 1,
              }}
            >
              ZAR AT
            </button>
          </div>
        </div>
      </Html>
    </>
  );
};

// Açılış Animasyonu (Sinematik Kamera)
const OpeningCinematic = ({ onComplete }) => {
  const progress = useRef(0);
  useFrame((state, delta) => {
    if (progress.current < 1) {
      progress.current += delta / 2.0;
      if (progress.current >= 1) {
        progress.current = 1;
        onComplete?.();
      }
      const p = progress.current;
      const ease = 1 - Math.pow(1 - p, 4);
      state.camera.position.set(
        0,
        THREE.MathUtils.lerp(8, 20, ease),
        THREE.MathUtils.lerp(24, 0.1, ease)
      );
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
};

// Ana Bileşen Export
const Backgammon = () => {
  const [canPlay, setCanPlay] = useState(false);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#181818" }}>
      <Canvas shadows camera={{ position: [0, 8, 24], fov: 45 }}>
        {!canPlay && <OpeningCinematic onComplete={() => setCanPlay(true)} />}
        <GameScene isInteractive={canPlay} />
      </Canvas>
    </div>
  );
};

export default Backgammon;
