# STAC_BOT-1.0: phát hành nghiên cứu nội bộ v1.0

Built with Qwen. Thương hiệu STAC_BOT, model ID `stac-bot`. Phiên bản
1.0.0 phát hành nội bộ ngày 2026-11-12; chưa phải API hoạt động hoặc bản production.

AI06 hoàn thành ở phạm vi đóng gói artifact nghiên cứu. Revision lúc train
không được ghi nhận là giới hạn tái lập đã chấp nhận, không chặn release nội bộ.
Các điều kiện stable/public bên dưới không phải điều kiện để chạy tiếp AI07.

## Model và phạm vi

Trợ lý tri thức đa dạng sinh học tiếng Việt dựa trên Qwen2.5-3B-Instruct và
adapter LoRA SFT v2, không phải foundation model huấn luyện từ đầu. Archive
ghi model nền lúc train là `unsloth/Qwen2.5-3B-Instruct-unsloth-bnb-4bit`.
Revision model/tokenizer chưa được pin: không giả định revision hiện tại
trên Hub chính là revision đã dùng lúc train.

`STAC_BOT-1.0.zip` chứa safetensors, tokenizer và cấu hình;
không chứa model nền đầy đủ. Khi suy luận chỉ cần các thành phần phục vụ
inference; không deserialize training_args.bin chỉ để đọc cấu hình.

Theo log nghiên cứu: 1.156 mẫu SFT train, 138 validation, một epoch, 289 bước;
rank/alpha 16, dropout 0. Đây là thông tin từ log, không phải kiểm tra train
lại. Adapter được giữ nguyên khi đóng gói; đổi thương hiệu không cần train lại.

## Dữ liệu và đánh giá

Corpus v0.1.0 xuất từ PostgreSQL/PostGIS và được làm giàu bằng GBIF,
Crossref, Europe PMC. Sáu nhóm dữ liệu loài gồm động vật, thực vật, côn trùng,
nấm, tảo và nhóm protista của dự án. Không coi tên bảng protista là đại diện
cho mọi vi sinh vật. Corpus không được phân phối trong gói này.

- Retrieval validation 500 câu: Recall@5 dense 0.968, hybrid 0.880,
  hybrid+reranker 0.954. Dense là cấu hình đề xuất mặc định.
- Generator validation: v2 từ chối đúng 19/20 mẫu cần từ chối.
- Oracle-evidence test ban đầu 100 câu: v2 thiếu ký hiệu dẫn nguồn ở 2 câu,
  không dẫn số nguồn ngoài tập có sẵn. Không phải tỷ lệ đúng khoa học.
- Regression v3 cải thiện một số lỗi nguồn nhưng còn lặp và cắt đáp án;
  nhánh này không được tự động đưa vào cấu hình mặc định.

Bằng chứng đúng được cấp sẵn trong test generator; chưa có đánh giá
end-to-end RAG trên test độc lập. Tập 100 câu không chứa mẫu cần từ chối.
Không công bố tỷ lệ factual accuracy/hallucination đã xác minh khoa học.
Nguồn có thể thiếu, lỗi mã hóa, cũ hoặc chứa nhãn bảo tồn lịch sử.

## Giấy phép

Model card chính thức của Qwen2.5-3B-Instruct ghi `qwen-research`, không phải
Apache-2.0. Điều khoản dành cho nghiên cứu/đánh giá phi thương mại; dùng
thương mại cần yêu cầu giấy phép. Phân phối phái sinh có yêu cầu license,
attribution và notice. Tên thương hiệu riêng không thay thế nghĩa vụ này.

Nguồn đối chiếu ngày 2026-11-11:
- https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE
- https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/README.md
- https://huggingface.co/BAAI/bge-m3/blob/main/README.md (metadata MIT)

Chưa đóng đủ bản sao license/notice hoặc rà quyền từng nguồn để phát hành
công khai. Dữ liệu API và nội dung trong database không mặc nhiên được quyền
tái phân phối. Cần rà riêng checkpoint quantized, adapter, corpus, model
embedding và các thư viện khi quyết định phạm vi phát hành. Đây là ghi nhận
nguồn điều khoản, không phải chứng nhận pháp lý cho sản phẩm.

## Tái sử dụng

AI06 đóng gói artifact; AI07 làm dịch vụ Python nạp model một lần và endpoint
NestJS; AI08 làm UI Angular. API là lớp truy cập model, không phải bản thân
model. Có thể tái sử dụng cùng release qua API hoặc qua loader Python.

Giữ riêng phiên bản adapter, corpus, prompt và retrieval profile. API phải
trả model/release/profile thực tế đang nạp. Bản phát hành sau không ghi đè
trọng số hay cấu hình của phiên bản đã chốt. Thay model nền, train adapter
mới, đổi prompt hay cải tiến corpus đều cần ghi thay đổi và bằng chứng đánh giá.

Trước stable 1.0.0: pin checkpoint/tokenizer thực tế;
khóa môi trường đã kiểm chứng; hoàn tất quyền phân phối và notice; xác nhận
runtime loader + profile. Chưa có endpoint, quyền web hoặc SLA trong AI06.

## Hồ sơ bổ sung ngày 2026-11-12

Tên STAC_BOT-1.0 đã được chủ dự án chốt. Bản ZIP mang tên mới có cùng
hash trọng số adapter v2; không thay đổi model hoặc train lại. `adapter.zip`
cũ được giữ làm bản lưu nghiên cứu, không phải archive mặc định của release.

`environment/` giữ nguyên hai file do chủ dự án xuất từ Kaggle. Đây là
snapshot môi trường, không phải lockfile cài đặt đã kiểm chứng hay bằng chứng
chắc chắn về môi trường lúc train. Không cài toàn bộ pip-freeze trên Windows.
`revisions.json` ghi revision cache quan sát được, chưa gán thành revision train.
`licenses/` chứa bản sao giấy phép Qwen, NOTICE và danh mục phần còn cần rà.
