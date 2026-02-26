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

2.  **Monkey-Patch `sendToChat`:**
    Run this script in the browser console to intercept the call and see what arguments are being passed:

    ```javascript
    // 1. Get the class
    const MediaPrepClass = WPP.whatsapp.MediaPrep.MediaPrep;

    // 2. Save the original function
    if (!window.originalSendToChat) {
        window.originalSendToChat = MediaPrepClass.prototype.sendToChat;
    }

    // 3. Overwrite with logging wrapper
    MediaPrepClass.prototype.sendToChat = function(...args) {
        console.log('[DEBUG] sendToChat called!');
        console.log('[DEBUG] Arguments:', args);

        // Inspect the options object specifically
        if (args[0] && args[0].options) {
             console.log('[DEBUG] Options passed:', args[0].options);
        }

        return window.originalSendToChat.apply(this, args);
    };
    console.log('Monkey-patch applied! Now try sending a file message.');
    ```

3.  **Trigger a File Send:**
    Now, try to send a file message using your usual code or a test command:
    ```javascript
    WPP.chat.sendFileMessage('123456789@c.us', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', {
        type: 'image',
        caption: 'Test'
    });
    ```

4.  **Analyze the Output:**
    *   **If `[DEBUG] sendToChat called!` does NOT appear:** The function signature might have changed so much that `sendFileMessage.ts` is failing before calling it (e.g., during `MediaPrep.prepRawMedia`).
    *   **If it appears:** Look at `[DEBUG] Options passed`.
        *   Does it contain `productMsgOptions`?
        *   Does `productMsgOptions` contain the `caption` and `id`?
    *   **Check Network/UI:** Did the message actually send?
        *   If yes, but `wa-js` hung, check the ID of the sent message in the network tab. Is it different from the one in `productMsgOptions`?

## Potential Fixes based on Findings

-   **If `productMsgOptions` is missing:** The `wa-js` code in `sendFileMessage.ts` might be failing to construct it.
-   **If `productMsgOptions` is present but ignored:** WhatsApp might have renamed this property. We would need to inspect the internal `M` function (from `promiseCallSync(M, ...)`) to see what properties it reads from the options object. This is harder as `M` is likely a minified variable.
-   **If ID is different:** The internal function is regenerating the ID. We might need to stop passing our own ID and instead capture the one returned by the function (if it returns one).
