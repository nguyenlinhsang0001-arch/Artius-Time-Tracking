
/* ============================================================
   ARTIUS — Quản lý giờ công theo dự án · v13.51
   Mới ở v13.51 — Bảng công, cột "Mở khoá / sửa":
     · Nút ổ khoá luôn làm việc với TUẦN ĐANG XEM trên bảng; chú thích rê chuột ghi thẳng khoảng ngày
       của tuần đó và tên người, khỏi nhầm sang tuần khác.
     · Ổ khoá SÁNG XANH nhịp nhẹ khi tuần đó đang được mở cho người này; bấm lần nữa là khoá lại.
     · BỎ mở khoá có thời hạn: không còn ô tích "mở chấm bù" và ô ngày "Mở tới". Một lần bấm là mở hẳn —
       gỡ dấu đã gửi của tuần, và nếu tuần đã quá hạn chấm công thì mở luôn quyền nhập cho người đó.
       Mở tới khi quản lý khoá lại hoặc nhân sự gửi lại.
     Kỹ thuật: cfg.pastOpen vẫn là { empId: { thứHai: "ngày" } } nhưng nay ghi mốc 9999-12-31, nên hàm
     chặn trong database (artius_ts_guard) chạy nguyên, KHÔNG cần chạy SQL. Mốc có hạn thật do bản cũ
     ghi vẫn tự hết hạn như trước, Thiết lập hiện "đang mở" hoặc "mở tới hết <ngày>" tuỳ loại.

   Mới ở v13.50 — Chấm công nhân viên: bỏ 26 thông báo theo danh sách Sang chốt
     (A3, B1-B4, B6, C1-C5, C7-C9, C11-C16, C18-C20, E4-E6).
     Ba chỗ bỏ xong sẽ thành "bấm mà không có gì xảy ra", nên thay thông báo bằng TRẠNG THÁI nút:
       · nút "Gửi giờ công" tự khoá khi chưa có giờ mới nào để gửi (thay C11 + C12);
       · nút "Tăng ca" tự khoá khi không còn khung giờ trống (thay C5);
       · ô chọn dự án vốn đã khoá sẵn khi khối có giờ (thay C16).
     Hai chỗ đổi cách xử lý: bấm ✓ / Xong ở khối chưa có giờ thì cứ thu gọn luôn thay vì chặn (C1, C2);
     trùng dòng thì con trỏ nhảy tới dòng đang có, không báo (C3, C7).
     Bỏ cả hàm addTaskToGroup vì không nơi nào gọi — thông báo C4 vốn không bao giờ hiện.

   Mới ở v13.49 — Chấm công nhân viên: bỏ thông báo của nút ✓ ("Đã tạm lưu giờ … Thêm tác vụ cho
     dự án khác, xong hết thì bấm Gửi giờ công."). Nút ✓ chỉ thu gọn khối và nhớ tạm trên MÁY NÀY,
     chữ "đã lưu" làm người dùng tưởng giờ đã nằm trên hệ thống. Chú thích rê chuột đổi thành
     "Xong — thu gọn khối này (chưa gửi)". Trường hợp khối không có giờ nào nên bị bỏ khỏi bảng
     thì vẫn báo, vì lúc đó có thứ biến mất khỏi màn hình.

   Mới ở v13.48 — Chấm công của nhân viên:
     · Ô chọn dự án: "Khác" đổi thành "Việc chung / Vắng mặt" (chỉ ở màn nhân viên; các màn quản lý
       vẫn để "Khác" cho gọn cột).
     · BỎ nút "Lưu nháp" (cả máy tính lẫn điện thoại) và đường ghi nháp lên server. Nhân sự chỉ còn
       "Gửi giờ công"; gửi và khoá vẫn theo TỪNG NGÀY nên gửi dần trong tuần vẫn được.
       Bản nháp tạm trên MÁY (localStorage) giữ nguyên — đó là lưới an toàn khi lỡ tải lại trang,
       không phải nút bấm. Hệ quả: nguồn "giờ nháp" mà Kế hoạch › Tuần này (v13.46) đọc sẽ cạn dần,
       giữa tuần chỉ còn thấy giờ đã GỬI.
     · Nút "Excel tăng ca" phát sáng nhịp nhẹ trong ba ngày cuối tháng (ngày cuối − 2 → ngày cuối),
       nhắc xuất bảng trước khi chốt công. Chỉ sáng khi nút đang trỏ đúng tháng hiện tại.

   Mới ở v13.47 — Kế hoạch › So với thực tế, khối người của từng vai trò ở bảng bên phải:
     · Bỏ dòng tiêu đề "ĐÃ CHẤM VÀO DỰ ÁN · KẾ HOẠCH VAI TRÒ … H" — con số kế hoạch đã nằm
       ngay ở cột Kế hoạch của hàng vai trò phía trên.
     · Dòng chú thích dưới tên mỗi người đổi từ "…% giờ của người này · gánh …% kế hoạch vai trò"
       thành "…% thời gian làm việc của họ · tải tuần …%". Hai sửa chữa:
         – Mẫu số cũ là TỔNG GIỜ ĐÃ CHẤM, gồm cả giờ vắng mặt và giờ trống việc, nên người nghỉ phép
           bị hiện tỉ lệ thấp như thể chia người đi chỗ khác. Nay mẫu số là giờ LÀM VIỆC thật.
         – Bỏ "gánh …% kế hoạch vai trò": hàng vai trò ngay trên đã có Kế hoạch / Thực tế / Lệch,
           chia nhỏ con số đó ra đầu người không thêm thông tin mà còn đẻ ra những số như "320%".
           Thay bằng mức tải của chính người đó trong khoảng đang xem (cùng công thức tab Nhân sự),
           tô đỏ khi quá tải — đó mới là thứ quyết định có kéo thêm việc cho họ được không.

   Mới ở v13.46 — Kế hoạch › So với thực tế: thêm khoảng "TUẦN NÀY (đang chạy)".
     Trước đây màn này cắt bỏ tuần hiện tại nên giữa tuần không thấy dự án nào đang lệch quân để bù.
     Nay chọn "Tuần này" thì:
       · kế hoạch cả tuần được CẮT THEO TỈ LỆ giờ chuẩn đã trôi qua (gồm cả hôm nay, trừ ngày lễ),
         để không so một tuần mới đi nửa chặng với kế hoạch trọn tuần;
       · cột Thực tế tính cả GIỜ NHÁP chưa bấm gửi — không có nó thì giữa tuần cột này gần như trống,
         vì mọi người thường gửi vào cuối tuần. Dải xanh phía trên ghi rõ bao nhiêu giờ còn là nháp;
       · ô "Quân số kỳ này" cũng cắt theo cùng tỉ lệ;
       · các kết luận "thấp hơn …%" / "chưa ai làm" vẫn mang dấu * vì tuần chưa xong.
     Tuần đã qua giữ nguyên cách cũ: chỉ giờ đã gửi, kế hoạch trọn tuần.

   Mới ở v13.45 — Kế hoạch › So với thực tế, dọn bớt chữ ở bảng kết luận bên phải:
     · Bỏ dòng "bấm một vai trò để mở / đóng danh sách người".
     · Bảng vai trò chỉ còn tên đầy đủ (Thiết kế, Họa viên 3D…), bỏ mã TK / 3D đứng trước.
     · Tiêu đề khối chỉ còn "BỔ SUNG", bỏ phần "… người TK · rê chuột xem giờ".
     · BỔ SUNG chỉ liệt kê người CHƯA chấm giờ vào dự án — người đã ở trong dự án đã nằm
       ở khối ngay trên, không lặp lại (bỏ luôn nhãn "đang ở dự án này").

   Mới ở v13.44 — Kế hoạch:
     · Ô lịch trên thanh công cụ BẤM ĐƯỢC: chọn thẳng tháng trong 4 năm, lưới cuộn tới tháng đó
       (đang ở tab khác thì tự về Nhập liệu). Tháng đầu / cuối cửa sổ 4 năm không kéo ra giữa được
       nên ô lịch vẫn ghi tháng đang nằm giữa màn hình.
     · Bảng bên phải của "So với thực tế": danh sách "Người … đang làm ở" đổi thành khối BỔ SUNG,
       MẶC ĐỊNH ĐÓNG, bấm tiêu đề mới mở. Trong đó liệt kê mọi người cùng vai trò kèm hệ số tải
       của chính khoảng đang xem (Quá tải / Bình thường / Thiếu giờ / Trống việc · %, cùng công thức
       với tab Nhân sự), xếp người rảnh nhất lên trước; rê chuột vào một người thì hiện thẻ chi tiết
       giờ của người đó theo từng dự án, giờ việc chung / vắng, tổng và OT / cố gắng / trống việc.

   Mới ở v13.43 — Ngưỡng kết luận chuyển từ Thiết lập về ngay tab Kế hoạch › So với thực tế:
     nút "Ngưỡng 15% / 30%" trên thanh công cụ, bấm là sửa và lưu tại chỗ, bảng bên dưới đổi chip
     ngay. Bỏ khung tương ứng trong Thiết lập để chỉ còn một chỗ chỉnh. Người chỉ-xem không thấy nút.

   Mới ở v13.42 — Kế hoạch › So với thực tế, bốn chỗ:
     · Ô "Giờ việc chung / vắng" bấm được: bóc ra danh sách ai nghỉ / làm việc chung bao nhiêu giờ,
       thay vì chỉ một con số tổng không biết của ai.
     · Thêm thanh lọc theo kết luận và ô tìm dự án (gõ không dấu cũng ra), giống tab "Theo dự án".
       Các ô số liệu phía trên vẫn tính trên TOÀN BỘ dự án, không đổi theo bộ lọc.
     · Ngưỡng kết luận (lệch bao nhiêu % thì coi là "đúng kế hoạch", sai vai trò bao nhiêu % thì là
       "đủ người nhưng sai vai trò") chuyển vào Thiết lập, trước đây gắn cứng 15% / 30% trong code.
     · Thêm ô "Quân số kỳ này" (tổng giờ công ty có thể làm trong khoảng) và dải đỏ cảnh báo khi
       kế hoạch của một vai trò xin nhiều hơn số người đang có — suất thừa đó không bao giờ chạy đủ.

   Mới ở v13.41 — Kế hoạch › So với thực tế, hai chỗ vá:
     · Cột "Từng tuần" trong bảng: mỗi tuần một cặp cột (kế hoạch nhạt, thực tế đặc — xanh lá đúng,
       cam vượt, xanh dương thiếu). Chỉ hiện khi khoảng đang xem có nhiều hơn một tuần. Trước đây cả
       bảng nén thành một con số bình quân nên dự án chấm 0/0/0/4 trông y hệt dự án chấm 1/1/1/1.
     · Tuần thiếu giờ gửi: trước chỉ đếm người của TUẦN CUỐI và giấu trong dòng phụ một ô số liệu.
       Nay xét mọi tuần trong khoảng, hiện dải cảnh báo kèm tên, và đánh dấu * lên các kết luận
       "thấp hơn …%" / "chưa ai làm" — đúng những kết luận có thể do thiếu giờ gửi gây ra.

   Mới ở v13.40 — Kế hoạch › Theo dự án: bỏ nốt ghi chú "Tuần hiện tại …" ở hàng tiêu đề; hàng này giờ chỉ
     còn trục tháng. Vạch đỏ trên trục và trong từng dải đã cho biết tuần hiện tại.

   Mới ở v13.39 — Kế hoạch › Theo dự án: dải thời gian nới rộng gấp khoảng ba lần (cột tên và dải chia đôi
     phần còn lại, dải bắt đầu khoảng giữa màn hình); thêm trục tháng ngay trên dải, mốc mỗi quý và ghi năm
     ở tháng 1, kèm vạch đỏ tuần hiện tại — nhìn là biết dải của dự án bắt đầu và kết thúc tháng nào.
     Dòng tóm tắt riêng phía trên gộp luôn vào hàng tiêu đề này.

   Mới ở v13.38 — Kế hoạch › Nhập liệu: bỏ dòng khoảng thời gian ("T7·1 → T10·3") trên dòng tên dự án;
     ô lịch trên thanh công cụ lấy tháng ở GIỮA vùng đang nhìn thay vì tháng ở mép trái.

   Mới ở v13.37 — Kế hoạch:
     · Bỏ cách xem "Từng dự án" (và file PlanFocus.jsx); Nhập liệu chỉ còn một lưới duy nhất.
     · Lưới trải 4 NĂM LIỀN NHAU (năm trước → ba năm sau, 192 cột), cuộn ngang qua tháng 12 là sang
       năm sau luôn, không còn ngắt và không còn ô chọn cặp năm.
     · Ô "Năm" cũ thành chỗ HIỆN MỐC THỜI GIAN: ghi tháng/năm đang ở mép trái lưới, đổi theo lúc cuộn.
     · Mỗi lần lưu chỉ ghi lại những năm thật sự có thay đổi, không xoá-ghi cả 4 năm.
   Dữ liệu dưới Supabase vẫn lưu từng năm một như cũ, không phải chạy thêm SQL.

   Mới ở v13.36 — Kế hoạch: bấm ra ngoài ô nhập thì NHẢ ô đang chọn — khung chọn, núm kéo điền và phần làm
     mờ ở khối TOÀN CÔNG TY · CÒN đều tắt. Trước đây bấm ra chỗ khác rồi mà ô vẫn bị coi là đang nhập.
     Vẫn giữ vùng chọn khi bấm sang ô nhập khác, Shift + bấm, và khi kéo núm điền.

   Mới ở v13.35 — Kế hoạch: việc làm mờ vai trò khác ở khối TOÀN CÔNG TY · CÒN nay chạy theo Ô ĐANG CHỌN
     (bấm vào ô nhập) thay vì theo con trỏ chuột. Rê chuột ngang qua lưới không còn làm mờ, rê vào chính
     khối CÒN cũng không. Bấm ô nào thì vai trò của ô đó giữ nguyên, các vai trò khác còn 15%; Esc nhả ô
     là sáng lại hết. Đường gióng ngang / dọc khi rê chuột giữ nguyên như cũ.

   Mới ở v13.34 — Kế hoạch: sửa lại cách làm mờ vai trò khác ở khối TOÀN CÔNG TY · CÒN. v13.33 dùng opacity
     trên cả dòng nên NỀN khối cũng trong suốt, nhìn xuyên xuống lưới nhập phía dưới, chữ chồng lên nhau.
     Nay phủ một lớp màu nền lên chính từng ô: nền khối vẫn đục, chỉ số và màu trạng thái nhạt đi.
     Mức mờ tăng thêm một nửa — vai trò khác chỉ còn 15% (v13.33 là 30%).

   Mới ở v13.33 — Kế hoạch › Nhập liệu:
     · Rê chuột vào một ô nhập: vai trò tương ứng trong khối TOÀN CÔNG TY · CÒN giữ nguyên, các vai trò
       khác mờ đi 70%. Áp cho cả dòng CÒN của chế độ Từng dự án.
     · SỬA LỖI gỡ vai trò khỏi dự án không lưu được: trước đây lúc lưu, dòng toàn 0 bị bỏ, nên danh sách
       vai trò của một dự án thực chất là "những vai trò đang có số"; tỉa bớt vai trò khi chưa gõ số nào
       thì dự án thành rỗng và lần mở sau được điền lại bộ vai trò cơ bản — trông như chưa từng xoá.
       Nay dòng toàn 0 cũng được lưu, nên danh sách vai trò đúng bằng những gì đang thấy trên lưới.
       Đổi lại: dòng trống để lại trên lưới sẽ còn nguyên sau F5, không tự biến mất như trước.

   Mới ở v13.32 — Kế hoạch › Nhập liệu, năm việc cho dễ nhìn và đỡ rủi ro:
     · Ctrl + Z lùi / Ctrl + Y tiến (50 bước, có nút trên hàng công cụ); gõ liên tiếp vào cùng một ô chỉ tính một bước.
     · Ô đã sửa kể từ lần lưu cuối có chấm xanh ở góc; nút Lưu ghi số ô đang chờ lưu.
     · Bấm một ô CÒN để xem dự án nào đang ăn vào vai trò đó trong tuần đó, kèm có / đang dùng / còn.
     · Bấm tên dự án để gập; gập rồi thì dòng dự án hiện tổng số người từng tuần. Nhớ riêng từng máy.
     · Ô lọc nhanh dự án trên hàng công cụ, gõ không dấu vẫn tìm ra.
     Cột tên nới 250 → 266px để mũi tên gập không làm cắt ngắn tên dự án.

   Mới ở v13.31 — Chấm công: gửi xong cả tuần thì ẩn hẳn banner "đang mở chấm bù / đã quá hạn" (lời nhắc bấm Gửi
     không còn việc gì để làm). Nút "Excel tăng ca" hiện cả ở tab Dashboard cá nhân, lấy đúng tháng đang mở trên
     Lịch tháng ở đó (phần gom giờ và dựng file tách sang shared/otReport.js để hai màn dùng chung một hàm).
     Mode sáng: số tháng trên nút đổi sang teal đậm cho đủ tương phản.

   Mới ở v13.30 — Nút "Excel tăng ca" dời từ chân bảng Chấm công lên header, nằm ngay bên trái nút sáng/tối,
     và GHI RÕ THÁNG sẽ xuất ngay trên nút ("Excel tăng ca 11/2026") để nhân viên không xuất nhầm tháng.
     Tháng vẫn theo tuần đang mở, đổi tuần thì số trên nút đổi theo. Nút chỉ hiện khi đang ở tab Chấm công.

   Mới ở v13.29 — Chấm công (màn nhân viên): nút "Excel tăng ca tháng" xuất BẢNG CHẤM CÔNG_NGOÀI GIỜ của tháng đang
     xem, điền thẳng vào mẫu giấy của công ty (public/mau-tang-ca.xlsx) nên in ra giống hệt bản đang dùng: giữ khung,
     đường kẻ, ô ký tên, khổ giấy và công thức cột Số giờ. Chỉ lấy giờ ĐÃ GỬI. App không lưu giờ vào/ra nên
     V = giờ bắt đầu khung, R = V + số giờ đã chấm; cột Số tiền để trống cho kế toán. Mỗi nửa tháng chứa 2 công
     trình, dư ra thì báo cho người xuất biết chứ không nuốt dữ liệu. Sửa 13 công thức sai sẵn có trong mẫu
     (ngày 16 của CRM 3 bị trừ ngược dấu, CRM 4 bỏ quên hẳn ngày 16, CRM 3 để hệ số 1.5 cho hai khung đêm).

   Mới ở v13.28 — Chấm công (màn nhân viên): lăn bánh xe chuột khi con trỏ đang ở ô giờ không còn tăng / giảm
     số giờ nữa (hành vi mặc định của ô số trên trình duyệt). Ô tự bỏ tiêu điểm khi lăn, nên trang cuộn bình
     thường. Áp cho cả lưới tuần trên máy tính và ô nhập trên điện thoại. Gõ số và nút +/- 0.5 giữ nguyên.

   Mới ở v13.27 — Bỏ tab con "Nhân sự" trong tab Bảng công, thanh tab con còn Bảng công | Giờ ngoài dự án
     (bảng chi tiết bấm vào tên nhân sự ở v13.24-v13.26 đã thay được phần đó). Ai đang để localStorage ở tab
     Nhân sự thì tự quay về Bảng công. Thanh số liệu Bảng công thêm ô "Đang quá tải" (số người quá tải / tổng
     người đang làm, đỏ khi có người quá tải), dùng cùng allocState với chip ở cột TỔNG / CHUẨN; thanh trở lại 5 ô.

   Mới ở v13.26 — Bảng công: bấm thẳng vào TÊN nhân sự để bung bảng chi tiết giờ theo dự án / tác vụ (trước là mở
     ngăn kéo sửa giờ công); mũi tên ‹ › trước tên cho biết đang đóng hay mở. Bỏ hẳn nút "..." khỏi giao diện.
     Sửa giờ công giờ đi qua nút bút chì ở cột MỞ KHOÁ / SỬA (chế độ Tuần) hoặc bấm vào ô ngày rồi chọn sửa.

   Mới ở v13.25 — Bảng công, bảng chi tiết "...": rê chuột vào một dòng dự án thì hiện thẻ chú thích giống tab
     Nhân sự — danh sách tác vụ của người đó trong đúng dự án đó (giờ và %, tăng ca xanh ngọc xếp cuối, trống việc
     xám), kèm "Chiếm trong tổng giờ dự án" (% trên tổng giờ đã gửi của dự án trong kỳ, tính trên toàn bộ nhân sự
     chứ không theo bộ lọc) và "Giai đoạn".

   Mới ở v13.24 — Bảng công: thêm nút "..." cạnh tên từng nhân sự (cả chế độ Tuần và Tháng). Bấm vào bung một hàng
     chi tiết ngay dưới dòng đó, gồm hai bảng Dự án và Tác vụ (giờ và %), đúng như phần chi tiết của tab Nhân sự:
     chỉ tính giờ đã gửi, vắng mặt và việc chung gom vào "Việc chung, vắng mặt", tăng ca ghi "Tăng ca · tác vụ"
     màu xanh ngọc và xếp cuối, trống việc màu xám. % dùng chung hàm pct100 nên cộng lại đúng 100. Nút tên vẫn mở
     ngăn kéo sửa giờ như cũ, mở được nhiều người cùng lúc.

   Mới ở v13.23 — Bảng công, nút phễu lọc thêm hai mục: lọc theo mức tải (Quá tải / Bình thường / Trống việc /
     Thiếu giờ) và sắp xếp theo tải (Tải nhiều → ít, Tải ít → nhiều). Mức tải lấy từ cùng allocState và công thức %
     của chip ở cột TỔNG / CHUẨN nên khớp tab Nhân sự. Khi đang sắp theo tải thì bỏ gom bộ phận để thứ tự đúng trên
     toàn danh sách; người chưa có giờ chuẩn luôn xếp cuối. Xoá lọc trả cả hai mục về mặc định.

   Mới ở v13.22 — Bảng công, cột TỔNG / CHUẨN của từng nhân sự: bỏ ghi chú "trống x h", thay bằng chip trạng thái tải
     (Quá tải / Thiếu giờ / Trống việc / Bình thường · %) dùng chung allocState và công thức % của tab Nhân sự
     (tải = tổng giờ − trống việc, % = tải / giờ chuẩn kỳ) nên hai tab luôn khớp nhau. Giờ trống việc vẫn còn ở
     khúc xám trên thanh và ở tooltip.

   Mới ở v13.21 — Bảng công, thanh số liệu rút còn 4 ô và mỗi ô gói trong ĐÚNG MỘT dòng (nowrap, không xuống dòng thứ hai):
     Tổng giờ đã gửi hiện "657 / 616 h chuẩn · vượt 41 h (+6.7%)"; gộp "Giờ làm việc" với "Trong đó cố gắng · OT" thành một ô
     "Giờ làm việc" = số giờ · % trên tổng đã gửi · cố gắng (h và % trong giờ làm việc) · OT (h và % trong giờ làm việc);
     bỏ thanh chia khúc của v13.20 (đã thay bằng số); điện thoại xếp một cột để không ô nào bị xuống dòng.

   Mới ở v13.20 — Bảng công, thanh 5 ô số liệu làm rõ mẫu số của từng tỷ lệ: Tổng giờ đã gửi thêm mức chịu tải
     (vượt/hụt bao nhiêu h và bao nhiêu % so với giờ chuẩn, hổ phách khi vượt, đỏ khi vượt quá 5%);
     Giờ làm việc ghi "% tổng" và có thanh chia khúc chuẩn · cố gắng · OT; "Trong đó cố gắng · OT" đổi mẫu số
     từ tổng giờ đã gửi sang GIỜ LÀM VIỆC cho đúng nghĩa "trong đó"; Giờ khác bỏ tooltip, hiện thẳng
     "% tổng · vắng mặt … h · trống việc … h".

   Mới ở v13.19 — Bảng công, thanh trạng thái thành 5 ô số liệu (bỏ thanh màu): Đã nộp đủ · Tổng giờ đã gửi · Giờ làm việc (gồm
     cố gắng và OT, h và %) · Trong đó cố gắng · OT (h và % trên tổng) · Giờ khác (vắng mặt + trống việc, rê chuột hiện chi tiết).

   Mới ở v13.18 — Bảng công, thanh trạng thái: bỏ ô Chưa nộp / còn nháp, Thiếu giờ chuẩn, Trong đó tăng ca; thêm thanh "Tỷ lệ giờ
     đã gửi": Giờ làm việc (dự án + việc chung, trừ vắng mặt, trống việc, cố gắng) · Giờ công khác (vắng mặt + trống việc) ·
     Giờ cố gắng · Giờ OT, mỗi phần % và giờ.

   Mới ở v13.17 — Bảng công tách hai khung: thanh trạng thái chung (Đã nộp đủ, Chưa nộp, Tổng giờ, Tăng ca, Thiếu giờ) ở trên;
     bảng chấm công ở dưới, dòng đầu là thanh Tuần / Tháng, lịch, phễu lọc, tìm, (?), Khoá quá hạn, Xuất Excel.

   Mới ở v13.16 — Lịch: bỏ dòng "Hôm nay" ở cuối (CalendarPanel). Ô lịch theo chuẩn ô của Bảng công (rộng 160px, chữ giữa,
     không biểu tượng): Nhân sự, Giờ ngoài dự án, Ma trận, ô tuần ở Chấm công, ô ngày ở Thiết lập › Ngày lễ.

   Mới ở v13.15 — Ô lịch chỉ ghi ngày/tháng (bỏ năm, số ngày, biểu tượng). Phễu lọc: đang lọc thì hiện (x) ở góc, bấm là tắt hết
     bộ lọc (FilterButton, áp cho mọi phễu). Bảng công: chữ "Tuần …" thay bằng ô lịch PeriodField như Nhân sự — chọn ngày là
     nhảy tới tuần / tháng chứa ngày đó.

   Mới ở v13.14 — Gộp vai trò vào team (planning.merge) chuyển sang Nhân sự › Tác vụ › Phòng ban & vai trò: mỗi chip vai trò có ô
     "team" (→ 2D…), team chính ghi các vai trò gộp vào. Bỏ nút / bảng Gộp vai trò ở tab Kế hoạch.

   Mới ở v13.13 — Bộ lọc vai trò lọc theo TEAM: dùng bảng Gộp vai trò của Kế hoạch (cfg.planning.merge, vd TL-2D → 2D, TLTK → TK),
     chọn 2D là ra cả Teamleader 2D. Ô chọn chỉ liệt kê team, ghi kèm vai trò gộp ("2D · Họa viên 2D + TL-2D").

   Mới ở v13.12 — Bảng công, Nhân sự, Giờ ngoài dự án, Ma trận: ô Bộ phận + Vai trò gom vào nút phễu lọc (FilterButton ở core/ui.jsx),
     phễu sáng và có số khi đang lọc. Bảng chú thích (?) bỏ chữ "Thanh tổng:".

   Mới ở v13.11 — Bảng công, Nhân sự, Giờ ngoài dự án, Ma trận: ô lọc "Mọi vai trò" cạnh ô Bộ phận (vai trò đang có người,
     thu theo bộ phận đang chọn). Bảng công: chú thích màu gộp vào nút (?) cạnh Khoá quá hạn. Khung Hỗ trợ dự án luôn thu gọn
     khi mở trang.

   Mới ở v13.10 — Nhân sự, Giờ ngoài dự án, Ma trận: nút "Tuần này" / "Tháng này" cạnh mũi tên ›, chỉ hiện khi đang xem kỳ khác
     (giống tab Bảng công). Mọi lịch tự vẽ (CalendarPanel: ô chọn khoảng ngày, ô chọn ngày, lịch Chấm công) khoanh đỏ ngày lễ
     theo danh sách ở Thiết lập, rê chuột hiện tên ngày lễ.

   Mới ở v13.9 — Giờ ngoài dự án: thanh năng lực ghi "% · giờ" trong từng đoạn, chú thích chỉ còn tên; bỏ thanh "So với giờ chuẩn
     của kỳ" và đoạn giải thích. Xem theo Tác vụ: ba cột Việc chung | Trống việc | Vắng mặt, mỗi tác vụ mở sẵn danh sách người.

   Mới ở v13.8 — Thanh thời gian của Nhân sự, Giờ ngoài dự án (Bảng công) và Ma trận (Dashboard):
     · Bỏ tiêu đề + dòng kỳ / giờ chuẩn, bỏ nút Tuần này / Tuần trước / 7 ngày qua; bỏ chú thích "giờ chuẩn của kỳ",
       "thiếu giờ chuẩn", "Bấm một người…" ở tab Nhân sự.
     · [Tuần | Tháng] ‹ ô lịch › : mặc định tuần này (T2 → hôm nay); ‹ › lùi / tiến một tuần hoặc một tháng, không quá kỳ hiện tại;
       ô lịch chọn khoảng tuỳ ý, khi đó ‹ › dịch đúng bằng độ dài khoảng.

   Mới ở v13.7 — Trưởng phòng: tab Bảng công có đủ 3 tab con Bảng công | Nhân sự | Giờ ngoài dự án như Admin.
     Nhân sự và Giờ ngoài dự án chỉ xem, chỉ nhân sự phòng mình (gồm cả trưởng phòng), cùng nguồn với Ma trận của trưởng phòng.

   Mới ở v13.6 — Tác vụ Teamleader:
     · Nhân sự › Tác vụ: ô "Teamleader · chỉ teamleader" trong nhóm Cấp quản lý (task.tl = true).
     · Phòng ban & vai trò: mỗi vai trò có nút TL để đánh dấu cấp Teamleader (role.tl); chưa bấm lần nào thì mã bắt đầu bằng TL
       (TLTK, TL-2D) coi như đã đánh dấu.
     · Chấm công: chỉ người có vai trò cấp Teamleader thấy tác vụ Teamleader (Trưởng phòng, BOD không thấy); nhóm "Teamleader"
       (nhãn vàng) đứng trước nhóm Quản lý, chọn được dưới dự án và ở Khác như tác vụ quản lý.

   Mới ở v13.5 — Chấm công: tác vụ quản lý đứng thành nhóm "Quản lý" riêng (nhãn tím).
     Khối Khác: Công việc chung → Quản lý → Vắng mặt. Khối dự án: Công việc dự án → Quản lý → Tăng ca.
     Ô chọn hạng mục và bảng thêm tác vụ trên điện thoại cũng tách nhóm Quản lý.

   Mới ở v13.4 — Tác vụ quản lý:
     · Nhân sự › Tác vụ có thêm ô "Quản lý · trưởng phòng trở lên" (task.mgr = true, không gắn vai trò).
     · Chấm công: chỉ tài khoản cấp Trưởng phòng / BOD / Admin thấy tác vụ quản lý; Nhân viên và Teamleader không thấy.
       Admin mở bảng công của một người: hiện khi người đó là cấp Trưởng phòng trở lên (đọc cấp từ danh sách tài khoản);
       Trưởng phòng mở bảng công nhân viên trong phòng: không hiện. Dòng cũ đã có giờ vẫn hiện.
     · Tác vụ quản lý chọn được dưới dự án (tính giờ dự án) và ở "Khác" (tính việc chung); Giờ ngoài dự án tính theo đúng chỗ chấm.

   Mới ở v13.3 — Kế hoạch:
     · So với thực tế: dự án đã đóng hoặc tạm ẩn không tính phần kế hoạch (đồng bộ với Nhập liệu và Tổng quan nguồn lực);
       có giờ chấm trong khoảng thì vẫn hiện phần thực tế kèm nhãn "đã đóng". Dòng "chưa ai làm" ghi thêm "chưa giao ai"
       khi dự án không có ai được giao.
     · Theo dự án: trạng thái mới "Thiếu người được giao" khi dự án đang mở, có kế hoạch từ tuần này trở đi, mà có vai trò
       trong kế hoạch chưa ai thuộc vai trò đó được giao (thành viên dự án hoặc đang hỗ trợ; không tính quyền tất cả dự án,
       người bỏ khỏi kế hoạch, người nghỉ việc). Dòng dự án ghi rõ "chưa giao TK, 3D…". Lọc "Đang lệch" gồm cả trạng thái này.

   Mới ở v13.2 — Kế hoạch › So với thực tế (features/planning/PlanActual.jsx):
     · Công tắc Đơn vị Người / Giờ, mặc định Giờ. Giờ = tổng giờ trong khoảng đang xem (kế hoạch = số người × giờ chuẩn tuần);
       Người = bình quân mỗi tuần như v13.1. Đổi theo cả hàng số liệu, bảng dự án, bảng vai trò và biểu đồ lũy kế.
     · Bảng vai trò của dự án bấm mở / đóng từng vai trò (vai trò lệch tự mở): ai thuộc vai trò đã chấm bao nhiêu giờ,
       chiếm bao nhiêu % giờ của người đó, gánh bao nhiêu % kế hoạch vai trò; vai trò thiếu thì liệt kê người cùng vai trò
       đang làm ở dự án nào. Bỏ danh sách "Ai đã chấm" riêng vì đã nằm trong từng vai trò.

   Mới ở v13.1 — Kế hoạch thêm chế độ thứ ba "So với thực tế" (features/planning/PlanActual.jsx, chỉ đọc):
     · So kế hoạch (lưới hiện tại hoặc một bản chốt) với giờ ĐÃ GỬI vào từng dự án; thực tế (người) = giờ ÷ giờ chuẩn một tuần.
       Giờ tính theo vai trò của người chấm (vai trò gộp như lưới). Khoảng: tuần trước / 4 tuần gần nhất / từ khi có giờ chấm.
     · Hàng số liệu: kế hoạch, thực tế đổ vào dự án (kèm giờ việc chung / vắng và số người chưa gửi), % làm đúng dự án đúng vai trò,
       dự án có kế hoạch mà chưa ai làm, giờ làm ngoài kế hoạch.
     · Bảng dự án nhóm theo kết luận: chưa ai làm · ngoài kế hoạch · đủ người nhưng lệch vai trò · nhiều hơn · ít hơn · đúng kế hoạch;
       thanh lệch và từng vai trò "kế hoạch → thực tế". Bấm một dự án: bảng vai trò, ai đã chấm bao nhiêu giờ, biểu đồ lũy kế.

   Mới ở v13.0 — Dashboard › Tổng quan nguồn lực, chọn dự án ở bảng "Dự án chiếm vai trò đang thiếu":
     · Biểu đồ chỉ còn các vai trò có trong dự án (vai trò khác tạm tắt, chip hiện nét đứt). Trong đó chỉ tuần dự án
       đang làm thiếu mới giữ màu: phần thiếu của chính dự án tô đậm có viền, phần của dự án khác nhạt; còn lại xám.
       Số trên đỉnh cột là phần thiếu dự án góp vào tuần đó. Có thanh "Đang xem dự án" và nút "× Bỏ chọn dự án".
     · Khung bên phải chuyển sang tình trạng riêng của dự án: số tuần dùng vai trò đang thiếu, % phần thiếu của công ty,
       người bình quân / tuần, đỉnh, dải từng tuần (bấm để xem tuần), và từng vai trò của dự án.
     · Bấm một tuần trên biểu đồ thì khung phải hiện nhân lực tuần đó (chỉ các vai trò của dự án, dòng dự án tô teal),
       có đường "‹ Về tình trạng dự án".

   Mới ở v12.37 — Chấm công (máy tính):
     · N1 bấm thẳng vào ô giờ của khối đang đóng: khối tự mở, con trỏ nằm sẵn ở đúng ô đó (nút bút chì vẫn dùng được).
     · N3 đường gióng: ô đang nhập thì cả dòng tác vụ tô nhạt và tiêu đề ngày của ô đó sáng lên.
     · N6 phím Esc khi đang nhập = bấm ✓ (tạm lưu, đóng khối); Enter ở dòng cuối của khối nhảy sang ngày kế tiếp, dòng đầu khối.

   Mới ở v12.36 — Bảng công: nút bút chì "Sửa giờ của khối này" có viền teal, nền teal nhạt và quầng sáng nhịp nhẹ
     (chu kỳ 2,4 giây) để mọi người dễ thấy. Có màu riêng cho mode sáng / tối; máy bật giảm chuyển động thì sáng đứng yên.

   Mới ở v12.35 — Kế hoạch › Nhập liệu:
     · Đường gióng khi rê chuột: tô nhạt cả dòng vai trò (kể cả ô tên), cả cột tuần từ tiêu đề xuống khối CÒN,
       và dòng CÒN của đúng vai trò đó ở khối Toàn công ty. Không vẽ lại lưới khi rê (ghi thẳng vào một thẻ style).
     · Bỏ icon thùng rác. Máy tính: rê chuột vào dòng vai trò hiện × nhỏ; dòng trống xoá ngay, dòng đã có số thì hỏi Xoá / Không.
       Điện thoại: ấn giữ tên vai trò 1 giây hiện hộp Xoá / Không (xê dịch hoặc nhả sớm thì huỷ).
     · Nút ẩn vai trò ở khối TOÀN CÔNG TY · CÒN cũng chỉ hiện khi rê chuột; điện thoại ấn giữ 1 giây để hỏi ẩn.

   Mới ở v12.34 — Kế hoạch: bỏ chế độ Tổng quan, chỉ còn Nhập liệu | Theo dự án. Phần thiếu / dư người trùng với
     Dashboard › Tổng quan nguồn lực (và dòng CÒN ở Nhập liệu) nên chỉ xem ở đó. Xuất Excel, Chốt bản, giờ thực tế giữ nguyên.
     File features/planning/PlanOverview.jsx để lại, không còn dùng.

   Mới ở v12.33 — Kế hoạch › Nhập liệu, thang màu ô CÒN (khối Toàn công ty và dòng CÒN ở Từng dự án), bỏ màu vàng, chỉ còn 3 loại:
     · từ −0,5 đến 0,5: không tô, giữ nền theme
     · trên 0,5: xanh lá, chuyển sắc liên tục — 0,5 nhạt nhất, từ 3 trở lên đậm nhất
     · dưới −0,5: đỏ, chuyển sắc liên tục — −0,5 nhạt nhất, từ −3 trở xuống đậm nhất · nền đậm thì chữ trắng

   Mới ở v12.32 — Kế hoạch › Nhập liệu: ô CÒN từ 0 đến 1 ở mode tối đổi sang vàng trong (nền #3f3a17, chữ #fde047)
     thay cho nền nâu #422006 bị đục. Mode sáng giữ nguyên.

   Mới ở v12.31 — Kế hoạch › Nhập liệu:
     · Dòng tên dự án to ×1,2 (chữ 15px, dòng cao 34px); tên vai trò trong dự án mờ 80%.
     · Tuần hiện tại ở mode sáng đậm hơn: ô nền #ccfbf1, số tuần ở tiêu đề chữ trắng nền teal.
     · Ô CÒN (khối Toàn công ty và dòng CÒN ở Từng dự án): lớn hơn 1 nền xanh lá, càng gần 1 càng nhạt, từ 4 trở lên đậm nhất;
       từ 0 đến 1 nền vàng nhạt; âm nền đỏ, càng âm càng đậm, từ −3 trở xuống đậm nhất. Nền đậm thì chữ trắng.

   Mới ở v12.30 — Kế hoạch › Nhập liệu:
     · Bỏ thanh nhập nhanh (Dự án · Vai trò · từ · đến · Áp dụng · Xoá đoạn). Núm kéo điền và mọi phím tắt giữ nguyên.
     · "Về tuần này" chuyển lên hàng công cụ, cạnh nút Toàn bộ | Từng dự án.
     · Lưới nhập theo theme html mẫu: ô nền trắng, ô trống để trống, vai trò có chấm màu và ghi đủ tên, dòng dự án nền xám nhạt
       kèm khoảng tuần, cột tuần này nền xanh nhạt, ô đang chọn viền xanh đậm. Màu đặt bằng biến CSS riêng của lưới, có bộ sáng / tối.
     · Khối "TOÀN CÔNG TY · CÒN" dính đáy ngay trong lưới, mỗi vai trò đúng 1 dòng ("TK · có 5", số có = quân số × hệ số sẵn sàng),
       số âm chữ đỏ nền đỏ nhạt. Bỏ dòng "cần", bỏ bảng tổng tách riêng, bỏ dải "cần — vai trò / còn lại".
       Admin vẫn thêm / ẩn / kéo đổi thứ tự vai trò trong khối này.

   Mới ở v12.29 — Kế hoạch › Nhập liệu:
     · Thanh nhập nhanh trên lưới: chọn dự án, vai trò, từ tuần, đến tuần, số người / tuần → Áp dụng ghi cả đoạn một lượt;
       Xoá đoạn đưa đoạn đó về 0. Dự án chưa có vai trò đó thì tự thêm dòng. Ô vừa điền sáng lên một nhịp.
     · Núm kéo điền ở góc phải dưới ô đang chọn: kéo sang ngang trên cùng dòng để chép số của ô đó cho cả đoạn.
     · Nút chuyển "Toàn bộ | Từng dự án". Từng dự án: danh sách dự án bên trái (khoảng tuần có kế hoạch, dấu có tuần thiếu người),
       bên phải là lưới riêng dự án đang chọn — chỉ vai trò của dự án, chỉ các tuần dự án chạy (− tuần / + tuần để nới),
       dưới mỗi vai trò là dòng CÒN toàn công ty. Cùng dữ liệu, cùng tự lưu như lưới Toàn bộ.
     · Giữ nguyên mọi phím tắt cũ: + / − tăng giảm 0,25, Ctrl + D, Ctrl + C / V, Shift + mũi tên, Delete.

   Mới ở v12.28 — Sửa lỗi điện thoại: bấm "+ Nhân sự" ở tab Dự án hoặc thêm dự án cho nhân sự ở tab Nhân sự thì bảng chọn
     vừa mở đã tự tắt. Nguyên nhân: hai bảng chọn này đóng ở MỌI sự kiện resize, mà ô tìm kiếm tự bật bàn phím ảo khi mở —
     bàn phím làm đổi chiều cao màn hình, trình duyệt phát resize, bảng đóng ngay. Cuộn trang cũng gây lỗi vì thanh địa chỉ
     của trình duyệt điện thoại co giãn. Sửa: chỉ đóng khi BỀ NGANG đổi (xoay máy, kéo cửa sổ); trên điện thoại không tự bật
     bàn phím khi mở bảng nữa (chạm vào ô tìm kiếm khi cần), máy tính vẫn tự trỏ vào ô tìm kiếm như cũ.

   Mới ở v12.27 — Mode sáng của Tổng quan nguồn lực và Kế hoạch › Theo dự án:
     · Sửa lỗi rê chuột vào một dòng ra dải xám đen. Nguyên nhân: LIGHT_CSS tự sinh bằng cách đảo từng class Tailwind
       của mode tối, class có tiền tố hover: hoặc độ mờ /60 không nằm trong danh sách đã sinh thì giữ nguyên màu tối
       (hover:bg-slate-900/60, border-slate-800/60, hover:bg-teal-950, bg-cyan-700/80). Hai màn này giờ đặt màu
       theo theme ngay trong code (bảng TONE), không trông vào LIGHT_CSS nữa; quét lại còn 0 class lọt.
     · Dòng đang chọn trong bảng dự án: nền xanh ngọc nhạt, vạch xanh bên trái, tên dự án màu xanh, giữ nền khi rê chuột.
     · Tuần không liên quan tới dự án đang chọn tô xám trung tính thay vì làm trong suốt 22% — trên nền trắng cách cũ
       biến cam thành kem, xanh thành tím phấn, nhìn như một màu khác chứ không phải đang bị làm mờ.
     · Tuần đang chọn là một dải nền nhạt sau cột, số tuần đậm màu xanh, thay cho khung nét đứt đen.
     · Chip vai trò đang tắt: ô màu chỉ còn viền, viền chip nét đứt — thay vì làm nhạt cả chip.
     · Phần dư nền nhạt hơn, viền rõ hơn, số dư màu đậm hơn; dải nhiệt từng tuần dùng thang đỏ liền
       từ hồng nhạt tới đỏ đậm; hai ô người thiếu / người dư có viền mảnh.
     Mode tối giữ nguyên màu cũ, chỉ đổi cách làm mờ tuần và cách đánh dấu tuần đang chọn để hai mode hành xử như nhau.
     Cả hai màn nghe sự kiện đổi theme nên bấm Sáng / Tối là đổi màu ngay.

   Mới ở v12.26 — Dashboard › Tổng quan nguồn lực dựng lại phần hiển thị, số liệu và cách tính không đổi:
     · Dải tóm tắt cho CẢ giai đoạn đang xem (12 / 24 / 36 tuần): bao nhiêu tuần có thiếu, thiếu bình quân mỗi tuần
       kèm phần trăm quân số, đỉnh thiếu rơi vào tuần nào, vai trò thiếu nhiều nhất tính bằng người-tuần cộng dồn.
       Trước đây màn chỉ có số của MỘT tuần đang chọn nên không biết thiếu là đỉnh tạm thời hay kéo dài —
       hai thứ đó dẫn tới hai cách xử lý khác hẳn nhau. Thêm dòng vai trò đang dư ≥ 1 người trong ≥ 3 tuần.
     · Bảng "Dự án chiếm vai trò đang thiếu" dưới biểu đồ: xếp hạng theo người-tuần mà dự án đặt vào các vai trò
       đang thiếu, thanh màu tách theo vai trò, dải nhiệt từng tuần. Bấm một dòng thì biểu đồ làm mờ những tuần
       dự án đó không góp mặt. Con số là NHU CẦU của dự án (giãn dự án này thì giải phóng được bấy nhiêu),
       nên tổng các dòng lớn hơn tổng thiếu — một tuần thiếu 2 người có thể do bốn dự án cùng đặt người vào.
     · Khung chi tiết bên phải gom theo từng vai trò thiếu, dự án nằm dưới vai trò đó nên mã vai trò không lặp
       ở mỗi dòng; vai trò dư và vai trò vừa đủ gộp thành một dòng cuối. Khung cao đúng bằng cột trái rồi cuộn
       bên trong, thay vì kéo dài làm cột trái bỏ trống gần nửa màn hình.
     · Chip vai trò mang luôn đỉnh thiếu ("2D ▲6,5"), xếp theo mức nghẽn, và lọc đồng bộ cả bốn khối.
     · Phần dư dưới vạch 0 sáng hơn và có viền màu vai trò (trước mờ 0,32 nên thành một mảng đục, không đọc được
       vai trò nào đang rảnh); thêm tổng số dư ghi dưới chân cột, đối xứng với tổng thiếu trên đỉnh.

   Mới ở v12.25 — Trưởng phòng xem được Dashboard › Dự án và Ma trận: tab Dashboard của trưởng phòng thành thanh
     tab con "Của tôi | Dự án | Ma trận" (nhân viên thường không đổi, vẫn chỉ có Dashboard cá nhân).
     Hai tab mới dùng lại đúng Dashboard quản lý, chỉ xem, phạm vi nhân sự là phòng mình và GỒM cả chính trưởng phòng
     (headCfg của Bảng công cố tình loại họ ra, nhưng Ma trận thiếu chính họ thì tổng của phòng bị hụt).
     Hai tab này không nhận saveCfg nên nút Urgent trên Tiến độ dự án tắt sẵn — truyền headSave vào thì nó so với
     headCfg (không có chính trưởng phòng) và báo nhầm "Trưởng phòng không thêm được nhân sự".
     Cần chạy supabase/v12_25_truongphong_dashboard.sql: hai hàm tổng hợp artius_usage và artius_phase_detail
     đang chặn bằng artius_view_all() = admin/bod, mà đó là điều kiện WHERE chứ không phải RAISE, nên trưởng phòng
     gọi vào nhận RỖNG chứ không báo lỗi — tab Dự án sẽ hiện đủ dự án với giờ đã dùng = 0. File SQL thêm một hàm
     riêng artius_view_agg() (admin/bod/head) cho đúng hai hàm tổng hợp đó; artius_view_all() giữ nguyên nên
     quyền đọc bảng công và mọi hàm khác không đổi. Không chạy file SQL thì Ma trận vẫn đúng, chỉ Dự án là trống.
     Lưu ý phạm vi: hai hàm đó trả số toàn công ty, nên trưởng phòng thấy giờ và ngân sách của mọi dự án,
     kể cả dự án phòng họ không tham gia. Cột "Người tuần này" ở Tiến độ dự án chỉ đếm người phòng mình.

   Mới ở v12.24 — Tab Kế hoạch thêm chế độ thứ ba "Theo dự án" (features/planning/PlanProjects.jsx), cạnh Nhập liệu và
     Tổng quan: mỗi dòng là một dự án, gộp sẵn trạng thái chấm công, khoảng thời gian kế hoạch (tuần đầu → tuần cuối,
     số tuần, người-tuần), dải thời gian từng vai trò có vạch đánh dấu tuần hiện tại, và nút Đóng / Mở bấm ngay tại chỗ
     — không phải chuyển qua tab Dự án nữa.
     Cột "Đang lệch" so khoảng thời gian kế hoạch với trạng thái đang bật/tắt: "Nên mở" khi kế hoạch đang chạy tuần này
     mà dự án đã đóng, "Nên đóng" khi kế hoạch đã hết, chưa tới hạn, hoặc dự án mở mà chưa nhập kế hoạch tuần nào.
     App chỉ gợi ý, không tự đóng/mở. Lọc nhanh Tất cả | Đang lệch | Đang mở | Đã đóng, tìm theo tên không dấu.
     Bung một dòng để xem vai trò theo kế hoạch và người tham gia — ghép người được gắn ở tab Nhân sự (nhãn "gắn")
     với người đã chấm giờ nhưng chưa được gắn (nhãn "ngoài"), kèm số giờ đã chấm.
     Người tham gia gom theo VAI TRÒ, tiêu đề mỗi nhóm mang luôn con số kế hoạch của vai trò đó
     ("kế hoạch 3/tuần · 2 người") để soi chéo ngay; vai trò kế hoạch có nhưng chưa ai làm vẫn hiện thành nhóm rỗng
     ghi "chưa có ai" (màu hổ phách), người có vai trò ngoài kế hoạch gom vào nhóm "ngoài kế hoạch".
     Vai trò của người đi qua bảng gộp vai trò (vd TL-2D → 2D) để khớp với vai trò trong lưới kế hoạch.
     Danh sách này kể cả dự án ĐÃ ĐÓNG, nếu không thì không bao giờ gợi ý được "nên mở".
     Nút Đóng / Mở chỉ Admin dùng được: lệnh lưu kế hoạch của BOD chỉ ghi được khoá "planning", không ghi được
     projects[].active — tài khoản BOD thấy cảnh báo nhưng cột nút hiện "chỉ xem".

   Mới ở v12.23 — Tổng quan nguồn lực, chỉnh phần nhìn: bỏ dòng phụ đề dưới tiêu đề, bỏ dòng chú thích dưới chân
     biểu đồ và bỏ hai nhãn trục "THIẾU người" / "DƯ người".
     Biểu đồ vẽ đúng bề ngang thật của khung (đo bằng ResizeObserver) thay vì để viewBox kéo giãn — trước đây viewBox
     980 đơn vị bị kéo ra ~1900px nên cỡ chữ bị nhân gần gấp đôi; nay cỡ chữ là pixel thật trên mọi màn hình:
     tháng 10,5px · tuần 9px · số thiếu trên đỉnh cột 9,5px.
     Số tuần chuyển lên nằm ngay dưới số tháng ở đầu biểu đồ (trước nằm ở đáy); nhãn tháng canh giữa khối tuần của
     chính nó nên không còn dính nhau kiểu "T10·26T11"; tuần đang chọn thì số tuần sáng lên.

   Mới ở v12.22 — Dashboard thêm tab "Tổng quan nguồn lực", đứng đầu thanh tab (features/dashboard/ResourceOverview.jsx
     + ResourcePane.jsx, tải rời và có vỏ bắt lỗi riêng như PlanPane):
     một biểu đồ cột chồng hai chiều cho cả công ty lẫn từng vai trò theo tuần — trên vạch 0 là người thiếu,
     dưới là người dư, mỗi đoạn màu là một vai trò; không bù trừ hai bên nên vai trò đang dư không che vai trò đang thiếu.
     Biểu đồ để trần, không nhãn trục và không dòng chú thích dưới chân.
     Bấm một cột để xem chi tiết tuần đó (cần / có từng vai trò, % quân số của vai trò thiếu, dự án đang chiếm).
     Đổi đơn vị Số người / % quân số công ty; xem 12 · 24 · 36 tuần kể từ tuần hiện tại; chip bật tắt từng vai trò.
     Vạch 0 tự đặt theo tỉ lệ thiếu / dư đang có nên biểu đồ không để trống nửa dưới; khung chi tiết bên phải rộng 420px,
     tên dự án viết đủ (mã dự án chỉ đi kèm, không thay cho tên).
     Đoạn nhỏ vẫn vẽ dày tối thiểu 3px để không mất hút. Màn này CHỈ ĐỌC — lưới nhập vẫn ở tab Kế hoạch,
     dùng chung nguồn số liệu và quy tắc với tab đó (quân số × hệ số sẵn sàng, dự án tạm ẩn, vai trò gộp).
     Tắt mục Kế hoạch trong Thiết lập thì tab này cũng ẩn theo.

   Mới ở v12.21 — Thanh bên (Admin / BOD): Kế hoạch lên ngay dưới Dashboard, trên Bảng công; Tác vụ gộp vào mục Nhân sự
     thành tab con (Nhân sự | Tác vụ). Trưởng phòng và nhân viên không đổi.
   Mới ở v12.20 — Tab "Nhân sự" và "Giờ ngoài dự án" chuyển từ Dashboard sang tab Bảng công (thanh tab con:
     Bảng công | Nhân sự | Giờ ngoài dự án), áp dụng cho Admin và BOD. Dashboard còn Dự án | Ma trận. Trưởng phòng không đổi.
   Mới ở v12.19 — BOD sửa được toàn bộ mục Kế hoạch như Admin: lưới, chốt bản, ẩn dự án, gộp vai trò, khối tổng, hệ số
     sẵn sàng. Cần chạy supabase/v12_19_bod_ke_hoach.sql (lưới + chốt bản cho Admin/BOD; hàm artius_planning_set chỉ ghi
     khoá "planning" của thiết lập chung). Các mục khác của BOD vẫn chỉ xem.
   Mới ở v12.18 — Kế hoạch: (1) TỔNG TOÀN CÔNG TY tách thành bảng riêng dưới lưới nhập, có hàng tiêu đề tháng / tuần
     riêng, cuộn ngang đồng bộ; (2) màu CÒN LẠI: ≥ 0 xanh lá, thiếu tới 1 người vàng, thiếu hơn 1 người đỏ;
     (3) khung chi tiết khi bấm ô ở Bản đồ tải không còn nền xám ở giao diện Sáng.
   Mới ở v12.17 — Nhân sự: ô "Tính vào Kế hoạch nguồn lực" trong khung sửa nhân sự (bỏ tích cho người thử việc…). Người bị bỏ
     không tính vào quân số, giờ thực tế và điều kiện "tuần đủ giờ" của mục Kế hoạch; chấm công vẫn bình thường.
     Danh sách nhân sự hiện nhãn "Không tính KH", bấm để tính lại.
   Mới ở v12.16 — Kế hoạch: nút "Gộp vai trò" (Admin) gộp vai trò con vào vai trò chính, vd TL-2D → 2D, TLTK → TK.
     Trong Kế hoạch, quân số, nhu cầu và giờ thực tế của vai trò con tính vào vai trò chính; dòng cũ của vai trò con trong
     dự án được cộng vào dòng vai trò chính rồi tự lưu. Vai trò ở tab Nhân sự không đổi. Thiết lập chung (planning.merge).
   Mới ở v12.15 — Kế hoạch, khối TỔNG TOÀN CÔNG TY: Admin thêm vai trò (dấu + ở tiêu đề khối), ẩn vai trò (con mắt cuối dòng —
     ẩn luôn ở Tổng quan và Excel), kéo ⋮⋮ đổi thứ tự dòng. Lưu trong thiết lập chung (planning.totals), mọi người thấy như nhau.
   Mới ở v12.14 — Kế hoạch: (1) kéo thả dự án đổi vị trí (cầm ⋮⋮ ở dòng tên dự án; thứ tự riêng từng máy);
     (2) nút con mắt tạm ẩn một dự án: thu gọn, mờ, KHÔNG tính vào dòng tổng / Tổng quan / Excel, số đã nhập giữ nguyên;
     lưu trong thiết lập chung (planning.hidden) nên mọi người thấy như nhau; (3) nút "+ vai trò" thu lại thành dấu +.
   Mới ở v12.13 — Kế hoạch: TỰ LƯU sau khi ngừng gõ 2 giây (đầu lưới hiện Đang lưu… / Đã lưu lúc …); nút Lưu vẫn để ghi ngay.
     Đổi cặp năm thì lưu nốt phần dở trước; đóng tab khi còn số chưa lưu thì trình duyệt hỏi lại. Lỗi lưu hiện nguyên câu
     của Supabase. Chốt bản vẫn bấm tay.
   Mới ở v12.12 — Kế hoạch → Nhập liệu: phím + / − tăng / giảm 0,25 người cho ô đang đứng hoặc cả vùng đang chọn.
   Mới ở v12.11 — Kế hoạch → Nhập liệu: chọn nhiều ô (kéo chuột, Shift + mũi tên, Shift + bấm) rồi gõ số là điền cả vùng;
     Ctrl + C / Ctrl + X / Ctrl + V với vùng ô (dán thẳng từ Excel được, một số dán vào cả vùng đang chọn); Delete xoá vùng;
     Ctrl + D giống Excel: một dòng → lấy số dòng ngay trên, nhiều dòng → dòng đầu vùng chép xuống.
   Mới ở v12.10 — Kế hoạch: (1) mỗi tháng đúng 4 cột tuần, mỗi năm 48 cột, không còn tuần 5 (tuần thứ 5 thật của tháng gộp
     vào cột 4 khi so với giờ thực tế); dữ liệu đời cũ lưu theo 52–53 tuần ISO tự đổi sang 48 cột lúc tải, lưu lại là thành
     định dạng mới; (2) nút "Xuất Excel" xuất cả lưới, tổng theo vai trò (cần / năng lực / CÒN), kế hoạch so với thực tế và các bản chốt.
   Mới ở v12.9 — Kế hoạch: nét đứt dọc ngăn giữa các tháng (ở lưới Nhập liệu và bản đồ tải Tổng quan) để dễ nhận ra ranh giới tháng.
   Mới ở v12.8 — Kế hoạch: (1) bỏ nút "Chép tuần đang chọn sang tuần sau" và việc bấm số tuần để chọn;
     (2) hiện HAI NĂM LIỀN NHAU trên một lưới cuộn ngang (chọn cặp 2025–2026 hoặc 2026–2027, mặc định cặp có năm nay);
     đầu năm sau có vạch xanh và nhãn tháng 1 ghi năm (T1·27). Khi lưu, lưới tách lại và ghi từng năm như cũ nên không cần SQL.
     Sửa luôn cách chia tuần: năm 2025 trước đây thừa tuần 53 trùng với tuần 1 của 2026; nay hai năm nối liền không trùng tuần.
   Mới ở v12.7 — Sửa hai lỗi nhập lưới Kế hoạch: (1) gõ được số lẻ 0,5 / 0,25 / 0,75 (ô giữ chữ đang gõ, trước đây
     gõ "0," bị hiểu thành 0 và xoá mất dấu phẩy); (2) gõ 0 vào ô không còn làm mất cả dòng vai trò —
     dòng toàn 0 chỉ bị bỏ lúc lưu.
   Mới ở v12.6 — Kế hoạch: (1) kéo thả để đổi vị trí các vai trò trong cùng một dự án (cầm biểu tượng ⋮⋮ ở đầu dòng;
     thứ tự lưu riêng từng máy, không đổi dữ liệu kế hoạch); (2) các banner trong tab Kế hoạch đồng bộ
     viền đỏ nền hồng như các cảnh báo khác ở giao diện Sáng.
   Mới ở v12.5 — Hỗ trợ dự án: bấm vào khoảng ngày của một đợt (có biểu tượng bút) để sửa thẳng ngày bắt đầu và
     ngày kết thúc, thay vì chỉ có +1 / +2 tuần. Ghi đè đúng đợt đó; Admin lưu thẳng, trưởng phòng qua artius_support_set.
   Mới ở v12.4 — Kế hoạch → Nhập liệu: (1) kéo mép phải tiêu đề "Dự án · vai trò" để nới / thu cột tên dự án
     (150–520px, bấm đúp để về mặc định, nhớ riêng từng máy); (2) dự án chưa có dòng nào được điền sẵn 7 vai trò
     cơ bản TK, 3D, 2D, BIM, MEP, PM, GS (chỉ lấy vai trò còn trong Thiết lập), vẫn thêm / xoá từng vai trò được.
     Điền sẵn không tính là "chưa lưu"; dòng để trống khi lưu sẽ tự bỏ như trước.
   Mới ở v12.3 — Sửa lỗi hiển thị lưới Kế hoạch ở giao diện Sáng.
     Dải "cần / còn lại" dính đáy, các ô CÒN bằng 0 và bản đồ tải ở Tổng quan đặt màu thẳng bằng mã hex nên
     không đi qua bảng đảo màu của giao diện Sáng, còn nguyên nền xanh đen. Nay chọn màu theo giao diện đang dùng.
   Mới ở v12.2 — Sửa bố cục lưới Kế hoạch trên màn hình nhỏ và laptop.
     v12.1 dùng HAI cột khoá cứng và neo cột thứ hai ở một con số đặt sẵn (left: 150px), trong khi bề ngang
     thật của cột thứ nhất do trình duyệt tự tính từ nội dung — tên dự án dài thì cột nở, ngắn thì co.
     Hai con số đó không khớp nên khi cuộn ngang hở một khoảng cho cột tuần lọt qua, và tên dự án dài
     bị xuống ba dòng làm mỗi dòng cao gấp ba.
     Nay gộp còn MỘT cột khoá cứng (dự án và vai trò chung một cột, rộng cố định 230px, tên cắt gọn một dòng,
     rê chuột xem đủ); mỗi cột tuần rộng cố định 34px. Không còn con số nào phải khớp với con số nào.
     Bản đồ tải ở chế độ Tổng quan áp dụng cùng cách.
   Mới ở v12.1 — Kế hoạch → Nhập liệu: bỏ hai nút "Tuần 1–26 / 27–53", cả năm nằm trên MỘT lưới cuộn ngang
     liền mạch (dự án vắt qua giữa năm không còn bị cắt làm đôi). Mở lưới là tự nhảy tới tuần hiện tại,
     có nút "Về tuần này"; cột tuần hiện tại tô đậm, các tuần đã qua nền tối hơn.
     Mỗi dòng dự án × vai trò bọc React.memo — gõ một ô chỉ vẽ lại đúng dòng đó, không vẽ lại cả lưới,
     vì 53 cột nhân vài chục dòng là vài nghìn ô nhập.
     Thêm vai trò vào dự án nay tạo một dòng trống để gõ ngay (trước đây bấm xong không thấy dòng nào hiện ra).
   Mới ở v12.0 — KẾ HOẠCH NGUỒN LỰC (features/planning/, tab "Kế hoạch" của Admin; BOD chỉ xem).
     Cần chạy supabase/v12_ke_hoach.sql một lần. Bật / tắt mục này ở Thiết lập.
     · Nhập liệu — lưới dự án × vai trò × tuần, đơn vị SỐ NGƯỜI (1 / 0,5 / 0,25) như file Excel đang dùng;
       nửa năm một lần, cột trái khoá cứng, phím mũi tên di chuyển, Enter xuống dòng, chép tuần sang tuần sau.
       Dải Cần / CÒN dính đáy bảng chạy theo vai trò đang gõ, nên thấy ngay hậu quả mà không phải cuộn xuống cuối.
     · Tổng quan — việc cần xử lý 12 tuần tới, bản đồ tải vai trò × tuần (bấm ô để xem dự án nào chiếm),
       quân số cần so với đang có, và kế hoạch so với giờ đã chấm theo dự án × vai trò.
     · Năng lực = số người × HỆ SỐ SẴN SÀNG (mặc định 80%, đổi trong tab Kế hoạch). Không nhân hệ số thì dòng CÒN
       luôn đẹp hơn thực tế, vì mỗi người còn mất giờ cho họp, hỗ trợ việc chung, trống việc và nghỉ phép.
     · "Chốt bản" chụp lại lưới tại một thời điểm, để so với thực tế trên bản đã chốt thay vì bản vừa sửa.
     · Kế hoạch so thực tế chỉ tính tuần ĐÃ QUA và mọi nhân sự đều đã gửi giờ; tuần còn thiếu người gửi bị bỏ hẳn.
     · Module tải rời (file JS riêng, chỉ tải khi mở tab) và có vỏ bắt lỗi riêng — hỏng thì chỉ hỏng tab này.
   Mới ở v11.2 — "Giờ ngoài dự án" → khung Năng lực kỳ này tách làm hai thanh: thanh trên chia GIỜ ĐÃ CHẤM
     (Vào dự án / Việc chung / Trống việc / Vắng mặt) nên luôn đọc được; thanh dưới mảnh cho biết đã chấm được
     bao nhiêu phần giờ chuẩn của kỳ, dưới 60% thì cảnh báo tỉ lệ ở trên chưa phản ánh cả kỳ.
     Bản v11.1 lấy giờ chuẩn làm mẫu số chung nên khi bảng công còn thưa, khúc "Chưa chấm" chiếm gần hết thanh.
   Mới ở v11.1 — Dashboard quản lý thêm tab thứ tư "Giờ ngoài dự án" (features/dashboard/OffProject.jsx):
     giờ chấm vào việc chung của công ty, trống việc và vắng mặt — phần năng lực của kỳ không đổ được vào dự án nào.
     Khung "Năng lực kỳ này" chia giờ chuẩn của kỳ thành Vào dự án / Việc chung / Trống việc / Vắng mặt / Chưa chấm;
     xem theo Tác vụ (bung ra: ai chấm bao nhiêu) hoặc theo Người (bung ra: từng tác vụ). Dùng chung bộ lọc kỳ,
     bộ phận và tìm người với tab Nhân sự. Không đổi dữ liệu, không thêm bảng mới — đọc từ giờ đã gửi sẵn có.
   Mới ở v11.0 — TÁCH FILE, không đổi giao diện và không đổi dữ liệu. src/App.jsx (9.900 dòng) chia thành:
     core/   — tầng lõi, CHỈ được gọi, không bao giờ gọi ngược ra ngoài (quy tắc chống vòng lặp import):
       theme.jsx  giao diện Sáng/Tối   db.jsx  DB trong bộ nhớ, hàng đợi gọi server, bảng công
       date.jsx   ngày tháng, giờ chuẩn, ngày lễ   domain.jsx  bộ phận, vai trò, tác vụ, OT, giai đoạn, vắng mặt
       ui.jsx     nút, ô nhập, Panel, lịch, chọn tuần
     shared/ — dùng chung giữa vài màn: alloc, dayStyle, rowDrag, deadline, support
     features/ — từng màn: SignIn, Timesheet, TimesheetBoard, EmployeeHome, Projects, Employees, Tasks, Settings,
       dashboard/ (Dashboard, ProjectProgress, StaffAllocation, calc)
     App.jsx giữ AppMain, header, menu.
     Ba biến chung OT_PENDING / OT_MIG_NOTE / IDLE_PENDING nay chỉ đổi qua setOtPending / setOtMigNote / setIdlePending,
     vì file khác chỉ ĐỌC được biến nhập vào, không gán được.
     Đã kiểm: 0 định danh thiếu import, 0 vòng lặp import, 0 file mồ côi, 339/339 khai báo khớp bản cũ,
     8.590/8.590 chuỗi hiển thị khớp từng ký tự với bản v10.2.
   Mới ở v10.2 — Sửa lệch số liệu: tab Ma trận gom giờ vắng mặt về cột "Khác" giống khung "Theo người" và biểu đồ theo dự án
   (trước đây giờ vắng mặt cũ chấm dưới một dự án thật vẫn nằm ở cột dự án đó, nên hai chỗ hiện hai con số khác nhau).
   Tiêu đề cửa sổ trong index.html cập nhật theo phiên bản.
   Mới ở v10.1 — Ma trận giờ công tách thành tab riêng trên thanh tab Dashboard, cạnh Nhân sự (bỏ cặp nút "Theo người | Ma trận"
   ở góc phải khung Nhân sự); hai tab dùng chung bộ lọc kỳ / bộ phận / tìm người và dải KPI. Ô ma trận hiện thêm dòng nhỏ
   "trống N" khi ô đó có giờ Trống việc, dòng Tổng dự án cũng tách phần này. Đổi toàn bộ nhãn "Chờ việc" thành "Trống việc".
   Mới ở v10.0 — Trưởng phòng thêm nhân sự hỗ trợ trực tiếp trong tab Dự án (nút "+ Hỗ trợ", chỉ nhân viên phòng mình); trưởng phòng chỉ thấy đợt hỗ trợ của phòng mình.
   Mới ở v9.9 — Nhắc hằng ngày: thứ Bảy có giờ riêng (mặc định 11:00), nhắc 2 lần (giờ đó và 1 giờ sau). Cần cập nhật api/_reminders.js trên Vercel.
   Mới ở v9.8 — Mở chấm bù cho một nhân sự chuyển vào nút mở khoá (cột Mở khoá / sửa) của Bảng công; hộp thoại Khoá quá hạn chỉ còn đổi số tuần + danh sách đang mở.
   Mới ở v9.7 — Khoá chấm công quá hạn chuyển từ Thiết lập sang Bảng công (Admin): nút "Khoá quá hạn · N tuần" ở thanh công cụ mở hộp thoại đổi số tuần + mở chấm bù.
   Mới ở v9.6 — Thiết lập → Nhắc nộp bảng công: thêm "Nhắc hằng ngày" (bật / tắt, chọn giờ) — nhắc người chưa Gửi giờ hôm nay. Cần cập nhật api/_reminders.js trên Vercel.
   Mới ở v9.5 — Mode sáng: nâng độ tương phản chữ/nền (xám phụ, xanh ngọc, vàng cam, đỏ, nút & nhãn xanh) lên từ 4.5:1.
   Mới ở v9.4 — Mode sáng: mã dự án ở tab Dự án hiện chữ đen (trước đây chữ trắng nên mất trên nền sáng).
   Mới ở v9.3 — Trưởng phòng có thêm tab Dự án (chỉ xem; thêm / gỡ nhân viên phòng mình vào dự án) và tab Nhân sự (chỉ nhân viên phòng mình;
   giao / gỡ dự án, Tất cả dự án). Không xem tài khoản / mật khẩu, không thấy nhân viên phòng khác, không thêm / sửa / xoá nhân sự.
   Ghi qua hàm SQL artius_emp_projects_set (supabase/v9_3_truong_phong.sql).
   Mới ở v9.2 — Điện thoại: nhóm Tăng ca (khi mở đủ tác vụ) chỉ hiện dòng tăng ca của ngày đang xem; dòng tăng ca của ngày khác không hiện sẵn.
   Bấm "Tăng ca" / "+ Thêm dòng tăng ca" tạo dòng mới cho ngày đó; chọn trùng tác vụ + khung giờ của dòng đã có thì tự gộp vào dòng đó.
   Mới ở v9.1 — Điện thoại: nút ⋯ ở đầu khối dự án đổi thành thùng rác — xoá dự án khỏi ngày đang xem (còn giờ ngày khác thì chỉ xoá
   giờ ngày này, không thì xoá hẳn khối), có Hoàn tác. Sửa khối / tăng ca: bấm nút mở rộng ˅.
   Mới ở v9.0 — Chấm công trên điện thoại: ngày đang xem chỉ hiện tác vụ có giờ của chính ngày đó; ngày chưa chấm thì trống
   (không bày sẵn tác vụ của các ngày khác trong tuần). Đổi ngày thì khối đang mở đủ tác vụ tự thu lại.
   Mới ở v8.9 — Chấm công trên điện thoại: ô có giờ nổi rõ (nền xanh ngọc, số đậm, vạch xanh đầu dòng) ở cả Sáng / Tối, kể cả ngày đã khoá;
   nút ˄ / ˅ ở đầu khối để thu gọn (chỉ còn tác vụ có giờ) / mở đủ; bỏ dòng "Cả tuần x h"; nút "8h" điền nhanh 8 giờ, bấm lại để xoá.
   Mới ở v8.8 — "Dự án đang tham gia" có quyền Tất cả dự án (employee.allProjects): chấm được mọi dự án đang mở, kể cả dự án thêm sau,
   không phải chọn từng dự án. Bật / tắt ở tab Nhân sự (nút "Tất cả" / chip ✕) và trong hộp Sửa nhân sự; tắt thì quay về danh sách đã chọn.
   Mới ở v8.7 — Hỗ trợ dự án có thời hạn: trưởng phòng (nhân viên phòng mình) / Admin mở cho một nhân sự chấm công vào dự án không được giao,
   chọn giai đoạn + khoảng ngày (1/2/4 tuần, hết tháng, tự chọn). Nhân sự thấy dự án ở mục "Đang hỗ trợ", chỉ nhập được ngày trong thời hạn;
   hết hạn tự ngắt, giờ đã chấm giữ nguyên. Danh sách đợt hỗ trợ ở đầu Bảng công, Nhân sự → "Hỗ trợ dự án", Dự án → "+ Hỗ trợ";
   Gia hạn +1/+2 tuần, Kết thúc sớm. Excel chi tiết có cột "Loại" (Chính / Hỗ trợ). Cần chạy supabase/v8_7_ho_tro_du_an.sql.
   Mới ở v8.6 — Khoá chấm công quá hạn: nhân viên chỉ nhập / sửa được N tuần gần nhất (mặc định 2: tuần này + tuần trước, tính từ thứ Hai);
   ngày cũ hơn bị khoá kể cả giờ nháp, không gửi được. Thiết lập → Khoá chấm công quá hạn: đổi số tuần (0 = tắt), mở chấm bù một tuần cho
   một người tới hạn chọn. Database cũng chặn: chạy supabase/v8_6_khoa_qua_han.sql.
   Mới ở v8.5 — Nhân sự nghỉ việc: nút Nghỉ việc (chọn ngày nghỉ) khoá tài khoản, gỡ khỏi dự án, chuyển sang tab "Nhân sự nghỉ việc";
   không còn hiện ở giao dự án / nhắc nộp / KPI nộp bảng công; báo cáo kỳ còn giờ của họ vẫn hiện kèm nhãn "Đã nghỉ". Làm lại được.
   Xoá nhân sự: chọn giữ giờ công hoặc xoá luôn toàn bộ giờ công (gõ XOA). Khung "Giờ công của nhân sự đã xoá" để xuất Excel / xoá hẳn
   giờ còn sót của nhân sự đã xoá trước đây.
   Mới ở v8.4 — Màn Chấm công trên điện thoại gọn lại (máy tính giữ nguyên): header chỉ còn logo + vòng tròn chữ cái tên;
   banner 1 dòng "N tuần chưa gửi · cũ nhất dd/mm · Xem ›"; ẩn dải chú thích màu; thẻ tuần ‹ › + Chuẩn · Cố gắng · Tổng;
   dải ngày tô đặc ngày đang xem, chấm màu trạng thái; khối dự án 1 dòng (mã · tên · giai đoạn · ⋯), nhập giờ − / + ngay tại dòng;
   "Thêm dự án / tác vụ" mở bảng trượt (dự án → giai đoạn → tích nhiều tác vụ); Lưu nháp + Gửi giờ công cố định ở đáy màn;
   menu đáy Chấm công · Dashboard · Tài khoản (Sáng/Tối, Phiên bản, Đăng xuất nằm trong Tài khoản). Lưu nháp bỏ icon.
   Mới ở v8.3 — Icon app mới (vòng tiến độ + ngôi sao AI, nền gradient xanh ngọc → tím): favicon, icon cài app (Windows/macOS/Android),
   iPhone (apple-touch-icon), Android maskable, biểu tượng thông báo — đều trong public/. Không đổi giao diện hay dữ liệu.
   Mới ở v8.1 — Chấm công: "Thêm tác vụ" thêm được khối mới kể cả khi khối đang mở chưa nhập giờ (khối đó vẫn mở nguyên);
   nút "Lưu nháp" cạnh "Gửi giờ công": ghi giờ đang nhập lên server nhưng chưa gửi (quản lý thấy ô Nháp, chưa tính báo cáo).
   Cài đặt của nhân viên bỏ mục "Kiểm tra lưu trữ" (vẫn còn ở Thiết lập của Admin).
   Mới ở v8.0 — Chấm công: tuần còn trống thì tự mở sẵn một khối trống (Dự án · Giai đoạn · Hạng mục) như vừa bấm "Thêm tác vụ",
   nhân viên chọn và nhập giờ ngay. Rê chuột vào dòng tác vụ: tên tác vụ in đậm (cả Sáng và Tối), dòng chú thích giữ nguyên. Giao diện Sáng: banner "Còn x tuần chưa gửi" nền hồng viền đỏ. Khối trống không làm hiện cảnh báo "chưa lưu"; quản lý sửa hộ (ngăn kéo Bảng công) thì không tự thêm.
   Mới ở v7.9 — Hoàn thiện giao diện Sáng: rê chuột dòng chấm công chữ xanh dương; Giờ chuẩn xanh đậm, Giờ cố gắng giữ tím có nền chip + thanh sọc;
   phần thiếu ở thanh tổng Bảng công là dải cam nhạt đặc (bỏ sọc), ô "Bỏ trống" nhạt hơn; bảng Tháng: Thiếu giờ vàng đậm, Nghỉ phép xám xanh, Giờ cố gắng tím đặc,
   hôm nay = dải xám liền một khối dọc cả cột + số ngày trong chip đen. Rê chuột vào ô ngày: viền xanh lá nhạt (cả Sáng và Tối).
   Mới ở v7.8 — Giao diện Sáng (Light) bên cạnh giao diện Tối (Dark): nút "Sáng / Tối" ở góc phải thanh trên cùng (mọi màn, kể cả đăng nhập);
   lựa chọn nhớ riêng từng máy, mặc định Tối. CSS Sáng nằm ở src/lightTheme.js (sinh tự động từ class Tailwind), logo Sáng ở public/logo-artius-time-light.svg.
   Nhãn / thanh trạng thái ở giao diện Sáng dùng màu riêng, đặc và đậm hơn (xanh lá Bình thường, cam Sắp vượt, đỏ Vượt…) cho dễ nhìn trên nền sáng.
   Nút giao diện 3 lựa chọn: Tối · Sáng · Theo máy (tự đổi theo cài đặt sáng/tối của máy). Ở Sáng: ô "Bỏ trống" bảng Tháng là nền hồng nhạt
   không viền; chấm "Nộp từng tuần" và màu dự án / giai đoạn bản đậm; dải tên phòng ban thống nhất. BOD chỉ xem: ẩn hẳn nút / ô thêm-sửa-xoá-lưu.
   Giao diện Tối giữ nguyên như v7.7.
   Mới ở v7.7 — Chuông nhắc ở Bảng công bấm lại được nhiều lần (tuần và tháng), cách nhau tối thiểu 30 phút cho mỗi người: trong 30 phút chuông mờ đi,
   rê chuột hiện "nhắc lại được lúc …"; chuông có dấu ✓ nhỏ nếu người đó đã được nhắc; "Nhắc tất cả" bỏ qua người đang trong 30 phút.
   BOD xem được mọi mục quản lý (Dự án, Nhân sự, Tác vụ, Thiết lập) ở chế độ chỉ xem; nhãn "Chế độ chỉ xem" ở header cạnh tên tài khoản (mọi mục quản lý) — không lưu được thay đổi, không xem tài khoản/mật khẩu.
   Kéo thả dự án đổi vị trí: giữ biểu tượng ⋮⋮ đầu dòng dự án ở Dashboard (Tiến độ dự án) và tab Dự án; thứ tự lưu riêng từng máy (trình duyệt),
   dùng chung giữa hai màn; nút "Xếp tự động" ở Dashboard để bỏ thứ tự đã kéo. Dự án Urgent vẫn ghim đầu bảng Dashboard. Chỉ dùng được bằng chuột (máy tính).
   Chỉ đổi giao diện (src/App.jsx); không đổi database hay api/push.js.
   Mới ở v7.6 — Bỏ giới hạn 1520px của v7.5: mọi tài khoản hiển thị full màn hình. Quản lý (Admin, BOD, Trưởng phòng) trên máy tính:
   menu dọc dạng thẻ bám mép trái khung nội dung (dính khi cuộn), có Thoát + phiên bản; header chỉ còn tiêu đề trang · logo · tên.
   Nhân viên giữ tab ngang trên header (v7.5).
   Nút Thoát nổi bật hơn (viền + nền đỏ nhạt, có chữ "Thoát"): header của nhân viên, cuối menu dọc của quản lý, thanh menu dưới đáy điện thoại.
   Mới ở v7.5 — Máy tính: bỏ thanh menu dọc bên trái; các tab đưa lên thanh trên cùng thành tab ngang (bên trái), logo giữ ở giữa,
   tên · phiên bản · nút Thoát bên phải. Header và nội dung giới hạn rộng tối đa 1520px, căn giữa trình duyệt.
   Tab ngang chỉ hiện icon ở màn hẹp, hiện chữ từ 1280px (≤ 4 tab) hoặc 1536px (Admin 6 tab). Điện thoại giữ nguyên thanh menu dưới đáy.
   Mới ở v7.2 — Tác vụ "Trống việc" (gắn cứng, mục Khác · dùng chung): tính là giờ công (không bị báo thiếu), không thành giờ cố gắng,
   KHÔNG tính vào tải. Khúc xám riêng trên thanh Từng tuần / Lịch tháng / Bảng công / Phân bổ; khung Phân bổ có nhãn "Trống việc",
   ô KPI Trống việc, % tải = (tổng − trống việc) / giờ chuẩn kỳ; Excel thêm cột Giờ trống việc.
   Mới ở v7.1 — Dashboard cá nhân: ô Lịch tháng hiện tổng giờ (số to) và dòng chuẩn · +OT · +cố gắng theo màu; nút "Chấm công ngay"
   mở thẳng tuần cũ nhất còn thiếu của tháng đang xem; thanh Từng tuần kiểu khung Phân bổ của quản lý (số trong khúc, vạch giờ chuẩn
   của tuần tính đến hôm nay, ngoặc vàng "thiếu X h", cột tổng giờ).
   Mới ở v7.0 — Dashboard cá nhân: bỏ Xuất Excel, ô chọn kỳ + nút nhanh và khung Chi tiết tuần; xem theo tháng của Lịch tháng ("Tháng này" để quay về); khung Từng tuần cao vừa nội dung; thêm Lịch tháng (màu ô như bảng Tuần của quản lý), bấm một ngày → mở Chấm công đúng tuần đó.
   Mới ở v6.9 — Nhân sự: "Dự án đang tham gia" sửa ngay trên danh sách (✕ gỡ · + Dự án) hoặc trong khung sửa nhân sự. Tab Dự án: ⌄ dưới tên dự án mở danh sách Tên · Vai trò, + Nhân sự / ✕ để giao, gỡ. Màn chấm công của nhân sự chỉ hiện các dự án được giao;
     chưa giao dự án nào = chỉ chấm Việc chung / vắng mặt. Cột "Dự án đang tham gia" ở danh sách = dự án được giao.
   Mới ở v6.8 — Dashboard cá nhân → Chi tiết tuần: ngày lễ khoanh vòng đỏ kèm tên ngày lễ.
     Màn chấm công nhân viên gọn hơn: bỏ ghi chú "Chọn dự án (hoặc Khác)…", bỏ chú thích cạnh nhãn Công việc chung /
     Vắng mặt, bỏ nút "…" (mô tả dòng), bỏ "Chép tuần trước"; nút "Thêm dòng" đổi thành "Thêm tác vụ".
   Mới ở v6.7 — Bảng công giảm màu (phương án C): giờ nháp chỉ hiện số mờ, không tô cam; thanh tổng không vẽ nháp và không ghi
     "thiếu" khi phần thiếu đã có giờ nháp; cột Nộp tuần ẩn "Còn nháp" của tuần đang chạy (chấm tuần trong bảng Tháng: xám);
     KPI "Chưa nộp / còn nháp" màu trung tính; bỏ dòng ghi chú "Rê chuột vào ô…". Chuông nhắc giữ màu.
   Mới ở v6.6 — Dashboard → Nhân sự: thêm lọc nhanh "Tuần trước" (T2 → CN). Ô tìm nhân sự / dự án gõ không dấu vẫn ra
     (Dashboard, Bảng công, Tiến độ dự án).
     Xoá tác vụ = xoá luôn giờ đã chấm vào tác vụ đó (kể cả dòng tăng ca "cho tác vụ" đó), không còn "(tác vụ đã xoá)".
     Hộp xác nhận báo số giờ sẽ mất. Xoá vai trò cũng xoá giờ của các tác vụ bị xoá theo. Tab Tác vụ hiện khung vàng khi còn giờ
     của tác vụ đã xoá trước đây → "Xoá hẳn". Database: artius_purge_tasks, artius_orphan_tasks (chạy lại schema.sql).
   Mới ở v6.5 — Sửa lỗi sau kiểm tra số liệu: Dashboard "Tăng ca theo tác vụ" trống từ v6.3 (database chỉ nhận hạng mục [OT],
     nay nhận cả khung tăng ca chung — chạy lại schema.sql); Dashboard Nhân sự tính giờ chuẩn hôm nay chỉ cho người đã gửi
     (khớp Bảng công); Bảng công tháng: "Đã nộp đủ" chỉ xét các tuần đã qua.
   Mới ở v6.4 — Bảng công (quản lý): ô Nghỉ phép đổi màu cam đất (tách khỏi xanh "đủ giờ").
     Thanh Tổng / chuẩn chia khúc: chuẩn (xanh dương) · cố gắng (tím) · OT (xanh ngọc) · phần thiếu (sọc vàng + "thiếu x h").
     Hôm nay chỉ tính vào giờ chuẩn khi đã gửi (trước đây ai cũng bị "thiếu 8 h" cả ngày); hôm nay chưa tính là bỏ trống.
     Bảng Tháng có cột Nhắc: chuông kèm số tuần chưa nộp (các tuần đã qua) — bấm một lần gửi một thông báo gộp mọi tuần thiếu;
     "Nhắc tất cả" ở tiêu đề cột. /api/push nudge nhận thêm weeks[] và ghi nhật ký từng tuần.
   Mới ở v6.3 — Tăng ca là CÀI ĐẶT CHUNG (Thiết lập → Tăng ca): khung giờ (bắt đầu – kết thúc) + hệ số, áp cho mọi vai trò.
     Không còn hạng mục [OT] ở tab Tác vụ (tạo tên "[OT]…" bị chặn) — xoá / sửa tác vụ không làm mất tăng ca.
     Quản lý mở bản mới lần đầu: tự chuyển các hạng mục [OT] cũ sang khung chung khớp theo giờ (giữ hệ số), dữ liệu không đổi.
     Khung có giờ chấm thì không xoá được; giờ OT của hạng mục [OT] đã xoá trước đây gán lại được vào khung.
     Màn chấm công nhân viên giữ nguyên thao tác (Tăng ca cho tác vụ + Khung giờ, không hiện hệ số).
   Mới ở v6.2 — Bảng chấm công: bỏ tiêu đề "Công việc dự án"; nhóm "Công việc chung" / "Vắng mặt" của dòng Khác
     hiện thành nhãn màu bo tròn (xanh ngọc / xanh nhạt) + chú thích + đường kẻ mảnh, tách rõ khỏi tác vụ bên dưới.
   Mới ở v6.1 — Hộp sửa nhanh ô ngày luôn nằm trọn trong màn hình (lật lên trên ô khi sát đáy, cuộn bên trong nếu quá dài).
     Bỏ tab "Chi tiết nhân viên" ở Bảng công — sửa cả tuần bằng ngăn kéo (✎ hoặc bấm tên).
   Mới ở v6.0 — Tổng quan bảng công: sửa giờ ngay tại chỗ, không chuyển tab.
     · Bấm một ô ngày → hộp sửa nhanh các dòng giờ của ngày đó (giữ dấu đã gửi; ngày hết giờ thì bỏ dấu).
     · Bấm ✎ hoặc tên người → ngăn kéo bên phải với bảng sửa cả tuần (dùng lại bảng của Chi tiết nhân viên): thêm dòng,
       tăng ca, chép tuần trước, lưu, mở khoá; nút ‹ › sang người kế tiếp; Esc / ✕ để đóng (hỏi nếu còn thay đổi chưa lưu).
   Mới ở v5.9 — Bảng công (quản lý): "Tổng quan bảng công" thay khung Tình trạng nộp + Ma trận giờ công.
     Tuần = lưới ngày (giờ từng ngày, tăng ca "+h", tổng / chuẩn, trạng thái nộp, cột Nhắc gửi thông báo);
     Tháng = lịch nhiệt (ô nhỏ mỗi ngày, cùng bộ màu; chấm trạng thái nộp từng tuần, bấm để mở tuần). Hiện ngày lễ.
     Tiêu đề cột: thứ ở trên, ngày ở dưới. Cột "Mở khoá / sửa": mở khoá cả tuần cho nhân sự (có xác nhận) · mở Chi tiết đúng tuần để sửa.
   Mới ở v5.8 — Tab Nhân sự, chi tiết một người: thêm bảng Tác vụ · Giờ · % (gộp mọi dự án trong kỳ) bên phải bảng Dự án.
   Mới ở v5.7 — Tab Nhân sự, thanh từng người: số giờ nằm trong từng khúc (Giờ chuẩn / OT / cố gắng), bên phải chỉ còn giờ tổng;
     ngoặc vàng phía trên thanh chỉ khoảng thiếu giờ chuẩn ("thiếu x h"); vạch giờ chuẩn của kỳ đổi trắng mờ, mảnh 1px;
     khung chi tiết bỏ dòng "Giờ chuẩn · OT · cố gắng".
   Mới ở v5.6 — Dashboard tách hai tab "Dự án | Nhân sự", mỗi tab có bộ lọc riêng:
     · Dự án: tiến độ từ trước tới nay (không theo kỳ); lọc Vượt / Sắp vượt / Bình thường, tìm dự án; KPI đang mở / vượt /
       sắp vượt / Urgent; thêm cột "Người tuần này".
     · Nhân sự: kỳ chọn nhanh Tuần này / 7 ngày qua / Tháng này hoặc lịch, bộ phận, tìm người, Excel; 6 KPI; người chưa chấm
       gom một dòng cuối. Bỏ ô lọc Dự án / Giai đoạn chung ở đầu trang.
     · Khung chi tiết giai đoạn: rê chuột vào tên nhân sự → thẻ tác vụ của người đó trong giai đoạn (Tác vụ · Giờ · %).
       Cần chạy lại supabase/schema.sql (mục 14 trả thêm "et"); chưa chạy thì tạm tính từ dữ liệu đã tải.
     · Giai đoạn đang xem chi tiết: viền teal mảnh bo góc bao trọn dòng dự án + khung chi tiết.
     · Bảng "Tăng ca theo tác vụ" trong khung chi tiết mặc định ẩn — bấm nút ▸ ở đầu khung TĂNG CA để xổ bảng ra bên dưới.
       Bảng không hiện hệ số / giờ quy đổi (vẫn có trong file Excel); cột "Trong đó CN / lễ" chỉ hiện khi có giờ tăng ca CN / lễ.
   Mới ở v5.5 — Phân bổ nhân sự, chi tiết một người: thêm cột % thời gian theo dự án; rê chuột vào dự án hiện thẻ
   các tác vụ người đó làm trong dự án (giờ, % trên tổng giờ của người đó ở dự án; dòng tăng ca ghi "Tăng ca · tác vụ"),
   phần người đó chiếm trong tổng giờ dự án của kỳ, và giai đoạn.
   Mới ở v5.4 — "Phân bổ giờ công theo nhân sự" (Theo người): chi tiết khi bấm một người chỉ còn chữ + số
   (dòng Giờ chuẩn · OT · cố gắng, rồi mỗi dự án một dòng tên — giờ), bỏ các thanh màu nhỏ; thanh tải có khe tách
   nhẹ giữa các khúc Giờ chuẩn / OT / cố gắng.
   Mới ở v5.3 — Dashboard quản lý, "Phân bổ giờ công theo nhân sự": hai cách xem Theo người (thanh chuẩn / OT / cố gắng,
   nhãn Quá tải / Thiếu giờ, gom theo bộ phận, bấm mở chi tiết dự án) và Ma trận người × dự án; hàng chỉ số công suất;
   lọc theo trạng thái, sắp xếp. Ngưỡng Quá tải / Thiếu giờ chỉnh ở Thiết lập (cfg.allocOver, cfg.allocUnder).
   Mới ở v5.2 — Đổi màu để giờ chuẩn và OT không lẫn nhau: Giờ chuẩn = xanh dương nhạt (blue-400 #60a5fa),
   OT / Tăng ca = xanh ngọc (teal, trước là xanh lá emerald), Giờ cố gắng giữ tím. Áp toàn app.
   Mới ở v5.1 — Tăng ca gộp theo KHUNG GIỜ: mỗi vai trò có bộ hạng mục [OT] riêng nhưng cùng khung giờ, nên hệ số (Thiết lập),
   cột của bảng "Tăng ca theo tác vụ" (Dashboard), sheet Tăng ca (Excel) và ô Khung giờ ở màn chấm công đều gộp theo khung giờ
   (otBandKey), không tách theo từng hạng mục. cfg.otRates nay lưu theo khung giờ; hệ số cũ lưu theo mã hạng mục vẫn đọc được.
   Mới ở v5.0 — Nhóm Tăng ca trong khối dự án mặc định ẩn: chỉ có nút "+ Tăng ca"; bấm vào mới hiện, kèm sẵn
   một dòng khung giờ đầu tiên (17:30 – 21:00). "+ Thêm dòng tăng ca" thêm lần lượt các khung kế tiếp.
   Mỗi dòng tăng ca có nút xoá (kể cả khi chưa nhập giờ); xoá hết dòng thì nhóm Tăng ca ẩn lại.
   Mới ở v4.9 — Tăng ca gắn tác vụ (phương án B+): mỗi dòng tăng ca (hạng mục [OT] = một khung giờ) phải chọn
   "Tăng ca cho tác vụ" nào (row.otFor); một khung giờ có thể có nhiều dòng cho nhiều tác vụ. Thiết lập có hệ số
   chi phí từng khung giờ + hệ số Chủ nhật / ngày lễ. Dashboard (chi tiết giai đoạn) và Excel có giờ tăng ca theo
   tác vụ × khung giờ và giờ quy đổi. Database: các hàm khoá ngày đã gửi tính cả otFor (chạy lại schema.sql).
   Mới ở v4.8 — Dashboard quản lý, "Tiến độ dự án": làm nổi giai đoạn đang mở (nền màu giai đoạn + vạch trái, ô đóng chìm hẳn);
     cờ Urgent cho dự án (rê chuột vào tên → bấm cờ), dự án Urgent luôn xếp đầu bảng.
   Mới ở v4.7 — Dashboard quản lý, bảng "Tiến độ dự án": rê chuột vào ô giai đoạn hiện thẻ tóm tắt (giờ còn lại, dự báo,
     ai / tác vụ nào tiêu giờ nhiều nhất, tăng ca, lần gửi gần nhất); bấm vào ô mở khung chi tiết ngay dưới dự án (giờ theo tuần,
     toàn bộ nhân sự và tác vụ, dòng Tăng ca 3 mức), các dự án khác mờ đi. Số liệu do database tính (schema.sql mục 14).
   Mới ở v4.6 — Dashboard quản lý: "Tiến độ dự án" (giờ hiện tại từ trước tới nay so với dự kiến từng giai đoạn, cảnh báo
     chỉ giai đoạn đang mở) thay biểu đồ giai đoạn cũ; "Phân bổ giờ công theo nhân sự" (thanh chia khúc + vạch giờ chuẩn kỳ)
     thay bảng nhân sự × dự án. Các tab khác giữ nguyên.
   Mới ở v4.5 — Dashboard quản lý: bỏ biểu đồ "Giờ công theo tác vụ"; bảng nhân sự × dự án gọn cho nhiều dự án
   Mới ở v4.4 — mô tả ngắn cho tác vụ: quản lý ghi ở tab Tác vụ (bút chì), nhân sự thấy dưới tên hạng mục khi nhập giờ
     + kéo thả để đổi thứ tự tác vụ (máy tính); màn Chấm công hiện đúng thứ tự đó
   Mới ở v4.3 — chỉ sửa database: khoá bảng cũ artius_kv (xem supabase/schema.sql mục 8b)
   Mới ở v4.2 — nhắc lại mỗi 1 giờ
   · Sau lần nhắc đầu tiên (giờ trong Thiết lập), người chưa gửi đủ được nhắc lại mỗi 1 giờ trong chính ngày nhắc,
     tới 17:30 thì dừng; gửi đủ là hết nhận. Áp dụng cho cả nhắc tuần và nhắc chốt tháng (xem api/_reminders.js).
   Mới ở v4.1 — nhân viên vào app dễ hơn
   · Cài app từ trình duyệt (PWA): nút "Cài app" trên thanh đầu trang (Chrome/Edge, Android);
     iPhone hiện hướng dẫn "Thêm vào MH chính". Cài xong có icon ARTIUS TIME, mở cửa sổ riêng.
   · Bấm thông báo nhắc khi app đang mở: chuyển thẳng tới tuần cần gửi (trước chỉ đưa cửa sổ lên).
   · Màn đăng nhập nhớ tên đăng nhập lần trước trên máy đó.
   · Thiết lập → "Truy cập app": link, mã QR và in poster QR dán ở văn phòng / xưởng / công trường.
   ------------------------------------------------------------
   v2.2
   Mới ở v2.2 — chuẩn bị chạy thật cho 50+ người
   · Tự cập nhật nhẹ hơn: lần hỏi định kỳ chỉ lấy danh sách dòng vừa đổi, tải nội dung đúng dòng đổi;
     quản lý hỏi 30 giây/lần, máy để yên quá 10 phút thì ngừng hỏi.
   · Thư viện Excel chỉ tải khi bấm xuất file, mở app nhanh hơn.
   · Báo "Mất kết nối" và tự gửi lại khi có mạng.
   · Màn hình hỏng hiện thông báo + nút tải lại thay vì trang trắng.
   Mới ở v2.1
   · Mở app chỉ tải bảng công 6 tháng gần nhất; tháng cũ hơn tự tải khi xem tới (báo cáo, lịch chọn tuần, tuần cũ).
     Tổng giờ "từ trước tới nay" (tab Dự án, Giai đoạn) do database tính (hàm artius_usage).
   · Sửa lỗi nút Xuất Excel ở Dashboard cá nhân của nhân sự (có từ v1.6).
   Mới ở v2.0
   · Cảnh báo thiếu bảng công chỉ tính những ngày đã tới (tính cả hôm nay); tuần chưa tới không bị báo thiếu.
   · Bỏ dòng thông báo "Đã gửi và khoá: T2, T3…" trên màn chấm công (ô ngày đã gửi vẫn có biểu tượng khoá).
   Dark theme thống nhất · responsive desktop + mobile
   Storage: window.storage (shared = true)
     artius:config:v1            -> { employees, projects, tasks, adminPin, deadlineDay, hours, holidays }
     artius:db:v1 -> { config, ts: { '<empId>:<YYYY-MM>': { rows, weeks } } }   (một khoá duy nhất)

   Mới ở v1.7 (chỉ chạy ở bản webapp Vercel + Supabase, không còn chạy trong artifact)
   · Đăng nhập bằng tên đăng nhập + mật khẩu (Supabase Auth). Bỏ màn chọn tên và mã PIN quản lý
   · Ban quản lý tạo tài khoản, đặt / xem / đặt lại mật khẩu, khoá tài khoản ngay ở tab Nhân sự
   · Quyền quản lý là một thuộc tính của tài khoản
   · Dữ liệu chỉ được tải SAU khi đăng nhập. Tải hỏng thì dừng ở màn báo lỗi, không vào app
     với dữ liệu rỗng (tránh ghi đè dữ liệu thật)

   Mới ở v1.9 — quy trình gửi và khoá bảng công
   · Bỏ Lưu nháp: giờ nhân sự nhập chỉ nằm trên màn hình cho tới khi bấm "Gửi giờ công". Gửi và khoá theo từng ngày.
   · Gửi là khoá cứng: nhân sự không tự mở khoá được, chỉ quản lý mở ở Bảng công → Chi tiết nhân viên.
     Database cũng chặn (trigger artius_ts_guard), không chỉ giao diện
   · Quản lý chỉ tổng hợp giờ của tuần ĐÃ GỬI: Dashboard, Ma trận giờ công, file Excel, cột Dự án đang tham gia
   · Màn hình tự cập nhật: máy quản lý hỏi server 10 giây một lần (chỉ lấy dòng vừa thay đổi),
     máy nhân sự 60 giây một lần và khi quay lại tab

   Mới ở v1.8 — tách bảng dữ liệu (xem src/data.js và supabase/schema.sql)
   · Thiết lập nằm ở bảng artius_config; bảng công mỗi nhân sự mỗi tháng là một dòng ở artius_ts.
     máy mình tải lúc mở app, nên đè mất giờ công và thay đổi thiết lập của người khác
   · Mỗi lần lưu chỉ ghi đúng dòng (nhân sự, tháng) liên quan, và đọc lại dòng đó ngay trước khi ghi
   · Database chặn nhân sự đọc/ghi bảng công của người khác và chặn sửa thiết lập (chỉ quản lý)
   · Nhân sự chỉ tải bảng công của chính mình; quản lý tải tất cả
   · Hai quản lý cùng sửa thiết lập: app đọc bản mới nhất rồi gộp theo từng mục trước khi ghi (src/merge.js)
   · Bỏ cảnh báo "hạn mức lệnh" và "giới hạn một khoá": hai giới hạn đó chỉ có ở bản artifact

   Cập nhật 09/10/2026 (v1.7) — tab Nhân sự
   · Chia 2 tab con: Nhân sự | Tài khoản quản lý
   · Một bảng duy nhất gom theo phòng ban, có ô tìm, lọc theo phòng ban và trạng thái tài khoản;
     "Dự án đang tham gia" là một cột (bỏ bảng theo dõi riêng)
   · Thêm / sửa qua khung nhập: tên đăng nhập tự gợi ý theo họ tên, mật khẩu sinh sẵn,
     vai trò lọc theo phòng ban, có "Lưu và thêm tiếp"
   · Mỗi dòng có nút chép tài khoản; nút Xuất tài khoản ra Excel theo bộ lọc đang chọn

   Cập nhật 09/10/2026 (vẫn là v1.7) — tab Tác vụ
   · Chia 3 tab con: Tác vụ | Phòng ban & vai trò | Vắng mặt
   · Tab Tác vụ: cột trái là vai trò gom theo phòng ban (có ô tìm và số tác vụ), cột phải là tác vụ của vai trò đang chọn
   · Phòng ban và vai trò: bấm vào để sửa tên tại chỗ, chỉ còn nút thùng rác
   · Vai trò: bấm đúp vào mã để sửa mã (nhân sự và tác vụ đang dùng mã cũ đổi theo); kéo thả sang dòng phòng ban khác để chuyển phòng ban

   Mới ở v1.5
   · Ghi chú phiên bản ở góc trái, dưới cùng màn hình
   · Tab Tác vụ (ban quản lý): thêm mới / xoá vai trò. Danh sách vai trò nằm trong cấu hình dùng chung
   · Bỏ nút "Nạp bộ tác vụ theo vai trò" (bộ 25 tác vụ chuẩn)
   · Tab Tác vụ chỉ còn ô vai trò, ô dùng chung và danh sách tác vụ; bỏ các dòng ghi chú nhỏ
   · Bỏ tác vụ theo bộ phận: tác vụ chỉ gắn vai trò hoặc dùng chung. Tác vụ cấp bộ phận có sẵn
     trong dữ liệu bị xoá khi nạp. Xoá một vai trò thì xoá luôn tác vụ của vai trò đó

   Mới ở v1.4
   · Toàn bộ dữ liệu nằm trong MỘT khoá lưu trữ. Đọc 1 lần lúc mở app, sau đó mọi thao tác
     chạy trong bộ nhớ. Quản lý xem dashboard 20 nhân sự: 64 lệnh -> 3 lệnh.
   · Mọi lệnh lưu trữ có hạn chờ 8 giây, hết hạn thì đi tiếp thay vì treo app
   · Khởi động luôn kết thúc kể cả khi lưu trữ hỏng
   · Sao lưu / khôi phục toàn bộ dữ liệu ra file JSON
   · Tự nhận biết mất kết nối lưu trữ và dừng gọi, kèm nút tải lại trang

   Mới ở v1.3
   · Khoá tổng hợp theo tháng: Dashboard đọc 1 lệnh/tháng thay vì 1 lệnh/nhân sự/tháng
   · Vắng mặt chọn thẳng trong ô Tác vụ (Phép năm, nghỉ ốm, không lương, nghỉ lễ, công tác ngoài)
   · Ghi chú mở bằng nút "…" thay vì chiếm một cột trong bảng
   · Mũi tên/Enter di chuyển giữa các ô giờ · Điền giờ chuẩn cả tuần · Hoàn tác xoá dòng
   · Cảnh báo khi rời bảng công lúc chưa lưu
   · Hạn mức giờ cho dự án + panel cảnh báo vượt giờ
   · Tra cứu bằng Map thay cho .find() trong vòng lặp

   Mới ở v1.2
   · Tab "Bảng công" cho quản lý: chọn nhân sự, xem và sửa trực tiếp, đánh dấu / gỡ đánh dấu đã gửi
   · Giờ chuẩn cấu hình được theo T2–T6 / T7 / CN + ngưỡng cảnh báo vượt giờ mỗi ngày
   · Thanh tiến độ so với target tuần (chấm công) và target kỳ (dashboard cá nhân)
   · Ngày lễ khai báo ở Thiết lập — miễn cảnh báo thiếu giờ, giờ chấm vào đó tính hết là OT
   · Nghỉ phép theo ngày: phép năm, phép nửa ngày, nghỉ ốm, không lương, công tác ngoài
   · OT tự tính (vượt giờ chuẩn + ngày lễ/ngày nghỉ), hiện trên cả 2 dashboard và file Excel

   Mới ở v1.1
   · Ghi chú theo từng dòng chấm công · Chép cơ cấu dòng của tuần trước
   · Khoá tuần đã gửi · Tự lưu khi chuyển tuần · Xác nhận trước khi xoá
   · Dashboard quản lý: lọc bộ phận / dự án / tên + biểu đồ theo hạng mục
   ============================================================ */

/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Clock, Users, FolderKanban, LayoutDashboard, AlertTriangle, LogOut, Settings, CheckCircle2, Loader2, ListChecks, RotateCcw, ClipboardList, User, Eye, CalendarDays,
  Download,
} from "lucide-react";
import { LIGHT_CSS } from "./lightTheme.js";
import { supabase } from "./storage.js";
import { askPermission, syncPush, pushPermission } from "./push.js";
import { currentUser } from "./auth.js";
import { signOut as authSignOut } from "./auth.js";
import { DEFAULT_HOURS } from "./core/date.jsx";
import { LAST_STORAGE_ERROR, NET_OK, STORAGE_OK, commitConfig, errText, loadDB, pullTs, resetDB, useNet, useStorageHealth } from "./core/db.jsx";
import { DEFAULT_DEPTS, DEFAULT_LEAVE_TYPES, DEFAULT_PHASES, DEFAULT_ROLES, DEFAULT_TASKS, IDLE_PENDING, IDLE_TASK_ID, OT_PENDING, emptyConfig, isDeptTask, migrateOtCfg, setIdlePending, setOtMigNote, setOtPending, supportList, syncDepts, syncLeave, syncOtBands, syncPhases, syncRoles, withIdleTask } from "./core/domain.jsx";
import { useTheme } from "./core/theme.jsx";
import { syncHolidays, APP_VERSION, BrandLogo, CTRL, ConfirmDialog, InstallButton, ThemeToggle, btnDanger, btnGhost, btnPrimary } from "./core/ui.jsx";
import { EmployeeDashboard, EmployeeSettings } from "./features/EmployeeHome.jsx";
import { Employees } from "./features/Employees.jsx";
import { Projects } from "./features/Projects.jsx";
import { SettingsTab } from "./features/Settings.jsx";
import { SignIn } from "./features/SignIn.jsx";
import { Tasks } from "./features/Tasks.jsx";
import { EmployeeArea } from "./features/Timesheet.jsx";
import { AdminTimesheet } from "./features/TimesheetBoard.jsx";
import { Dashboard } from "./features/dashboard/Dashboard.jsx";
import { PlanPane } from "./features/planning/PlanPane.jsx";

/* ============================================================ */
/* v2.2 — Màn hình hỏng (lỗi khi vẽ giao diện) thì hiện thông báo + nút tải lại thay vì trang trắng. */
export class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md space-y-3 rounded-xl border border-rose-900 bg-rose-950 p-5 text-sm">
          <div className="flex items-center gap-2 text-base font-semibold"><AlertTriangle size={18} className="text-rose-400" /> App gặp lỗi khi hiển thị</div>
          <p className="text-rose-100">Bấm tải lại để tiếp tục; giờ đã gửi trước đó không bị mất. Nếu lặp lại, chụp màn hình này gửi quản lý.</p>
          <p className="break-words font-mono text-xs text-rose-300">{errText(this.state.err)}</p>
          <button onClick={() => window.location.reload()} className={btnDanger}><RotateCcw size={14} /> Tải lại trang</button>
        </div>
      </div>
    );
  }
}
export default function App() {
  useTheme();   // v7.8: vẽ lại toàn app khi đổi Sáng / Tối (các màu ghi thẳng trong code đọc isLight())
  return <AppErrorBoundary><AppMain /></AppErrorBoundary>;
}
export function AppMain() {
  // v10.2: tiêu đề cửa sổ lấy thẳng từ APP_VERSION — index.html không còn phải sửa tay mỗi lần lên phiên bản
  useEffect(() => { document.title = `ARTIUS — Quản lý giờ công · ${APP_VERSION}`; }, []);
  const [cfg, setCfg] = useState(null);
  const [booting, setBooting] = useState(true);
  const [who, setWho] = useState(null);                  // tài khoản đang đăng nhập: { userId, username, empId, admin }
  const [loadFailed, setLoadFailed] = useState(false);   // đăng nhập được nhưng không tải được dữ liệu
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dash");
  const [sheetDirty, setSheetDirty] = useState(false);   // bảng công còn thay đổi chưa lưu
  const [otBtn, setOtBtn] = useState(null);   // v13.30: { ym, run, busy } do EmployeeArea đẩy lên, hiện thành nút trên header
  /* v13.48 — nút "Excel tăng ca" phát sáng nhẹ trong BA NGÀY CUỐI THÁNG (ngày cuối − 2 → ngày cuối),
     nhắc xuất bảng trước khi chốt công. Chỉ sáng khi nút đang trỏ đúng tháng hiện tại. */
  const otGlow = useMemo(() => {
    if (!otBtn) return false;
    const now = new Date(), last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return otBtn.ym === ym && now.getDate() >= last - 2;
  }, [otBtn]);
  const [pendingTab, setPendingTab] = useState(null);    // tab muốn sang, đang chờ xác nhận
  const [tsMonday, setTsMonday] = useState(null);        // v7.0: bấm ngày trên Lịch tháng → mở Chấm công đúng tuần đó
  // Rời khỏi màn chấm công khi còn thay đổi chưa lưu thì hỏi lại — trước đây mất dữ liệu lặng lẽ
  const go = (k) => {
    if (k === tab) return;
    if (sheetDirty && (tab === "ts" || tab === "sheet")) { setPendingTab(k); return; }
    setTsMonday(null); setTab(k);
  };

  const flash = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 2600);
  }, []);

  /* Tải toàn bộ dữ liệu. Chỉ gọi SAU khi đã đăng nhập: database từ chối người chưa có tài khoản. */
  const openData = useCallback(async () => {
    try {
      const db = await loadDB(true);          // 1 lệnh duy nhất cho toàn bộ dữ liệu
      let c = db.config || emptyConfig();
      c.tasks = c.tasks?.length ? c.tasks : DEFAULT_TASKS;
      c.tasks = c.tasks.filter((t) => !isDeptTask(t));   // v1.5: bỏ tác vụ cấp bộ phận có sẵn
      c.deadlineDay = c.deadlineDay || 5;
      delete c.adminPin;                                    // v2.3: PIN v1.6 không còn dùng, không giữ trong thiết lập dùng chung
      c.hours = { ...DEFAULT_HOURS, ...(c.hours || {}) };  // dữ liệu cũ chưa có mục này thì lấy mặc định
      c.holidays = Array.isArray(c.holidays) ? c.holidays : [];
      // dữ liệu v1.4 trở về trước chưa có danh sách vai trò thì lấy 5 vai trò mặc định
      c.roles = Array.isArray(c.roles) ? c.roles : DEFAULT_ROLES.map((r) => ({ ...r }));
      c.leaveTypes = Array.isArray(c.leaveTypes) && c.leaveTypes.length ? c.leaveTypes : DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
      c.depts = Array.isArray(c.depts) && c.depts.length ? c.depts : [...DEFAULT_DEPTS];
      if (!c.depts.includes("Ban giám đốc")) c.depts = [...c.depts, "Ban giám đốc"];
      syncDepts(c.depts);
      const needOtMig = !Array.isArray(c.otBands);   // v6.3: cấu hình cũ → khung tăng ca chung (quản lý mở app sẽ tự lưu)
      const mig = migrateOtCfg(c); c = mig.cfg; setOtPending(needOtMig ? mig.moved : -1);
      syncRoles(c.roles); syncOtBands(c);
      syncLeave(c.leaveTypes);
      c.phases = Array.isArray(c.phases) && c.phases.length ? c.phases : DEFAULT_PHASES.map((x) => ({ ...x }));
      syncPhases(c.phases);
      setIdlePending(!c.tasks.some((t) => t.id === IDLE_TASK_ID));
      c = withIdleTask(c);
      setCfg(c); setLoadFailed(false);
      return true;
    } catch {
      // Không vào app với cấu hình rỗng: bấm Lưu lúc đó sẽ đè lên dữ liệu thật
      setCfg(null); setLoadFailed(true);
      return false;
    }
  }, []);

  /* Vào app sau khi có danh tính: tải dữ liệu rồi mở đúng màn hình theo quyền */
  const enter = useCallback(async (w) => {
    setBooting(true);
    setWho(w); setTab(w.access === "admin" || w.access === "bod" ? "dash" : "ts");
    await openData();
    setBooting(false);
  }, [openData]);

  /* v2.6 — Thông báo nhắc nộp bảng công. Đã cho phép thì lưu trình duyệt này lên server (mỗi lần mở app).
     Người đang đăng nhập sẵn từ trước (không bấm Đăng nhập lại) thì trình duyệt hỏi ở cú bấm đầu tiên trong app. */
  useEffect(() => {
    if (!who) return;
    syncPush();
    if (pushPermission() !== "default") return;
    const once = () => { askPermission(); window.removeEventListener("pointerdown", once, true); window.removeEventListener("keydown", once, true); };
    window.addEventListener("pointerdown", once, true);
    window.addEventListener("keydown", once, true);
    return () => { window.removeEventListener("pointerdown", once, true); window.removeEventListener("keydown", once, true); };
  }, [who?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      // Khởi động phải luôn kết thúc, kể cả khi lưu trữ hỏng — nếu không app đứng mãi ở màn hình chờ
      let w = null;
      try { w = await currentUser(); } catch { /* coi như chưa đăng nhập */ }
      if (w) await enter(w); else setBooting(false);
    })();
  }, [enter]);

  /* v1.9 — Tự cập nhật bảng công khi tab đang hiện: quản lý 10 giây một lần để thấy ngay giờ mọi người vừa gửi;
     nhân sự 60 giây một lần và khi quay lại tab, để thấy tuần vừa được quản lý mở khoá. */
  /* v2.2 — quản lý 30 giây/lần (trước 10 giây), nhân sự 60 giây/lần. Máy để yên quá 10 phút thì ngừng hỏi,
     chạm chuột / gõ phím lại là hỏi ngay. Mất mạng thì 10 giây thử lại một lần để biết khi nào có mạng lại. */
  useEffect(() => {
    if (!who || !cfg) return;
    let last = Date.now();
    const IDLE = 10 * 60 * 1000;
    const visible = () => document.visibilityState === "visible";
    const tick = () => { if (visible() && Date.now() - last < IDLE) pullTs(); };
    const wake = () => { const idle = Date.now() - last >= IDLE; last = Date.now(); if (idle && visible()) pullTs(); };
    const now = () => { last = Date.now(); if (visible()) pullTs(); };
    const id = setInterval(tick, who.access !== "emp" ? 30000 : 60000);   // v7.3: Admin / BOD / Trưởng phòng 30 giây
    const probe = setInterval(() => { if (!NET_OK && visible()) pullTs(); }, 10000);
    document.addEventListener("visibilitychange", now);
    window.addEventListener("focus", now);
    window.addEventListener("online", now);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearInterval(id); clearInterval(probe);
      document.removeEventListener("visibilitychange", now); window.removeEventListener("focus", now); window.removeEventListener("online", now);
      window.removeEventListener("pointerdown", wake); window.removeEventListener("keydown", wake);
    };
  }, [who?.userId, who?.access, !!cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCfg = useCallback(async (next) => {
    next = withIdleTask(next);   // v7.2: Trống việc luôn có mặt và đứng đầu
    setCfg(next);
    const merged = await commitConfig(next);
    if (!merged) {
      // báo lỗi SAU các thông báo "Đã lưu…" mà nơi gọi có thể hiện ngay sau lệnh này, để lỗi không bị che
      setTimeout(() => flash(`Không lưu được thiết lập — ${LAST_STORAGE_ERROR || "thử lại"}`, "err"), 50);
      return false;
    }
    setCfg(withIdleTask(merged));   // bản đã gộp: có thể kèm phần quản lý khác vừa sửa
    return true;
  }, [flash]);

  /* v6.3 — quản lý mở bản mới lần đầu: lưu cấu hình đã chuyển sang khung tăng ca chung */
  useEffect(() => {
    if (!cfg || !who?.admin || (OT_PENDING < 0 && !IDLE_PENDING)) return;
    const n = OT_PENDING; setOtPending(-1); setIdlePending(false);
    saveCfg(cfg).then((ok) => {
      if (!ok) { setOtPending(n); setIdlePending(true); return; }
      if (n < 0) return;   // v7.2: chỉ lưu thêm tác vụ Trống việc
      setOtMigNote(n ? `Đã chuyển ${n} hạng mục [OT] theo vai trò sang ${cfg.otBands.length} khung tăng ca chung (khớp theo giờ). Giờ OT đã chấm giữ nguyên; các hạng mục [OT] cũ đã gỡ khỏi tab Tác vụ.` : "");
      if (n) flash("Tăng ca đã chuyển thành cài đặt chung — xem Thiết lập → Tăng ca.");
    });
  }, [cfg, who?.admin]); // eslint-disable-line react-hooks/exhaustive-deps

  syncDepts(cfg?.depts);
  syncLeave(cfg?.leaveTypes);
  syncOtBands(cfg);
  syncRoles(cfg?.roles);   // đồng bộ trước khi các màn con render (cfg còn null lúc app vừa mở)
  syncHolidays(cfg?.holidays);   // v13.10: mọi lịch tự vẽ khoanh đỏ ngày lễ
  syncPhases(cfg?.phases);

  const signOut = async () => {
    await authSignOut();
    resetDB();
    setWho(null); setCfg(null); setLoadFailed(false); setSheetDirty(false); setPendingTab(null);
  };

  /* Danh tính dùng trong app, suy ra từ tài khoản (v7.3: 4 cấp quyền):
     · Admin -> khu vực quản lý, toàn quyền
     · BOD -> Dashboard + Bảng công toàn công ty, chỉ xem (gắn nhân sự thì chấm công của mình như nhân viên)
     · Trưởng phòng -> chấm công của mình + Bảng công nhân viên cùng phòng ban (xem và sửa)
     · Nhân viên -> bảng công của đúng nhân sự gắn với tài khoản đó */
  const myEmp = who?.empId && cfg ? cfg.employees.find((e) => e.id === who.empId) || null : null;
  const me = !who || !cfg ? null
    : who.access === "admin" ? { type: "admin", empId: myEmp?.id || null }
    : who.access === "bod" ? { type: "bod", empId: myEmp?.id || null }
    : myEmp ? { type: who.access === "head" ? "head" : "emp", empId: myEmp.id, dept: myEmp.dept || "" } : null;
  // trưởng phòng: Bảng công chỉ gồm nhân viên cùng phòng (trừ chính mình) — database cũng chỉ cho đọc/ghi đúng phạm vi này
  const headCfg = useMemo(() => (me?.type === "head" && cfg
    ? (() => {
      const emps = cfg.employees.filter((e) => me.dept && e.dept === me.dept && e.id !== me.empId);
      const ids = new Set(emps.map((e) => e.id));
      return { ...cfg, employees: emps, support: supportList(cfg).filter((x) => ids.has(x.empId)) };   // v10.0: không lộ đợt hỗ trợ của phòng khác
    })() : null),
  [cfg, me?.type, me?.dept, me?.empId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* v12.25 — Dashboard của trưởng phòng: nhân sự phòng mình, GỒM cả chính họ.
     headCfg (dùng cho Bảng công) cố tình loại chính trưởng phòng ra vì bảng công của họ theo luật nhân viên;
     còn Ma trận là để nhìn phòng, thiếu chính họ thì tổng của phòng bị hụt. Database vốn đã cho họ đọc giờ của mình. */
  const headDashCfg = useMemo(() => (me?.type === "head" && cfg
    ? { ...cfg, employees: cfg.employees.filter((e) => me.dept && e.dept === me.dept) }
    : null),
  [cfg, me?.type, me?.dept]);
  const bodSave = useCallback(async () => { flash("Tài khoản BOD chỉ xem, không sửa được.", "err"); return false; }, [flash]);
  /* v12.19 — BOD sửa được mục Kế hoạch như Admin. Lưới đi qua artius_plan_set (SQL cho phép Admin + BOD);
     phần thiết lập của Kế hoạch (ẩn dự án, gộp vai trò, khối tổng, hệ số sẵn sàng) chỉ ghi khoá "planning"
     của thiết lập chung qua hàm artius_planning_set — BOD vẫn không đổi được phần thiết lập nào khác. */
  const bodPlanSave = useCallback(async (next) => {
    try {
      const { data, error } = await supabase.rpc("artius_planning_set", { p_planning: next?.planning || {} });
      if (error) throw error;
      setCfg((c) => (c ? { ...c, planning: data && typeof data === "object" ? data : next.planning } : c));
      return true;
    } catch (e) {
      const m = String(e?.message || e || "");
      flash(/artius_planning_set|function|schema cache/i.test(m) && !/Admin|BOD/.test(m) ? "Chưa bật được: Admin cần chạy file supabase/v12_19_bod_ke_hoach.sql trên Supabase." : `Chưa lưu được — ${m}`, "err");
      return false;
    }
  }, [flash]);
  /* v9.3 — trưởng phòng "lưu thiết lập" ở tab Dự án / Nhân sự: chỉ được đổi dự án tham gia (projects, allProjects) của nhân viên phòng mình.
     So bản mới với headCfg; mỗi người thay đổi ghi qua hàm SQL artius_emp_projects_set. Đổi gì khác → báo chỉ xem. */
  const headSave = useCallback(async (next) => {
    if (!headCfg) return false;
    const before = new Map(headCfg.employees.map((e) => [e.id, e]));
    const changed = [];
    for (const e of next.employees || []) {
      const b = before.get(e.id);
      if (!b) { flash("Trưởng phòng không thêm được nhân sự.", "err"); return false; }
      const { projects: p1, allProjects: a1, ...r1 } = e, { projects: p2, allProjects: a2, ...r2 } = b;
      if (JSON.stringify(r1) !== JSON.stringify(r2)) { flash("Trưởng phòng chỉ giao / gỡ dự án cho nhân viên, không sửa được thông tin khác.", "err"); return false; }
      if (JSON.stringify(p1 || []) !== JSON.stringify(p2 || []) || !!a1 !== !!a2) changed.push(e);
    }
    const { employees: ne, ...restN } = next, { employees: oe, ...restO } = headCfg;   // eslint-disable-line no-unused-vars
    if (JSON.stringify(restN) !== JSON.stringify(restO)) { flash("Trưởng phòng chỉ xem dự án, chỉ thêm / gỡ nhân sự phòng mình.", "err"); return false; }
    try {
      for (const e of changed) {
        const { error } = await supabase.rpc("artius_emp_projects_set", { p_emp: e.id, p_projects: Array.isArray(e.projects) ? e.projects : [], p_all: !!e.allProjects });
        if (error) throw error;
        setCfg((c) => (c ? { ...c, employees: c.employees.map((x) => { if (x.id !== e.id) return x; const { allProjects, ...rest } = x; return { ...rest, projects: Array.isArray(e.projects) ? e.projects : [], ...(e.allProjects ? { allProjects: true } : {}) }; }) } : c));   // eslint-disable-line no-unused-vars
      }
      return true;
    } catch (err) {
      const m = String(err?.message || err || "");
      flash(/artius_emp_projects_set|schema cache|function/i.test(m) && !/phòng/.test(m) ? "Chưa bật được: Admin cần chạy file supabase/v9_3_truong_phong.sql trên Supabase." : `Chưa lưu được — ${m}`, "err");
      return false;
    }
  }, [headCfg, flash]);
  /* v8.7 — ghi một đợt hỗ trợ dự án. Admin: lưu thẳng thiết lập. Trưởng phòng: qua hàm SQL artius_support_set (chỉ nhân viên phòng mình). */
  const supportSave = useCallback(async (item, remove = false) => {
    const msg = remove ? "Đã huỷ đợt hỗ trợ." : "Đã lưu hỗ trợ dự án.";
    if (me?.type === "admin") {
      const list = supportList(cfg).filter((x) => x.id !== item.id);
      const ok = await saveCfg({ ...cfg, support: remove ? list : [...list, { ...item, by: who?.username || "", at: new Date().toISOString() }] });
      if (ok !== false) flash(msg);
      return ok !== false;
    }
    if (me?.type !== "head") { flash("Chỉ Admin hoặc trưởng phòng được mở hỗ trợ dự án.", "err"); return false; }
    try {
      const { data, error } = await supabase.rpc("artius_support_set", { p_item: item, p_remove: remove });
      if (error) throw error;
      setCfg((c) => (c ? { ...c, support: Array.isArray(data) ? data : [] } : c));
      flash(msg);
      return true;
    } catch (e) {
      const m = String(e?.message || e || "");
      flash(/artius_support_set|function|schema cache/i.test(m) && !/Trưởng phòng|nhân viên/.test(m) ? "Chưa bật được: Admin cần chạy file supabase/v8_7_ho_tro_du_an.sql trên Supabase." : `Chưa lưu được — ${m}`, "err");
      return false;
    }
  }, [me?.type, cfg, saveCfg, flash, who?.username]);
  const orphan = !!who && !!cfg && !me;   // tài khoản thường nhưng nhân sự gắn kèm đã bị xoá

  /* v4.1 — Bấm thông báo nhắc khi app ĐANG MỞ: service worker gửi tin sang đây thay vì tải lại trang.
     Đang ở màn Chấm công thì chuyển tuần (vẫn hỏi lại nếu còn giờ chưa gửi); ở màn khác thì mở màn Chấm công đúng tuần đó. */
  const navRef = useRef(null);
  navRef.current = { me, tab, go };
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (ev) => {
      if (ev.data?.type !== "artius-open") return;
      let t = "";
      try { t = new URL(ev.data.url).searchParams.get("tuan") || ""; } catch { /* bỏ qua */ }
      const { me: m, tab: cur, go: goTab } = navRef.current || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || m?.type !== "emp") return;
      if (cur === "ts") window.dispatchEvent(new CustomEvent("artius:tuan", { detail: t }));
      else {
        try { window.history.replaceState(null, "", `${window.location.pathname}?tuan=${t}`); } catch { /* bỏ qua */ }
        goTab("ts");
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  if (booting) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
      <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /><span className="text-sm">Đang tải dữ liệu…</span></div>
    </div>
  );

  /* v12 — tab Kế hoạch bật / tắt trong Thiết lập; tắt thì tab biến mất, phần còn lại chạy như chưa có gì */
  const planOn = cfg?.planning?.enabled !== false;
  /* v12.22 — tab "Tổng quan nguồn lực" đọc lưới kế hoạch, nên tắt mục Kế hoạch thì cũng ẩn tab này */
  const dashTabs = planOn ? DASH_TABS : DASH_TABS.filter((t) => t !== "res");
  const railItems = me?.type === "admin"
    ? [["dash", "Dashboard", LayoutDashboard], ...(planOn ? [["plan", "Kế hoạch", CalendarDays]] : []),   // v12.21: Kế hoạch lên trên Bảng công
       ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban],
       ["emp", "Nhân sự", Users], ["set", "Thiết lập", Settings]]   // v12.21: Tác vụ gộp vào Nhân sự (tab con)
    : me?.type === "bod"
      ? [["dash", "Dashboard", LayoutDashboard], ...(planOn ? [["plan", "Kế hoạch", CalendarDays]] : []),
         ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban],
         ["emp", "Nhân sự", Users], ["set", "Thiết lập", Settings],
         ...(me.empId ? [["ts", "Chấm công", Clock], ["eset", "Cài đặt", Settings]] : [])]
    : me?.type === "head"
      ? [["ts", "Chấm công", Clock], ["edash", "Dashboard", LayoutDashboard], ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban], ["emp", "Nhân sự", Users], ["eset", "Cài đặt", Settings]]   // v9.3: + Dự án, Nhân sự (phòng mình)
    : me ? [["ts", "Chấm công", Clock], ["edash", "Dashboard", LayoutDashboard], ["eset", "Cài đặt", Settings]] : [];

  /* v8.4 — điện thoại: tài khoản có tab Cài đặt cá nhân → header chỉ còn logo + vòng tròn chữ cái tên (bấm mở Tài khoản);
     Sáng/Tối và Đăng xuất chuyển vào Tài khoản, menu đáy bỏ nút Thoát */
  const hasAcct = railItems.some(([k]) => k === "eset");
  const initials = String(myEmp?.name || who?.username || "?").trim().split(/\s+/).slice(-2).map((w) => w[0] || "").join("").toUpperCase();

  // v7.6: Admin · BOD · Trưởng phòng — full màn hình + menu dọc bám khung; nhân viên giữ tab ngang trên header; mọi tài khoản full màn hình
  const isMgr = !!me && ["admin", "bod", "head"].includes(me.type);

  const pageTitle = { dash: "Dashboard giờ công", sheet: "Bảng công nhân sự", proj: "Dự án", emp: "Nhân sự", task: "Tác vụ công việc theo vai trò", set: "Thiết lập", ts: "", edash: "Dashboard cá nhân", eset: "Cài đặt cá nhân" }[tab];

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      <style>{`
        /* Một font duy nhất cho cả chữ lẫn số: Inter, cắt gọn còn ASCII + trọn bộ tiếng Việt.
           Số 0 của Inter là hình bầu dục rỗng, không chấm không gạch — đã kiểm bằng cách đếm
           đường viền glyph. Nhúng thẳng vào file nên hiển thị giống hệt nhau trên mọi máy. */
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,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) format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,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) format("woff2");
          font-weight: 500 900; font-style: normal; font-display: swap;
        }
        :root, body, input, select, textarea, button, optgroup {
          font-family: "ARTIUS", system-ui, "Segoe UI", Roboto, Arial, sans-serif;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
        }
        /* font-mono nay chỉ còn nhiệm vụ giãn chữ cho cột số dễ đọc, không đổi mặt chữ nữa */
        .font-mono, code, kbd, pre, samp { font-family: inherit; letter-spacing: 0.02em; }

        /* Ẩn mũi tên tăng/giảm của ô nhập số — gõ thẳng con số, không bấm mũi tên */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

        /* v13.31 — số tháng trên nút "Excel tăng ca": mode sáng đổi sang teal đậm cho đủ tương phản
           (teal-300 vốn dành cho nền tối, nằm trên nền trắng thì mờ) */
        html[data-theme="light"] .ot-ym { color: #0f766e; }

        /* v13.48 — ba ngày cuối tháng: nút "Excel tăng ca" sáng nhịp nhẹ để nhớ xuất trước khi chốt công.
           Cùng cách làm với nút bút chì ở Chấm công; máy bật "giảm chuyển động" thì quầng sáng đứng yên. */
        .ot-glow { border-color: #14b8a6 !important; color: #5eead4 !important; background: rgba(20,184,166,.12) !important; animation: otGlow 2.4s ease-in-out infinite; }
        .ot-glow:hover { background: rgba(20,184,166,.24) !important; color: #99f6e4 !important; }
        @keyframes otGlow { 0%,100% { box-shadow: 0 0 5px rgba(45,212,191,.30); } 50% { box-shadow: 0 0 0 3px rgba(45,212,191,.16), 0 0 13px rgba(45,212,191,.55); } }
        html[data-theme="light"] .ot-glow { border-color: #0d9488 !important; color: #0f766e !important; background: #f0fdfa !important; animation-name: otGlowL; }
        html[data-theme="light"] .ot-glow:hover { background: #ccfbf1 !important; }
        @keyframes otGlowL { 0%,100% { box-shadow: 0 0 5px rgba(13,148,136,.25); } 50% { box-shadow: 0 0 0 3px rgba(13,148,136,.14), 0 0 12px rgba(13,148,136,.45); } }
        @media (prefers-reduced-motion: reduce) { .ot-glow { animation: none !important; box-shadow: 0 0 8px rgba(45,212,191,.45); } }

        /* v13.51 — ổ khoá ở Bảng công sáng xanh nhẹ khi tuần đó đang được mở cho nhân sự. */
        .lock-on { background: rgba(20,184,166,.14); animation: lockOn 2.6s ease-in-out infinite; }
        .lock-on:hover { background: rgba(20,184,166,.26) !important; color: #99f6e4 !important; }
        @keyframes lockOn { 0%,100% { box-shadow: 0 0 4px rgba(45,212,191,.28); } 50% { box-shadow: 0 0 0 3px rgba(45,212,191,.15), 0 0 12px rgba(45,212,191,.5); } }
        html[data-theme="light"] .lock-on { background: #f0fdfa; border-color: #0d9488 !important; color: #0f766e !important; animation-name: lockOnL; }
        html[data-theme="light"] .lock-on:hover { background: #ccfbf1 !important; }
        @keyframes lockOnL { 0%,100% { box-shadow: 0 0 4px rgba(13,148,136,.24); } 50% { box-shadow: 0 0 0 3px rgba(13,148,136,.13), 0 0 11px rgba(13,148,136,.42); } }
        @media (prefers-reduced-motion: reduce) { .lock-on { animation: none !important; box-shadow: 0 0 8px rgba(45,212,191,.42); } }

        /* v7.9 — rê chuột vào ô ngày (Bảng công Tuần/Tháng, Lịch tháng cá nhân): viền xanh lá nhạt bám theo góc bo của ô */
        .cell-hov { position: relative; }
        .cell-hov:hover { outline: 2px solid #86efac; outline-offset: 1px; z-index: 2; }
        html[data-theme="light"] .cell-hov:hover { outline-color: #4ade80; }

        /* v7.8 — nền chung cho giao diện Sáng (phần còn lại do LIGHT_CSS đảo màu các class Tailwind) */
        html[data-theme="light"] body { background: #f1f5f9; color: #0f172a; }

        /* v7.8 — BOD chỉ xem: ẩn hẳn nút / ô thêm-sửa-xoá-lưu; nút trạng thái (Đang mở, Đang chấm công, công tắc) chỉ hiển thị, không bấm được */
        .artius-ro button:has(> svg.lucide-pencil), .artius-ro button:has(> svg.lucide-trash2), .artius-ro button:has(> svg.lucide-trash-2),
        .artius-ro button:has(> svg.lucide-plus), .artius-ro button:has(> svg.lucide-x), .artius-ro button:has(> svg.lucide-eye-off),
        .artius-ro button:has(> svg.lucide-eye), .artius-ro button:has(> svg.lucide-save), .artius-ro button:has(> svg.lucide-send),
        .artius-ro button:has(> svg.lucide-rotate-ccw), .artius-ro .ro-hide,
        .artius-ro div:has(> input[placeholder="Mã DA"]), .artius-ro div:has(> input[placeholder$="rồi Enter"]),
        .artius-ro div:has(> input[placeholder^="Mã, ví dụ"]), .artius-ro div:has(> input[placeholder^="Quốc khánh"]),
        .artius-ro div:has(> input[placeholder^="Gõ XOA"]), .artius-ro div:has(> textarea),
        .artius-ro div:has(> label > input[type="checkbox"]) { display: none !important; }
        .artius-ro button:has(> svg.lucide-lock), .artius-ro button:has(> svg.lucide-lock-open), .artius-ro button.appearance-none.rounded-full,
        .artius-ro .ro-static { pointer-events: none; }
        html[data-theme="light"] ::selection { background: #99f6e4; color: #0f172a; }
      `}{LIGHT_CSS}</style>
      {/* v7.5: bỏ thanh menu dọc bên trái trên máy tính — tab chuyển lên header (tab ngang) */}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-800">
          {/* v7.6: header full màn hình (bỏ giới hạn 1520px của v7.5) */}
          <div className="relative flex w-full items-center justify-between px-4 py-3 md:px-6 md:py-3.5">
            <div className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-4">
              {/* v7.5: tab ngang (máy tính). Màn hẹp chỉ hiện icon (rê chuột xem tên); chữ hiện từ xl (≤ 4 tab) / 2xl (Admin 6 tab) để không đè logo giữa */}
              {me && !isMgr && (
                <nav className="hidden items-center gap-0.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1 md:flex">
                  {railItems.map(([k, label, Icon]) => (
                    <button key={k} onClick={() => go(k)} title={label}
                      className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${tab === k ? "bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-500/40" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"}`}>
                      <Icon size={16} className="shrink-0" />
                      <span className={`whitespace-nowrap ${railItems.length > 4 ? "hidden 2xl:inline" : "hidden xl:inline"}`}>{label}</span>
                    </button>
                  ))}
                </nav>
              )}
              {hasAcct && <BrandLogo className="h-8 w-auto md:hidden" />}
              <span className={`font-mono text-sm tracking-[0.3em] text-slate-100 ${hasAcct ? "hidden" : me ? "md:hidden" : ""}`}>ARTIUS</span>
              {/* máy tính đã đăng nhập: tên trang thể hiện bằng tab đang chọn → ẩn dòng tiêu đề; điện thoại giữ như cũ */}
              <span className={`truncate text-xs text-slate-500 ${hasAcct ? "hidden" : me && !isMgr ? "md:hidden" : ""}`}>{me ? pageTitle : "Quản lý giờ công dự án"}</span>
            </div>
            {/* logo chữ ở giữa header = giữa cửa sổ trình duyệt */}
            {me && <BrandLogo className="pointer-events-none absolute left-1/2 top-1/2 hidden h-9 w-auto -translate-x-1/2 -translate-y-1/2 md:block" />}
            <div className="flex min-w-0 items-center">
              <InstallButton />
              {/* v13.30 — Excel tăng ca: ghi rõ tháng sẽ xuất ngay trên nút, tránh xuất nhầm tháng */}
              {(tab === "ts" || tab === "edash") && otBtn && (
                <button onClick={otBtn.run} disabled={otBtn.busy}
                  title={`Xuất bảng chấm công ngoài giờ tháng ${otBtn.ym.slice(5)}/${otBtn.ym.slice(0, 4)} theo mẫu giấy công ty — chỉ gồm giờ đã gửi${otGlow ? " · sắp hết tháng, nhớ xuất" : ""}`}
                  className={`mr-2 hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 md:inline-flex${otGlow ? " ot-glow" : ""}`}>
                  {otBtn.busy ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                  Excel tăng ca <span className="ot-ym font-mono font-semibold text-teal-300">{otBtn.ym.slice(5)}/{otBtn.ym.slice(0, 4)}</span>
                </button>
              )}
              <span className={hasAcct ? "hidden md:contents" : "contents"}><ThemeToggle /></span>
              {me?.type === "bod" && ["dash", "sheet", "proj", "emp", "set"].includes(tab) && (
                <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-900 bg-violet-950/60 px-2 py-1 text-[11px] text-violet-200" title="Tài khoản BOD xem được mục này nhưng không chỉnh sửa được">
                  <Eye size={12} /> Chế độ chỉ xem
                </span>
              )}
              {me && <span className={`ml-3 shrink-0 truncate text-xs text-slate-400 ${hasAcct ? "hidden md:inline" : ""}`}>{myEmp?.name || who.username}</span>}
              {hasAcct && (
                <button onClick={() => go("eset")} title="Tài khoản" aria-label="Tài khoản"
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white md:hidden"
                  style={{ background: "linear-gradient(135deg,#06b6d4,#4f46e5)" }}>{initials}</button>
              )}
              {me && !isMgr && <span className="ml-3 hidden select-none font-mono text-[10px] text-slate-600 md:inline">{APP_VERSION}</span>}
              {me && !isMgr && (
                <button onClick={signOut} title="Thoát khỏi app" className="ml-3 hidden h-9 items-center gap-1.5 rounded-lg border border-rose-900/80 bg-rose-950/50 px-3 text-sm text-rose-300 transition-colors hover:border-rose-600 hover:bg-rose-900/60 hover:text-rose-100 md:flex">
                  <LogOut size={15} /> Thoát
                </button>
              )}
            </div>
          </div>
        </header>

        {/* v7.6: quản lý — menu dọc dạng thẻ bám mép trái khung nội dung (full màn hình); nhân viên — "contents" giữ bố cục v7.5 */}
        <div className={isMgr ? "flex min-w-0 flex-1 md:gap-5 md:px-6 md:pt-5" : "contents"}>
        {isMgr && (
          <nav className="sticky top-5 hidden h-fit w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-2 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)] md:flex">
            {railItems.map(([k, label, Icon]) => (
              <button key={k} onClick={() => go(k)} title={label}
                className={`flex w-full flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${tab === k ? "bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-500/40" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`}>
                <Icon size={18} />
                <span className="w-full truncate px-0.5 text-center text-[10px] leading-none">{label}</span>
              </button>
            ))}
            <div className="my-1 h-px w-8 bg-slate-800" />
            <button onClick={signOut} title="Thoát khỏi app" className="flex w-full flex-col items-center gap-1 rounded-xl border border-rose-900/80 bg-rose-950/50 py-2.5 text-rose-300 transition-colors hover:border-rose-600 hover:bg-rose-900/60 hover:text-rose-100">
              <LogOut size={18} />
              <span className="text-[10px] leading-none">Thoát</span>
            </button>
            <div className="mt-1 select-none font-mono text-[9px] text-slate-600">{APP_VERSION}</div>
          </nav>
        )}
        <main className={`min-w-0 flex-1 px-3 pb-28 pt-4 ${isMgr ? "md:px-0 md:pb-24 md:pt-0" : "md:px-6 md:pb-24 md:pt-5"}`}>
          <ConfirmDialog
            open={pendingTab !== null}
            title="Rời khỏi bảng công khi chưa lưu?"
desc={me?.type === "admin" || (me?.type === "head" && tab === "sheet") ? "Giờ vừa sửa sẽ mất. Bấm Giữ lại để quay về bảng công và bấm Lưu trước." : "Giờ bạn vừa nhập chưa gửi nên sẽ mất. Bấm Giữ lại để quay về bảng công và bấm Gửi trước."}
            confirmLabel="Rời đi, bỏ thay đổi"
            onConfirm={() => { setSheetDirty(false); setTab(pendingTab); setPendingTab(null); }}
            onCancel={() => setPendingTab(null)}
          />
          <StorageBanner />

          {!who ? <SignIn onSignedIn={enter} flash={flash} />
            : !me ? (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 md:mt-10 md:p-6">
                <div className="flex items-center gap-2 text-sm text-rose-300"><AlertTriangle size={16} className="shrink-0" />
                  {orphan ? "Tài khoản này chưa gắn với nhân sự nào." : "Không tải được dữ liệu."}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {loadFailed ? <button onClick={() => enter(who)} className={btnPrimary}><RotateCcw size={14} /> Thử lại</button> : <span />}
                  <button onClick={signOut} className={btnGhost}><LogOut size={14} /> Đăng xuất</button>
                </div>
              </div>
            )
            : me.type === "bod" ? (
              <>
                {tab === "dash" && <Dashboard cfg={cfg} saveCfg={bodSave} flash={flash} tabs={dashTabs} />}
                {tab === "sheet" && <SheetArea cfg={cfg} saveCfg={bodSave} flash={flash}><AdminTimesheet cfg={cfg} flash={flash} onDirtyChange={setSheetDirty} readOnly onSupport={bodSave} /></SheetArea>}
                {/* v7.7 — BOD xem được mọi mục quản lý nhưng không sửa: mọi lệnh lưu cấu hình bị chặn bởi bodSave */}
                {tab === "proj" && <ReadOnlyView><Projects cfg={cfg} saveCfg={bodSave} flash={flash} onSupport={bodSave} supportRo /></ReadOnlyView>}
                {tab === "emp" && <EmpArea emp={<ReadOnlyView><Employees cfg={cfg} saveCfg={bodSave} flash={flash} readOnly onSupport={bodSave} /></ReadOnlyView>}
                  task={<ReadOnlyView><Tasks cfg={cfg} saveCfg={bodSave} flash={flash} /></ReadOnlyView>} />}
                {tab === "set" && <ReadOnlyView><SettingsTab cfg={cfg} saveCfg={bodSave} flash={flash} /></ReadOnlyView>}
                {tab === "plan" && <PlanPane cfg={cfg} saveCfg={bodPlanSave} flash={flash} />}
                {tab === "ts" && me.empId && <EmployeeArea key={tsMonday || "now"} cfg={cfg} empId={me.empId} flash={flash} onDirtyChange={setSheetDirty} onOtReady={setOtBtn} initialMonday={tsMonday} mgrOk />}
                {tab === "eset" && me.empId && <EmployeeSettings cfg={cfg} empId={me.empId} onSignOut={signOut} />}
              </>
            )
            : me.type === "admin" ? (
              <>
                {tab === "dash" && <Dashboard cfg={cfg} saveCfg={saveCfg} flash={flash} tabs={dashTabs} />}
                {tab === "sheet" && <SheetArea cfg={cfg} saveCfg={saveCfg} flash={flash}><AdminTimesheet cfg={cfg} flash={flash} onDirtyChange={setSheetDirty} onSupport={supportSave} pastLockSave={saveCfg} /></SheetArea>}
                {tab === "proj" && <Projects cfg={cfg} saveCfg={saveCfg} flash={flash} onSupport={supportSave} />}
                {tab === "emp" && <EmpArea emp={<Employees cfg={cfg} saveCfg={saveCfg} flash={flash} onSupport={supportSave} />}
                  task={<Tasks cfg={cfg} saveCfg={saveCfg} flash={flash} />} />}
                {tab === "plan" && <PlanPane cfg={cfg} saveCfg={saveCfg} flash={flash} canSaveProjects />}
                {tab === "set" && <SettingsTab cfg={cfg} saveCfg={saveCfg} flash={flash} />}
              </>
            ) : (
              <>
                {tab === "ts" && <EmployeeArea key={tsMonday || "now"} cfg={cfg} empId={me.empId} flash={flash} onDirtyChange={setSheetDirty} onOtReady={setOtBtn} initialMonday={tsMonday} mgrOk={me.type === "head"} />}
                {/* v12.25 — trưởng phòng: tab Dashboard có thanh tab con Của tôi | Dự án | Ma trận.
                    Nhân viên thường vẫn chỉ có Dashboard cá nhân như cũ. */}
                {tab === "edash" && (me.type === "head" && headDashCfg
                  ? <HeadDashArea cfg={headDashCfg} flash={flash}
                      me={<EmployeeDashboard cfg={cfg} empId={me.empId} flash={flash} onOtReady={setOtBtn} onGoTimesheet={(mon) => { setTsMonday(mon || null); setTab("ts"); }} />} />
                  : <EmployeeDashboard cfg={cfg} empId={me.empId} flash={flash} onOtReady={setOtBtn} onGoTimesheet={(mon) => { setTsMonday(mon || null); setTab("ts"); }} />)}
                {tab === "eset" && <EmployeeSettings cfg={cfg} empId={me.empId} onSignOut={signOut} />}
                {/* v13.7 — trưởng phòng thấy đủ 3 tab con của Bảng công; Nhân sự và Giờ ngoài dự án chỉ xem, nhân sự phòng mình gồm cả trưởng phòng */}
                {tab === "sheet" && me.type === "head" && headCfg && <SheetArea cfg={headDashCfg || headCfg} flash={flash}><AdminTimesheet cfg={headCfg} flash={flash} onDirtyChange={setSheetDirty} oneDept onSupport={supportSave} /></SheetArea>}
                {/* v9.3 — trưởng phòng: Dự án (chỉ xem, thêm / gỡ nhân sự phòng mình) · Nhân sự (phòng mình, giao dự án; không xem tài khoản / mật khẩu) */}
                {tab === "proj" && me.type === "head" && headCfg && <ReadOnlyView><Projects cfg={headCfg} saveCfg={headSave} flash={flash} onSupport={supportSave} /></ReadOnlyView>}
                {tab === "emp" && me.type === "head" && headCfg && <Employees cfg={headCfg} saveCfg={headSave} flash={flash} limited />}
              </>
            )}
        </main>
        </div>
      </div>

      {me && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950 md:hidden">
          {railItems.map(([k, label, Icon]) => {
            const acct = k === "eset";   // v8.4: Cài đặt → "Tài khoản" (có Sáng/Tối, Đăng xuất)
            const Ic = acct ? User : Icon;
            return (
              <button key={k} onClick={() => go(k)}
                className={`flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 ${tab === k ? "text-teal-400" : "text-slate-500"}`}>
                <Ic size={19} /><span className={`text-[10px] leading-none ${tab === k ? "font-semibold" : ""}`}>{acct ? "Tài khoản" : label}</span>
              </button>
            );
          })}
          {!hasAcct && (
            <button onClick={signOut} className="flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-rose-400">
              <LogOut size={19} /><span className="text-[10px] leading-none">Thoát</span>
            </button>
          )}
        </nav>
      )}

      {/* Ghi chú phiên bản: màn đăng nhập thì ở góc trái dưới; đã đăng nhập thì nằm trên header cạnh tên (máy tính, v7.5), ẩn trên mobile */}
      {!me && (
        <div className="pointer-events-none fixed bottom-1.5 left-2 z-30 select-none font-mono text-[10px] text-slate-600">
          ARTIUS {APP_VERSION}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 md:bottom-6">
          <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white shadow-xl ${toast.kind === "err" ? "bg-rose-600" : "bg-teal-600"}`}>
            {toast.kind === "err" ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

/* Cảnh báo về sức khoẻ lưu trữ: sắp chạm hạn mức lệnh, hoặc đã chạm và cần tải lại trang */
export function StorageBanner() {
  const { limited } = useStorageHealth();
  const net = useNet();
  if (!net) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100 md:mb-4" role="status">
      <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-400" />
      <div><b>Mất kết nối tới máy chủ — đang thử lại.</b> Giờ đang nhập vẫn giữ trên màn hình; có mạng lại app tự gửi phần đang chờ.</div>
    </div>
  );

  if (!STORAGE_OK) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
      <div><b>Không truy cập được bộ nhớ lưu trữ.</b> Mọi thứ bạn nhập sẽ mất khi tải lại trang. Thử mở app ở tab trình duyệt thường và bật cookie cho trang này.</div>
    </div>
  );

  if (limited) return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="shrink-0 text-rose-400" />
      <div className="min-w-0 flex-1">
        <b>Đã chạm hạn mức lệnh của phiên làm việc.</b> Không lưu được nữa cho tới khi tải lại trang.
        Nếu đang có giờ chưa lưu, chụp màn hình lại trước khi tải lại.
      </div>
      <button onClick={() => window.location.reload()} className={`shrink-0 ${btnDanger}`}>
        <RotateCcw size={14} /> Tải lại trang
      </button>
    </div>
  );

  return null;
}

/* v12.20 — tab Bảng công của Admin / BOD có thanh tab con: Bảng công | Nhân sự | Giờ ngoài dự án.
   "Nhân sự" và "Giờ ngoài dự án" chuyển từ Dashboard sang (Dashboard còn Dự án | Ma trận).
   Bảng công luôn giữ nguyên trong bộ nhớ khi xem tab khác, để không mất phần đang sửa dở. */
const DASH_TABS = ["res", "proj", "mtx"];   // v12.22: Tổng quan nguồn lực đứng đầu
/* v13.27 — bỏ tab con "Nhân sự" (ppl): bảng chi tiết bấm vào tên trong Bảng công đã thay được phần đó */
const SHEET_TABS = [["sheet", "Bảng công"], ["off", "Giờ ngoài dự án"]];
function SheetArea({ cfg, saveCfg, flash, children }) {
  const [sub, setSub0] = useState(() => { try { const v = localStorage.getItem("artius.sheetTab"); return SHEET_TABS.some(([k]) => k === v) ? v : "sheet"; } catch { return "sheet"; } });
  const setSub = (t) => { setSub0(t); try { localStorage.setItem("artius.sheetTab", t); } catch { /* bỏ qua */ } };
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 md:inline-flex">
        {SHEET_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} aria-pressed={sub === k}
            className={`${CTRL} flex flex-1 items-center justify-center rounded-lg px-6 text-sm font-medium md:flex-none ${sub === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>
      <div className={sub === "sheet" ? "" : "hidden"}>{children}</div>
      {sub !== "sheet" && <Dashboard key={sub} cfg={cfg} saveCfg={saveCfg} flash={flash} tabs={[sub]} hideBar />}
    </div>
  );
}

/* v12.21 — mục Nhân sự của Admin / BOD gộp thêm Tác vụ: thanh tab con Nhân sự | Tác vụ (cả hai giữ trong bộ nhớ khi chuyển qua lại) */
const EMP_TABS = [["emp", "Nhân sự"], ["task", "Tác vụ"]];
/* v12.25 — Dashboard của trưởng phòng. "Của tôi" là Dashboard cá nhân sẵn có;
   "Dự án" và "Ma trận" dùng lại đúng Dashboard quản lý, mỗi lần một tab (tabs={[sub]} hideBar) như SheetArea.
   Chỉ xem: không truyền saveCfg, nên nút Urgent trên Tiến độ dự án tự tắt. */
const HEAD_DASH_TABS = [["me", "Của tôi"], ["proj", "Dự án"], ["mtx", "Ma trận"]];
function HeadDashArea({ cfg, flash, me }) {
  const [sub, setSub0] = useState(() => { try { const v = localStorage.getItem("artius.headDashTab"); return ["me", "proj", "mtx"].includes(v) ? v : "me"; } catch { return "me"; } });
  const setSub = (t) => { setSub0(t); try { localStorage.setItem("artius.headDashTab", t); } catch { /* bỏ qua */ } };
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 md:inline-flex">
        {HEAD_DASH_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} aria-pressed={sub === k}
            className={`${CTRL} flex flex-1 items-center justify-center rounded-lg px-6 text-sm font-medium md:flex-none ${sub === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>
      {/* không truyền saveCfg: hai tab này chỉ xem. ProjectProgress tự tắt nút Urgent khi thiếu saveCfg,
          nếu truyền headSave vào thì nó so với headCfg (vốn không có chính trưởng phòng) và báo nhầm
          "Trưởng phòng không thêm được nhân sự". */}
      {sub === "me" ? me : <Dashboard key={sub} cfg={cfg} flash={flash} tabs={[sub]} hideBar />}
    </div>
  );
}

function EmpArea({ emp, task }) {
  const [sub, setSub0] = useState(() => { try { return localStorage.getItem("artius.empTab") === "task" ? "task" : "emp"; } catch { return "emp"; } });
  const [seen, setSeen] = useState(() => new Set([sub]));
  const setSub = (t) => { setSub0(t); setSeen((s) => new Set([...s, t])); try { localStorage.setItem("artius.empTab", t); } catch { /* bỏ qua */ } };
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 md:inline-flex">
        {EMP_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} aria-pressed={sub === k}
            className={`${CTRL} flex flex-1 items-center justify-center rounded-lg px-6 text-sm font-medium md:flex-none ${sub === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>
      {seen.has("emp") && <div className={sub === "emp" ? "" : "hidden"}>{emp}</div>}
      {seen.has("task") && <div className={sub === "task" ? "" : "hidden"}>{task}</div>}
    </div>
  );
}

/* v7.7 — Khung "chỉ xem" cho BOD (nhãn "Chế độ chỉ xem" hiện ở header cạnh tên tài khoản): ô nhập/chọn không thao tác được; lưu cấu hình đã bị chặn ở bodSave */
export function ReadOnlyView({ children }) {
  return (
    <div>
      <div className="artius-ro [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none">{children}</div>
    </div>
  );
}

