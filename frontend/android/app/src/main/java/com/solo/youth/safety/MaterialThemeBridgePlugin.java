package com.solo.youth.safety;

import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "MaterialThemeBridge")
public class MaterialThemeBridgePlugin extends Plugin {
    @PluginMethod
    public void getDynamicColorInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("sdkInt", Build.VERSION.SDK_INT);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            result.put("supported", false);
            result.put("seedColor", "");
            result.put("source", "unsupported");
            call.resolve(result);
            return;
        }

        try {
            int color = ContextCompat.getColor(getContext(), android.R.color.system_accent1_500);
            result.put("supported", true);
            result.put("seedColor", toHex(color));
            result.put("source", "android-wallpaper");
            call.resolve(result);
        } catch (Exception error) {
            result.put("supported", false);
            result.put("seedColor", "");
            result.put("source", "lookup-failed");
            call.resolve(result);
        }
    }

    private String toHex(int color) {
        return String.format(Locale.US, "#%06X", (0xFFFFFF & color));
    }
}
