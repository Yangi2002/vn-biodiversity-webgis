# Hướng phát triển sau gói AI06

## Tách thành phần để phát triển lâu dài

1. Model release: model nền + LoRA adapter + tokenizer, định danh bất biến.
2. Knowledge release: corpus, embedding index và metadata nguồn có phiên bản riêng.
3. Pipeline profile: retrieval, prompt, giới hạn token, chính sách từ chối.
4. Serving: dịch vụ Python giữ model trong bộ nhớ, NestJS xác thực và phân quyền.
5. Client: Angular dùng API; sau này ứng dụng khác có thể dùng cùng API.

Không gộp quyền tài khoản vào trọng số LLM. NestJS xác thực người dùng và
truyền phạm vi được phép từ server; Python lọc quyền trước retrieval.
Không mở model server trực tiếp ra client. Không nạp lại model theo từng request.

## Gói này chứa gì?

- release.json: STAC_BOT-1.0, model ID stac-bot, checksum adapter, readiness.
- runtime-profile.json: cấu hình dự kiến; chưa được code runtime tiêu thụ.
- MODEL_CARD.md: base model, nguồn dữ liệu, kết quả và giới hạn/giấy phép.
- STAC_BOT-1.0.zip: archive do chủ dự án gửi, cùng trọng số adapter nghiên cứu v2.
- environment/, revisions.json, licenses/: snapshot môi trường và hồ sơ nguồn gốc.
- evaluation/: báo cáo/metric AI05. Không bao gồm toàn bộ corpus hay model nền.

## Các bước tiếp theo

- AI06: tên đã chốt; xác định phạm vi phát hành; hoàn thiện provenance, license/notice,
  revision và môi trường. Bản này là nháp nội bộ, không upload công khai.
- AI07: nạp adapter tường minh, API có xác thực, nguồn dẫn đúng theo đáp án,
  trạng thái từ chối riêng, model version, timeout/cancel và giới hạn request.
  Chọn collection phục vụ web thay vì dùng ngầm partition train của nghiên cứu.
- AI08: chatbot component dùng chung cho các role được phép, hiện nguồn và
  phiên bản, loading/error/retry; kiểm thử E2E do chủ dự án chủ động chạy.

