package com.solo.youth.safety;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.os.Build;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "export.json");
        String mimeType = call.getString("mimeType", "application/json");
        String content = call.getString("content", "");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(call, fileName, mimeType, content);
        } else {
            saveViaLegacy(call, fileName, content);
        }
    }

    // Android 10+ (scoped storage): 通过 MediaStore.Downloads 写入
    private void saveViaMediaStore(PluginCall call, String fileName, String mimeType, String content) {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        // 必须显式声明相对路径,否则部分 ROM insert 返回 null 或落位不可预期
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        android.net.Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            call.resolve(result(false, null, "无法创建下载目录条目"));
            return;
        }

        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) throw new IllegalStateException("无法打开下载输出流");
            output.write(content.getBytes(StandardCharsets.UTF_8));
            output.flush();
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            call.resolve(result(false, null, "写入失败:" + error.getMessage()));
            return;
        }

        // 清除 pending 标志使文件对下载管理器可见;必须确认更新生效
        ContentValues ready = new ContentValues();
        ready.put(MediaStore.Downloads.IS_PENDING, 0);
        int updated = resolver.update(uri, ready, null, null);
        if (updated <= 0) {
            resolver.delete(uri, null, null);
            call.resolve(result(false, null, "无法发布导出文件"));
            return;
        }
        call.resolve(result(true, "Download/" + fileName, null));
    }

    // Android 9 及以下: 写入公共 Download 目录(清单已声明 WRITE_EXTERNAL_STORAGE maxSdkVersion=28)
    private void saveViaLegacy(PluginCall call, String fileName, String content) {
        try {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) {
                call.resolve(result(false, null, "无法访问下载目录"));
                return;
            }
            if (!dir.exists() && !dir.mkdirs()) {
                call.resolve(result(false, null, "无法创建下载目录"));
                return;
            }
            File out = new File(dir, fileName);
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }
            call.resolve(result(true, out.getAbsolutePath(), null));
        } catch (Exception error) {
            call.resolve(result(false, null, "写入失败:" + error.getMessage()));
        }
    }

    private JSObject result(boolean saved, String location, String error) {
        JSObject result = new JSObject();
        result.put("saved", saved);
        result.put("location", location);
        result.put("error", error);
        return result;
    }
}
