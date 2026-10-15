/* ARTIUS v2.6 — Service worker: chỉ dùng để nhận và hiện thông báo nhắc nộp bảng công.
   Không cache trang, không chặn mạng — app vẫn tải bình thường như trước.
   v4.1: đăng ký ngay khi mở app (không chờ cho phép thông báo) để trình duyệt cho "Cài đặt ứng dụng". */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ARTIUS", {
    body: d.body || "Bạn còn ngày chưa gửi giờ công.",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: "artius-nhac",          // cùng tag: thông báo mới thay thông báo cũ, không xếp chồng
    renotify: true,
    requireInteraction: true,    // trên máy tính: giữ trên màn hình tới khi người dùng bấm hoặc đóng
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    // App đang mở thì chỉ đưa lên trước, KHÔNG tải lại trang — tránh mất giờ đang nhập dở chưa gửi.
    // v4.1: báo cho app đang mở chuyển tới đúng tuần cần gửi (app tự hỏi lại nếu còn giờ chưa gửi).
    if (open) {
      await open.focus();
      try { open.postMessage({ type: "artius-open", url }); } catch { /* bỏ qua */ }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
