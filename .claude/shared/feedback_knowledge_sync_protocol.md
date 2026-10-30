# Quy trình train kiến thức mới: ghi file skill → commit → push

Chốt **22/10/2026**. Bản đầy đủ nằm ở [CLAUDE.md](../../CLAUDE.md) (mục
"QUY TRÌNH CẬP NHẬT KIẾN THỨC"); file này để skill trỏ link tới được.

## 3 bước bắt buộc khi chủ shop train/chốt kiến thức nghiệp vụ mới

1. **Ghi thẳng vào file skill** trong `.claude/skills/<tên-skill>/` — KHÔNG được
   chỉ lưu vào memory hội thoại. Memory chỉ sống trên 1 máy và PC Windows không
   bao giờ thấy.
2. **Commit** ngay, mô tả rõ chốt gì, ngày nào.
3. **Push lên GitHub ngay**. Chưa push = máy còn lại vẫn chạy bản cũ.

Luôn ghi kèm **ngày chốt** và **lý do/ngữ cảnh**, để phiên sau hiểu vì sao có
quy tắc đó. Quy tắc mới đè quy tắc cũ thì viết "chốt ngày X, thay cho quy tắc cũ
Y" chứ đừng xoá lịch sử.

## Vì sao có quy trình này

**Sự cố thật 22/10/2026:** máy Mac làm việc nhiều ngày trên bản kiến thức cũ vì
**không bao giờ `git pull`**, trong khi PC vẫn đẩy kiến thức mới lên GitHub. Kết
quả: chủ shop phải train lại những thứ PC đã chốt từ 15/10, và 2 nhánh git lệch
nhau phải gộp tay.

## Đầu phiên làm việc

```bash
bash scripts/sync-knowledge.sh          # Mac
```
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync-knowledge.ps1   # PC
```

**Ngoại lệ (chốt 23/10/2026):** task chạy theo lịch trên PC **không** chạy sync
và **không** kiểm `hostname` — Windows Task Scheduler `Claude - Dong bo kien thuc`
đã tự đồng bộ 15 phút/lần, chạy thêm chỉ tốn token.

## Nguồn chuẩn khi mâu thuẫn

File skill trong git **luôn thắng** memory cục bộ. Memory nói khác file skill
thì tin file skill, rồi sửa lại memory cho khớp.

## Việc nhạy phải hỏi trước

Sửa kiến thức nghiệp vụ, giá, sản phẩm → xem
[feedback_confirm_before_pricing](feedback_confirm_before_pricing.md) và
[feedback_confirm_before_delete_or_edit_existing](feedback_confirm_before_delete_or_edit_existing.md).
