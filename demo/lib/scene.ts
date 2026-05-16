// The canned arrival scene. All three modes (voice, visual novel, choice)
// render the same dialogue — only the player-turn interaction differs.
// This is a research demo: the conversation is on rails. The player's
// input doesn't change mom's lines; it just lets them feel the mode.

export type GuidanceLevel = "open" | "targets" | "step";

export interface NpcLine {
  kind: "npc";
  speaker: string;
  ja: string;
  en: string;
  audio: string; // path under /public
}

export interface PlayerTurn {
  kind: "player";
  prompt: string; // what mom is asking, in plain English
  guidance: {
    open: string;
    targets: string[];
    step: { ja: string; en: string };
  };
  choices: {
    ja: string;
    en: string;
    note: string;
    good: boolean;
  }[];
}

export type SceneStep = NpcLine | PlayerTurn;

export const SCENE_TITLE = "Summer at the minshuku";
export const SCENE_SUBTITLE = "Scene 1 · Arrival · with Tanaka-san";
export const SCENE_BRIEFING =
  "You've just arrived at a small countryside guesthouse after a long trip. Tanaka-san, the host, meets you at the entrance. You've never met. Be polite.";

export const NPC_NAME = "Tanaka-san";

export const scene: SceneStep[] = [
  {
    kind: "npc",
    speaker: NPC_NAME,
    ja: "いらっしゃいませ。遠いところ、よくいらっしゃいました。田中と申します。",
    en: "Welcome. Thank you for coming all this way. My name is Tanaka.",
    audio: "/audio/mom-1.wav",
  },
  {
    kind: "player",
    prompt: "Introduce yourself. You've just met — keep it polite.",
    guidance: {
      open: "Introduce yourself. Be polite — you've only just met.",
      targets: ["申します — humble “my name is”", "お世話になります — “thank you for having me”"],
      step: {
        ja: "はじめまして。ジョンと申します。お世話になります。",
        en: "Nice to meet you. My name is John. Thank you for having me.",
      },
    },
    choices: [
      {
        ja: "はじめまして。ジョンと申します。お世話になります。",
        en: "Nice to meet you. My name is John. Thank you for having me.",
        note: "Polite and warm — exactly right for a first meeting.",
        good: true,
      },
      {
        ja: "どうも。ジョンです。",
        en: "Hey. I'm John.",
        note: "Too casual for meeting a host for the first time.",
        good: false,
      },
      {
        ja: "こんにちは。元気ですか？",
        en: "Hello. How are you?",
        note: "Friendly, but skips the introduction she just offered.",
        good: false,
      },
    ],
  },
  {
    kind: "npc",
    speaker: NPC_NAME,
    ja: "まあ、ご丁寧に。お疲れでしょう。お部屋にご案内しますね。お荷物、お持ちしましょうか。",
    en: "Oh, how polite. You must be tired. Let me show you to your room. Shall I carry your luggage?",
    audio: "/audio/mom-2.wav",
  },
  {
    kind: "player",
    prompt: "She offered to carry your bag. Respond.",
    guidance: {
      open: "She offered to carry your luggage. Accept or decline — politely.",
      targets: ["大丈夫です — “I'm fine / no need”", "お願いします — “yes, please”"],
      step: {
        ja: "ありがとうございます。でも、大丈夫です。自分で持てます。",
        en: "Thank you. But I'm fine — I can carry it myself.",
      },
    },
    choices: [
      {
        ja: "ありがとうございます。お願いします。",
        en: "Thank you. Yes, please.",
        note: "Gracious acceptance. Perfectly natural.",
        good: true,
      },
      {
        ja: "ありがとうございます。でも、大丈夫です。",
        en: "Thank you, but I'm okay.",
        note: "A polite, common way to decline a kind offer.",
        good: true,
      },
      {
        ja: "いや、いい。",
        en: "Nah, it's fine.",
        note: "Far too blunt for this register.",
        good: false,
      },
    ],
  },
  {
    kind: "npc",
    speaker: NPC_NAME,
    ja: "では、こちらへどうぞ。お茶を入れますね。ゆっくりしてください。",
    en: "Then, this way please. I'll make some tea. Please make yourself at home.",
    audio: "/audio/mom-3.wav",
  },
];
