// The canned arrival scene. All three modes (voice, visual novel, choice)
// render the same dialogue — only the player-turn interaction differs.
// This is a research demo: the conversation is on rails. The player's
// input doesn't change mom's lines; it just lets them feel the mode.

export type GuidanceLevel = "open" | "targets" | "step";

// A run of Japanese text. `r` is the furigana reading for the kanji in
// `t` (omitted for kana/punctuation runs). Hand-annotated because the
// scene is fixed — no runtime tokenizer needed.
export interface Ruby {
  t: string;
  r?: string;
}

const p = (t: string): Ruby => ({ t });
const r = (t: string, reading: string): Ruby => ({ t, r: reading });

export interface NpcLine {
  kind: "npc";
  speaker: string;
  ja: Ruby[];
  en: string;
  audio: string; // path under /public
}

export interface PlayerTurn {
  kind: "player";
  prompt: string; // what mom is asking, in plain English
  guidance: {
    open: string;
    targets: string[];
    step: { ja: Ruby[]; en: string };
  };
  choices: {
    ja: Ruby[];
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
    ja: [
      p("いらっしゃいませ。"),
      r("遠", "とお"),
      p("いところ、よくいらっしゃいました。"),
      r("田中", "たなか"),
      p("と"),
      r("申", "もう"),
      p("します。"),
    ],
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
        ja: [
          p("はじめまして。ジョンと"),
          r("申", "もう"),
          p("します。お"),
          r("世話", "せわ"),
          p("になります。"),
        ],
        en: "Nice to meet you. My name is John. Thank you for having me.",
      },
    },
    choices: [
      {
        ja: [
          p("はじめまして。ジョンと"),
          r("申", "もう"),
          p("します。お"),
          r("世話", "せわ"),
          p("になります。"),
        ],
        en: "Nice to meet you. My name is John. Thank you for having me.",
        note: "Polite and warm — exactly right for a first meeting.",
        good: true,
      },
      {
        ja: [p("どうも。ジョンです。")],
        en: "Hey. I'm John.",
        note: "Too casual for meeting a host for the first time.",
        good: false,
      },
      {
        ja: [p("こんにちは。"), r("元気", "げんき"), p("ですか？")],
        en: "Hello. How are you?",
        note: "Friendly, but skips the introduction she just offered.",
        good: false,
      },
    ],
  },
  {
    kind: "npc",
    speaker: NPC_NAME,
    ja: [
      p("まあ、ご"),
      r("丁寧", "ていねい"),
      p("に。お"),
      r("疲", "つか"),
      p("れでしょう。お"),
      r("部屋", "へや"),
      p("にご"),
      r("案内", "あんない"),
      p("しますね。お"),
      r("荷物", "にもつ"),
      p("、お"),
      r("持", "も"),
      p("ちしましょうか。"),
    ],
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
        ja: [
          p("ありがとうございます。でも、"),
          r("大丈夫", "だいじょうぶ"),
          p("です。"),
          r("自分", "じぶん"),
          p("で"),
          r("持", "も"),
          p("てます。"),
        ],
        en: "Thank you. But I'm fine — I can carry it myself.",
      },
    },
    choices: [
      {
        ja: [
          p("ありがとうございます。お"),
          r("願", "ねが"),
          p("いします。"),
        ],
        en: "Thank you. Yes, please.",
        note: "Gracious acceptance. Perfectly natural.",
        good: true,
      },
      {
        ja: [
          p("ありがとうございます。でも、"),
          r("大丈夫", "だいじょうぶ"),
          p("です。"),
        ],
        en: "Thank you, but I'm okay.",
        note: "A polite, common way to decline a kind offer.",
        good: true,
      },
      {
        ja: [p("いや、いい。")],
        en: "Nah, it's fine.",
        note: "Far too blunt for this register.",
        good: false,
      },
    ],
  },
  {
    kind: "npc",
    speaker: NPC_NAME,
    ja: [
      p("では、こちらへどうぞ。お"),
      r("茶", "ちゃ"),
      p("を"),
      r("入", "い"),
      p("れますね。ゆっくりしてください。"),
    ],
    en: "Then, this way please. I'll make some tea. Please make yourself at home.",
    audio: "/audio/mom-3.wav",
  },
];
