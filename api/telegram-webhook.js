
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Метод не поддерживается" });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!token || !chatId || !webhookSecret || !supabaseUrl || !supabaseKey) {
        console.error("Не настроены переменные Telegram или Supabase");
        return res.status(500).json({ error: "Сервер не настроен" });
    }

    // Проверяем секрет, чтобы посторонние не могли управлять заявками.
    if (req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret) {
        return res.status(401).json({ error: "Не авторизовано" });
    }

    
    const callback = req.body?.callback_query;
    const incomingMessage = req.body?.message;

    // Обрабатываем команду /start.
    if (incomingMessage?.text?.startsWith("/start")) {
        const telegramUrl = `https://api.telegram.org/bot${token}/`;

        const welcomeText =
            "🧠 ПСИХОЛОГ МАКСИМ ТАРАСОВ\n\n" +
            "Здравствуйте! Рад приветствовать вас.\n\n" +
            "Иногда разобраться в своих чувствах, переживаниях и жизненных ситуациях непросто. На консультации мы сможем спокойно обсудить то, что вас беспокоит, и поискать подходящие именно вам решения.\n\n" +
            "Здесь вы можете узнать о консультациях и оставить заявку на встречу.\n\n" +
            "🤍 Первый шаг к изменениям начинается с заботы о себе.\n\n" +
            "Буду рад знакомству!";

        const photoUrl = "https://psychologytarasovmaxim.vercel.app/assets/portrait.webp";

        const result = await fetch(`${telegramUrl}sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: incomingMessage.chat.id,
                photo: photoUrl,
                caption: welcomeText,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Записаться на консультацию",
                                web_app: {
                                    url: "https://psychologytarasovmaxim.vercel.app/"
                                }
                            }
                        ]
                    ]
                }
            })
        });

        if (!result.ok) {
            console.error("Ошибка приветствия Telegram:", await result.text());
        }

        return res.status(200).json({ ok: true });
    }

    // Другие сообщения не обрабатываем.
    // Существующая обработка кнопок подтверждения сохраняется.
    if (!callback) {
        return res.status(200).json({ ok: true });
    }

    const message = callback.message;
    const data = callback.data || "";

    if (
        !message ||
        String(message.chat?.id) !== String(chatId) ||
        !/^appointment:(confirm|reject):[0-9a-f-]{36}$/i.test(data)
    ) {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callback.id,
                text: "Не удалось обработать эту кнопку."
            })
        });

        return res.status(200).json({ ok: true });
    }

    const [, action, appointmentId] = data.match(
        /^appointment:(confirm|reject):([0-9a-f-]{36})$/i
    );

    const newStatus = action === "confirm" ? "confirmed" : "rejected";
    const statusText = action === "confirm"
        ? "✅ Запись подтверждена"
        : "❌ Запись отклонена";

    try {
        const baseUrl = supabaseUrl
            .replace(/\/rest\/v1\/?$/, "")
            .replace(/\/$/, "");

        const dbResponse = await fetch(
            `${baseUrl}/rest/v1/appointments?id=eq.${appointmentId}&status=eq.pending`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Prefer: "return=representation"
                },
                body: JSON.stringify({ status: newStatus })
            }
        );

        if (!dbResponse.ok) {
            console.error("Ошибка обновления заявки:", await dbResponse.text());
            throw new Error("Не удалось обновить статус заявки");
        }

        const updated = await dbResponse.json();

        const telegramUrl = `https://api.telegram.org/bot${token}/`;

        if (updated.length === 0) {
            await fetch(`${telegramUrl}answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    callback_query_id: callback.id,
                    text: "Заявка уже обработана или не найдена."
                })
            });

            return res.status(200).json({ ok: true });
        }

        // Убираем кнопки после принятия решения.
        await fetch(`${telegramUrl}editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: message.chat.id,
                message_id: message.message_id,
                text: `${message.text || "Заявка"}\n\n${statusText}`,
                reply_markup: { inline_keyboard: [] }
            })
        });

        await fetch(`${telegramUrl}answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callback.id,
                text: statusText
            })
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Ошибка обработки кнопки:", error);
        return res.status(500).json({ error: "Не удалось обработать заявку" });
    }
}