# S3-AI05: kết luận thí nghiệm VietBio-3B v0.2

Ngày chốt: 2026-11-11. Trạng thái: hoàn thành đánh giá và lưu artifacts cho
phạm vi nghiên cứu/pilot. Không đồng nghĩa hệ thống không còn lỗi hoặc đã
được chứng nhận để triển khai thực tế. Không chạy lại model trong lượt chốt.

## Phạm vi và định danh

- Model nền: Qwen2.5-3B-Instruct; adapter fine-tune v2 được giữ nguyên.
- File người dùng đặt tên `_v2` có prompt_version `ai05-facet-regression-v1`.
- File `_v3` có prompt_version `ai05-preprocess-regression-v3`.
- Hai file cùng 100 example_id theo cùng thứ tự và cùng bằng chứng gốc.
- Input SHA-256: `b36337ba90a92947380c8ea7f892cecb1623718365e2d815d9e22913c83ed334`.
- Cùng adapter weights SHA-256: `08806b9171ab1786d622138f9b4e546bb82ad9ef41f975f9220056511693ccee`.
- File `_v2` SHA-256: `9b1172a267c8e52fe52da53c476b77ddf9171cae7ea8808f5d47b7748345dee4`.
- File `_v3` SHA-256: `bebb3940a151026e37ca047d907d710d885c8eac4f30d87639357e45725ef563`.

## Các giai đoạn đánh giá

| Giai đoạn | Kết quả | Giới hạn |
| --- | --- | --- |
| Retrieval validation, 500 câu | Dense Recall@5 0.968; hybrid 0.880; hybrid+reranker 0.954 | Giữ dense là lựa chọn nghiên cứu hiện tại; không phải retrieval test cuối |
| Generation validation, 138 câu | V2 từ chối đúng 19/20; pilot 0/20; base 4/20 | Nhận diện từ chối có bước kiểm tra bằng đọc câu trả lời; không suy rộng sang mọi dạng câu hỏi |
| Oracle-evidence test ban đầu, 100 câu | Base thiếu dẫn nguồn 43; adapter v2 thiếu 2; sai số nguồn lần lượt 1 và 0 | Bằng chứng đúng được cấp sẵn; không phải end-to-end RAG |
| Regression `_v2` / `_v3`, 100 câu đã xem | 37 câu thay đổi, 63 giữ nguyên | Tập đã được dùng để phân tích và cải tiến, không còn là test độc lập mới |

## So sánh hồi quy

| Chỉ số | File `_v2` | File `_v3` |
| --- | ---: | ---: |
| Kết quả có ký hiệu dẫn nguồn | 98/100 | 96/100 |
| Kết quả không có ký hiệu dẫn nguồn | 2 | 4 |
| Trong đó từ chối do tiền xử lý | 0 | 3 |
| Không có dẫn nguồn, loại trừ từ chối do tiền xử lý | 2 | 1 |
| Dẫn số nguồn không tồn tại | 0 | 0 |
| Chạm giới hạn 180 token | 3 | 3 |
| Đầu vào bị cắt | 0 | 0 |
| Chép thẻ XML evidence | 3 | 0 |
| Trả lời giới hạn do tiền xử lý, không gọi model | 0 | 19 |
| Tổng câu có gọi model | 100 | 78 |

Không so sánh 98% và 96% như tỷ lệ đúng: 3 kết quả v3 là từ chối không
cần dẫn nguồn, và 19 kết quả là trả lời trích xuất bằng luật. Cải thiện của
pipeline không được quy thành cải thiện học được của adapter.

## Nhận xét theo nội dung

- Câu 38, 51: v3 hết chép XML/cảnh báo; trả lời phân bố gọn hơn.
- Câu 63, 81: v3 chỉ trả đoạn phân bố trong nước/nước ngoài; câu 81 không
  còn chạm token limit.
- Câu 47, 49, 85: bộ tiền xử lý chặn lần lượt nguồn chỉ có mẫu thu thập,
  chữ hỏng và nguồn không nêu biện pháp bảo tồn. Đây là quyết định bằng luật.
- Nhóm 19 câu chỉ có phân loại: v3 trả thông tin hiện có và nói rõ thiếu mô
  tả tổng quan, thay vì coi tên/họ/bộ là mô tả đầy đủ.
- Câu 31: vẫn dừng giữa câu ở 180 token, chưa giải quyết.
- Câu 61: loại được phần mô tả loài khác, nhưng vẫn lặp nội dung và nhãn
  nguồn rồi chạm token limit. Chỉ cải thiện một phần.
- Câu 91: v3 lặp biện pháp bảo tồn và chạm token limit; đây là hồi quy xấu.

## Quyết định

Đóng S3-AI05 cho vòng nghiên cứu hiện tại: đã đánh giá retrieval, so sánh
base/pilot/adapter, đọc và phân tích lỗi bám nguồn, dẫn chứng và bịa thông tin,
lưu adapter, predictions, metrics, báo cáo và biểu đồ. Giữ adapter v2 và
kết quả test ban đầu làm mốc; lưu preprocessing v3 như một nhánh thí nghiệm
có cải thiện cục bộ, không tuyên bố nó thay thế toàn diện cấu hình cũ.

Chưa có tỷ lệ factual accuracy hoặc hallucination được xác minh khoa học
độc lập cho toàn bộ tập. Nguồn có lỗi mã hóa, câu mô tả thiếu dữ liệu và
nhãn bảo tồn lịch sử; trích đúng nguồn không đồng nghĩa đúng khoa học hiện tại.
Tập test 100 câu không có mẫu `should_abstain: true`; khả năng từ chối chỉ
được đo ở validation. Chưa có phép đo end-to-end retrieval + generation trên
một test mới. Các giới hạn này là kết quả của nghiên cứu, không bị xóa khỏi báo cáo.

## Artifacts được giữ

- Hai file hồi quy gốc và `comparison-metrics.json`, `comparison.svg` trong thư mục này.
- `../final-test/report-v1/metrics.json` và `review-findings.md`: test ban đầu.
- `../report-v1/metrics.json` và `review-findings.md`: validation.
- `../../../models/qwen2.5-3b-sft-v2/biodiversity-sft-v2-adapter.zip`: adapter lưu trữ.
- `../../../rag/v0.1.0/retrieval-validation.json`: retrieval validation.
- Checkpoint trung gian Kaggle không được xác nhận đã lưu tại máy trong lần chốt này;
  archive adapter cuối là model artifact được giữ, không phải toàn bộ model nền.
