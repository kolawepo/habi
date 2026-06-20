import { useEffect, useRef } from "react";
import Phaser from "phaser";
import BibiRunScene from "../game/BibiRunScene";

// Phaser owns its own canvas/render loop, so it's mounted once on a ref'd
// div and torn down on unmount — React never re-renders into the canvas.
export default function BibiRunGame() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 300,
      parent: containerRef.current,
      backgroundColor: "#FBF4EC",
      physics: {
        default: "arcade",
        arcade: { debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BibiRunScene],
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="bibiRunGame" />;
}
