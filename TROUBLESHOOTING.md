# Troubleshooting File Sending Issues

This document outlines potential issues and debugging steps when messages with files are not being sent.

## Overview

Sending file messages in `wa-js` relies on `src/chat/functions/sendFileMessage.ts` which uses `MediaPrep` (a wrapper around WhatsApp's internal `MediaPrep` module). If this process fails, it can manifest as the script hanging or the message simply not appearing.

## Potential Causes

### 1. `MediaPrep` Module Failure
The `MediaPrep` module is critical for preparing media (images, videos, audio) before sending. If WhatsApp updates its internal code structure, the `MediaPrep` module might not be found or its methods (`sendToChat`) might change signature.

- **Symptom:** The function `WPP.chat.sendFileMessage` throws an error like `Cannot read properties of undefined (reading 'prepRawMedia')` or hangs.
- **Location:** `src/whatsapp/misc/MediaPrep.ts` looks for `m.uploadProductImage && m.MediaPrep`. If these are no longer in the same module, `MediaPrep` will be undefined.

### 2. `productMsgOptions` Property Rename
Internally, `wa-js` passes message options (like caption, footer, and the message ID itself) via a property named `productMsgOptions` to `MediaPrep.sendToChat`.

- **Symptom:** The message sends but without a caption, or as the wrong type, or validation fails silently.
- **Reason:** This property name is specific to Catalog/Product messages but has been used for general file messages. If WhatsApp renames this internal property (e.g., to `msgOptions` or `message`), the options will be ignored.

### 3. Message ID Mismatch (Hanging)
`wa-js` generates a message ID before sending (`prepareRawMessage`). It then waits for a message with that specific ID to appear in the chat (`chat.msgs.on('add')`).

- **Symptom:** The script hangs indefinitely at `await new Promise(...)` in `sendFileMessage.ts`.
- **Reason:** If WhatsApp's `sendToChat` ignores the provided ID in `productMsgOptions` and generates a new one, `wa-js` will never see the expected ID and will wait forever.

### 4. `OpaqueData` Creation Failure
`OpaqueData` wraps the file content (Blob/File).

- **Symptom:** Failure during `convertToFile` or `OpaqueData.createFromData`.
- **Reason:** Environment issues (e.g., missing Blob polyfill in Node.js/Puppeteer) or invalid Base64/URL.

## Debugging Steps

To diagnose the issue, you can try the following:

1.  **Enable Debug Logs:**
    Set `localStorage.debug = 'WA-JS:message,WA-JS:whatsapp'` in the browser console to see detailed logs.

2.  **Check `MediaPrep` Availability:**
    Run this in the browser console:
    ```javascript
    WPP.whatsapp.MediaPrep
    ```
    If it returns `undefined`, the module export is broken.

3.  **Trace `sendToChat`:**
    You can try to monkey-patch `MediaPrep.sendToChat` to see what it receives and returns:
    ```javascript
    const originalSend = WPP.whatsapp.MediaPrep.prototype.sendToChat;
    WPP.whatsapp.MediaPrep.prototype.sendToChat = function(...args) {
        console.log('sendToChat called with:', args);
        return originalSend.apply(this, args);
    };
    ```

4.  **Verify Message ID:**
    If the script hangs, check the network tab or the chat to see if the message *was* sent. If it was, check its ID. If the ID is different from what `wa-js` generated (visible in debug logs), then the ID mismatch hypothesis is correct.

## Potential Fixes

-   **Update Selectors:** If `MediaPrep` is missing, `src/whatsapp/misc/MediaPrep.ts` needs to be updated with a new search condition.
-   **Update Property Names:** If `productMsgOptions` is ignored, we might need to find the new property name by inspecting the `MediaPrep` code source (via `WPP.webpack.moduleSource`).
-   **Fallback to `sendRawMessage`:** If `MediaPrep` is too unstable, we might need to explore constructing the `MediaData` manually and using `WPP.chat.sendRawMessage`, though this is complex.
