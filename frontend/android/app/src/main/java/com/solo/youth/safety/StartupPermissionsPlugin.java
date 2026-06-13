package com.solo.youth.safety;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "StartupPermissions",
    permissions = {
        @Permission(alias = "fineLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "coarseLocation", strings = { Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "storage", strings = {
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        })
    }
)
public class StartupPermissionsPlugin extends Plugin {
    private static final String ALIAS_FINE_LOCATION = "fineLocation";
    private static final String ALIAS_COARSE_LOCATION = "coarseLocation";
    private static final String ALIAS_STORAGE = "storage";

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("location", getLocationEntry());
        result.put("backgroundRun", getBackgroundRunEntry());
        result.put("storage", getStorageEntry());
        call.resolve(result);
    }

    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (isLocationGranted()) {
            call.resolve(entry("granted", "定位权限已授权"));
            return;
        }
        requestPermissionForAliases(new String[] { ALIAS_FINE_LOCATION, ALIAS_COARSE_LOCATION }, call, "locationPermsCallback");
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        call.resolve(getLocationEntry());
    }

    @PluginMethod
    public void requestBackgroundRun(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(entry("notRequired", "当前 Android 版本无需电池优化例外"));
            return;
        }
        if (isIgnoringBatteryOptimizations()) {
            call.resolve(entry("granted", "系统已允许忽略电池优化"));
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve(entry("manual", "已打开系统设置，请手动允许后台运行"));
        } catch (ActivityNotFoundException | SecurityException error) {
            openApplicationSettings();
            call.resolve(entry("manual", "已打开应用设置，请手动检查后台运行/省电策略"));
        }
    }

    @PluginMethod
    public void requestStorage(PluginCall call) {
        if (!requiresLegacyStoragePermission()) {
            call.resolve(entry("notRequired", "当前 Android 版本导出无需广泛存储权限"));
            return;
        }
        if (isStorageGranted()) {
            call.resolve(entry("granted", "存储访问权限已授权"));
            return;
        }
        requestPermissionForAlias(ALIAS_STORAGE, call, "storagePermsCallback");
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        call.resolve(getStorageEntry());
    }

    private JSObject getLocationEntry() {
        if (isLocationGranted()) {
            return entry("granted", "定位权限已授权");
        }
        return entry("denied", "定位权限未授权");
    }

    private JSObject getBackgroundRunEntry() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return entry("notRequired", "当前 Android 版本无需电池优化例外");
        }
        if (isIgnoringBatteryOptimizations()) {
            return entry("granted", "系统已允许忽略电池优化");
        }
        return entry("manual", "需要在系统设置中允许后台运行或忽略电池优化");
    }

    private JSObject getStorageEntry() {
        if (!requiresLegacyStoragePermission()) {
            return entry("notRequired", "当前 Android 版本导出无需广泛存储权限");
        }
        if (isStorageGranted()) {
            return entry("granted", "存储访问权限已授权");
        }
        return entry("denied", "旧版 Android 需要存储访问权限才能写入公共目录");
    }

    private boolean isLocationGranted() {
        return getPermissionState(ALIAS_FINE_LOCATION) == PermissionState.GRANTED
            || getPermissionState(ALIAS_COARSE_LOCATION) == PermissionState.GRANTED;
    }

    private boolean isIgnoringBatteryOptimizations() {
        PowerManager powerManager = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        return powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    private boolean requiresLegacyStoragePermission() {
        return Build.VERSION.SDK_INT <= Build.VERSION_CODES.P;
    }

    private boolean isStorageGranted() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private void openApplicationSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
    }

    private JSObject entry(String state, String detail) {
        JSObject result = new JSObject();
        result.put("state", state);
        result.put("detail", detail);
        return result;
    }
}
