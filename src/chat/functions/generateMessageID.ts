/*!
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assertWid } from '../../assert';
import { getMyUserLid, getMyUserWid } from '../../conn';
import { ChatModel, MsgKey, Wid } from '../../whatsapp';
import { randomMessageId } from '../../whatsapp/functions';

/**
 * Generate a new message ID
 *
 * @category Message
 */
export async function generateMessageID(
  chat: string | ChatModel | Wid
): Promise<MsgKey> {
  let to: Wid;

  if (chat instanceof Wid) {
    to = chat;
  } else if (
    chat &&
    typeof chat === 'object' &&
    'id' in chat &&
    (chat as any).id instanceof Wid
  ) {
    console.log(
      '[wa-js DEBUG - generateMessageID] Resolvido via duck-typing (chat.id instanceof Wid):',
      (chat as any).id.toString()
    );
    to = (chat as any).id;
  } else if (chat instanceof ChatModel) {
    console.log(
      '[wa-js DEBUG - generateMessageID] Resolvido via (chat instanceof ChatModel)'
    );
    to = chat.id;
  } else {
    console.error(
      '[wa-js DEBUG - generateMessageID] Falha na validação, caindo no fallback assertWid. chat=',
      chat
    );
    to = assertWid(chat as any);
  }

  // For group messages, use LID format for both 'from' and 'participant'
  const from = to.isGroup() ? getMyUserLid() : getMyUserWid();
  const participant = to.isGroup() ? from : undefined;

  return new MsgKey({
    from,
    to,
    id: await Promise.resolve(randomMessageId()),
    participant,
    selfDir: 'out',
  });
}
