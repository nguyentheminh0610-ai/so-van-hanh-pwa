Bot Telegram "Báo cáo" (@Baocaotheminhbot) dùng để gửi báo cáo vận hành hàng ngày cho chủ shop (Thế Minh, @theminh0610) — chốt 2026-10-05.

- Bot token: `<TELEGRAM_BOT_TOKEN>` — token thật KHÔNG lưu trong repo (repo này public). Lấy token thật từ memory nội bộ của phiên Claude Code (`reference_telegram_bot.md` trong thư mục memory), hoặc hỏi lại chủ shop.
- Chat ID (chủ shop, chat riêng 1-1): `1874515158`
- Gửi tin nhắn: `curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage" --data-urlencode "chat_id=1874515158" --data-urlencode "text=<nội dung>"`

**Why:** chủ shop muốn nhận báo cáo qua Telegram thay vì chỉ trong chat này, vì không phải lúc nào cũng mở app chat.
**How to apply:** mọi báo cáo định kỳ (check đơn tồn, và các báo cáo khác nếu chủ shop muốn) gửi qua bot này bằng lệnh curl ở trên thay vì chỉ trả lời trong chat. Thay `<TELEGRAM_BOT_TOKEN>` bằng token thật khi thực thi — không commit token thật vào git vì repo này đang public.
