/**
 * SSE stream parser for chunked ReadableStream.
 *
 * fetch() ReadableStream does not guarantee SSE event boundaries —
 * a single read() may contain multiple events, or one event may be
 * split across two chunks. This parser maintains a buffer to handle
 * both cases correctly.
 *
 * SSE wire format expected from the backend:
 *   event: <event-name>\n
 *   data: <json-string>\n
 *   \n
 */

interface SSEEvent {
  event: string;
  data: unknown;
}

type SSEHandler = (e: SSEEvent) => void;

export function createSSEParser(onEvent: SSEHandler): (chunk: string) => void {
  let buffer = "";
  let currentEvent = "";

  return function parse(chunk: string) {
    buffer += chunk;

    // Split on newlines but keep incomplete last line in buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trimEnd();

      if (line === "") {
        // Blank line = end of one SSE message; reset event name
        currentEvent = "";
        continue;
      }

      if (line.startsWith("event:")) {
        currentEvent = line.slice("event:".length).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        const jsonStr = line.slice("data:".length).trim();
        if (!jsonStr) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // Non-JSON data line — skip
          continue;
        }

        onEvent({ event: currentEvent, data: parsed });
      }
    }
  };
}
