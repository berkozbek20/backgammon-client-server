// Backgammon.js
// ==========================================
// WEBSOCKET BACKEND İLE ÇALIŞAN 3D TAVLA (React Three Fiber)
// ==========================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Html, useCursor, Text } from "@react-three/drei";
import * as THREE from "three";

import { TavlaGame, Player } from "./backend-ws";

// ================= 1) SABİTLER =================
const BOARD_SPECS = {
  width: 15,
  height: 11,
  barWidth: 1.2,
  checkerRadius: 0.44,
  checkerHeight: 0.12,
};

const COLORS = {
  board: "#eaddcf",
  frameMain: "#3b2512",
  frameRim: "#7b5740",
  pointDark: "#5e4034",
  pointLight: "#c2b091",
  checkerWhite: "#f5f5f5",
  checkerBlack: "#151515",
  hover: "#ffaa00",
  highlight: "#2ecc71",
};

// WS gelmeden önce güvenli başlangıç state’i
const EMPTY_STATE = {
  points: Array(24)
      .fill(0)
      .map((_, i) => ({ index: i, owner: null, count: 0 })),
  whiteBar: 0,
  blackBar: 0,
  whiteOff: 0,
  blackOff: 0,
  dice: [],
  winner: null,
  currentPlayer: Player.WHITE,
};

// ================= 2) YARDIMCILAR =================
const createBoardTexture = () => {
  const width = 2048;
  const height = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, width, height);

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

  const barCenterX = width / 2;
  ctx.fillStyle = "#6d4c41";
  ctx.fillRect(barCenterX - barW / 2, 0, barW, height);

  ctx.strokeStyle = "#3e2b1f";
  ctx.lineWidth = 20;
  ctx.strokeRect(0, 0, width, height);

  return canvas;
};

// Backend index -> 3D pozisyon (senin mevcut mapping’inle uyumlu)
const getPointBasePosition = (index) => {
  const { width, height, barWidth } = BOARD_SPECS;
  const margin = 0.5;
  const panelWidth = (width - barWidth - margin * 2) / 2;
  const triWidth = panelWidth / 6;
  const halfTri = triWidth / 2;
  const zEdge = height / 2 - 0.7;

  const leftPanelStartX = -(width / 2) + margin;
  const rightPanelStartX = barWidth / 2;

  if (index >= 0 && index <= 5) {
    // Sağ Alt (WHITE home)
    return { x: rightPanelStartX + (5 - index) * triWidth + halfTri, zBase: zEdge, direction: -1 };
  } else if (index >= 6 && index <= 11) {
    // Sol Alt
    return { x: leftPanelStartX + (11 - index) * triWidth + halfTri, zBase: zEdge, direction: -1 };
  } else if (index >= 12 && index <= 17) {
    // Sol Üst
    return { x: leftPanelStartX + (index - 12) * triWidth + halfTri, zBase: -zEdge, direction: 1 };
  } else {
    // Sağ Üst (BLACK home)
    return { x: rightPanelStartX + (index - 18) * triWidth + halfTri, zBase: -zEdge, direction: 1 };
  }
};

const getSlotPosition = (index, stackIndex) => {
  const baseInfo = getPointBasePosition(index);
  const diameter = BOARD_SPECS.checkerRadius * 2;
  const standardSpacing = diameter + 0.05;

  let zOffset = 0;
  if (stackIndex < 5) zOffset = stackIndex * standardSpacing;
  else {
    const compressedSpacing = standardSpacing / 2.5;
    zOffset = 4 * standardSpacing + (stackIndex - 4) * compressedSpacing;
  }
  if (zOffset > 5.0) zOffset = 5.0;

  const z = baseInfo.zBase + zOffset * baseInfo.direction;
  return { x: baseInfo.x, z, y: BOARD_SPECS.checkerHeight / 2 };
};

const getBarPosition = (color, index) => {
  const x = 0;
  const y = 0.2 + index * BOARD_SPECS.checkerHeight * 1.05;
  const z = color === Player.WHITE ? 2.5 : -2.5;
  return [x, y, z];
};

const getOffPosition = (color, index) => {
  const x = BOARD_SPECS.width / 2 + 1.5;
  const zStart = color === Player.WHITE ? 4 : -4;
  const zDir = color === Player.WHITE ? -1 : 1;
  const stackLayer = Math.floor(index / 15);
  const posInLayer = index % 15;
  const z = zStart + posInLayer * zDir * 0.35;
  const y = BOARD_SPECS.checkerHeight / 2 + stackLayer * BOARD_SPECS.checkerHeight;
  return [x, y, z];
};

// ================= 3) 3D COMPONENTS =================
const Pip = ({ pos }) => (
    <mesh position={pos}>
      <cylinderGeometry args={[0.08, 0.08, 0.01, 32]} />
      <meshStandardMaterial color="black" />
    </mesh>
);

const Dice3D = ({ value, position, rolling }) => {
  const ref = useRef();
  const startTime = useRef(0);

  const targetRot = useMemo(() => {
    switch (value) {
      case 1: return [0, 0, 0];
      case 6: return [Math.PI, 0, 0];
      case 2: return [-Math.PI / 2, 0, 0];
      case 5: return [Math.PI / 2, 0, 0];
      case 3: return [0, 0, Math.PI / 2];
      case 4: return [0, 0, -Math.PI / 2];
      default: return [0, 0, 0];
    }
  }, [value]);

  useFrame((state, delta) => {
    if (!ref.current) return;

    if (rolling && startTime.current === 0) startTime.current = state.clock.elapsedTime;
    if (!rolling) startTime.current = 0;

    if (rolling) {
      ref.current.rotation.x += delta * 15;
      ref.current.rotation.y += delta * 12;
      ref.current.rotation.z += delta * 8;
      const rollTime = state.clock.elapsedTime - startTime.current;
      ref.current.position.y = 1.0 + Math.abs(Math.sin(rollTime * 10 + position[0] * 3)) * 0.5;
    } else {
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, 0.3, delta * 10);
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, targetRot[0], delta * 10);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, targetRot[1], delta * 10);
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, targetRot[2], delta * 10);
    }
  });

  return (
      <group position={position}>
        <group ref={ref}>
          <RoundedBox args={[0.6, 0.6, 0.6]} radius={0.1} castShadow>
            <meshStandardMaterial color="white" />
            <Pip pos={[0, 0.31, 0]} />
            <group rotation={[Math.PI, 0, 0]}>
              <Pip pos={[-0.18, 0.31, -0.18]} /><Pip pos={[-0.18, 0.31, 0]} /><Pip pos={[-0.18, 0.31, 0.18]} />
              <Pip pos={[0.18, 0.31, -0.18]} /><Pip pos={[0.18, 0.31, 0]} /><Pip pos={[0.18, 0.31, 0.18]} />
            </group>
            <group rotation={[Math.PI / 2, 0, 0]}>
              <Pip pos={[0, 0.31, -0.15]} /><Pip pos={[0, 0.31, 0.15]} />
            </group>
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Pip pos={[-0.15, 0.31, -0.15]} /><Pip pos={[0.15, 0.31, 0.15]} /><Pip pos={[0, 0.31, 0]} />
              <Pip pos={[-0.15, 0.31, 0.15]} /><Pip pos={[0.15, 0.31, -0.15]} />
            </group>
            <group rotation={[0, 0, -Math.PI / 2]}>
              <Pip pos={[-0.15, 0.31, -0.15]} /><Pip pos={[0, 0.31, 0]} /><Pip pos={[0.15, 0.31, 0.15]} />
            </group>
            <group rotation={[0, 0, Math.PI / 2]}>
              <Pip pos={[-0.15, 0.31, -0.15]} /><Pip pos={[0.15, 0.31, -0.15]} />
              <Pip pos={[-0.15, 0.31, 0.15]} /><Pip pos={[0.15, 0.31, 0.15]} />
            </group>
          </RoundedBox>
        </group>
      </group>
  );
};

const Checker = ({ color, position, isTopStack, onDragStart, opacity = 1 }) => {
  const isWhite = color === Player.WHITE;
  const [hover, setHover] = useState(false);
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
            if (!isTopStack) return;
            e.stopPropagation();
            onDragStart?.();
          }}
      >
        <mesh>
          <cylinderGeometry args={[BOARD_SPECS.checkerRadius, BOARD_SPECS.checkerRadius, BOARD_SPECS.checkerHeight, 48]} />
          <meshStandardMaterial color={hoverColor} roughness={0.4} metalness={0.3} transparent opacity={opacity} />
        </mesh>

        {!isWhite && opacity === 1 && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[BOARD_SPECS.checkerRadius, 0.05, 16, 48]} />
              <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
            </mesh>
        )}
      </group>
  );
};

const MoveHighlight = ({ index, boardState }) => {
  let pos;
  if (index === "off") pos = { x: 9.5, z: 0 };
  else {
    const count = boardState.points[index]?.count ?? 0;
    const slot = getSlotPosition(index, count);
    pos = { x: slot.x, z: slot.z };
  }

  return (
      <group position={[pos.x, 0.03, pos.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, BOARD_SPECS.checkerRadius, 32]} />
          <meshBasicMaterial color={COLORS.highlight} opacity={0.35} transparent />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[BOARD_SPECS.checkerRadius, BOARD_SPECS.checkerRadius + 0.1, 32]} />
          <meshBasicMaterial color={COLORS.highlight} />
        </mesh>

        {index === "off" && (
            <Text position={[0, 0.5, 0]} fontSize={0.35} color="white" anchorX="center" anchorY="middle">
              TOPLA
            </Text>
        )}
      </group>
  );
};

// ================= 4) OYUN SAHNESİ =================
const GameScene = ({ isInteractive }) => {
  const gameRef = useRef(null);

  const [boardState, setBoardState] = useState(EMPTY_STATE);
  const [rolling, setRolling] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [assignedPlayer, setAssignedPlayer] = useState(null); // WHITE/BLACK
  const [joinInput, setJoinInput] = useState("");

  const [msg, setMsg] = useState("Bağlanılıyor...");
  const [winner, setWinner] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [dragItem, setDragItem] = useState(null); // { index, owner }
  const [dragPos, setDragPos] = useState([0, 0, 0]);
  const [validMoves, setValidMoves] = useState([]);
  const [dropTarget, setDropTarget] = useState(null);

  const boardTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(createBoardTexture());
    texture.anisotropy = 16;
    return texture;
  }, []);

  // 1) WS connect + event bağlama
  useEffect(() => {
    const game = new TavlaGame({ url: "ws://localhost:8080" });
    gameRef.current = game;

    game.onState = (snap) => {
      setBoardState(snap || EMPTY_STATE);
      setWinner(snap?.winner ?? null);

      const pl = snap?.currentPlayer === Player.WHITE ? "BEYAZ" : "SİYAH";
      setMsg(`Sıra: ${pl}`);
      setRolling(false);
    };

    game.onError = (err) => {
      setMsg("❌ " + err);
      setRolling(false);
    };

    // room_created / room_joined mesajlarını adapter içinde set ediyoruz
    // ama burada UI’ya yansıtmak için küçük polling yapalım (basit yol):
    const t = setInterval(() => {
      if (!gameRef.current) return;
      if (gameRef.current.roomId && gameRef.current.roomId !== roomId) {
        setRoomId(gameRef.current.roomId);
      }
      if (gameRef.current.player && gameRef.current.player !== assignedPlayer) {
        setAssignedPlayer(gameRef.current.player);
      }
    }, 200);

    game.connect();
    setMsg("Bağlandı. Oda oluştur veya odaya katıl.");

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Room actions
  const handleCreateRoom = () => {
    if (!gameRef.current) return;
    gameRef.current.createRoom();
    setMsg("Oda oluşturuluyor...");
  };

  const handleJoinRoom = () => {
    if (!gameRef.current) return;
    if (!joinInput.trim()) return setMsg("RoomId boş olamaz.");
    gameRef.current.joinRoom(joinInput.trim());
    setMsg("Odaya katılınıyor...");
  };

  // 3) Roll
  const handleRoll = () => {
    if (!isInteractive || rolling || winner) return;
    if (!gameRef.current) return;

    // Sadece kendi sırandaysa zar at
    if (assignedPlayer && boardState.currentPlayer !== assignedPlayer) {
      setMsg("Sıra sende değil.");
      return;
    }

    // Zar zaten varsa tekrar atma
    if ((boardState.dice?.length ?? 0) > 0) {
      setMsg("Zarlar zaten atıldı.");
      return;
    }

    setRolling(true);
    gameRef.current.rollDice();
  };

  // 4) Drag start
  const onDragStart = (index, owner) => {
    if (!isInteractive || rolling || winner) return;
    if (!gameRef.current) return;

    // Zar yoksa sürükleme yok
    if ((boardState.dice?.length ?? 0) === 0) return;

    // Sadece kendi assigned player'ı oynayabilir
    if (assignedPlayer && boardState.currentPlayer !== assignedPlayer) return;

    // Taş currentPlayer'a ait olmalı
    if (owner !== boardState.currentPlayer) return;

    const moves = gameRef.current.getLegalMoves(index);
    if (!moves || moves.length === 0) return;

    setValidMoves(moves);
    setDragging(true);
    setDragItem({ index, owner });

    const info = getPointBasePosition(index);
    setDragPos([info.x, 2, info.zBase]);
  };

  // 5) Drag move
  const onPlanePointerMove = (e) => {
    if (!dragging) return;
    setDragPos([e.point.x, 2.5, e.point.z]);

    let bestIdx = null;
    let minDist = 3.0;
    const targets = [...Array(24).keys(), "off"];

    for (let t of targets) {
      let info;
      if (t === "off") info = { x: 9.5, zBase: 0 };
      else info = getPointBasePosition(t);

      const dist = Math.sqrt((e.point.x - info.x) ** 2 + (e.point.z - info.zBase) ** 2);

      if (dist < 2.5 && validMoves.includes(t)) {
        if (dist < minDist) {
          minDist = dist;
          bestIdx = t;
        }
      }
    }
    setDropTarget(bestIdx);
  };

  // 6) Drop
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);

    if (dropTarget !== null && dragItem && gameRef.current) {
      const bestIdx = dropTarget;

      // step hesapla (mock'taki gibi)
      let step = 0;
      if (bestIdx === "off") {
        // Şimdilik adapter highlight "off" gösterebilir ama backend MovePayload int bekliyorsa
        // off hamlesini göndermiyoruz. (Bearing off WS DTO’su sonra genişletilecek)
        setMsg("Bearing off henüz WS tarafında tamamlanmadı.");
      } else {
        if (boardState.currentPlayer === Player.WHITE) step = dragItem.index - bestIdx;
        else step = bestIdx - dragItem.index;

        // Server'a gönder (state server'dan gelecek)
        gameRef.current.applyMove(dragItem.index, bestIdx, step);
      }
    }

    setDragItem(null);
    setValidMoves([]);
    setDropTarget(null);
  };

  const isDiceDisabled =
      rolling ||
      winner ||
      (boardState.dice?.length ?? 0) > 0 ||
      (assignedPlayer && boardState.currentPlayer !== assignedPlayer);

  const curPlayerName = boardState.currentPlayer === Player.WHITE ? "BEYAZ" : "SİYAH";

  const getGhostPosition = () => {
    if (dropTarget === null) return [0, -10, 0];
    if (dropTarget === "off") return [9.5, 0.5, 0];

    const count = boardState.points[dropTarget]?.count ?? 0;
    const pos = getSlotPosition(dropTarget, count);
    return [pos.x, pos.y, pos.z];
  };

  // ================= RENDER =================
  return (
      <>
        <color attach="background" args={["#e0d6c8"]} />

        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow />
        <spotLight position={[-10, 20, 0]} intensity={0.5} />

        {/* Sürükleme Zemini */}
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

        <group onPointerUp={dragging ? null : onPointerUp}>
          {/* Board body */}
          <RoundedBox
              args={[BOARD_SPECS.width + 1.2, 1.2, BOARD_SPECS.height + 1.2]}
              position={[0, -0.62, 0]}
              radius={0.2}
              receiveShadow
          >
            <meshStandardMaterial color={COLORS.frameMain} />
          </RoundedBox>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[BOARD_SPECS.width, BOARD_SPECS.height]} />
            <meshStandardMaterial map={boardTexture} roughness={0.6} metalness={0.0} />
          </mesh>

          {/* Bar */}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[BOARD_SPECS.barWidth, 0.15, BOARD_SPECS.height]} />
            <meshStandardMaterial color="#704f3a" />
          </mesh>

          {/* Dice (state.dice: remainingSteps) */}
          {(boardState.dice ?? []).slice(0, 4).map((dVal, i) => (
              <Dice3D key={`dice-${i}`} value={dVal} position={[-1.5 + i * 1.0, 0.6, 0]} rolling={rolling} />
          ))}

          {/* Bar checkers */}
          {Array.from({ length: boardState.whiteBar }).map((_, i) => (
              <Checker key={`wb-${i}`} color={Player.WHITE} position={getBarPosition(Player.WHITE, i)} isTopStack={false} />
          ))}
          {Array.from({ length: boardState.blackBar }).map((_, i) => (
              <Checker key={`bb-${i}`} color={Player.BLACK} position={getBarPosition(Player.BLACK, i)} isTopStack={false} />
          ))}

          {/* Off checkers */}
          {Array.from({ length: boardState.whiteOff }).map((_, i) => (
              <Checker key={`wo-${i}`} color={Player.WHITE} position={getOffPosition(Player.WHITE, i)} isTopStack={false} />
          ))}
          {Array.from({ length: boardState.blackOff }).map((_, i) => (
              <Checker key={`bo-${i}`} color={Player.BLACK} position={getOffPosition(Player.BLACK, i)} isTopStack={false} />
          ))}

          {/* Highlights */}
          {validMoves.map((idx) => (
              <MoveHighlight key={`hl-${idx}`} index={idx} boardState={boardState} />
          ))}

          {/* Ghost */}
          {dragging && dropTarget !== null && dragItem && (
              <Checker color={dragItem.owner} position={getGhostPosition()} isTopStack={false} opacity={0.5} />
          )}

          {/* Points */}
          {boardState.points.map((p) => {
            const items = [];
            for (let i = 0; i < p.count; i++) {
              const isTop = i === p.count - 1;
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

          {/* Dragged checker */}
          {dragging && dragItem && <Checker color={dragItem.owner} position={dragPos} isTopStack={false} />}
        </group>

        {/* UI Overlay */}
        <Html fullscreen style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 20, left: 20, pointerEvents: "auto", color: "white" }}>
            <div style={{ background: "rgba(0,0,0,0.6)", padding: 12, borderRadius: 12, width: 340 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Tavla (WebSocket)</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                {msg} — <b>{curPlayerName}</b>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                    onClick={handleCreateRoom}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer" }}
                >
                  Oda Oluştur
                </button>

                <input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="RoomId"
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #444", width: 140 }}
                />
                <button
                    onClick={handleJoinRoom}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer" }}
                >
                  Katıl
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div>RoomId: <b>{roomId || "-"}</b></div>
                <div>Sen: <b>{assignedPlayer || "-"}</b></div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                    onClick={handleRoll}
                    disabled={isDiceDisabled}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "none",
                      cursor: isDiceDisabled ? "not-allowed" : "pointer",
                      background: isDiceDisabled ? "#555" : "linear-gradient(135deg,#f39c12,#d35400)",
                      color: "white",
                      fontWeight: 800,
                    }}
                >
                  ZAR AT
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                Zarlar: <b>{(boardState.dice ?? []).join(", ") || "-"}</b>
              </div>
            </div>
          </div>

          {winner && (
              <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                  }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: "white" }}>
                    {winner === Player.WHITE ? "BEYAZ KAZANDI!" : "SİYAH KAZANDI!"}
                  </div>
                  <div style={{ marginTop: 10, color: "#ddd" }}>
                    Backend winner gönderdi.
                  </div>
                </div>
              </div>
          )}
        </Html>
      </>
  );
};

// Açılış kamera animasyonu (kısa)
const OpeningCinematic = ({ onComplete }) => {
  const progress = useRef(0);
  useFrame((state, delta) => {
    if (progress.current < 1) {
      progress.current += delta / 1.6;
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
