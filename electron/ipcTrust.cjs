/** True only for the orb window's own top-level page on the app origin. */
function isTrustedIpcSender(event, mainWindow, trustedOrigin) {
  try {
    if (!event || !mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender !== mainWindow.webContents) return false;
    const frame = event.senderFrame;
    if (frame && frame.parent) return false;
    const url = (frame && frame.url) || event.sender.getURL();
    return new URL(url).origin === trustedOrigin;
  } catch {
    return false;
  }
}

module.exports = { isTrustedIpcSender };
