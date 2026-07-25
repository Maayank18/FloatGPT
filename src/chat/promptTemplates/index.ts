import { SlashCommandType } from '../commandSchemas';

export function getCommandSystemPrompt(command: SlashCommandType): string {
  const baseInstruction = "You are operating in a strict command-response mode. Do not include conversational filler, greetings, or acknowledgments. Optimize entirely for the requested format.";

  switch (command) {
    case 'one-liner':
      return `${baseInstruction}
Return exactly ONE powerful, polished, copy-paste-ready sentence.
No explanations. No markdown formatting unless it's bolding.
Concise and high-impact.`;

    case 'architecture':
      return `${baseInstruction}
Return a structured architecture answer that can be directly turned into a canvas flowchart or system diagram.
Organize into clear nodes and relationships.
Label components, data flow, and dependencies.
Avoid long prose unless strictly needed.`;

    case 'diagram':
      return `${baseInstruction}
Return a clean diagram-oriented answer using Mermaid.js syntax.
Use a simple visual structure (arrows, layers, boxes, sequence).
Do NOT include any text outside the mermaid block. Provide exactly ONE \`\`\`mermaid block.`;

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

    default:
      return baseInstruction;
  }
}
