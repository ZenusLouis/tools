# Technical Specification — M10: Interactive Agent Console

## 1. Objective
Xây dựng một giao diện tương tác thời gian thực cho phép người dùng trò chuyện cùng Claude Agent, theo dõi quá trình thực thi lệnh (Bash, File I/O), và can thiệp vào các quy trình phê duyệt (Confirmation Gates) ngay trên Dashboard.

---

## 2. Architecture: The "Interactive Bridge"

Vì Claude CLI chạy trong môi trường Terminal cục bộ, Dashboard (Next.js) cần một cơ chế để "giao tiếp" với tiến trình này.

### A. Communication Flow
1. **Frontend (Next.js)**: Sử dụng WebSockets (qua `socket.io` hoặc native WS) để gửi/nhận message.
2. **Backend (Node.js/Next Server)**: 
    - Khởi tạo và quản lý tiến trình CLI (Child Process).
    - Capture `stdout` và `stderr` để stream về Frontend.
    - Gửi input từ UI vào `stdin` của CLI.
3. **Log Monitor**: Đồng thời theo dõi tệp `.jsonl` để trích xuất các metadata (token used, tool name) mà CLI không in ra terminal.

### B. IO Handling logic
- **Buffering**: Do output của Agent có thể rất nhanh, cần một buffer ở server-side để tránh tràn stream (backpressure management).
- **ANSI Parsing**: Sử dụng thư viện `xterm-for-react` hoặc `ansi-to-html` để render output terminal có màu sắc và định dạng.

---

## 3. UI/UX Design (Agent Console)

### Cấu trúc màn hình (Split View)
- **Cột Trái (Chat Stream)**:
    - Bubble chat chuẩn (User vs AI).
    - Status indicators: "Agent is thinking...", "Running bash command...".
    - Tích hợp **Gate Action Buttons**: Khi log phát hiện pattern `Confirm? [y/n]`, UI sẽ tự động render 2 nút Approve (y) và Reject (n) thay vì bắt người dùng gõ.
- **Cột Phải (Live Execution Trace)**:
    - **Tab 1: Terminal**: Hiển thị output thô từ bash.
    - **Tab 2: Tool Calls**: Hiển thị bảng danh sách các tool đang chạy (e.g., `list_dir`, `grep_search`) kèm theo thông số input/output.
    - **Tab 3: File Diff**: Nếu agent đang sửa file, hiển thị một mini-diff viewer ngay tại đây.

---

## 4. State Management

Sử dụng **React Context** hoặc **Zustand** để quản lý:
- `sessionStatus`: `IDLE` | `BUSY` | `AWAITING_CONFIRMATION` | `ERROR`.
- `messageHistory`: Lưu trữ hội thoại trong session hiện tại.
- `activeTools`: Map các tool đang chạy để hiển thị loading states.

---

## 5. Security Constraints
- **Path Sanitization**: Chặn các lệnh bash nguy hiểm nếu script cố tình thực thi ngoài thư mục dự án (vùng an toàn được định nghĩa trong `context.json`).
- **Secret Masking**: Tự động thay thế các chuỗi ký tự trông giống API Key bằng `[HIDDEN]` trước khi gửi về UI.

---

## 6. API Endpoints (Proposals)
- `POST /api/agent/start`: Khởi động session Claude CLI cho project X.
- `POST /api/agent/command`: Gửi lệnh text hoặc phím tắt (Control+C, y/n).
- `GET /api/agent/stream`: Kết nối WebSocket để nhận dữ liệu.
