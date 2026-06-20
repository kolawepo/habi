import Phaser from "phaser";

const GROUND_Y = 230;
const GRAVITY = 1300;
const JUMP_VELOCITY = -640;
const BIBI_SIZE = 74;
// Lowest a collectible can spawn, in px above GROUND_Y. Needs to stay clear
// of Bibi's resting hitbox top (GROUND_Y - BIBI_SIZE) or standing still next
// to a low collectible will register as a pickup without jumping.
const COLLECTIBLE_MIN_HEIGHT = 95;
// Minimum/extra horizontal gap (in px of travel) between spawns, not ms —
// converted to a time delay via gapPx / this.speed each time, so pixel
// spacing stays constant as speed ramps up instead of compressing.
const MIN_GAP_PX = 220;
const EXTRA_GAP_PX_MIN = 80;
const EXTRA_GAP_PX_MAX = 260;
const BASE_SPEED = 260;
const MAX_SPEED_BONUS = 200;

const OBSTACLES = [
  { emoji: "📱", size: 30 },
  { emoji: "📺", size: 34 },
  { emoji: "😴", size: 30 },
  { emoji: "🛋️", size: 32 },
];

const COLLECTIBLES = [
  { emoji: "🍯", points: 1, size: 24 },
  { emoji: "🔥", points: 5, size: 26 },
  { emoji: "⭐", points: 3, size: 24 },
];

// Placeholder obstacle/collectible art: rendered as emoji Text objects for v1,
// easy to swap for real illustrated sprites later without touching game logic.
export default class BibiRunScene extends Phaser.Scene {
  constructor() {
    super("BibiRunScene");
  }

  preload() {
    this.load.image("bibi", "/bibi-sprite.png");
  }

  create() {
    this.cameras.main.setBackgroundColor("#FBF4EC");

    this.add.rectangle(400, GROUND_Y + 34, 800, 3, 0xE8553A, 0.25);

    // Bottom-anchored (origin 0.5, 1) so "bibi.y" is her feet, matching the
    // obstacles' own bottom anchor — with the previous default center origin,
    // her hitbox sank ~28px below the visual ground line, overlapping
    // grounded obstacles even at rest, regardless of jump timing.
    this.bibi = this.physics.add.image(90, GROUND_Y, "bibi")
      .setDisplaySize(BIBI_SIZE, BIBI_SIZE)
      .setOrigin(0.5, 1);
    this.bibi.body.setAllowGravity(false); // manual gravity below, no ground collider needed
    this.bibi.setDepth(5);
    // setDisplaySize computed this.bibi.scaleX from BIBI_SIZE / native 512px
    // texture width — capture it so the squash/stretch tween in update() can
    // scale relative to it instead of overwriting it outright.
    this.bibiBaseScale = this.bibi.scaleX;
    this.bibiVy = 0;

    this.gameOver = false;
    this.score = 0;
    this.elapsed = 0;
    this.speed = BASE_SPEED;
    this.nextSpawnAt = 1200; // initial delay, before speed-based gaps kick in

    this.scoreText = this.add.text(770, 16, "0", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#E8553A",
    }).setOrigin(1, 0).setDepth(10);

    this.statusText = this.add.text(400, 110, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#E8553A",
    }).setOrigin(0.5).setDepth(20);

    this.obstacles = this.physics.add.group();
    this.collectibles = this.physics.add.group();

    this.physics.add.overlap(this.bibi, this.obstacles, this.hitObstacle, null, this);
    this.physics.add.overlap(this.bibi, this.collectibles, this.collectItem, null, this);

    this.input.on("pointerdown", () => this.handleInput());
    this.input.keyboard.on("keydown-SPACE", () => this.handleInput());
  }

  handleInput() {
    if (this.gameOver) {
      this.scene.restart();
      return;
    }
    this.jump();
  }

  jump() {
    if (this.bibi.y >= GROUND_Y - 1) {
      this.bibiVy = JUMP_VELOCITY;
    }
  }

  // Single scheduler deciding what spawns next (obstacle, collectible, or
  // nothing) and when — replaces two independent timers that could fire
  // close enough together to land on the same x-position. The gap is chosen
  // in pixels-of-travel, then converted to a ms delay via gapPx / this.speed,
  // so spacing stays visually consistent as the game speeds up instead of
  // compressing (a fixed ms gap would shrink in pixel terms as speed rises).
  scheduleNextSpawn() {
    const roll = Math.random();
    if (roll < 0.55) {
      this.spawnObstacle();
    } else if (roll < 0.85) {
      this.spawnCollectible();
    } // else: nothing this tick, for breathing room

    const gapPx = MIN_GAP_PX + Phaser.Math.Between(EXTRA_GAP_PX_MIN, EXTRA_GAP_PX_MAX);
    this.nextSpawnAt = (gapPx / this.speed) * 1000;
  }

  spawnObstacle() {
    const def = Phaser.Utils.Array.GetRandom(OBSTACLES);
    // Bottom-anchored flush with GROUND_Y (was +2, a stray fudge) so it
    // lines up exactly with Bibi's own bottom anchor.
    const obstacle = this.add.text(820, GROUND_Y, def.emoji, { fontSize: `${def.size}px` }).setOrigin(0.5, 1);
    this.physics.add.existing(obstacle);
    obstacle.body.setAllowGravity(false);
    obstacle.body.setVelocityX(-this.speed);
    // Emoji glyphs render with a fair amount of padding inside their font-size
    // box — a hitbox at 0.8x the font size was taller than the visible ink.
    // Tightened to 0.55x and pinned to the bottom of the frame (rather than
    // Arcade's default vertical centering) so the hitbox top roughly tracks
    // where the obstacle visually appears to end.
    const hitboxW = def.size * 0.6;
    const hitboxH = def.size * 0.55;
    obstacle.body.setSize(hitboxW, hitboxH);
    obstacle.body.setOffset((def.size - hitboxW) / 2, def.size - hitboxH);
    this.obstacles.add(obstacle);
  }

  spawnCollectible() {
    const def = Phaser.Utils.Array.GetRandom(COLLECTIBLES);
    const y = GROUND_Y - COLLECTIBLE_MIN_HEIGHT - Math.random() * 50;
    const item = this.add.text(820, y, def.emoji, { fontSize: `${def.size}px` }).setOrigin(0.5);
    item.points = def.points;
    this.physics.add.existing(item);
    item.body.setAllowGravity(false);
    item.body.setVelocityX(-this.speed);
    item.body.setSize(def.size * 0.8, def.size * 0.8);
    this.collectibles.add(item);
  }

  hitObstacle() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.bibi.setTint(0xff8888);
    this.statusText.setText("Tap to run again");
  }

  collectItem(bibi, item) {
    this.score += item.points;
    item.destroy();
  }

  update(time, delta) {
    if (this.gameOver) return;

    this.elapsed += delta;
    this.speed = BASE_SPEED + Math.min(this.elapsed / 200, MAX_SPEED_BONUS);

    // Manual gravity/ground clamp — simpler than a physics ground collider
    // for a single auto-runner that only ever moves vertically.
    this.bibiVy += GRAVITY * (delta / 1000);
    this.bibi.y += this.bibiVy * (delta / 1000);
    if (this.bibi.y >= GROUND_Y) {
      this.bibi.y = GROUND_Y;
      this.bibiVy = 0;
    }
    const airborne = this.bibi.y < GROUND_Y - 2;
    this.bibi.setRotation(airborne ? -0.15 : 0);
    this.bibi.setScale(
      this.bibiBaseScale * (airborne ? 0.95 : 1),
      this.bibiBaseScale * (airborne ? 1.05 : 1)
    );

    // Passive distance score, same convention as classic endless runners.
    this.score += delta * 0.002;
    this.scoreText.setText(String(Math.floor(this.score)));

    this.nextSpawnAt -= delta;
    if (this.nextSpawnAt <= 0) {
      this.scheduleNextSpawn();
    }

    // Group.children is a native Set in Phaser 4 (Phaser 3's
    // Phaser.Structs.Set, which had .each(), is gone) — getChildren()
    // returns a snapshot array, safer to iterate while destroying items.
    this.obstacles.getChildren().forEach((o) => {
      o.body.setVelocityX(-this.speed);
      if (o.x < -40) o.destroy();
    });
    this.collectibles.getChildren().forEach((c) => {
      c.body.setVelocityX(-this.speed);
      if (c.x < -40) c.destroy();
    });
  }
}
