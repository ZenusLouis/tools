# Technical Specification — M9: Log Engine & Analytics

## 1. Objective
Xây dựng một engine xử lý dữ liệu log thô (`.jsonl`) từ Claude CLI thành các thông tin có giá trị phân tích, giúp quản trị viên (BA/Dev) kiểm soát chi phí và hiệu năng làm việc của Agent.

---

## 2. Backend Processing (Log Parser)

### A. Streaming JSONL Reader
- Sử dụng `readline` interface trong Node.js để đọc file theo từng dòng (Chunk-based loading).
- Tránh nạp toàn bộ file log (có thể lên tới hàng chục MB) vào RAM.

### B. Indexing Strategy
Vì hệ thống không dùng Database (theo yêu cầu BRD), Dashboard sẽ tạo một **In-memory Index** hoặc một tệp cache nhỏ (`log-index.json`):
- Map `task_id` -> `line_offsets` (Vị trí các dòng log liên quan đến task).
- Map `tool_name` -> `count` (Tần suất sử dụng tool).
- Map `date` -> `total_cost`.

---

## 3. Analytics Features

### A. Token Usage Heatmap
- Phân tích trường `tokens_used` trong metadata của mỗi tool call.
- Visual: Bar chart theo giờ/ngày.
- **Top Burnt Tools**: Danh sách các lệnh tiêu tốn nhiều token nhất (thường là `read_file` trên các file lớn hoặc `grep` quá rộng).

### B. Audit Trail (Log Viewer)
- Cung cấp giao diện bảng (Table view) với khả năng lọc cực nhanh:
    - `Filter by Type`: [TOOL_CALL, TOOL_RESULT, AGENT_THOUGHT, SYSTEM_ERROR].
    - `Search Context`: Tìm kiếm text trong phần input/output của tool.
- **Thought Inspector**: Một modal đặc biệt để xem phần "thought" ẩn của AI, giúp hiểu tại sao AI lại chọn phương án đó.

### C. Cost Prediction
- Dựa trên dữ liệu 7 ngày gần nhất để dự báo chi phí (forecasting) cho cả tháng.

---

## 4. UI/UX Specs

- **Log Stream Component**: Giống giao diện `Google Cloud Logging` hoặc `Datadog`.
- **Latency Monitoring**: Đo thời gian từ khi `tool_call` bắt đầu đến khi có `tool_result` để phát hiện các MCP server đang chậm chạp.

---

## 5. Performance Optimization
- **Pagination**: Chỉ load 50 dòng log mỗi lần cuộn trang.
- **Virtual Scrolling**: Đảm bảo UI mượt mà ngay cả khi hiển thị hàng ngàn dòng log.
- **Worker Threads**: Sử dụng Node.js workers để xử lý việc parse log nặng, tránh block Main thread của Next.js server.
