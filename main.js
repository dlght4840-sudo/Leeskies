import time
import os
from neonize.client import NewClient
from neonize.events import ConnectedEv, MessageEv, PairStatusEv, event
from neonize.types import MessageWithContextInfo
from neonize.utils import log
import config

# Initialize client (stores session in sqlite db leeskies.db)
client = NewClient("leeskies.db")

START_TIME = time.time()


def get_uptime():
    seconds = int(time.time() - START_TIME)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h {minutes}m {seconds}s"


# Event: Logged in and connected
@client.event(ConnectedEv)
def on_connected(client: NewClient, __: ConnectedEv):
    print(f"\n[+] {config.BOT_NAME} is ONLINE and connected to WhatsApp!\n")


# Event: Pairing code or QR status
@client.event(PairStatusEv)
def on_pair(client: NewClient, message: PairStatusEv):
    print(f"[*] Pairing status: {message.Status}")


# Event: Handle Incoming Messages
@client.event(MessageEv)
def on_message(client: NewClient, message: MessageEv):
    # Ignore messages sent by the bot itself or empty messages
    msg_info = message.Info
    text = (
        message.Message.conversation
        or (message.Message.extendedTextMessage.text if message.Message.extendedTextMessage else "")
    )

    if not text:
        return

    # Check for prefix
    if not text.startswith(config.PREFIX):
        return

    # Parse command and arguments
    parts = text[len(config.PREFIX):].strip().split()
    if not parts:
        return

    command = parts[0].lower()
    args = parts[1:]
    sender_chat = msg_info.MessageSource.Chat

    # Helper: reply shortcut
    def reply(content: str):
        client.reply_message(content, message)

    print(f"[CMD] {command} received from {sender_chat.User}")

    # ================= COMMANDS ================= #

    # 1. PING COMMAND
    if command == "ping":
        start_ping = time.time()
        latency = round((time.time() - start_ping) * 1000, 2)
        reply(f"🏓 *Pong!*\n⚡ Latency: `{latency}ms`")

    # 2. ALIVE COMMAND
    elif command in ["alive", "runtime", "uptime"]:
        status_msg = (
            f"🤖 *{config.BOT_NAME} is active!*\n\n"
            f"⏱ *Uptime:* {get_uptime()}\n"
            f"👑 *Owner:* {config.OWNER_NAME}\n"
            f"⚡ Type `{config.PREFIX}menu` to view all features."
        )
        reply(status_msg)

    # 3. MENU / HELP COMMAND
    elif command in ["menu", "help"]:
        menu_text = (
            f"{config.MENU_HEADER}\n"
            f"┌── *GENERAL* ──\n"
            f"│ ◦ `{config.PREFIX}ping` - Check response speed\n"
            f"│ ◦ `{config.PREFIX}alive` - Check bot status\n"
            f"│ ◦ `{config.PREFIX}menu` - Show this menu\n"
            f"│ ◦ `{config.PREFIX}echo <text>` - Repeats your text\n"
            f"│ ◦ `{config.PREFIX}owner` - Contact developer\n"
            f"└──\n\n"
            f"💡 *Tip:* More plugins can be added in `main.py`."
        )
        reply(menu_text)

    # 4. ECHO COMMAND
    elif command == "echo":
        if not args:
            reply(f"⚠️ Usage: `{config.PREFIX}echo your message here`")
        else:
            reply(" ".join(args))

    # 5. OWNER COMMAND
    elif command == "owner":
        reply(f"👤 *Bot Owner:* {config.OWNER_NAME}\n📞 *WhatsApp:* wa.me/{config.OWNER_NUMBER}")

    else:
        # Optional: notify about unknown commands (or leave blank)
        pass


if __name__ == "__main__":
    print(f"[*] Starting {config.BOT_NAME}...")
    print("[*] Scan the QR code that appears in your terminal below:\n")
    client.connect()