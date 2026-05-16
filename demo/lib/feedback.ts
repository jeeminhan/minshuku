// Paste your Google Apps Script Web App URL here after deploying it
// (see demo/FEEDBACK_SETUP.md). Until it's set, the form still works —
// it just logs to the console instead of posting.
export const FEEDBACK_ENDPOINT = "";

export interface RadioQuestion {
  id: string;
  question: string;
  help?: string;
  options: { value: string; label: string; sub?: string }[];
}

export const radioQuestions: RadioQuestion[] = [
  {
    id: "mode",
    question: "Which mode felt best to you?",
    help: "The one you'd actually want to come back to.",
    options: [
      { value: "voice", label: "Voice", sub: "speak and be spoken to" },
      {
        value: "visual-novel",
        label: "Visual novel",
        sub: "a scene you read and type into",
      },
      { value: "choice", label: "Choice", sub: "pick from written replies" },
      { value: "unsure", label: "Couldn't tell / need more" },
    ],
  },
  {
    id: "guidance",
    question: "How much help would you want by default?",
    options: [
      { value: "open", label: "Open", sub: "just the situation" },
      {
        value: "targets",
        label: "Targets shown",
        sub: "a few words to use",
      },
      {
        value: "step",
        label: "Step-by-step",
        sub: "a suggested line each turn",
      },
    ],
  },
  {
    id: "wouldUse",
    question: "Would you actually use this to learn Japanese?",
    options: [
      { value: "yes", label: "Yes, definitely" },
      { value: "maybe", label: "Maybe — depends" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "wouldAuthor",
    question: "Would you ever write a story for it?",
    help: "Honestly — most people won't, and that's useful to know.",
    options: [
      { value: "yes", label: "Yes, I'd try" },
      { value: "maybe", label: "Maybe, if it were easy" },
      { value: "no", label: "No, I just want to play" },
    ],
  },
  {
    id: "level",
    question: "Your current Japanese level?",
    options: [
      { value: "none", label: "Just starting" },
      { value: "n5", label: "N5" },
      { value: "n4", label: "N4" },
      { value: "n3", label: "N3" },
      { value: "n2", label: "N2" },
      { value: "n1", label: "N1 / fluent-ish" },
    ],
  },
];

export interface FeedbackPayload {
  mode: string;
  guidance: string;
  wouldUse: string;
  wouldAuthor: string;
  level: string;
  open: string;
  ua: string;
}
