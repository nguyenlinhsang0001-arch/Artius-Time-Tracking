/* ============================================================
   Lớp thay thế window.storage cho bản webapp (Vercel)

   App v1.4 gọi window.storage.get / set / delete / list — API này chỉ có trong
   artifact của Claude. File này dựng lại đúng API đó để App không phải sửa dòng nào:
     · shared = true  -> bảng `artius_kv` trên Supabase (cả công ty dùng chung)
     · shared = false -> localStorage của trình duyệt (riêng từng máy: "tôi là ai",
                         các tuỳ chọn ẩn/hiện)

   QUAN TRỌNG: file này phải được import TRƯỚC App trong main.jsx, vì App kiểm tra
   `window.storage` ngay lúc nạp module (hằng STORAGE_OK).
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "artius_kv";
const LOCAL_NS = "artius:private:";

export const STORAGE_CONFIGURED = !!(URL && KEY);

if (STORAGE_CONFIGURED) {
  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  // Ký tự % và _ là ký tự đại diện của LIKE, phải thoát trước khi tìm theo tiền tố
  const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  const fail = (op, error) => new Error(`Supabase ${op}: ${error.message || error.code || "lỗi không rõ"}`);

  window.storage = {
    async get(key, shared = true) {
      if (!shared) {
        const value = localStorage.getItem(LOCAL_NS + key);
        // App nhận biết "khoá chưa tồn tại" qua chữ "not found" trong thông điệp lỗi
        if (value === null) throw new Error("Key not found");
        return { key, value, shared };
      }
      const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
      if (error) throw fail("get", error);
      if (!data) throw new Error("Key not found");
      return { key, value: data.value, shared };
    },

    async set(key, value, shared = true) {
      if (!shared) {
        localStorage.setItem(LOCAL_NS + key, value);
        return { key, value, shared };
      }
      const { error } = await supabase
        .from(TABLE)
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw fail("set", error);
      return { key, value, shared };
    },

    async delete(key, shared = true) {
      if (!shared) {
        localStorage.removeItem(LOCAL_NS + key);
        return { key, deleted: true, shared };
      }
      const { error } = await supabase.from(TABLE).delete().eq("key", key);
      if (error) throw fail("delete", error);
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = true) {
      if (!shared) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(LOCAL_NS + prefix)) keys.push(k.slice(LOCAL_NS.length));
        }
        return { keys, prefix, shared };
      }
      const { data, error } = await supabase.from(TABLE).select("key").like("key", `${escapeLike(prefix)}%`);
      if (error) throw fail("list", error);
      return { keys: (data || []).map((r) => r.key), prefix, shared };
    },
  };
}
