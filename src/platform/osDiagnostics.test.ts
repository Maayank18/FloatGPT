import { detectSystemDiagIntent, formatDiagMessage } from './osDiagnostics';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('OS diagnostics intent & formatting suite');

  // Original tests
  assert(detectSystemDiagIntent('aap merko bata sakte ho kitni RAM use ho rahi hai ?') === 'ram', 'hinglish kitni ram');
  assert(detectSystemDiagIntent('kitni ram use ho rahi hai') === 'ram', 'kitni ram');
  assert(detectSystemDiagIntent('can you tell me how much memory is being used right now') === 'ram', 'memory paraphrase');
  assert(detectSystemDiagIntent('check memory usage') === 'ram', 'memory usage');
  assert(detectSystemDiagIntent('cpu usage') === 'cpu', 'cpu');
  assert(detectSystemDiagIntent('battery percent') === 'battery', 'battery');
  assert(detectSystemDiagIntent('Help me design a marketing strategy') === null, 'not diag');
  assert(detectSystemDiagIntent('please send hi to mummy') === null, 'not ram');

  // Requirement 1: Battery Level
  assert(detectSystemDiagIntent('finding the battery level') === 'battery', 'finding the battery level');
  assert(detectSystemDiagIntent('what is my battery level') === 'battery', 'what is my battery level');
  assert(detectSystemDiagIntent('battery level') === 'battery', 'battery level');
  assert(detectSystemDiagIntent('how much battery is left') === 'battery', 'how much battery left');
  assert(detectSystemDiagIntent('check battery status') === 'battery', 'check battery status');

  // Requirement 2: Desktop Folders
  assert(detectSystemDiagIntent('how many folders are present on desktop') === 'desktop_folders', 'how many folders are present on desktop');
  assert(detectSystemDiagIntent('how many folders on my desktop') === 'desktop_folders', 'how many folders on my desktop');
  assert(detectSystemDiagIntent('count folders on desktop') === 'desktop_folders', 'count folders on desktop');
  assert(detectSystemDiagIntent('folders present on desktop') === 'desktop_folders', 'folders present on desktop');
  assert(detectSystemDiagIntent('desktop pe kitne folder hai') === 'desktop_folders', 'desktop pe kitne folder');

  // Requirement 3: Screen Recordings
  assert(detectSystemDiagIntent('how many screen recordings are there in totla') === 'screen_recordings', 'how many screen recordings are there in totla (typo-tolerant)');
  assert(detectSystemDiagIntent('how many screen recordings are there in total') === 'screen_recordings', 'how many screen recordings are there in total');
  assert(detectSystemDiagIntent('count screen recordings') === 'screen_recordings', 'count screen recordings');
  assert(detectSystemDiagIntent('screen recordings count') === 'screen_recordings', 'screen recordings count');
  assert(detectSystemDiagIntent('total screen recordings') === 'screen_recordings', 'total screen recordings');

  // Requirement 4: Which app taking too much RAM / Open task bar and check RAM
  assert(detectSystemDiagIntent('whihc app taking too much ram') === 'top_processes', 'whihc app taking too much ram (typo-tolerant)');
  assert(detectSystemDiagIntent('which app is taking too much ram') === 'top_processes', 'which app is taking too much ram');
  assert(detectSystemDiagIntent('what app is using the most ram') === 'top_processes', 'what app is using the most ram');
  assert(detectSystemDiagIntent('top ram apps') === 'top_processes', 'top ram apps');
  assert(detectSystemDiagIntent('open task bar and check how much ram is used') === 'open_taskmgr_and_ram', 'open task bar and check how much ram is used');
  assert(detectSystemDiagIntent('open task manager and check ram') === 'open_taskmgr_and_ram', 'open task manager and check ram');

  // Formatting Verifications
  const msgRam = formatDiagMessage('ram', {
    ok: true,
    ram: { totalGb: 15.7, usedGb: 12.2, freeGb: 3.5, percent: 78 }
  });
  assert(msgRam.includes('12.2'), 'formats used gb');
  assert(msgRam.includes('15.7'), 'formats total gb');

  const msgFolders = formatDiagMessage('desktop_folders', {
    ok: true,
    desktopFolders: {
      path: 'C:\\Users\\Mayank Garg\\OneDrive\\Desktop',
      count: 3,
      folders: ['AI projects', 'DSA Practice', 'Projects']
    }
  });
  assert(msgFolders.includes('3 folders'), 'formats desktop folder count');
  assert(msgFolders.includes('AI projects'), 'lists folder names');

  const flatFolders = formatDiagMessage('desktop_folders', {
    ok: true,
    path: 'C:\\Users\\Mayank Garg\\OneDrive\\Desktop',
    count: 9,
    folders: ['AI projects', 'LeetCode', 'Projects']
  });
  assert(flatFolders.includes('9 folders'), 'reads a flat desktop scan');
  assert(!flatFolders.startsWith('💻'), 'flat scan is not the generic PC line');

  const msgRecordings = formatDiagMessage('screen_recordings', {
    ok: true,
    screenRecordings: {
      count: 38,
      totalBytes: 2280000000,
      totalMb: 2174.4,
      totalGb: 2.12,
      locations: [{ dir: 'Videos\\Screen Recordings', count: 36 }, { dir: 'Videos', count: 2 }],
      recent: [{ name: 'demo.mp4', folder: 'Videos\\Screen Recordings', sizeMb: 24.5, date: '23/9/2026' }]
    }
  });
  assert(msgRecordings.includes('38 screen recordings'), 'formats screen recordings count');
  assert(msgRecordings.includes('2.12 GB'), 'formats recordings total size');
  assert(msgRecordings.includes('demo.mp4'), 'lists recent recording');

  const msgProcesses = formatDiagMessage('top_processes', {
    ok: true,
    ram: { totalGb: 15.7, usedGb: 12.6, freeGb: 3.1, percent: 80.2 },
    processes: [
      { name: 'msedge', displayName: 'Microsoft Edge', instances: 14, bytes: 2600000000, mb: 2479.5 },
      { name: 'Antigravity IDE', displayName: 'Antigravity IDE', instances: 16, bytes: 2500000000, mb: 2384.1 }
    ]
  });
  assert(msgProcesses.includes('Microsoft Edge'), 'shows top process name');
  assert(msgProcesses.includes('2.42 GB') || msgProcesses.includes('2479.5 MB'), 'shows process memory');

  const msgTaskMgr = formatDiagMessage('open_taskmgr_and_ram', {
    ok: true,
    taskManagerOpened: true,
    openedAppName: 'Task Manager',
    ram: { totalGb: 15.7, usedGb: 12.6, freeGb: 3.1, percent: 80.2 },
    processes: [
      { name: 'msedge', displayName: 'Microsoft Edge', instances: 14, bytes: 2600000000, mb: 2479.5 }
    ]
  });
  assert(msgTaskMgr.includes('Task Manager') && msgTaskMgr.includes('Opened'), 'confirms task manager launch');

  const msgBattery = formatDiagMessage('battery', {
    ok: true,
    battery: { percent: 34, charging: false, status: 1, statusText: 'Discharging (On Battery)' }
  });
  assert(msgBattery.includes('34%'), 'formats battery percent');
  assert(msgBattery.includes('Discharging (On Battery)'), 'formats battery statusText');

  console.log('ALL OS DIAGNOSTIC INTENT & FORMATTING TESTS PASSED! ✅');
}
