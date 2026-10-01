<div align="center">
  <img src="docs/logo.png" alt="FloatGPT" width="420" />

  <p><strong>A floating desktop assistant for Windows.</strong></p>
  <p>Ask in English or Hinglish. FloatGPT opens apps, reads this PC, and answers in the chat.</p>

  <p>
    <img src="https://img.shields.io/badge/Windows-2.2.0-1a73e8?style=flat-square" alt="Windows 2.2.0" />
    <img src="https://img.shields.io/badge/macOS%20installer-2.1.2-8e918f?style=flat-square" alt="macOS installer 2.1.2" />
  </p>
</div>

<div align="center">
  <img src="docs/showcase.png" alt="FloatGPT on the desktop" width="100%" />
</div>

If this is useful, [star the repository](https://github.com/Maayank18/FloatGPT).

## What it does

- Open apps, Settings, and files on the desktop, and read live memory, from a normal sentence.
- Name the real window behind the orb when you ask about the screen.
- Talk by holding the button. The reply is spoken back.
- Keep a PDF and ask about it later. A file you close stays closed. Each chat keeps its own thread.
- Use a cloud key, or run with no key on Qwen 3.5 9B through Ollama.

Plan mode is optional. The default is a conversation. Chats stay on the device that wrote them. An account carries plans and settings, not the chat and not the API keys.

## Get the Windows app

[Download FloatGPT.Setup.2.2.0.exe](https://github.com/Maayank18/FloatGPT/releases/download/v2.2.0/FloatGPT.Setup.2.2.0.exe)

Windows 10 or 11, 64-bit. The installer is about 100 MB. If SmartScreen warns that the app is unrecognized, choose **More info**, then **Run anyway**.

The current Mac installer remains [FloatGPT 2.1.2](https://github.com/Maayank18/FloatGPT/releases/download/v2.1.2/FloatGPT-2.1.2-arm64.dmg). This release does not replace it.

## Run it on your own PC

You need Node.js 20 or newer. For local chat with no API key, you also need [Ollama](https://ollama.com). Ollama does not need an account.

> [!NOTE]
> `npm install` installs the project packages. It does not install Ollama or the model. The model stays on disk after you close the terminal.

**Once**

```bash
git clone https://github.com/Maayank18/FloatGPT.git
cd FloatGPT
ollama pull qwen3.5:9b
npm install
```

Qwen 3.5 9B is about 6.6 GB. A PC with 8 GB of RAM can run it. 16 GB is easier.

**Every later start**

```bash
npm run dev
```

That opens the orb. With no API key, chat uses Qwen on this PC. If a cloud key is already saved, choose **On this PC** in the key menu to use the local model. Opening apps and reading this PC do not need a model.

Stop it with `Ctrl+C` in that terminal. The next start is `npm run dev` again.

## Optional cloud key

Create a `.env` file in the project root. One key is enough.

```env
VITE_GROQ_API_KEY=your_groq_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_OPENAI_API_KEY=your_openai_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
```

Groq, Gemini, OpenAI, and Anthropic are supported. Keys stay on the device where you enter them.

## Voice and safety

Voice is press or hold. There is no wake word and the microphone is not left on.

Destructive commands, including deleting system files or formatting a drive, are blocked. FloatGPT does not treat a script’s exit code as success if the screen did not change.

## Build the Windows installer

```bash
npm run pack:win
```

The installer is written to `release/` and published as `FloatGPT.Setup.2.2.0.exe`.

```bash
npm run pack:mac
```

`pack:mac` builds a Mac disk image from this tree. The published Mac installer is still the 2.1.2 image.

## License

FloatGPT is proprietary software. All rights reserved. Designed and developed by Mayank Garg.
