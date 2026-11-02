const assert = require('node:assert/strict');
const { isTrustedIpcSender } = require('./ipcTrust.cjs');

const origin = 'http://localhost:3000';
const mainContents = { getURL: () => 'http://localhost:3000/' };
const mainWindow = { isDestroyed: () => false, webContents: mainContents };
const topFrame = { url: 'http://localhost:3000/', parent: null };

assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: topFrame }, mainWindow, origin), true);

const popup = { getURL: () => 'https://accounts.google.com/' };
assert.equal(isTrustedIpcSender({ sender: popup, senderFrame: { url: 'https://accounts.google.com/', parent: null } }, mainWindow, origin), false, 'the Google popup is rejected');

assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: { url: 'https://evil.example/', parent: null } }, mainWindow, origin), false, 'a navigated orb page is rejected');
assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: { url: 'http://localhost:3000/', parent: topFrame } }, mainWindow, origin), false, 'an iframe is rejected');
assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: { url: 'http://localhost:3001/', parent: null } }, mainWindow, origin), false, 'another port is rejected');
assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: topFrame }, { isDestroyed: () => true, webContents: mainContents }, origin), false);
assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: topFrame }, null, origin), false);
assert.equal(isTrustedIpcSender(null, mainWindow, origin), false);
assert.equal(isTrustedIpcSender({ sender: mainContents, senderFrame: { url: 'not a url', parent: null } }, mainWindow, origin), false);

console.log('ipc trust checks passed');
