/**
 * Test-only script appended to popup.html in the Firefox test build. It plays
 * the user's part inside the real popup (clicks, slider drags, key presses)
 * when asked over runtime messaging, and reports what the popup shows.
 */
browser.runtime.onMessage.addListener((message) => {
  const action = message && message.ytePopup;
  if (!action) return undefined;

  const node = action.selector ? document.querySelector(action.selector) : null;
  switch (action.type) {
    case 'ready':
      return Promise.resolve(!!document.querySelector('.lang-btn.active'));
    case 'click':
      node.click();
      return Promise.resolve(true);
    case 'slide':
      node.value = String(action.value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
      return Promise.resolve(true);
    case 'key':
      window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true }, action.init)));
      return Promise.resolve(true);
    case 'read':
      return Promise.resolve(
        node
          ? {
              text: node.textContent,
              value: node.value,
              checked: node.checked,
              disabled: node.disabled,
              className: node.className
            }
          : null
      );
    default:
      return Promise.resolve(null);
  }
});
