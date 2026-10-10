
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Метод не поддерживается"
        });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
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
            contact,
            comment
        } = req.body || {};

        // Проверяем имя
        if (
            typeof clientName !== "string" ||
            !clientName.trim()
        ) {
            return res.status(400).json({
                error: "Укажи своё имя"
            });
        }

        // Проверяем телефон
        if (
            typeof contact !== "string" ||
            !contact.trim()
        ) {
            return res.status(400).json({
                error: "Укажи номер телефона"
            });
        }

        const phone = contact.trim();
        const digits = phone.replace(/\D/g, "");

        if (digits.length < 10 || digits.length > 15) {
            return res.status(400).json({
                error: "Проверь номер телефона"
            });
        }

        // Подготавливаем заявку для Supabase
        const appointment = {
            client_name: clientName.trim().slice(0, 120),
            notification_method: "phone",
            consultation_format: "Пока не знаю",
            contact: phone.slice(0, 50),
            service: "Не указано",
            client_comment: typeof comment === "string"
                ? comment.trim().slice(0, 2000) || null
                : null,
            status: "pending"
        };

        const baseUrl = supabaseUrl.replace(/\/+$/, "");

        const response = await fetch(
            `${baseUrl}/rest/v1/appointments`,
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

        // Уведомляем психолога в Telegram
        try {
            const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
            const telegramChatId = process.env.TELEGRAM_CHAT_ID;

            if (telegramToken && telegramChatId) {
                const message = [
                    "🔔 Новая заявка с сайта психолога!",
                    "",
                    `👤 Имя: ${appointment.client_name}`,
                    `📞 Телефон: ${appointment.contact}`,
                    `💬 Комментарий: ${appointment.client_comment || "Не указан"}`,
                    "",
                    "Статус: ожидает решения"
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
                                            callback_data:
                                                `appointment:confirm:${savedAppointment.id}`
                                        },
                                        {
                                            text: "❌ Отклонить",
                                            callback_data:
                                                `appointment:reject:${savedAppointment.id}`
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
                console.error(
                    "Не настроены переменные Telegram"
                );
            }
        } catch (telegramError) {
            console.error(
                "Ошибка отправки в Telegram:",
                telegramError
            );
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