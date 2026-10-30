/**
 * Test-only background script (Firefox test build): opens and closes the
 * add-on's own pages as tabs, which content scripts cannot do themselves.
 */
browser.runtime.onMessage.addListener((message) => {
  if (message && message.yteOpenTab) {
    return browser.tabs.create({ url: message.yteOpenTab, active: false }).then((tab) => tab.id);
  }
  if (message && message.yteCloseTab) {
    return browser.tabs.remove(message.yteCloseTab).then(() => true);
  }
  return undefined;
});
