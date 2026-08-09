package com.solo.youth.safety;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "export.json");
        String mimeType = call.getString("mimeType", "application/json");
        String content = call.getString("content", "");
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Downloads.IS_PENDING, 1);
        }

        android.net.Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            call.resolve(result(false, null));
            return;
        }

        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) throw new IllegalStateException("Unable to open Downloads output");
            output.write(content.getBytes(StandardCharsets.UTF_8));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, ready, null, null);
            }
            call.resolve(result(true, "Downloads/" + fileName));
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            call.resolve(result(false, null));
        }
    }

    private JSObject result(boolean saved, String location) {
        JSObject result = new JSObject();
        result.put("saved", saved);
        result.put("location", location);
        return result;
    }
}
