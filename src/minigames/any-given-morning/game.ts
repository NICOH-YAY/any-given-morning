import { CONVERSATIONS, QUESTS } from "./quests";
import { COPY, DEATH_TEXT, DEED_TEXT, TARGET_LABELS, type DeathKind, type DeedId } from "./text";
import { BIOMES, generateArea, isWalkable, MIN_INTERACTABLE_SPACING, mulberry32, seedFor, TRACE_KINDS, type Area, type Biome, type ItemKind, type LegacyTrace, type Npc, type Point, type Rng, type Station } from "./world";
export { mulberry32 } from "./world";

export const LIFESPAN_BASE = 20;
export const LIFESPAN_JITTER = 4;
export const TELEGRAPH = 1.3;
export const ROUND_LIVES = 5;
export const IMMORTAL_ROUND_SECONDS = 100;
export const DYING_SECONDS = 2.5;
export const LEGACY_CAP = 6;
export const INVENTORY_SLOTS = 4;
export const FISH_WAIT = 1.2;
export const FISH_WINDOW = 0.6;
export const MOVE_SPEED = 70;
export const INTERACTION_RADIUS = 22;
const EPSILON = 1e-9;

export type Screen = "MENU" | "PLAY" | "DYING" | "DEAD" | "LEDGER";
export interface ScreenMachine { screen: Screen }
export const SCREEN_TRANSITIONS: Record<Screen, readonly Screen[]> = {
  MENU: ["PLAY"],
  PLAY: ["DYING", "LEDGER", "MENU"],
  DYING: ["DEAD", "MENU"],
  DEAD: ["PLAY", "LEDGER", "MENU"],
  LEDGER: ["MENU"],
};
export function transition(machine: ScreenMachine, next: Screen): void {
  if (!SCREEN_TRANSITIONS[machine.screen].includes(next)) throw new Error(`Illegal screen transition ${machine.screen} -> ${next}`);
  machine.screen = next;
}

export interface DeathDefinition {
  kind: DeathKind;
  biomes: readonly Biome[];
  weight: number;
  peaceful: boolean;
  /** Stable animation identifier for the later renderer. */
  animation: string;
}
export const DEATHS: readonly DeathDefinition[] = [
  { kind: "shark", biomes: ["seaside"], weight: 2, peaceful: false, animation: "fin_lunge" },
  { kind: "seagulls", biomes: ["seaside"], weight: 2, peaceful: false, animation: "gull_swarm" },
  { kind: "rogue_wave", biomes: ["seaside"], weight: 2, peaceful: false, animation: "sea_surge" },
  { kind: "coconut", biomes: ["seaside"], weight: 2, peaceful: false, animation: "palm_drop" },
  { kind: "npc_attack", biomes: BIOMES, weight: 1, peaceful: false, animation: "pan_rush" },
  { kind: "meteor", biomes: BIOMES, weight: 3, peaceful: false, animation: "meteor_strike" },
  { kind: "lightning", biomes: BIOMES, weight: 2, peaceful: false, animation: "silhouette_ash" },
  { kind: "gator_explodes", biomes: ["riverside"], weight: 2, peaceful: false, animation: "gator_confetti" },
  { kind: "sinkhole", biomes: BIOMES, weight: 2, peaceful: false, animation: "ground_crack" },
  { kind: "ufo", biomes: BIOMES, weight: 2, peaceful: false, animation: "cow_beam" },
  { kind: "piano", biomes: BIOMES, weight: 2, peaceful: false, animation: "piano_drop" },
  { kind: "crows", biomes: BIOMES, weight: 1, peaceful: false, animation: "crow_cloud" },
  { kind: "tornado", biomes: BIOMES, weight: 2, peaceful: false, animation: "tornado_lift" },
  { kind: "hay_avalanche", biomes: ["farm"], weight: 2, peaceful: false, animation: "bale_topple" },
  { kind: "flood", biomes: ["riverside"], weight: 2, peaceful: false, animation: "water_wall" },
  { kind: "bloom", biomes: BIOMES, weight: 1, peaceful: true, animation: "flower_tree" },
  { kind: "lights_out", biomes: BIOMES, weight: 1, peaceful: true, animation: "sky_dim" },
  { kind: "wave_goodbye", biomes: BIOMES, weight: 1, peaceful: true, animation: "wave_fade" },
  { kind: "comet_pair", biomes: BIOMES, weight: 1, peaceful: false, animation: "double_strike" },
];

export function drawLifespan(rng: Rng): number {
  return LIFESPAN_BASE + (rng() * 2 - 1) * LIFESPAN_JITTER;
}

export function deathFor(biome: Biome, rng: Rng, usedKinds: readonly DeathKind[] = [], annoyed = false): DeathDefinition {
  const choices = DEATHS.filter((death) => death.biomes.includes(biome) && !usedKinds.includes(death.kind) && (death.kind !== "npc_attack" || annoyed));
  if (!choices.length) throw new Error("No unused death kind for this biome");
  let draw = rng() * choices.reduce((total, death) => total + death.weight, 0);
  for (const death of choices) {
    draw -= death.weight;
    if (draw < 0) return death;
  }
  return choices[choices.length - 1];
}

export interface Deed { id: DeedId; text: string }
export interface LifeSummary {
  number: number;
  seconds: number;
  died: boolean;
  kind: DeathKind | null;
  cause: string;
  deedCount: number;
  deeds: Deed[];
  quests: { title: string; finished: boolean }[];
}
export interface RoundState extends ScreenMachine {
  mortal: boolean;
  seed: number;
  lifeCount: number;
  history: LifeSummary[];
  legacy: LegacyTrace[];
  scheduledDeaths: DeathKind[];
}
export interface Session { state: RoundState; life: Life | null }
export interface Life {
  /** Shared round state, without a circular reference to the session. */
  round: RoundState;
  number: number;
  world: Area;
  player: Point & { vx: number; vy: number };
  elapsed: number;
  deathAt: number | null;
  death: DeathDefinition | null;
  telegraphAt: number | null;
  telegraph: boolean;
  dyingElapsed: number;
  ended: boolean;
  deeds: Deed[];
  inventory: ItemKind[];
  conversation: { npcId: string; kind: "give" | "talk"; selected: number } | null;
  fishing: { at: Point; biteAt: number; baited: boolean } | null;
  attacker: Npc | null;
  idleSeconds: number;
  nearbySeconds: Record<string, number>;
  dialogue: string | null;
  sittingUntil: number;
}
export interface Input { x?: number; y?: number; interact?: boolean }

/** Rules mutate the supplied session/life and return it for the host's next render. */
export function createSession(options: { mortal: boolean; seed: number }): Session {
  if (!Number.isSafeInteger(options.seed)) throw new RangeError("Seed must be a safe integer");
  return { state: { ...options, seed: options.seed >>> 0, screen: "MENU", lifeCount: 0, history: [], legacy: [], scheduledDeaths: [] }, life: null };
}

export function startLife(session: Session): Life {
  const round = session.state;
  if (round.screen !== "MENU" && round.screen !== "DEAD") throw new Error("A life can start only from MENU or DEAD");
  if (round.lifeCount >= (round.mortal ? ROUND_LIVES : 1)) throw new Error("The round has no lives left");
  if (round.screen === "MENU" && round.lifeCount !== 0) throw new Error("Create a new session after returning to MENU");
  const index = round.lifeCount;
  const world = generateArea(seedFor(round.seed, index, 1), round.legacy);
  const deathAt = round.mortal ? drawLifespan(mulberry32(seedFor(round.seed, index, 2))) : null;
  const usedKinds = round.scheduledDeaths;
  const death = round.mortal ? deathFor(world.biome, mulberry32(seedFor(round.seed, index, 3)), usedKinds) : null;
  if (death) round.scheduledDeaths.push(death.kind);
  const life: Life = {
    round, number: index + 1, world, player: { ...world.spawn, vx: 0, vy: 0 }, elapsed: 0,
    deathAt, death, telegraphAt: deathAt !== null && death && !death.peaceful ? deathAt - TELEGRAPH : null,
    telegraph: false, dyingElapsed: 0, ended: false, deeds: [], inventory: [], conversation: null, fishing: null, attacker: null, idleSeconds: 0, nearbySeconds: {}, dialogue: null, sittingUntil: 0,
  };
  transition(round, "PLAY");
  round.lifeCount++;
  session.life = life;
  return life;
}

/** DEAD waits for a button/key. The fifth life then opens the ledger. */
export function continueAfterDeath(session: Session): Life | null {
  if (session.state.screen !== "DEAD") throw new Error("Continue requires DEAD");
  if (session.state.lifeCount === ROUND_LIVES) {
    transition(session.state, "LEDGER");
    return null;
  }
  return startLife(session);
}

function recordDeed(life: Life, id: DeedId): void {
  if (!life.deeds.some((deed) => deed.id === id)) life.deeds.push({ id, text: DEED_TEXT[id] });
}

function finishLife(life: Life): void {
  if (life.ended) return;
  life.ended = true;
  life.round.history.push(summarizeLife(life));
  if (!life.round.mortal || !life.death) return;
  // Each deed leaves one trace. The final deeds of a life are the newest traces.
  const traces = life.deeds.map((deed, index): LegacyTrace => ({
    id: `${life.number}-${deed.id}`, deed: deed.id, life: life.number,
    kind: TRACE_KINDS[Math.floor(mulberry32(seedFor(life.round.seed, life.number * 32 + index, 4))() * TRACE_KINDS.length)],
  }));
  life.round.legacy = [...traces.reverse(), ...life.round.legacy].slice(0, LEGACY_CAP);
}

function near(a: Point, b: Point): boolean { return Math.hypot(a.x - b.x, a.y - b.y) <= INTERACTION_RADIUS; }
export function take(life: Life, item: ItemKind): boolean {
  if (life.inventory.length >= INVENTORY_SLOTS) return false;
  life.inventory.push(item);
  return true;
}
function consume(life: Life, item: Life["inventory"][number]): boolean {
  const index = life.inventory.indexOf(item);
  if (index < 0) return false;
  life.inventory.splice(index, 1);
  return true;
}

const ERRAND_DEEDS: Record<Npc["archetype"], DeedId> = {
  hatless_farmer: "returned_hat", chicken_keeper: "fed_chickens", river_child: "talked_to_child",
  fisherman: "helped_fisherman", letter_recipient: "delivered_letter", gardener: "watered_crops",
  couple: "errand_couple", dog: "errand_dog", sleeper: "errand_sleeper", pie_seller: "errand_pie_seller",
  neighbor: "errand_neighbor", cloud_watcher: "errand_cloud_watcher", florist: "errand_florist", shepherd: "errand_shepherd",
  lighthouse_keeper: "errand_lighthouse_keeper", sea_fisher: "errand_sea_fisher", sand_kid: "errand_sand_kid",
};
function talk(life: Life, npc: Npc): string {
  if (npc.quest === "new") npc.quest = "asked";
  npc.talks++;
  if (npc.need === "quiet" && !npc.awake) { npc.awake = true; recordDeed(life, "woke_sleeper"); }
  if (npc.need === "pet") recordDeed(life, "pet_dog");
  life.conversation = { npcId: npc.id, kind: "talk", selected: 0 };
  return npc.done ? QUESTS[npc.archetype].thanks : CONVERSATIONS[npc.archetype][npc.node].line;
}

export function conversationOptions(life: Life): string[] {
  const menu = life.conversation;
  const npc = life.world.npcs.find((person) => person.id === menu?.npcId);
  if (!menu || !npc) return [];
  return menu.kind === "give" ? [...life.inventory.map((item) => TARGET_LABELS.items[item]), COPY.justTalk]
    : CONVERSATIONS[npc.archetype][npc.node].replies.map((reply) => reply.text);
}
export function closeConversation(life: Life): void { life.conversation = null; life.dialogue = null; }

/** Every gift leaves the bag. Only the requested item advances the errand. */
export function give(life: Life, npc: Npc, slot: number): string | null {
  if (life.round.screen !== "PLAY" || !near(life.player, npc) || !Number.isInteger(slot)) return null;
  const item = life.inventory[slot];
  if (!item) return null;
  life.inventory.splice(slot, 1);
  const quest = QUESTS[npc.archetype];
  if (npc.quest === "new") npc.quest = "asked";
  if (item === quest.wanted && !npc.done) {
    completeErrand(life, npc);
    life.dialogue = quest.thanks;
  } else {
    npc.wrongGifts++;
    life.dialogue = quest.grumpy && npc.wrongGifts >= 2 ? "That's enough. Keep your hands out of my pan." : quest.otherGift;
    if (quest.grumpy && npc.wrongGifts >= 2) life.attacker = npc;
  }
  life.conversation = null;
  return life.dialogue;
}
export function chooseReply(life: Life, choice: number): string | null {
  if (life.round.screen !== "PLAY" || !Number.isInteger(choice)) return null;
  const menu = life.conversation;
  const npc = life.world.npcs.find((person) => person.id === menu?.npcId);
  if (!menu || !npc) return null;
  if (menu.kind === "give") {
    if (choice === life.inventory.length) return life.dialogue = talk(life, npc);
    return give(life, npc, choice);
  }
  const reply = CONVERSATIONS[npc.archetype][npc.node].replies[choice];
  if (!reply) return null;
  if (reply.next === null) { closeConversation(life); return null; }
  npc.node = reply.next;
  menu.selected = 0;
  return life.dialogue = CONVERSATIONS[npc.archetype][npc.node].line;
}
function completeErrand(life: Life, npc: Npc): void {
  npc.done = true; npc.quest = "delivery";
  recordDeed(life, ERRAND_DEEDS[npc.archetype]);
  take(life, QUESTS[npc.archetype].reward);
  if (npc.archetype === "lighthouse_keeper") life.world.changes.push({ kind: "lantern", item: "oil", x: 280, y: 18, at: life.elapsed });
}
function openPerson(life: Life, npc: Npc): string {
  if (npc.quest === "new") npc.quest = "asked";
  if (life.inventory.length) {
    life.conversation = { npcId: npc.id, kind: "give", selected: 0 };
    return npc.done ? QUESTS[npc.archetype].thanks : CONVERSATIONS[npc.archetype][npc.node].line;
  }
  return talk(life, npc);
}

function fish(life: Life, station: Station): string {
  if (life.fishing) {
    const attempt = life.fishing;
    life.fishing = null;
    if (!attempt.baited) return COPY.fishingEmpty;
    if (life.elapsed + EPSILON < attempt.biteAt || life.elapsed - attempt.biteAt > FISH_WINDOW + EPSILON) return COPY.fishingMiss;
    return take(life, "fish") ? COPY.fishingCaught : COPY.bagFull;
  }
  if (life.inventory.length >= INVENTORY_SLOTS && !life.inventory.includes("bait")) return COPY.bagFull;
  life.fishing = { at: { x: station.x, y: station.y }, baited: consume(life, "bait"), biteAt: life.elapsed + FISH_WAIT };
  return COPY.fishingWait;
}

function useStation(life: Life, station: Station): string | null {
  const waiting = life.world.npcs.find((npc) => npc.quest === "delivery" && QUESTS[npc.archetype].destination === station.kind && life.inventory.includes(QUESTS[npc.archetype].reward));
  if (waiting) {
    consume(life, QUESTS[waiting.archetype].reward);
    waiting.quest = "finished";
    recordDeed(life, `quest_${waiting.archetype}`);
    life.world.changes.push({ kind: station.kind, item: QUESTS[waiting.archetype].reward, x: station.x, y: station.y, at: life.elapsed });
    return null;
  }
  switch (station.kind) {
    case "fishing_spot": return fish(life, station);
    case "worm_patch": return take(life, "bait") ? "You took worms from the garden patch." : COPY.bagFull;
    case "grain_sack": return take(life, "grain") ? COPY.grain : COPY.bagFull;
    case "trough":
      if (!consume(life, "grain")) return null;
      recordDeed(life, "fed_chickens");
      life.world.npcs.filter((npc) => npc.need === "grain" && !npc.done).forEach((npc) => completeErrand(life, npc));
      return COPY.fed;
    case "well": return take(life, "water") ? COPY.can : COPY.bagFull;
    case "crop_plot":
      if (!consume(life, "water")) return null;
      recordDeed(life, "watered_crops");
      life.world.npcs.filter((npc) => npc.need === "water" && !npc.done).forEach((npc) => completeErrand(life, npc));
      return COPY.watered;
    case "flowers": if (!take(life, "flower")) return COPY.bagFull; recordDeed(life, "picked_flowers"); return COPY.flowers;
    case "water_bank": recordDeed(life, "sat_by_water"); return COPY.water;
    case "lantern": case "boat_launch": case "table": case "song_post": case "planter": return null;
    case "bench":
      Object.assign(life.player, { x: station.x, y: station.y, vx: 0, vy: 0 });
      life.sittingUntil = life.elapsed + 1.6;
      recordDeed(life, "sat_on_bench");
      return COPY.bench;
  }
}

/** The marker and input share the same nearest target and tie order. */
export function nearestInteraction(life: Life): { at: Point; label: string; act: () => string | null } | undefined {
  const targets = [
    ...life.world.items.filter((item) => !item.taken).map((item) => ({ at: item, label: TARGET_LABELS.items[item.kind], act: () => {
      if (!take(life, item.kind)) return COPY.bagFull;
      item.taken = true; return `You picked up ${TARGET_LABELS.items[item.kind].toLowerCase()}.`;
    } })),
    ...life.world.npcs.map((npc) => ({ at: npc, label: TARGET_LABELS.npcs[npc.archetype], act: () => openPerson(life, npc) })),
    ...life.world.stations.map((station) => ({ at: station, label: TARGET_LABELS.stations[station.kind], act: () => useStation(life, station) })),
    ...life.world.traces.map((trace) => ({ at: trace, label: TARGET_LABELS.trace, act: () => COPY.trace })),
  ].filter(({ at }) => near(life.player, at)).sort((a, b) =>
    Math.hypot(a.at.x - life.player.x, a.at.y - life.player.y) - Math.hypot(b.at.x - life.player.x, b.at.y - life.player.y));
  return targets[0];
}

/** Nearest reachable object wins. Input is ignored outside this life in PLAY. */
export function interact(life: Life): string | null {
  if (life.round.screen !== "PLAY" || life.ended) return null;
  if (life.conversation) return chooseReply(life, life.conversation.selected);
  if (life.fishing) {
    life.dialogue = fish(life, { id: "fishing_spot", kind: "fishing_spot", ...life.fishing.at });
    return life.dialogue;
  }
  life.idleSeconds = 0;
  life.nearbySeconds = {};
  life.sittingUntil = 0;
  life.dialogue = nearestInteraction(life)?.act() ?? null;
  return life.dialogue;
}

function approach(value: number, target: number, amount: number): number {
  return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
}
function canStand(world: Area, x: number, y: number): boolean {
  return [-4, 4].every((dx) => [-4, 4].every((dy) => isWalkable(world, x + dx, y + dy)));
}
function advance(life: Life, dt: number, input: Input): void {
  const x = life.conversation ? 0 : input.x ?? 0, y = life.conversation ? 0 : input.y ?? 0;
  const magnitude = Math.max(1, Math.hypot(x, y));
  const moving = x !== 0 || y !== 0;
  if (moving) life.sittingUntil = 0;
  const acceleration = moving ? 450 : 600;
  const player = life.player;
  player.vx = approach(player.vx, x / magnitude * MOVE_SPEED, acceleration * dt);
  player.vy = approach(player.vy, y / magnitude * MOVE_SPEED, acceleration * dt);
  const nextX = player.x + player.vx * dt, nextY = player.y + player.vy * dt;
  if (canStand(life.world, nextX, player.y)) player.x = nextX; else player.vx = 0;
  if (canStand(life.world, player.x, nextY)) player.y = nextY; else player.vy = 0;
  life.elapsed += dt;
  if (life.fishing) {
    if (Math.hypot(life.player.x - life.fishing.at.x, life.player.y - life.fishing.at.y) > INTERACTION_RADIUS) { life.fishing = null; life.dialogue = COPY.fishingMiss; }
    else if (life.elapsed > life.fishing.biteAt + (life.fishing.baited ? FISH_WINDOW : 0) + EPSILON) {
      life.dialogue = life.fishing.baited ? COPY.fishingMiss : COPY.fishingEmpty; life.fishing = null;
    } else if (life.fishing.baited && life.elapsed + EPSILON >= life.fishing.biteAt) life.dialogue = COPY.fishingBite;
  }
  const idle = !moving && !input.interact && Math.hypot(player.vx, player.vy) < 1;
  life.idleSeconds = idle ? life.idleSeconds + dt : 0;
  if (life.idleSeconds + EPSILON >= 4) recordDeed(life, "looked_at_sky");
  for (const npc of life.world.npcs) {
    // Slight wander stays inside the home tile and cannot affect collision.
    const next = {
      x: npc.home.x + Math.sin(life.elapsed * 0.7 + npc.phase) * 1.5,
      y: npc.home.y + Math.sin(life.elapsed * 0.5 + npc.phase) * 1.5,
    };
    const neighbors = [...life.world.npcs.filter((other) => other !== npc), ...life.world.items, ...life.world.stations];
    if (neighbors.every((other) => Math.hypot(next.x - other.x, next.y - other.y) >= MIN_INTERACTABLE_SPACING)) Object.assign(npc, next);
    const quiet = idle && near(player, npc) && !npc.awake;
    life.nearbySeconds[npc.id] = quiet ? (life.nearbySeconds[npc.id] ?? 0) + dt : 0;
    if (npc.need === "quiet" && life.nearbySeconds[npc.id] + EPSILON >= 3) recordDeed(life, "let_sleeper_sleep");
    if (npc.need === "company" && life.nearbySeconds[npc.id] + EPSILON >= 2) {
      recordDeed(life, "listened_to_couple");
      npc.done = true;
    }
  }
}

/** dt is seconds. Large steps are subdivided for collision, then clipped at the deadline. */
export function step(life: Life, dt: number, input: Input = {}): Life {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("dt must be finite and nonnegative");
  if (![input.x ?? 0, input.y ?? 0].every(Number.isFinite)) throw new RangeError("Movement must be finite");
  const round = life.round;
  // An old life must never advance the shared state after a respawn.
  if (life.number !== round.lifeCount) return life;
  if (round.screen === "DYING") {
    life.dyingElapsed = Math.min(DYING_SECONDS, life.dyingElapsed + dt);
    if (life.dyingElapsed + EPSILON >= DYING_SECONDS) transition(round, "DEAD");
    return life;
  }
  if (round.screen !== "PLAY" || life.ended) return life;
  if (input.interact) interact(life);
  const deadline = life.deathAt ?? IMMORTAL_ROUND_SECONDS;
  const activeTime = Math.min(dt, Math.max(0, deadline - life.elapsed));
  let remaining = activeTime;
  while (remaining > 0) {
    const frame = Math.min(1 / 60, remaining);
    advance(life, frame, input);
    remaining = Math.max(0, remaining - frame);
  }
  if (round.mortal && life.attacker && life.elapsed + EPSILON >= life.deathAt! - TELEGRAPH && !round.history.some((entry) => entry.kind === "npc_attack")) {
    life.death = DEATHS.find((death) => death.kind === "npc_attack")!;
    life.telegraphAt = life.deathAt! - TELEGRAPH;
  }
  life.telegraph = life.telegraphAt !== null && life.elapsed + EPSILON >= life.telegraphAt;
  if (life.elapsed + EPSILON >= deadline) {
    life.elapsed = deadline;
    finishLife(life);
    transition(round, round.mortal ? "DYING" : "LEDGER");
    if (round.mortal) step(life, Math.max(0, dt - activeTime));
  }
  return life;
}

export function summarizeLife(life: Life): LifeSummary {
  const died = life.ended && life.round.mortal;
  return {
    number: life.number, seconds: life.elapsed, died, kind: died ? life.death!.kind : null,
    cause: died ? DEATH_TEXT[life.death!.kind] : COPY.dayEnded,
    deedCount: life.deeds.length, deeds: life.deeds.map((deed) => ({ ...deed })),
    quests: life.world.npcs.filter((npc) => npc.quest !== "new").map((npc) => ({ title: QUESTS[npc.archetype].title, finished: npc.quest === "finished" })),
  };
}

export function summarizeRound(session: Session): { mortal: boolean; mode: string; lives: LifeSummary[]; seconds: number; deedCount: number; deedsPerMinute: number } {
  const lives = session.state.history.map((life) => ({ ...life, deeds: life.deeds.map((deed) => ({ ...deed })), quests: life.quests.map((quest) => ({ ...quest })) }));
  const seconds = lives.reduce((sum, life) => sum + life.seconds, 0);
  const deedCount = lives.reduce((sum, life) => sum + life.deedCount, 0);
  const activeDeeds = lives.reduce((sum, life) => sum + life.deeds.filter((deed) => deed.id !== "looked_at_sky" && deed.id !== "let_sleeper_sleep").length, 0);
  return { mortal: session.state.mortal, mode: session.state.mortal ? COPY.mortalMode : COPY.immortalMode,
    lives, seconds, deedCount, deedsPerMinute: seconds > 0 ? activeDeeds * 60 / seconds : 0 };
}
