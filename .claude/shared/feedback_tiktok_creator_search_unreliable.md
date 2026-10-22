# feedback_tiktok_creator_search_unreliable

> TikTok Shop Affiliate's \"Tìm nhà sáng tạo\" search doesn't index every creator — expect misses regardless of follower count, degrade gracefully instead of retrying forever.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Khi cần tra GPM / % độ tuổi 18-34 của 1 KOC (qua affiliate.tiktok.com/affiliate/creator → search đúng handle → mở hồ sơ chi tiết → tab "Người theo dõi"), khoảng 30-35% số KOC đã thử **không ra kết quả tìm kiếm chính xác** dù gõ đúng handle — xảy ra với cả account follower nhỏ (843) lẫn khá lớn (14K, 67K), không có quy luật rõ ràng theo kích thước. Khi không tìm thấy, trang chỉ hiện danh sách gợi ý chung chung không liên quan.

Ô tìm kiếm trên trang này cũng hay bị "mất chữ" (click + type xong ô vẫn trống) nếu gõ ngay sau khi navigate — phải click lại/gõ lại lần 2 mới ăn.

**Why:** tốn rất nhiều thao tác nếu cứ thử lại nhiều lần cho 1 KOC không tìm được — cần biết đây là giới hạn thật của công cụ TikTok, không phải lỗi thao tác.
**How to apply:** thử tối đa 2 lần (double click+gõ) cho mỗi KOC; nếu vẫn không ra đúng kết quả, chấp nhận bỏ trống cột GPM/KH 18-34% cho KOC đó trong [koc-scoring-sheet](reference_koc_scoring_sheet.md) và báo rõ cho chủ shop, không cố lặp lại nhiều lần nữa.
