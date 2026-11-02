# SETUP (copy–paste từng dòng)

## A. Chạy thử trên máy cậu (1 lần cài)
1. Cài Node.js bản LTS: https://nodejs.org
2. Mở Terminal/CMD trong thư mục dự án, chạy:
```
npm i -g pnpm
pnpm install
pnpm dev
```
3. Mở trình duyệt: http://localhost:5173 → nhập tên → "Tạo phòng" game Demo → "+ Thêm máy" → chọn "Làm cái" → "Bắt đầu".
4. Thử bạn bè: mở thêm tab ẩn danh, nhập tên khác, nhập mã phòng 6 ký tự.

Kiểm tra code: `pnpm test` (tất cả phải xanh).

## B. Đưa lên mạng (làm khi cần)
1. Đẩy code lên GitHub repo của cậu (GitHub Desktop: Add → Commit → Push).
2. **Server (Render, miễn phí):** render.com → New → Blueprint → chọn repo (đọc `render.yaml`). Xong có link dạng `https://cardgame-server.onrender.com`. (Gói free sẽ "ngủ" sau ít phút không dùng, lần vào đầu chậm ~30s.)
3. **Web (GitHub Pages):** repo → Settings → Pages → Source = GitHub Actions. Rồi Settings → Secrets and variables → Actions → tab Variables → New: tên `VITE_SERVER_URL`, giá trị `wss://cardgame-server.onrender.com` (đổi theo link Render, dùng `wss://`). Push lên nhánh main là web tự cập nhật.
4. Đăng nhập Google (Supabase) và mic (LiveKit): làm ở giai đoạn P5, tớ sẽ hướng dẫn từng bước lúc đó.
