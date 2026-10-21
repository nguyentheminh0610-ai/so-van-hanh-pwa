---
name: shopee-promotion-product-management
description: Add or remove a product from one of shop sometime_official's "Khuyến Mãi của Shop" (shop-wide promotion/discount) campaigns on banhang.shopee.vn. Use this whenever you need to edit a product's phân loại/SKU (variants) and find the "Phân loại hàng" section locked with a 🔒 icon on every row -- that lock happens because the product is currently inside an ongoing ("Đang diễn ra") shop promotion campaign, and the fix is to remove it from that campaign first (unlocking the variant editor), do the SKU edit, then add it back in. Also use when the user explicitly says things like "gỡ sản phẩm khỏi khuyến mãi", "thêm sản phẩm vào lại FS/chương trình khuyến mãi", or asks to pull a product out of an active Shopee discount campaign.
---

# Shopee shop promotion: add/remove a product

## Why this skill exists

When a product is sitting inside an ongoing ("Đang diễn ra") "Khuyến Mãi
của Shop" campaign, Shopee locks its entire "Phân loại hàng" (variant)
editor -- every phân loại 1/phân loại 2 row shows a 🔒 icon and you can't
add, edit, or delete any option. This is different from (and stricter
than) the partial lock you see on a product that's only in a time-boxed
Flash Sale window -- there, existing SKUs' prices are locked but a brand
new phân loại option can still be added. The full 🔒 lock only clears once
the product is taken out of the ongoing promotion campaign entirely.

So the fix when you need to add a new combo/SKU to a locked product is:
remove the product from the campaign -> edit variants freely -> add the
product back into the same campaign once the edit is saved.

## Before touching anything: this always needs the shop owner's sign-off

Removing a product from a campaign and re-adding it both end with a real
"Xác nhận" click that rewrites live promotion data -- that's an edit to
something that already exists, which this shop's owner has set as a hard
rule: any delete/decluster or edit of existing data needs their
confirmation first, no exceptions (see `[[confirm-before-delete-or-edit-existing]]`
memory if you have access to it). Adding something brand new doesn't need
to be asked first, but putting a product back into an existing campaign
counts as editing that campaign's product list, so still check in. Walk
through steps 1-4 below (finding the campaign, opening edit mode) freely
to confirm you've got the right product and campaign, but stop and ask
before clicking the final red "Xác nhận" that actually removes or
re-adds the product.

## Step 1-4: get into the campaign's edit mode (shared by both directions)

1. Dùng **Claude in Chrome** ([[reference_chrome_browsers]]) deviceId Shopee
   — KHÔNG dùng built-in browser. Go to Kênh Marketing
   (`banhang.shopee.vn/portal/marketing`) and click
   **"Khuyến Mãi của Shop"**. This opens the "Giảm giá" list page.
2. Scroll to **"Danh sách chương trình"**. Find the row with status
   **"Đang diễn ra"** whose "Sản phẩm" column thumbnails include the
   product you're after -- if there are several ongoing campaigns, use
   the "Tên chương trình" search box or the "Thời gian khuyến mãi" date
   filter to narrow it down rather than guessing which one, and if it's
   still unclear which campaign contains the product, ask the user.
3. Click **"Chỉnh sửa"** (not "Chi tiết" -- that's read-only) on that
   row. You land on "Chi tiết chương trình khuyến mãi"
   (`.../marketing/discount/<id>`).
4. Click **"Chỉnh sửa Chương Trình Khuyến Mãi"** (top-right of the
   "Thông tin cơ bản" box). The page switches into edit mode: the "Sản
   phẩm khuyến mãi" table now has a search box, a checkbox per row, and
   an orange **"Thêm sản phẩm"** button.

   While you're here, note the **"Đồng bộ Chương trình khuyến mãi này
   sang Shop nước ngoài"** toggle in "Thông tin cơ bản". If it's on
   (green), every SKU in this campaign is synced to the shop's overseas
   storefronts (Malaysia/Philippines/Singapore) -- that's why editing a
   VNĐ price for a product in this campaign pops up a popup demanding
   MY/PH/SG prices before it'll accept the change. Don't turn this
   toggle off to dodge that popup unless the user asks for it
   specifically -- it's a deliberate cross-border setting, not a bug.

## To remove a product

5. Type the product's name into the **"Tên sản phẩm"** search box above
   the table and hit the magnifying-glass icon to filter the list down
   to just that product.
6. Tick the checkbox on its row (or the header checkbox if you've
   filtered to exactly the rows you want gone).
7. Click **"Xóa"** in the "Thiết lập hàng loạt" panel that appears once
   something's ticked -- it's greyed out until at least one row is
   selected.
8. Confirm with the shop owner, then click the red **"Xác nhận"** at the
   bottom of the page to save. The product's variant editor should be
   unlocked within a page reload.

## To add a product back (after the SKU edit is done and saved)

5. Steps 1-4 above get you back into the same campaign's edit mode.
6. Click the orange **"Thêm sản phẩm"** button -> a "Chọn Sản Phẩm"
   popup opens with a "Chọn" tab (the one you want) and a "Đăng Danh
   Sách Sản Phẩm" tab.
7. In the "Chọn" tab, type the product name into the "Tìm" box (dropdown
   defaults to "Tên sản phẩm") and click "Tìm".
8. Tick the product -- you may be able to pick specific phân loại/SKU
   rows to include rather than the whole product; if the new combo SKUs
   you just added aren't showing up as selectable yet, the product list
   search index can lag a few minutes behind a just-saved edit, so retry
   rather than assuming something's wrong.
9. Click **"Xác nhận"** inside the popup to close it -- the product now
   sits in the table as a pending addition, not yet saved.
10. You'll likely need to set a discount % (and optionally a max-order
    limit) for the newly added SKU rows, the same "Thiết lập hàng loạt"
    panel used for existing rows handles this.
11. Confirm with the shop owner, then click the red **"Xác nhận"** at
    the bottom of the page to actually save the addition.

## Report back

After either direction, tell the shop owner plainly what changed: which
product, which campaign (by its "Tên chương trình khuyến mãi", since
that's the only name they'll recognize -- campaign names don't show to
buyers), and whether it's now removed or re-added. If you removed a
product to unlock variant editing, say explicitly that it still needs to
be added back once you're done, so it doesn't get forgotten outside the
promotion.
