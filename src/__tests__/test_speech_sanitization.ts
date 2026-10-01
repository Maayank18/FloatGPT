import { cleanForSpeech } from '../lib/speechPlayer';

const testCases = [
  {
    input: '🔋 **Battery Status (Windows Hardware):**\n• Charge: 85%\n• State: Discharging (on Battery)\n• Health: 100%\n\n*(Queried directly via ACPI/WMI power subsystem — 0 tokens used, 100% offline)*',
    mustNotContain: ['Queried directly', 'tokens used', '100% offline', 'ACPI', 'WMI', '🔋'],
    mustContain: ['Charge: 85%', 'Discharging']
  },
  {
    input: '📊 **RAM (This PC — Kernel Reading)**\n\nAbhi **8.5 GB** RAM use ho rahi hai.\n\n*(Source: Windows Memory Manager via Node `os.totalmem()`. 0 tokens used, 100% offline)*',
    mustNotContain: ['Source: Windows Memory Manager', 'os.totalmem', 'tokens used', '100% offline', '📊'],
    mustContain: ['8.5 GB', 'RAM use ho rahi hai']
  },
  {
    input: '📊 RAM (This PC — Kernel Reading) Abhi 11.5 GB RAM use ho rahi hai. Total: 15.7 GB. (Source: Windows Memory Manager via Node os.totalmem() / os.freemem(). 0 tokens used, 100% offline)',
    mustNotContain: ['os.totalmem', '0 tokens', '100% offline'],
    mustContain: ['11.5 GB', 'RAM use ho rahi hai']
  },
  {
    input: '⚡ **CPU Usage**\n\n*(Sampled from OS idle/busy counters over 150ms. 0 tokens used, 100% offline)*',
    mustNotContain: ['Sampled from', '0 tokens', 'offline', '⚡']
  },
  {
    input: 'Hello! The President of India is Droupadi Murmu.',
    mustContain: ['The President of India is Droupadi Murmu']
  }
];

let allPassed = true;
for (const tc of testCases) {
  const sanitized = cleanForSpeech(tc.input);
  if (tc.mustNotContain) {
    for (const forbidden of tc.mustNotContain) {
      if (sanitized.toLowerCase().includes(forbidden.toLowerCase())) {
        console.error(`❌ FAILED: Found forbidden substring "${forbidden}" in sanitized output:\n"${sanitized}"`);
        allPassed = false;
      }
    }
  }
  if (tc.mustContain) {
    for (const required of tc.mustContain) {
      if (!sanitized.includes(required)) {
        console.error(`❌ FAILED: Missing required substring "${required}" in sanitized output:\n"${sanitized}"`);
        allPassed = false;
      }
    }
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('✅ PASS: Speech sanitization verified (telemetry, footnotes, and emojis successfully stripped).');
}
