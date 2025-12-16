import * as z from "zod";
import { TELEGRAM_SECRET_KEY, TELEGRAM_CHAT_ID } from "astro:env/server";

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_SECRET_KEY}`;
const CHAT_ID = Number.parseInt(TELEGRAM_CHAT_ID);

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: "Markdown" | "HTML";
}

/**
 * Escapes special Markdown characters in Telegram messages
 * to prevent parsing errors
 */
export function escapeMarkdown(text: string): string {
  // Telegram MarkdownV2 special characters that need escaping
  // We use the simpler Markdown (v1) mode, which requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
  // For Markdown v1, we mainly need to escape _ * [ ] ( ) `
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export async function sendTelegramMessage(
  message: string,
  parseMode: "Markdown" | "HTML" = "Markdown",
  chatId: number = CHAT_ID,
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
      }),
    });

    const result = await response.json();
    const parsedResult = TelegramResponseSchema.safeParse(result);

    if (!parsedResult.success) {
      console.error("Invalid response format:", parsedResult.error);
      return false;
    }

    if (!parsedResult.data.ok) {
      console.error("Telegram API error:", {
        error_code: parsedResult.data.error_code,
        description: parsedResult.data.description,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

export async function sendTelegramSticker(
  stickerId: string,
  chatId: number = CHAT_ID,
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendSticker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        sticker: stickerId,
      }),
    });

    const result = await response.json();
    const parsedResult = TelegramResponseSchema.safeParse(result);

    if (!parsedResult.success) {
      console.error("Invalid sticker response format:", parsedResult.error);
      return false;
    }

    if (!parsedResult.data.ok) {
      console.error("Telegram API sticker error:", {
        error_code: parsedResult.data.error_code,
        description: parsedResult.data.description,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram sticker:", error);
    return false;
  }
}

// Zod schemas for Telegram API responses
const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

const TelegramChatSchema = z.object({
  id: z.number(),
  type: z.enum(["private", "group", "supergroup", "channel"]),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const TelegramMessageSchema = z.object({
  message_id: z.number(),
  from: TelegramUserSchema.optional(),
  chat: TelegramChatSchema,
  date: z.number(),
  text: z.string().optional(),
  sticker: z
    .object({
      file_id: z.string(),
      file_unique_id: z.string(),
      width: z.number(),
      height: z.number(),
      is_animated: z.boolean().optional(),
      is_video: z.boolean().optional(),
    })
    .optional(),
});

const TelegramResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    result: TelegramMessageSchema,
  }),
  z.object({
    ok: z.literal(false),
    error_code: z.number(),
    description: z.string(),
  }),
]);
