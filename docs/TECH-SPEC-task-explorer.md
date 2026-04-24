# Technical Specification — M8: Task Explorer (Deep-dive)

## 1. Objective
Cung cấp cái nhìn "hậu kiểm" (Post-mortem) chi tiết cho mỗi task. Giúp Developer và BA hiểu rõ AI đã làm gì, tại sao làm thế, và kết quả cụ thể ra sao.

---

## 2. Data Modeling
Thông tin của một task được tổng hợp từ 3 nguồn:
1. `projects/<name>/progress.json`: Lấy ID, tên task, trạng thái hiện tại.
2. `projects/<name>/logs/*.jsonl`: Lấy timeline các sự kiện (events).
3. `git history`: Lấy diff code sau khi task được commit.

### Task Object Schema (UI Level)
```typescript
interface TaskDetail {
  id: string; // e.g., M2-F1-T3
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  timeline: TaskEvent[];
  filesTouched: {
    path: string;
    additions: number;
    deletions: number;
    patch: string; // Unified diff
  }[];
  reasoning: string[]; // Trích xuất từ metadata thought
}
```

---

## 3. Features Detail

### A. Activity Timeline (The "Flight Recorder")
- **Vertical Stepper**: Hiển thị các mốc thời gian:
    - `Task Created`: Khi `/task-add` được gọi.
    - `Analysis Finished`: Khi `/analyze` hoàn tất.
    - `Design Approved`: Khi người dùng `confirm` tại Gate 2.
    - `Tools Executed`: Danh sách các lệnh bash/read/write đã chạy trong task này.
- **Duration Tracking**: Tính toán thời gian thực hiện giữa các bước.

### B. Integrated Diff Viewer
- Sử dụng thư viện `react-diff-view`.
- **Side-by-side mode**: Cho phép xem code cũ và mới.
- **File Picker**: Danh sách các file đã thay đổi trong task (trích xuất từ commit hash đính kèm trong log task-commit).

### C. Context Breadcrumbs
- Hiển thị danh sách các file mà Agent đã đọc (`read_file`) trước khi đưa ra thay đổi. 
- Giúp người dùng hiểu tại sao Agent lại chọn sửa đoạn code đó (Agent đã tham chiếu những kiến thức nào).

---

## 4. Extraction Logic (Log Parser)
Hệ thống cần một service chạy ngầm để scan tệp logs:
- **Pattern Matching**: Tìm các entry có `task_id` tương ứng.
- **State Reconstruction**: Nếu log bị ngắt quãng (CLI bị tắt), Dashboard phải tự khôi phục lại trạng thái cuối cùng dựa trên các entry cuối cùng của task đó.

---

## 5. UI Layout (Specs)
- **Top Bar**: Summary (Task ID, Total Time, Cost, Tokens).
- **Left Panel (30%)**: Timeline & Events List.
- **Center Panel (70%)**: Code Diff View / Detailed reasoning text area.
- **Right Panel (Optional)**: File Context list.
