export function goalEmoji(goal) {
  if (goal.includes("fun")) return "🌟";
  if (goal.includes("business")) return "💼";
  if (goal.includes("confidence")) return "✨";
  if (goal.includes("community")) return "❤️";

  return "📈";
}

export function sectionEmoji(section) {
  const map = {
    Hair: "💇🏾‍♀️",
    Face: "💄",
    Coding: "💻",
    Design: "🎨",
    Visual: "📸",
    Handmade: "🧶",
    Training: "🏋️",
    Wellness: "🧘",
    Style: "👗",
    Create: "🧵",
    Cooking: "🍳",
    Content: "🎥",
  };

  return map[section] || "✨";
}

export function skillEmoji(skill) {
  const map = {
    Braiding: "💇🏾‍♀️",
    "Wig Installs": "💇🏾‍♀️",
    "Natural Hair": "🌀",
    Makeup: "💄",
    Lashes: "👁️",
    Skincare: "🧴",
    Frontend: "💻",
    Python: "🐍",
    "App Building": "📱",
    "UI/UX": "🎨",
    "Web Design": "🖥️",
    "AI Tools": "🤖",
    Photography: "📸",
    "Video Editing": "🎬",
    "Graphic Design": "🖼️",
    Crochet: "🧶",
    Drawing: "✏️",
    Painting: "🎨",
    "Gym Routine": "🏋️",
    "Glute Growth": "🍑",
    Pilates: "🧘",
    Stretching: "🤸",
    Running: "🏃",
    Yoga: "🧘",
    Styling: "👗",
    "Outfit Planning": "👚",
    Thrifting: "🛍️",
    Sewing: "🧵",
    "Fashion Content": "📸",
    "Meal Prep": "🍱",
    Baking: "🧁",
    "Healthy Meals": "🥗",
    "Recipe Videos": "🎥",
    "Food Photography": "🍳",
  };

  return map[skill] || "✨";
}