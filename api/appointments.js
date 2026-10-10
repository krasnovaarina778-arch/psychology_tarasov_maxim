
export default async function handler(req, res) {
    // Принимаем только POST-запросы
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Метод не поддерживается"
        });
    }

    // Секреты хранятся только на сервере
    const supabaseUrl = process.env.SUPABASE_URL;
    console.log(
        "Проверка SUPABASE_URL:",
        supabaseUrl ? new URL(supabaseUrl).origin : "URL не задан"
    );
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Не настроены переменные Supabase");

        return res.status(500).json({
            error: "Сервер пока не настроен"
        });
    }

    try {
        const {
            clientName,
            notificationMethod,
            contact,
            consultationFormat,
            service,
            comment
        } = req.body || {};

        // Проверяем обязательные поля
        if (
            typeof clientName !== "string" ||
            !clientName.trim() ||
            typeof contact !== "string" ||
            !contact.trim()
        ) {
            return res.status(400).json({
                error: "Укажи имя и контакт для связи"
            });
        }

        if (!["email", "telegram"].includes(notificationMethod)) {
            return res.status(400).json({
                error: "Выбери Email или Telegram"
            });
        }

        
        if (!["online", "offline", "unknown"].includes(consultationFormat)) {
            return res.status(400).json({
                error: "Выбери формат консультации"
            });
        }

        if (
            notificationMethod === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())
        ) {
            return res.status(400).json({
                error: "Проверь адрес электронной почты"
            });
        }

        const appointment = {
            client_name: clientName.trim().slice(0, 120),
            notification_method: notificationMethod,
            consultation_format: consultationFormat === "unknown"
                ? "Пока не знаю"
                : consultationFormat,
            contact: contact.trim().slice(0, 254),
            service: typeof service === "string"
                ? service.trim().slice(0, 200)
                : null,
            client_comment: typeof comment === "string"
                ? comment.trim().slice(0, 2000)
                : null,
            status: "pending"
        };

        const response = await fetch(
            `${supabaseUrl.replace(/\/rest\/v1\/?$/, "")}/rest/v1/appointments`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": supabaseKey,
                    "Authorization": `Bearer ${supabaseKey}`,
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(appointment)
            }
        );

        if (!response.ok) {
            const details = await response.text();
            console.error("Ошибка Supabase:", details);

            return res.status(500).json({
                error: "Не удалось сохранить заявку"
            });
        }

        const insertedAppointments = await response.json();
        const savedAppointment = insertedAppointments[0];

        if (!savedAppointment?.id) {
            console.error("Supabase не вернул ID заявки");

            return res.status(500).json({
                error: "Не удалось получить номер заявки"
            });
        }


        // Отправляем уведомление психологу в Telegram
        try {
            const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
            const telegramChatId = process.env.TELEGRAM_CHAT_ID;

            if (telegramToken && telegramChatId) {
                const message = [
                    "🔔 Новая заявка с сайта психолога!",
                    "",
                    `👤 Имя: ${appointment.client_name}`,
                    `📞 Контакт: ${appointment.contact}`,
                    `💬 Способ связи: ${appointment.notification_method}`,
                    `🖥 Формат: ${appointment.consultation_format}`,
                    `📝 Услуга: ${appointment.service || "Не указана"}`,
                    `Комментарий: ${appointment.client_comment || "Нет"}`
                ].join("\n");

                const telegramResponse = await fetch(
                    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                        chat_id: telegramChatId,
                        text: message,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✅ Подтвердить",
                                        callback_data: `appointment:confirm:${savedAppointment.id}`
                                    },
                                    {
                                        text: "❌ Отклонить",
                                        callback_data: `appointment:reject:${savedAppointment.id}`
                                    }
                                ]
                            ]
                        }
                    })
                    }
                );

                if (!telegramResponse.ok) {
                    console.error(
                        "Telegram не отправил уведомление:",
                        await telegramResponse.text()
                    );
                }
            } else {
                console.error("Не настроены переменные Telegram");
            }
        } catch (telegramError) {
            console.error("Ошибка отправки в Telegram:", telegramError);
        }

        return res.status(201).json({
            success: true,
            message: "Заявка отправлена на рассмотрение"
        });
    } catch (error) {
        console.error("Ошибка обработки заявки:", error);

        return res.status(500).json({
            error: "Произошла ошибка. Попробуй позже"
        });
    }
}