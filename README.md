# Giá vàng và tỷ giá tự động

- `gold.json`: giá **mua vào** (đồng / chỉ) của vàng miếng SJC và nhẫn trơn 999.9, lấy từ PNJ.
- `fx.json`: tỷ giá **mua vào** (đồng / 1 đơn vị) của USD, EUR, JPY, AUD, CAD, KRW, SGD, GBP, lấy từ Vietcombank.

GitHub Actions chạy `scripts/fetch-gold.mjs` và `scripts/fetch-fx.mjs` mỗi 30 phút trong giờ làm việc và chỉ lưu khi giá đổi.
Kho này công khai và không chứa dữ liệu cá nhân.
