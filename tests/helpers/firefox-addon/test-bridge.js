/**
 * Test-only content script (Firefox test build). Firefox's WebDriver BiDi
 * cannot reach moz-extension:// pages, so tests talk to the add-on from a
 * youtube.com tab: the page posts `{ yteTest: { id, op, value } }` and this
 * script answers with `{ yteTestReply: id, result | error }`.
 */
window.addEventListener('message', async (event) => {
  const request = event.source === window && event.data && event.data.yteTest;
  if (!request) return;

  let reply;
  try {
    let result;
    if (request.op === 'set') result = await browser.storage.local.set(request.value);
    else if (request.op === 'get') result = await browser.storage.local.get(request.value);
    else if (request.op === 'clear') result = await browser.storage.local.clear();
    else if (request.op === 'open') result = await browser.runtime.sendMessage({ yteOpenTab: request.value });
    else if (request.op === 'close') result = await browser.runtime.sendMessage({ yteCloseTab: request.value });
    else if (request.op === 'popup') result = await browser.runtime.sendMessage({ ytePopup: request.value });
    reply = { yteTestReply: request.id, result: result === undefined ? null : result };
  } catch (error) {
    reply = { yteTestReply: request.id, error: String(error && error.message ? error.message : error) };
  }
  window.postMessage(reply, '*');
});
