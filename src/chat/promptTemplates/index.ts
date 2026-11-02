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
The user asked for one picture with /image. Read the request, then write one image prompt.
The picture is exactly the subject they named.
A house is a building. A bird is a bird. An animal is that animal. Food is that food. A place is that place.
Put their subject in the first words.
Add only details that make that subject clear: what it looks like, where it is, and the light.
Do not add a person, face, hands, portrait, or character unless they asked for one.
A named person, lord, god, king, or character is someone they asked for. Describe that figure.
Do not write "no people" when they named a figure.
Do not replace the subject with something else.
One line. No title and no explanation.`;

    case 'research':
      return `${baseInstruction}
This command is answered from arXiv. Do not invent a paper, an author, a year, or a link.`;

    case 'compare':
      return `${baseInstruction}
The user names two things to compare.
Return one Markdown table only.
Columns: Point, then the first thing, then the second thing.
Use 3 to 6 rows. No text before or after the table.`;

    case 'checklist':
      return `${baseInstruction}
Return only a checklist, in the order to do the work.
Each line is "- [ ] " and one short action.
5 to 8 lines. No title and no closing sentence.`;

    case 'define':
      return `${baseInstruction}
First line is one sentence that says what it is.
Then at most 3 bullets on what it is for.
No history essay. If you are not sure, say you are not sure.`;

    case 'next':
      return `${baseInstruction}
Return exactly one next action, as a single imperative sentence.
No list and no explanation.`;

    default:
      return baseInstruction;
  }
}
