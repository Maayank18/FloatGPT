# FloatGPT interview booklet

How to use this: read the short answer out loud. The line under it is only if they say “go one level deeper.” Do not recite file names unless they ask to see the code.

Do not claim these, even if a keyword sounds impressive: NVIDIA NeMo, Parakeet, LangChain, Pinecone, a vector database, Redis, Kubernetes, AWS, or “I run it on Ollama.” Ollama is an unused option in the code. You do not use it.

---

## How to start

**What did you build, in one sentence?**

FloatGPT is a hybrid desktop and web companion. On the laptop it can open apps, check the machine, listen, and read a PDF you gave it. In the browser it is a second place to chat, and that chat never erases the desktop chat.

**Say a little more.**

Most assistants only talk. This one also does the small jobs on your computer without calling an AI model, because those jobs are predictable. When the question really needs language, it calls Gemini, OpenAI, Groq, or Anthropic. If one key is rate-limited, it tries another. If you attach a PDF, you can ask about it later in the same chat, and the chat remembers what you already said.

**Why should I care?**

The hard part was not putting a chat box on screen. The hard part was deciding what must never go to a model, what must never be deleted by sync, and what must never be invented when the answer is sitting in a PDF.

**What did you own?**

I owned the path from a sentence to an action or an answer: understanding casual English and Hinglish, running local tasks, choosing a model safely, keeping the conversation, and keeping uploaded files on the device.

---

## The product

**Who is it for?**

One person on their own laptop. It is a personal companion, not a company product with teams and roles.

**What can a person actually do with it?**

They can ask it to open Settings, Chrome, YouTube, or Notepad. They can ask how much RAM is in use and get a real number. They can hold a button and talk. They can ask what is on the screen. They can drop a PDF and ask questions about it later. They can also use the browser version for a separate conversation.

**What can it not do?**

It cannot see the screen unless you ask. It cannot read a scanned photo of a PDF. It does not wake up when you say a magic phrase. It does not run a private model on the laptop. It is not built for millions of users.

**Why “hybrid desktop and web”?**

The desktop app can touch the operating system. A website cannot open Settings or read RAM. The website is still useful for a normal chat. So there are two doors into one product, with two separate conversations.

**What is the orb?**

A small round window that stays above other apps. You click it to open the chat. It is the desktop face of FloatGPT.

**What is the Playground?**

The browser face. Same kind of assistant, its own message history. Closing a chat on the website does not wipe the chat on the orb.

**Why an orb and not a normal window?**

People wanted something that stays out of the way and is one click away, like a companion sitting on the desktop, not another full app they have to find in the taskbar.

**What happens if they open FloatGPT twice?**

The second copy quits. One instance is enough, and two copies would fight over the same saved state.

---

## A single message, simply

**What happens when I press send?**

The message is saved first. The box locks so you cannot send a second question on top of the first. The app then asks, in order: is this a form, is this about the screen, is this a simple computer task, is this an operating-system command? If yes, it does that and stops. If no, it calls a model, with the recent chat and any relevant PDF pages attached. When the answer arrives, it is saved in the same chat. If you hit Cancel, a late answer is thrown away.

**Why save the message before the answer exists?**

If the app closes mid-request, your question is still there.

**Why lock the input?**

A second question sent while the first is running used to look like the app was idle. People stacked requests and got confused. Now Send becomes Cancel until the reply finishes.

**Why try local rules before the model?**

“Open settings” has one correct result. A model might describe how to open Settings, or print a script, or refuse. A direct action is faster, free, and reliable.

---

## Why this project exists

**Why not just use ChatGPT?**

ChatGPT does not live on the desktop, does not open your apps, and does not know your RAM this second. I wanted those jobs and a normal conversation in one place.

**What problem were you actually solving?**

People phrase the same request in many ways, including Hinglish. The product used to miss those, show a script instead of doing the task, or forget the chat and the PDF. I made the common path boring and dependable.

**What was the first version missing?**

It talked well and acted poorly. Polite sentences, typos, and Hindi-English mixes fell through to the model. The model then wrote instructions instead of doing the work.

**How is this different from a wrapper around an API?**

A wrapper forwards every sentence to a model. Here a large set of sentences never reach a model. The model is the fallback, not the product.

---

## Architecture in plain words

**How is the app split?**

Think of three rooms.

The desktop shell owns the window, the hotkey, screenshots, sound, and anything that touches Windows or macOS. The screen you see is a React app. A thin bridge sits between them so the screen can ask for “open Settings” without getting full access to the computer. A small server exists for the website side.

**Why not put everything in the web page?**

A web page is not allowed to run PowerShell, read system memory, or capture the desktop. Those stay in the desktop shell.

**What is that bridge?**

The page gets a short list of allowed requests, like “open this app” or “read RAM.” It does not get a general power to touch any file.

**Where does data live while you are using it?**

In memory, in a simple store the screen can read. Every change is also written to a local database in the browser, IndexedDB, so a restart does not start from zero.

**Where does the cloud fit?**

Firebase Firestore is a backup and a way to share things like tasks. It is not the first place the app reads. The app works from the local copy first.

**What language is the project?**

TypeScript for the app logic, JavaScript for the desktop shell, because that is how Electron is usually wired. The two meet at a typed list of bridge methods.

**Why TypeScript?**

A mistake in the shape of a message, a file, or a model request is easy to ship. TypeScript catches those before you run the app.

---

## Tech choices, one by one

**Why Electron?**

I needed a real desktop window, a tray, a global shortcut, and operating-system access, with a React screen. Electron gives all of that. The downside is it uses more memory, and the orb can cover the screen you are trying to capture. I hide it before a screenshot.

**Why not a Chrome extension?**

An extension cannot be a reliable always-on-top companion with a tray and system scripts.

**Why not Tauri?**

Tauri is lighter. This screen was already React, and the desktop work is ordinary Node. Switching shells would not have made the product better.

**Why React?**

The chat, settings, and panels are a normal interface. React is what I already build those in. The version in the project is React 19.

**Why Vite?**

It starts the screen quickly in development. Electron waits until that screen is up, then opens the window.

**Why Tailwind?**

Fast, consistent styling. The look is quiet on purpose. Bright red is only for a real warning, not for decoration.

**Why Zustand?**

The whole app state is one object that must be saved often. Zustand lets me update that object without a lot of ceremony. Redux would not change the hard part, which is saving and merging.

**Why Express?**

The website side needs a small backend to accept a prompt and return an answer. Express is enough. I did not need a large framework.

**Why WebSocket and also Socket.IO on the resume?**

FloatGPT’s own server uses WebSockets. Socket.IO is from CodeArena, the other project, for live competition updates. They solve a similar problem in two products. I can explain the difference: WebSocket is the pipe, Socket.IO is a library on top of that idea.

**Why Zod?**

The website sends a chunk of state to the server. Zod checks that the body looks right before any AI code runs. Bad input fails early.

**Why Firebase?**

One user, already a natural fit for login and a cloud document. I did not want to run a database server for a desktop companion.

**Why IndexedDB?**

It is already on the machine, it is fast, and it works offline. The app reads this first.

**Why not Postgres or MongoDB for FloatGPT?**

Those are right when many users share one server. FloatGPT’s chat and PDFs belong to one device. MongoDB is in CodeArena, not in this product. I do not pretend one database served both.

**Why not Redis?**

Nothing here needs a separate cache server. The speech cache is a small list in memory. Saying Redis would be a lie.

**Why four model providers?**

Keys get rate-limited, especially on fast cheap tiers. Gemini and OpenAI can look at a screenshot. Groq is quick for text. Anthropic is another text option. If the chosen one has no working key, the app can move to another that does.

**Why not Ollama?**

A local model sounds good and then needs a heavy install, a GPU story, and worse quality on the same prompts. I left a door in the code and did not ship the product through it. I do not put it on the resume.

**Why not LangChain?**

The risky part is the computer, not the prompt library. I wanted to see, in one place, “this sentence opens Settings, this sentence goes to a model.” A big framework hides that.

**Why not a vector database?**

The files are small, and the important facts are exact: a company, a year, a score, a page. A vector search can “feel” related and still invent a nearby number. I cut the PDF into sections and search for the words you used. I will add vectors only if the library gets large. Until then, exact wording matters more than a clever index.

**Why pdf.js?**

It reads real text from a PDF in the browser and the desktop app. I do not upload the file to a third-party parser.

---

## Understanding what you said

**How do you handle messy English?**

Before any decision, the sentence is cleaned. “Could you please opn the settigns app for me” becomes close to “open settings.” Typos I actually saw are corrected. Polite padding is removed. The meaning is left alone.

**What about Hinglish?**

Words like “kholdo”, “aap”, “merko”, and “batao” are treated as fillers or as the verb “open,” so “setting kholdo” and “open settings” hit the same action.

**Did you train a language model for that?**

No. It is a careful cleanup plus rules. Training a model to open Settings would be slower and less predictable.

**How do you avoid doing the wrong thing?**

“Help me design a marketing strategy” does not name an app, so it stays a conversation. “What app is using the most RAM” used to be misread as WhatsApp, because “what app” was a shortcut for WhatsApp. I narrowed that shortcut. It is now a question about memory, not a message to send.

**What if two meanings are possible?**

Local actions are strict. If the sentence is not clearly a known app, a known site, a file, a screen question, or a machine question, it goes to the model. I would rather chat than open the wrong program.

---

## Doing things on the computer

**How does “open settings” work?**

It is recognized as a local action and the desktop shell opens the Windows Settings link. If that fails, it tries File Explorer. You see Settings open. You do not see a script.

**What else opens the same way?**

Known apps such as Chrome, Edge, Notepad, Calculator, and VS Code, and known sites such as YouTube, GitHub, and LinkedIn.

**How do you create a file?**

Only simple text files, and only on the Desktop or in Documents. The app then shows the file in Explorer. It will not write to a random folder.

**How do you answer “how much RAM is used”?**

The desktop shell asks the operating system for total memory and free memory, then the reply is a normal sentence with gigabytes. It is not a copied diagnostic script.

**What about battery, CPU, and “which app is heavy”?**

Those are the same idea. A local check, then a plain answer. Task Manager can be opened if that is what you asked.

**What about pause, play, and volume?**

Media keys. The app sends the same kind of key the keyboard would send. It does not need to know whether YouTube or Spotify is open.

**Can the model still run a script?**

Only if the sentence was not already handled, and only after a safety check. Dangerous commands are refused. The user can run those by hand if they really want to.

**What is dangerous?**

Deleting system folders, turning off antivirus, changing the registry, and broad delete commands. Hiding the word “delete” with special characters still gets caught, because those characters are removed before the check.

**Why did Settings once say “not permitted”?**

An old allow-list forgot “open app,” so a correct request was blocked. Opening apps is now always allowed. The safety check remains for destructive commands. I removed the permission switches so a normal person is not asked to enable Calculator.

**What if the model prints a script anyway?**

If the reply is clearly just “open Settings” written as a command, the app runs it instead of showing it. If the reply is a memory dump, the app throws it away and answers with the live number.

---

## Screen

**Can it see my screen all the time?**

No. Only when you ask what is on the screen. There is no background recording.

**How does it look?**

It hides itself first, so the picture is not a photo of FloatGPT. It asks the system which windows are open, and it can attach a screenshot for models that accept images.

**Why did it used to say you were inside FloatGPT, or inside a tiny YouTube window?**

The orb sits on top of everything, so the first picture was the assistant. Also, Cursor’s window title contains the project name “FloatGPT,” so the editor was mistaken for the orb. The fix was to ignore the assistant window, and to treat a large Cursor or VS Code window as the app you are actually using.

**Why not install a special “read the active window” package?**

The popular ones need a native build. The Windows installer is set not to rebuild native modules, so that package would break the app. The tools Electron already has were enough.

**What if the model cannot look at images?**

You still get the window titles. I would rather say “you are in Cursor” from a real title than invent a description of pixels I did not send.

**Do you skip private windows?**

Titles that look like passwords, bank logins, or one-time codes are treated as sensitive and not described.

---

## Voice

**How do I talk to it?**

Click the microphone, or right-click and hold the orb. It does not listen in the background.

**Why no wake word?**

A wake word means the mic is always on. It also hears the assistant’s own voice. Push to talk is clearer and safer on a laptop.

**What turns speech into text?**

While you speak, the browser’s speech recognition shows a live draft. The recording is then sent to Whisper, through Groq or OpenAI, using the same kind of API key as the chat. If Whisper fails, the live draft is kept.

**What turns text into speech?**

A neural voice from Microsoft Edge, inside the desktop app, with no extra API key. If the machine is offline, it falls back to the normal Windows or macOS voice. A new answer stops the old one. Links, markdown, and emoji are not read aloud as symbols.

**Why Edge for the voice and Whisper for the ear?**

Listening needs a strong speech model, so Whisper. Speaking can be excellent without spending the model keys. Edge is free and good enough.

---

## PDFs and later questions

**What happens when I add a PDF?**

A chip shows up immediately so you can see it is working. The file is read on your machine. The text is split into sections, roughly a page at a time, with a little overlap so a sentence on the edge is not cut in half. The chip then says ready. From then on, questions in that chat can use it.

**How do you keep headings and bullets?**

PDF text arrives as scattered pieces with positions. I group pieces that sit on the same line, then order the lines from top to bottom. That keeps “Experience” and the job under it from becoming one long smear.

**What if the PDF is a scan or a picture?**

If almost no real text comes out, the chip shows an error. I do not pretend the filename is the document. I do not run OCR.

**How many pages?**

About sixty, and a size cap so a huge file cannot fill the local database. For a resume or a normal notes PDF, that is enough.

**How does a later question find the right part?**

Common words like “what” and “is” are ignored. The remaining words are matched against the sections. A question about a company should hit the experience section, not only the first paragraph. Very broad questions, like “summarize this,” sample the start, middle, and end so one section does not dominate.

**What does the model see?**

The start of the file, a handful of matching sections, and the page number. It is told to use only that text, to name the page, and to say when the file does not contain the answer.

**Why not dump the whole PDF into the prompt?**

Long files blow the limit and the cost, and models skip the middle. Sections keep the relevant page and leave the rest out.

**Does “open settings” search the PDF?**

No. Computer tasks skip the document. Otherwise a resume would get in the way of opening an app.

**Does a follow-up like “what about the dates?” work?**

The recent chat is included in the search, so “dates” is understood next to whatever you just asked about the file.

**Why did an old resume keep coming back after I closed it?**

It was saved with the app. Closing the chip updated the screen, then an older save or a cloud copy put it back. Now only files you chose to keep are restored. A closed file is remembered as closed. The cloud is not allowed to restore documents. The save always writes the newest copy, not an older one that still had the file.

**Where do PDFs live?**

On the device. They are not part of the cloud backup.

**Is this “RAG”?**

Yes, in the plain sense: find the relevant pieces, then let the model answer from those pieces. It is not vector search. If someone asks for the embedding model, say you do not use one, and explain why exact facts mattered more.

---

## Remembering the chat

**Does it remember earlier messages?**

Yes, inside that chat. Recent messages are sent in fairly full form. Older ones in the same chat are shortened to a line each and marked as earlier context. The model is told it is continuing the same conversation and should not ask you to repeat yourself.

**How far back?**

About the last dozen to two dozen messages in full, and a week of history. A message from months ago is not dragged in.

**Why shorten the old part?**

Sending every word of a long chat hits rate limits and makes answers worse. The short lines keep the facts. The latest reply stays long enough to be useful.

**Do the desktop chat and the website chat share messages?**

No. They share the idea of memory, not the transcript. A website session must not erase the desktop session.

**What is left out of memory on purpose?**

Huge images, and junk like a QR-code instruction, are replaced with a short note so they do not eat the whole request.

**Why did it used to forget?**

Only a few short messages were sent. A long chat lost its beginning. That limit is gone.

**Does a screen question include the whole chat?**

No. The question is about what is in front of you, and a screenshot is already large. History is skipped there so the model looks at the screen, not at an old topic.

---

## Saving and sync

**What is local-first?**

The app reads and writes the copy on the machine first. The cloud update happens after, in the background. If the cloud is slow or down, the chat is already saved locally.

**What goes to the cloud?**

Things like tasks and settings, not your API keys, and not the text of your PDFs.

**What must the cloud never overwrite?**

The desktop transcript, the website transcript, the files you loaded, and the list of files you removed. A completed task also cannot become incomplete just because an older cloud copy said so.

**Why those rules?**

Two screens were saving one blob. The last save won, and it deleted the other conversation. Splitting the transcripts fixed that. Files stay local for the same reason: the device you removed a PDF on should stay removed.

**What if both sides edited tasks?**

Shared items such as tasks can come from the cloud. The chat cannot. Completed work stays completed.

---

## Models, keys, and failure

**How is a model chosen?**

You pick a provider in settings. The app uses that one if it has a working key. If the key is missing, it can switch to another provider that has a key.

**What if the key is rate-limited?**

That key waits. The next request uses another key in the pool. Pasting several keys into the settings field works. A wrong or dead key is remembered so it is not hammered. If the model name itself does not exist, switching keys would not help, so it does not.

**Why a pool?**

Free and cheap tiers limit you per key. Several keys keep a personal tool usable.

**Do you log the key?**

No. Logs can say that a key was found, not the key itself.

**What leaves the laptop when you chat?**

The question, the recent chat, and any PDF excerpts needed for that question, sent to the provider you chose. The PDF file itself is not uploaded as a file. A screenshot is sent only for a screen question, and only to a provider that can see images.

---

## The screen you use

**What do you see while it works?**

The input locks, a bar moves, and the label says what it is doing, such as reading the screen or checking the PC. Send turns into Cancel.

**What is the default mode?**

A normal conversation. There is a plan mode for structured tasks, but the app no longer opens in that mode. An old saved setting that forced plan mode is turned off once.

**Why did plan mode matter?**

Plan mode asks the model for rigid structured output. That is useful for building a task list and annoying for “what does this PDF say?” Conversation is the right default.

**Can I remove a PDF?**

Yes. The X on the chip removes it and remembers that removal. Clear is the same idea for every file.

**What does the chip mean by ready?**

The text was read and split into sections. It is available for later questions. An error chip means the file had no readable text.

---

## Safety, simply

**Can it delete my Windows folder because a model said so?**

The script is checked first. Destructive commands are blocked. You would have to run those yourself.

**Is there an emergency stop?**

Yes. A kill switch rejects new automated actions without asking a model. Cancel on the chat is separate: it drops the answer that is still in flight.

**Is there a multi-step agent behind this?**

There is a workflow runner for longer jobs: a plan, a limit on steps, a timeout, and a pause for approval. Everyday “open settings” does not go through it. I do not add the phrase “agent orchestration” to the resume, because the clearer story is the fast path plus a model with failover. If they ask, I describe the workflow runner in one sentence and stop.

**What about WhatsApp or filling forms?**

There is optional desktop help for a WhatsApp window and for forms, using details you stored locally. I do not lead with that in an interview. It is easy to misunderstand, and it is not the strongest part of the work. The strongest part is the local actions, the model failover, the PDF memory, and the sync rules.

---

## Problems I actually solved

Tell these as stories. Situation, what went wrong, what I changed.

**It answered RAM with a script.**

I asked, in Hinglish, how much RAM was in use. The English-only rule missed it, so the model printed a Windows diagnostic script. I taught the cleaner to understand that phrasing, and if a script still comes back, I replace it with the live number from the machine.

**It would not open Settings.**

Three bugs stacked. The sentence did not match, so the model printed a command. Then it matched and a permission list blocked it. Then polite or misspelled versions still missed. I made one local action for Settings, stopped gating ordinary opens, and treated a reply that is only the Settings command as something to run.

**It described the wrong window.**

It photographed itself, or a small YouTube panel, while I was in Cursor. I hide the orb, ignore its own window, and prefer the editor when that window is actually large.

**A closed PDF returned.**

The close button worked for a moment, then an old save wrote the file back. I store the removal, restore only files you kept, and never let the cloud put documents back.

**It forgot the conversation.**

Only a handful of short lines were sent. I now send a real recent window and a short reminder of what came before.

**PDF answers were vague.**

It only searched the file if you said “pdf” or “summarize,” and it cut each piece very short. A question about a score never reached the education section. Search now runs for real questions about the file, and the page is named.

**The tests crashed on the PDF reader.**

The PDF library expects a browser. Plain Node tests do not have it. I split the line-building code so tests can run without loading that library. The app still uses the real reader.

---

## Testing and quality

**How do you know it works?**

The rules are tested without opening the whole desktop app: “this sentence opens Settings,” “this sentence is not a launch,” “this RAM question is not WhatsApp,” “this PDF section is the one about the company,” “an old unpinned file does not come back,” “a removed file stays removed,” and “an early fact is still in a long chat.” The dangerous-command check is tested the same way.

**What do you not pretend to test?**

I do not claim a robot clicks through every pixel of the window. The desktop shell is checked by using it. The logic that decides what to do is checked by tests.

**What should you say about the test count?**

The project records a large suite, on the order of a few hundred tests across several files. Before the interview, run the test command and quote the number that passes that day.

**What would you add next?**

A test that opens a real sample PDF in a browser, and one automated check that Settings and RAM still work through the desktop bridge on Windows.

---

## If they go deeper

**Why hide the orb using content protection and also hide the window?**

Some capture methods still see an always-on-top window. Doing both makes the picture the desktop, not the assistant.

**Why group PDF text by position?**

Otherwise every word on the page is joined with spaces in the wrong order. Lines are what a person reads.

**Why overlap the sections?**

A fact on the boundary would be split. A small overlap keeps it in at least one section.

**Why cap chunks from the same page?**

Otherwise six excerpts all come from the longest page and you miss Education or Skills.

**Why is the opening of the file always included?**

Names and titles are often at the top, and a keyword search can miss them. The opening is a safety net. The matched sections cover the specific question.

**Why is conversational mode the default?**

Plan mode forces a structured planning answer. Most questions are not plans. The user can still turn plan mode on.

**Why debounce the cloud save but write local immediately?**

The local copy must survive a crash. The cloud copy can wait a moment so you are not uploading on every keystroke.

**Why can a completed task never revert?**

An old laptop and a new laptop synced, and a finished task looked unfinished again. Finished should stay finished.

---

## Questions that are traps

**Did you fine-tune a model?**

No. I choose when to call one, and I choose what text it is allowed to see.

**What embedding model do you use?**

None. Search is by the words in the question against the sections of the file. I can explain the tradeoff. I will not invent a model name.

**How would this scale to ten million users?**

I would not pretend it does. It is one person, one machine, with a cloud backup. The scaling problem I actually solved was rate limits and two screens writing one saved state.

**Is the PDF search semantic?**

It understands the chat around the question, and it ignores filler words. It does not use embeddings. Related words that never appear in the file can be missed. I say that plainly.

**Do you stream tokens?**

The box locks until the full answer arrives. That is simpler and honest. Streaming would feel faster and is a reasonable next step. I have not done it.

**Can it run offline?**

Local actions, saved chats, and saved PDFs work from the machine. A new model answer needs the provider. Speech can fall back to the operating system voice if Edge is unavailable. Whisper needs a network.

**Is it production?**

It is a real desktop app I run, with an installer path for Windows and macOS, not a slide. I still talk about its limits: no OCR, no vector index, no always-on microphone.

---

## What I would say if they ask “what next?”

I would add text recognition only when a scanned PDF shows up for real. I would add vector search beside the word search only when there are many documents, and I would keep the word search for exact numbers. I would not rewrite the app in a new framework to make the resume longer.

---

## Thirty-second close

FloatGPT is a hybrid desktop and web companion. Simple computer tasks run on the machine, in ordinary English or Hinglish, without a model. Real questions go to Gemini, OpenAI, Groq, or Anthropic, and a tired key fails over to another. A PDF stays on the device, is cut into sections, and later answers cite the page. The chat remembers itself. The local save is the source of truth, the cloud cannot wipe either conversation, and destructive commands are blocked. That is the system I can walk through.
