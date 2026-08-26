/**
 * AI Orchestrator
 * Central entry point for all AI generation requests.
 * Coordinates provider selection, intent routing, context compression, 
 * prompt building, and fallback execution into a single clean pipeline.
 */

import { AppState, INITIAL_STATE } from '../types';
import { buildSystemInstructionForMode } from './prompts/system';
import { buildConversationContext } from './memory/context';
import { buildModeSpecificContext } from './context/compressor';
import { classifyIntent, type AIIntentMode } from './router';
import { getProvider } from './providers/registry';
import { executeWithFallback } from './fallbacks/retry';
import { AILogger } from './observability/logger';
import type { OverrideConfig } from './providers/types';
import { parseStructuredResponse } from './validation/response';
import { requiresRetrieval } from './multimodal/router';
import { retrieveContext, getAllImageContexts } from './retrieval/retriever';
import { processSlashCommand, postProcessSlashCommand } from '../chat';
import { analyzeCommandSecurity } from '../agent/securityGuard';
import { detectPlatform } from '../platform';

/**
 * Dynamically resolves all available API keys for a provider from user settings and the .env pool.
 * Discovers VITE_${PROVIDER}_API_KEY, VITE_${PROVIDER}_API_KEY_2 through _20.
 */
function resolveProviderKeyPool(
  providerId: string,
  userKey?: string,
  overrideFallbacks?: string[]
): { primaryKey: string; fallbackKeys: string[] } {
  const upper = providerId.toUpperCase();
  let env: Record<string, any> = {};
  try {
    if (typeof process !== 'undefined' && process.env) {
      env = { ...env, ...process.env };
    }
  } catch {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
      // @ts-ignore
      env = { ...env, ...import.meta.env };
    }
  } catch {}
  const pool: string[] = [];

  const addKey = (k?: string) => {
    if (k && typeof k === 'string' && k.trim() !== '' && !pool.includes(k.trim())) {
      pool.push(k.trim());
    }
  };

  // 1. User configured key takes top priority
  addKey(userKey);

  // 2. Override fallbacks if explicitly supplied
  if (overrideFallbacks && overrideFallbacks.length > 0) {
    overrideFallbacks.forEach(addKey);
  }

  // 3. Explicit Vite environment references (ensures build-time AST replacement)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (providerId === 'groq') {
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_2);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_3);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_4);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_5);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_6);
        // @ts-ignore
        addKey(import.meta.env.VITE_GROQ_API_KEY_7);
      } else if (providerId === 'google') {
        // @ts-ignore
        addKey(import.meta.env.VITE_GEMINI_API_KEY);
        // @ts-ignore
        addKey(import.meta.env.GEMINI_API_KEY);
        // @ts-ignore
        addKey(import.meta.env.VITE_GOOGLE_API_KEY);
      } else if (providerId === 'openai') {
        // @ts-ignore
        addKey(import.meta.env.VITE_OPENAI_API_KEY);
        // @ts-ignore
        addKey(import.meta.env.OPENAI_API_KEY);
      } else if (providerId === 'anthropic') {
        // @ts-ignore
        addKey(import.meta.env.VITE_ANTHROPIC_API_KEY);
        // @ts-ignore
        addKey(import.meta.env.ANTHROPIC_API_KEY);
      }
    }
  } catch {}

  // 4. Primary and Numbered .env dynamic access
  const primaryEnvNames = [
    `VITE_${upper}_API_KEY`,
    `${upper}_API_KEY`,
    providerId === 'google' ? 'VITE_GEMINI_API_KEY' : '',
    providerId === 'google' ? 'GEMINI_API_KEY' : '',
  ].filter(Boolean);

  primaryEnvNames.forEach(name => addKey(env[name]));

  for (let i = 2; i <= 20; i++) {
    const numberedNames = [
      `VITE_${upper}_API_KEY_${i}`,
      `${upper}_API_KEY_${i}`,
      providerId === 'google' ? `VITE_GEMINI_API_KEY_${i}` : '',
      providerId === 'google' ? `GEMINI_API_KEY_${i}` : '',
    ].filter(Boolean);

    numberedNames.forEach(name => addKey(env[name]));
  }

  // 5. Dynamic scan of any env var containing provider name and API_KEY
  for (const [keyName, keyVal] of Object.entries(env)) {
    if (
      typeof keyVal === 'string' &&
      keyVal.trim() !== '' &&
      keyName.includes('API_KEY') &&
      (keyName.includes(upper) || (providerId === 'google' && keyName.includes('GEMINI')))
    ) {
      addKey(keyVal);
    }
  }

  const [primaryKey, ...fallbackKeys] = pool;
  return {
    primaryKey: primaryKey || '',
    fallbackKeys: fallbackKeys || []
  };
}

/**
 * Main function to orchestrate the AI generation request.
 */
export async function generateAIResponse(
  state: AppState,
  prompt: string,
  attachments?: any[],
  useWebSearch?: boolean,
  overrideConfig?: OverrideConfig,
  isThinkingMode?: boolean
): Promise<any> {
  const config = state?.settings?.aiConfig || INITIAL_STATE.settings.aiConfig;
  
  // --- 1. Resolve Provider, Model, and API Key Pool ---
  const providerId = overrideConfig ? overrideConfig.providerId : (config.selectedProvider || 'groq');
  const validGroqModels = [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
  ];
  let model = overrideConfig ? overrideConfig.model : (config.selectedModels?.[providerId as keyof typeof config.selectedModels] || (providerId === 'groq' ? 'openai/gpt-oss-20b' : 'llama-3.3-70b-versatile'));
  if (providerId === 'groq' && !validGroqModels.includes(model)) {
    model = 'openai/gpt-oss-20b';
  }

  // Resolve full key pool (Primary + Key 2..20)
  const userProvidedKey = overrideConfig ? overrideConfig.apiKey : config.apiKeys?.[providerId as keyof typeof config.apiKeys];
  const { primaryKey: apiKey, fallbackKeys: fallbackApiKeys } = resolveProviderKeyPool(
    providerId,
    userProvidedKey,
    overrideConfig?.fallbackApiKeys
  );

  // Groq model IDs are provider-specific and must match Groq's supported names.
  if (providerId === 'groq' && (model === 'llama3-70b-8192' || model === 'llama3-8b-8192')) {
    model = 'llama-3.3-70b-versatile';
  }

  if (isThinkingMode) {
    if (providerId === 'groq') model = 'deepseek-r1-distill-llama-70b';
    else if (providerId === 'openai') model = 'o3-mini';
    else if (providerId === 'google') model = 'gemini-2.5-pro';
    else if (providerId === 'anthropic') model = 'claude-3-7-sonnet-20250219';
  }

  const { temperature, maxTokens, contextWindow } = config.parameters || INITIAL_STATE.settings.aiConfig.parameters;
  
  // The frontend toggle state:
  const isPlanModeToggle = config.isPlanMode !== false; 
  const customChatContext = config.customChatContext || '';

  const scope = overrideConfig?.isSystemScope ? 'Playground System Mode' : 'Float Runtime (User Mode)';
  AILogger.logKeyResolution(scope, providerId, !!apiKey);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`API key missing for provider: ${providerId.toUpperCase()}. Keys found: ${JSON.stringify(config.apiKeys)}. Please configure it in Settings.`);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unsupported AI Provider: ${providerId}`);
  }

  AILogger.logRequest(scope, provider.name, model);
  const startTime = Date.now();

  try {
    // --- 1.5 Intercept Slash Commands ---
    const slashResult = processSlashCommand(prompt, state);

    // --- 2. Classify Intent (Router with Fallback Keys) ---
    // Bypass intent classification for strict commands or OS Agent routing
    let mode: AIIntentMode = 'general_chat';
    if (overrideConfig?.isOsAgent) {
      mode = 'general_chat';
    } else {
      mode = slashResult.isCommand ? 'general_chat' : await classifyIntent(prompt, isPlanModeToggle, provider, { apiKey, fallbackApiKeys, model });
    }
    
    if (!slashResult.isCommand && !overrideConfig?.isOsAgent) {
      console.log(`[AI:Router] Classified intent: ${mode}`);
    }

    // --- 3. Compress Context ---
    // If it's a command, we don't need massive workspace context unless requested. We'll pass it for now just in case.
    const compressedState = buildModeSpecificContext(state, mode);

    // --- 4. Build System Instruction ---
    // Override standard conversational prompt with the strict command template
    let systemInstruction = slashResult.isCommand 
      ? slashResult.systemInstruction!
      : buildSystemInstructionForMode(state, mode, compressedState, customChatContext);
      
    if (overrideConfig?.isOsAgent) {
      systemInstruction += "\n\nCRITICAL DIRECTIVE: The user wants to execute a command on their OS (e.g. open an app, change settings, control the OS). You MUST use the `execute_os_command` tool to fulfill this request. Generate the correct PowerShell script (e.g. `Start-Process control`) and call the tool immediately. Do NOT answer conversationally.";
    }

    // --- 5. Build Conversation Context (Memory-filtered) ---
    const recentHistory = buildConversationContext(
      state.messages || [],
      config.memoryHorizonDays || 7,
      contextWindow
    );

    // Determines if the provider adapter should strictly return parsed JSON or normal text.
    // Only mutator modes generate JSON plans. Commands NEVER generate JSON plans.
    const requiresJson = slashResult.isCommand ? false : (mode === 'plan_create' || mode === 'plan_update');

    // --- Multimodal / Retrieval Injection ---
    let finalPrompt = slashResult.isCommand ? slashResult.strippedPrompt : prompt;
    let finalAttachments = attachments ? [...attachments] : [];
    
    if (true) {
      if (requiresRetrieval(prompt, state)) {
        const contextStr = retrieveContext(prompt, state, 3);
        if (contextStr) {
          finalPrompt = `${prompt}\n\n${contextStr}\n\n**Instructions:** Answer the user's query using the retrieved knowledge sources above. Cite the source names (e.g., "[Source 1: filename.pdf (Page 2)]") when providing factual answers. If the answer is not in the sources, do not make it up. Be extremely concise.`;
        }
      }

      // If we have images, inject them for vision models
      const imageContexts = getAllImageContexts(state);
      if (imageContexts.length > 0) {
        imageContexts.forEach(img => {
          if (!finalAttachments.some(a => a.name === img.name || a.data === img.data)) {
            finalAttachments.push({
              name: img.name || 'knowledge_base_image',
              mimeType: img.mimeType,
              data: img.data
            });
          }
        });
      }
    }

    // --- OS Execution Tool (Omnipotent OS Agent) ---
    const platform = detectPlatform();
    const isMac = platform === 'darwin';

    const windowsToolDesc = `Execute a PowerShell command on the user's Windows machine to control the OS, inspect system state, launch apps, write files, or automate UI tasks.
BEST PRACTICES:
(1) Windows Settings URIs:
- Sticky Keys / Keyboard: Start-Process 'ms-settings:easeofaccess-keyboard'
- Accessibility Home: Start-Process 'ms-settings:easeofaccess'
- Display / Brightness: Start-Process 'ms-settings:display'
- Sound / Volume: Start-Process 'ms-settings:sound'
- Bluetooth: Start-Process 'ms-settings:bluetooth'
- Wi-Fi: Start-Process 'ms-settings:network-wifi'
- Storage / Installed Apps: Start-Process 'ms-settings:appsfeatures'
- Windows Update: Start-Process 'ms-settings:windowsupdate'
(2) System Inspections:
- Check Pending Windows Updates:
  $session = New-Object -ComObject Microsoft.Update.Session; $searcher = $session.CreateUpdateSearcher(); $res = $searcher.Search("IsInstalled=0 and Type='Software'"); if ($res.Updates.Count -eq 0) { "Your device is up to date! No pending Windows updates." } else { "Pending updates ($($res.Updates.Count)):" ; $res.Updates | ForEach-Object { "- " + $_.Title } }
- Check Top Storage Consuming Apps / Programs:
  $apps = Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName -and $_.EstimatedSize } | Sort-Object EstimatedSize -Descending | Select-Object -First 5 -Property DisplayName, @{Name="Size(GB)";Expression={[math]::Round($_.EstimatedSize/(1024*1024), 2)}}, @{Name="Size(MB)";Expression={[math]::Round($_.EstimatedSize/1024, 2)}}; if ($apps) { $apps | Format-Table -AutoSize } else { Get-ChildItem "C:\\Program Files", "C:\\Program Files (x86)", "$env:LOCALAPPDATA\\Programs" -Directory | ForEach-Object { [PSCustomObject]@{ Name=$_.Name; SizeGB=[math]::Round(((Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1GB), 2) } } | Sort-Object SizeGB -Descending | Select-Object -First 5 | Format-Table -AutoSize }
(3) Folder Paths:
  ALWAYS use $([Environment]::GetFolderPath('Desktop')) or $([Environment]::GetFolderPath('MyDocuments')) instead of hardcoding paths.
(4) Locating Files & Finding Containing Folder:
  - Find Folder Containing a Specified File:
    $target = 'filename.ext'; $searchPaths = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments'), "$env:USERPROFILE\\Downloads"); Get-ChildItem -Path $searchPaths -Filter "*$target*" -Recurse -File -ErrorAction SilentlyContinue | Select-Object Name, @{Name="ContainingFolder";Expression={$_.DirectoryName}}, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB, 2)}}, LastWriteTime | Format-Table -AutoSize
(5) Writing Plain Text / Code Files & Updating Open Editors:
  $desktop = [Environment]::GetFolderPath('Desktop'); $filePath = Join-Path $desktop 'file.txt'; $content = @"
Content
"@; Set-Content -Path $filePath -Value $content -Encoding UTF8; $ws = New-Object -ComObject WScript.Shell; if ($ws.AppActivate('Notepad')) { Start-Sleep -Milliseconds 400; Set-Clipboard -Value $content; $ws.SendKeys('^a^v^s'); } else { Start-Process notepad.exe $filePath; }
(6) WhatsApp Web & Desktop Messaging (Direct Contact & Message Send):
  $ws = New-Object -ComObject WScript.Shell; if (-not $ws.AppActivate('WhatsApp')) { Start-Process 'https://web.whatsapp.com'; Start-Sleep -Seconds 5; $ws.AppActivate('WhatsApp'); $ws.AppActivate('Edge'); $ws.AppActivate('Chrome'); } Start-Sleep -Milliseconds 1000; $ws.SendKeys('{ESC}'); Start-Sleep -Milliseconds 300; $ws.SendKeys('{ESC}'); Start-Sleep -Milliseconds 300; $ws.SendKeys('^%n'); Start-Sleep -Milliseconds 800; $ws.SendKeys('ContactName'); Start-Sleep -Milliseconds 1500; $ws.SendKeys('{DOWN}'); Start-Sleep -Milliseconds 400; $ws.SendKeys('{ENTER}'); Start-Sleep -Milliseconds 1000; Set-Clipboard -Value 'MessageText'; $ws.SendKeys('^v'); Start-Sleep -Milliseconds 500; $ws.SendKeys('{ENTER}');
(7) Desktop & Local Folder Space & Subfolder Insights (Deep Analysis):
  $desktop = [Environment]::GetFolderPath('Desktop'); $folders = Get-ChildItem -Path $desktop -Directory -Force; $files = Get-ChildItem -Path $desktop -File -Force; "=== DESKTOP OVERVIEW ==="; "Total Top-Level Folders: " + $folders.Count; "Total Top-Level Files: " + $files.Count; ""; "=== FOLDER INSIGHTS (SUBFOLDERS, FILES & SIZE) ==="; $report = foreach ($f in $folders) { $subItems = Get-ChildItem -Path $f.FullName -Recurse -Force -ErrorAction SilentlyContinue; $subF = ($subItems | Where-Object { $_.PSIsContainer }).Count; $subFiles = ($subItems | Where-Object { -not $_.PSIsContainer }); $bytes = ($subFiles | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{ Folder=$f.Name; Subfolders=$subF; TotalFiles=$subFiles.Count; 'Size(MB)'=[math]::Round(($bytes/1MB), 2) } }; $report | Sort-Object 'Size(MB)' -Descending | Format-Table -AutoSize; ""; "=== TOP 5 LARGEST FILES ON DESKTOP ==="; Get-ChildItem -Path $desktop -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 5 -Property Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB, 2)}}, FullName | Format-Table -AutoSize
(8) Desktop File & Folder CRUD (Create, Read, Update, Move/Rename, Search):
  - Rename File/Folder: $desktop = [Environment]::GetFolderPath('Desktop'); $src = Join-Path $desktop 'OldName.ext'; $dst = 'NewName.ext'; if (Test-Path $src) { Rename-Item -Path $src -NewName $dst -Force; "Renamed to: $dst" } else { "File not found at: $src" }
  - Move File: $desktop = [Environment]::GetFolderPath('Desktop'); Move-Item -Path (Join-Path $desktop 'File.ext') -Destination (Join-Path $desktop 'TargetFolder\\') -Force; "Moved successfully."
  - Create Directory: $desktop = [Environment]::GetFolderPath('Desktop'); New-Item -ItemType Directory -Path (Join-Path $desktop 'FolderName') -Force | Out-Null; "Folder created."
  - Read/Inspect Tree: $desktop = [Environment]::GetFolderPath('Desktop'); Get-ChildItem -Path $desktop -Depth 2 | Select-Object Name, Mode, Length, LastWriteTime | Format-Table -AutoSize
  - Append Content: $desktop = [Environment]::GetFolderPath('Desktop'); Add-Content -Path (Join-Path $desktop 'file.txt') -Value 'New Content' -Encoding UTF8; "File updated."
(9) Excel Spreadsheet Automation (Live In-Place on Open Excel Window & Files):
  - LIVE Action on Currently Open Excel Window (In-Place Sorting, Formulas & Formatting):
    try { $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application'); } catch { $excel = New-Object -ComObject Excel.Application; $excel.Visible = $true; }; $wb = $excel.ActiveWorkbook; $ws = $excel.ActiveSheet; $used = $ws.UsedRange; $key = $ws.Range('A2'); $used.Sort($key, 1, $null, $null, 1, $null, 1, 1) | Out-Null; $ws.Columns.AutoFit() | Out-Null; "Active Excel sheet sorted live on screen.";
  - Calculate Average/Sum and Insert Formula Live into Active Excel Window:
    try { $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application'); } catch { $excel = New-Object -ComObject Excel.Application; $excel.Visible = $true; }; $ws = $excel.ActiveSheet; $lastRow = $ws.UsedRange.Rows.Count + 1; $ws.Cells.Item($lastRow, 1) = 'Average'; $ws.Cells.Item($lastRow, 2).Formula = '=AVERAGE(B2:B' + ($lastRow - 1) + ')'; $ws.Rows.Item($lastRow).Font.Bold = $true; $ws.Columns.AutoFit() | Out-Null; "Inserted Average formula live into active sheet.";
  - Create New Styled Excel File (.xlsx):
    $desktop = [Environment]::GetFolderPath('Desktop'); $filePath = Join-Path $desktop 'Data.xlsx'; $excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false; $wb = $excel.Workbooks.Add(); $ws = $wb.Worksheets.Item(1); $ws.Cells.Item(1, 1) = 'Name'; $ws.Cells.Item(1, 2) = 'Score'; $ws.Cells.Item(2, 1) = 'Alice'; $ws.Cells.Item(2, 2) = 95; $ws.Cells.Item(3, 1) = 'Bob'; $ws.Cells.Item(3, 2) = 88; $ws.Cells.Item(4, 1) = 'Average'; $ws.Cells.Item(4, 2).Formula = '=AVERAGE(B2:B3)'; $ws.Range('A1:B1').Font.Bold = $true; $ws.Range('A1:B1').Interior.ColorIndex = 37; $ws.Columns.AutoFit() | Out-Null; $wb.SaveAs($filePath); $wb.Close(); $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null; [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null; [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null; "Excel workbook created successfully at: " + $filePath;
(10) Word Document Automation (Live In-Place on Open Word Window & Files):
  - LIVE Action on Currently Open Word Window (Append Section, Table, or Text Live):
    try { $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); } catch { $word = New-Object -ComObject Word.Application; $word.Visible = $true; }; $doc = $word.ActiveDocument; $pHead = $doc.Paragraphs.Add(); $pHead.Range.Text = 'New Section Title'; $pHead.Range.Font.Bold = $true; $pHead.Range.Font.Size = 14; $pHead.Range.InsertParagraphAfter(); $pBody = $doc.Paragraphs.Add(); $pBody.Range.Text = 'New section text added live.'; $pBody.Range.InsertParagraphAfter(); "Appended section live into active Word document.";
  - LIVE Insert Table into Active Word Window:
    try { $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); } catch { $word = New-Object -ComObject Word.Application; $word.Visible = $true; }; $doc = $word.ActiveDocument; $tRange = $doc.Paragraphs.Add().Range; $table = $doc.Tables.Add($tRange, 3, 2); $table.Borders.Enable = $true; $table.Cell(1, 1).Range.Text = 'Task'; $table.Cell(1, 2).Range.Text = 'Owner'; $table.Cell(2, 1).Range.Text = 'Design'; $table.Cell(2, 2).Range.Text = 'Mayank'; $table.Rows.Item(1).Range.Font.Bold = $true; $table.Columns.AutoFit(); "Inserted table live into active Word document.";
  - LIVE Find and Replace in Active Word Window:
    try { $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); } catch { $word = New-Object -ComObject Word.Application; $word.Visible = $true; }; $doc = $word.ActiveDocument; $find = $doc.Content.Find; $find.Text = 'Draft'; $find.Replacement.Text = 'Approved'; $find.Forward = $true; $find.Wrap = 1; $find.Execute($find.Text, $false, $false, $false, $false, $false, $true, 1, $false, $find.Replacement.Text, 2) | Out-Null; "Replaced words live in active Word document.";`;

    const macToolDesc = `Execute a native macOS shell or AppleScript command to control the OS, inspect files, open apps, or automate tasks.
BEST PRACTICES FOR MACOS:
(1) Launching / Activating Apps:
- Open App: open -a "Safari" (or "Visual Studio Code", "System Settings", "Finder", "Terminal", "Spotify", "Notes", "Calculator")
- Open URL: open "https://github.com"
- Open Settings: osascript -e 'tell application "System Settings" to activate'
(2) Files & Folders:
- Paths: Always target ~/Desktop, ~/Documents, or ~/Downloads
- Create File: echo "content" > ~/Desktop/notes.txt
- Create Folder: mkdir -p ~/Desktop/NewFolder
- List / Tree: ls -lah ~/Desktop
- Top Space Hogs: du -sh ~/Desktop/* | sort -hr | head -n 5
- Find File: mdfind -name "target.txt"
(3) AppleScript Automation:
- Activate Window: osascript -e 'tell application "Notes" to activate'
- System Notification: osascript -e 'display notification "Task Complete" with title "FloatGPT"'`;

    const tools = typeof window !== 'undefined' && (window as any).electronAPI ? [
      {
        name: "execute_os_command",
        description: isMac ? macToolDesc : windowsToolDesc,
        parameters: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description: isMac ? "The shell command or AppleScript to execute on macOS." : "The raw PowerShell script to execute on Windows."
            }
          },
          required: ["script"]
        }
      }
    ] : [];

    // --- 6. Execute with Fallback ---
    // In plan creation/mutation modes, strictly disable OS tools and enforce structured JSON generation.
    const isPlanMutatorMode = mode === 'plan_create' || mode === 'plan_update';
    const toolList = (slashResult.isCommand || isPlanMutatorMode) ? undefined : tools;
    
    // Allocate sufficient tokens for comprehensive plans (minimum 4096)
    const effectiveMaxTokens = isPlanMutatorMode ? Math.max(maxTokens || 4096, 4096) : maxTokens;
    
    const result = await executeWithFallback(
      provider,
      [], // No automatic fallback to different providers right now
      {
        apiKey,
        fallbackApiKeys,
        model,
        systemInstruction,
        history: recentHistory,
        prompt: finalPrompt,
        // Strict deterministic temperature for commands, otherwise mode-based
        temperature: slashResult.isCommand ? 0.2 : (requiresJson ? temperature : 0.7), 
        maxTokens: effectiveMaxTokens,
        isPlanMode: requiresJson, // Strictly enforce JSON mode for all plan mutations
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        useWebSearch: useWebSearch || (slashResult.isCommand && slashResult.command === 'research'),
        tools: toolList 
      },
      2 // maxRetries on transient errors
    );

    // If the AI decided to call a tool, execute it securely through the Multi-Tiered Security Guard
    if (result.isToolCall && result.toolName === 'execute_os_command') {
      let script = result.toolArgs?.script || '';
      const scriptLang = isMac ? 'bash' : 'powershell';
      
      // Auto-repair common trailing syntax cutoffs or missing parentheses in SendKeys method calls
      script = script.replace(/SendKeys\((['"][^'"]*['"])\s*;/g, 'SendKeys($1);');
      
      const analysis = analyzeCommandSecurity(script);

      // Tier 3: Catastrophic / Malicious -> Strictly Blocked
      if (analysis.riskLevel === 'BLOCKED') {
        return { 
          message: `🛡️ **Security Alert: Execution Blocked**\n\nFloatGPT's Security Firewall detected a potentially catastrophic or restricted system operation:\n\n> **Category:** ${analysis.category}\n> **Reason:** ${analysis.reason}\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`\n\nFor system protection, this command cannot be executed automatically.` 
        };
      }

      // Tier 2: Sensitive / Destructive -> Requires Explicit User Confirmation
      if (analysis.riskLevel === 'REQUIRES_CONFIRMATION') {
        const securityPayload = JSON.stringify({
          category: analysis.category,
          reason: analysis.reason,
          script: analysis.script
        });
        return {
          message: `🛡️ **Security Firewall Notice**\n\nFloatGPT detected an operation that modifies or deletes system resources:\n\n<!-- SECURITY_PROMPT_CARD: ${securityPayload} -->`
        };
      }

      // Tier 1: Safe & Benign -> Execute instantly in 1 go!
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        AILogger.logSuccess(provider.id, Date.now() - startTime);
        
        const executionResult = await (window as any).electronAPI.flow.executeScript(script);
        
        if (executionResult.success) {
          return { message: `Executed command successfully.\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`\n\nOutput:\n\`\`\`\n${executionResult.output || 'No output'}\n\`\`\`` };
        } else {
          return { message: `Failed to execute command:\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`\n\nError:\n\`\`\`\n${executionResult.output}\n\`\`\`` };
        }
      }
    }

    if (slashResult.isCommand && slashResult.command) {
      result.message = postProcessSlashCommand(slashResult.command, result.message);
    }

    AILogger.logSuccess(provider.id, Date.now() - startTime);
    return result;
  } catch (error: any) {
    AILogger.logFailure(provider.id, error.message, false);
    throw new Error(error.message || "Failed to generate AI response.");
  }
}
