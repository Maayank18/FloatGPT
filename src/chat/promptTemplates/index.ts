import { SlashCommandType } from '../commandSchemas';

export function getCommandSystemPrompt(command: SlashCommandType): string {
  const baseInstruction = "You are operating in a strict command-response mode. Do not include conversational filler, greetings, or acknowledgments. Optimize entirely for the requested format.";

  switch (command) {
    case 'one-liner':
      return `${baseInstruction}
Return exactly one sentence. No title, no bullets, no second sentence.`;

    case 'architecture':
      return `${baseInstruction}
Return a structured architecture answer that can be directly turned into a canvas flowchart or system diagram.
Organize into clear nodes and relationships.
Label components, data flow, and dependencies.
Avoid long prose unless strictly needed.`;

    case 'diagram':
      return `${baseInstruction}
Return exactly one Mermaid diagram inside a mermaid code block.
Use graph TD unless a sequence is clearly better.
No words before or after the block.`;

    case 'summary':
      return `${baseInstruction}
Return a compact summary.
Be concise, factual, and use zero filler.
Preserve main meaning for quick understanding.`;

    case 'rewrite':
      return `${baseInstruction}
Rewrite the user's input in a better, more professional, and clearer form.
Preserve the original meaning entirely.
Do not add unrelated content.
Return ONLY the rewritten text.`;

    case 'translate':
      return `${baseInstruction}
The user message starts with "Target language:" and then the text to translate.
Return only the translation.
Preserve names, numbers, dates, URLs, and code.
Do not add a title, a note, or a second version.
If the text is already in the target language, return it unchanged.`;

    case 'email':
      return `${baseInstruction}
Draft one email from the user's notes. Return only this shape:

Subject: <one line>

<greeting>

<body in short paragraphs>

<closing>

Do not invent facts, dates, recipients, or a sender name.
If a person is named, greet them. Otherwise start with Hello.
Write in the language of the notes.
End with "Best regards" and no name, unless the notes include the sender's name.
Do not say that this is a draft. Nothing is sent.`;

    case 'plan':
      return `${baseInstruction}
Convert the input into a structured plan.
Break work into clear, numbered steps.
Identify priorities and dependencies.
Keep it execution-oriented. Do not write essays.`;

    case 'review':
      return `${baseInstruction}
Review the user's content or idea critically.
Use bullet points to highlight:
- Strengths
- Gaps / Missing elements
- Risks
Keep feedback direct, constructive, and useful.`;

    case 'bullets':
      return `${baseInstruction}
Return the answer strictly as a tight bulleted list.
Do not write introductory or concluding paragraphs.`;

    case 'table':
      return `${baseInstruction}
Return the answer strictly as a Markdown table.
Ensure column headers are clear.
Keep row text concise and readable.
Do not add text outside the table unless absolutely necessary for context.`;

    case 'image':
      return `${baseInstruction}
You are an elite AI image prompt engineer. The user will give you a basic idea.
Your job is to rewrite it into an effective, optimized image generation prompt.
CRITICAL RULES:
1. Respect the implied or requested art style. If the user asks for a cartoon, anime, or 2D character (e.g., "Shinchan"), DO NOT use words like "cinematic" or "photorealistic". Force the specific art style (e.g., "2D anime style", "vector art").
2. Keep known characters intact. Always include their exact name and iconic visual traits.
3. Optimize token usage: Keep the prompt concise (under 40 words) but highly descriptive of the subject, action, and style.
4. Output ONLY the final prompt text. No explanations. No markdown formatting.`;

    case 'research':
      return `${baseInstruction}
List relevant papers for the topic.
For each one: title, authors if you know them, year, a real link, and one sentence on what it covers.
Use links you are confident exist, such as arXiv or a publisher page. If you are not sure of a link, say the citation without a URL. Do not invent a link.`;

    default:
      return baseInstruction;
  }
}
