import asyncio
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# Предполагается, что эти файлы у тебя есть и настроены
from config import TELEGRAM_TOKEN, DATABASE_FILE
from database import Database
from twitch_api import TwitchAPI

# --- Настройка логирования ---
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


# --- Веб-сервер для Render (синхронный) ---
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

def run_web_server_sync(port: int):
    """Запускает простой HTTP-сервер в отдельном потоке."""
    with HTTPServer(('', port), HealthCheckHandler) as httpd:
        logger.info(f"Веб-сервер для health-чеков запущен на порту {port}")
        httpd.serve_forever()


# --- Логика Бота (без изменений) ---
class TwitchBot:
    def __init__(self, db: Database, twitch_api: TwitchAPI):
        self.db = db
        self.twitch_api = twitch_api

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.message: return
        user_id = update.effective_user.id
        username = update.effective_user.username or "Unknown"
        self.db.add_user(user_id, username)
        welcome_message = "..." # Твой текст приветствия
        await update.message.reply_html(welcome_message)

    # ... все остальные твои команды: help, add, remove, list ...


# --- Фоновая задача для проверки стримов (без изменений) ---
async def check_streams(context: ContextTypes.DEFAULT_TYPE):
    db: Database = context.job.data['db']
    twitch_api: TwitchAPI = context.job.data['twitch_api']
    
    subscriptions = db.get_all_subscriptions()
    if not subscriptions:
        return

    channel_subscribers = {}
    for user_id, channel_name in subscriptions:
        if channel_name not in channel_subscribers:
            channel_subscribers[channel_name] = []
        channel_subscribers[channel_name].append(user_id)
    
    logger.info(f"Проверяю {len(channel_subscribers)} уникальных каналов...")

    for channel_name, subscribers in channel_subscribers.items():
        try:
            stream_info = twitch_api.get_stream_info(channel_name)
            if stream_info and not db.is_stream_notified(stream_info['id']):
                # ... (твой код форматирования и отправки уведомлений) ...
                for user_id in subscribers:
                    try:
                        # ... (твой await context.bot.send_photo) ...
                        logger.info(f"Уведомление о стриме {channel_name} успешно отправлено пользователю {user_id}")
                    except Exception as e:
                        logger.error(f"Не удалось отправить уведомление пользователю {user_id}: {e}")
                db.add_stream_notification(stream_info['id'], channel_name)
        except Exception as e:
            logger.error(f"Ошибка при проверке канала {channel_name}: {e}", exc_info=True)


# --- Главная функция ---
def main():
    logger.info("=== Запуск Twitch Stream Notifier Bot ===")

    # 1. Запускаем веб-сервер в отдельном фоновом потоке
    port = int(os.environ.get('PORT', 10000))
    web_thread = threading.Thread(target=run_web_server_sync, args=(port,), daemon=True)
    web_thread.start()

    # 2. Настраиваем и запускаем бота
    db = Database(DATABASE_FILE)
    twitch_api = TwitchAPI()
    bot_logic = TwitchBot(db, twitch_api)
    
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    # Добавляем данные в контекст для доступа в задачах
    application.bot_data['db'] = db
    application.bot_data['twitch_api'] = twitch_api

    # Настраиваем периодическую задачу
    job_queue = application.job_queue
    job_queue.run_repeating(check_streams, interval=60, first=10)

    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", bot_logic.start_command))
    # ... (регистрация остальных твоих команд) ...

    logger.info("Запуск бота в режиме polling...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()