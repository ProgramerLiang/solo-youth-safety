package com.solo.youth.safety;

import android.os.Bundle;
import android.os.Build;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MaterialThemeBridgePlugin.class);
        registerPlugin(EmergencyActionsPlugin.class);
        registerPlugin(SystemLocationBridgePlugin.class);
        registerPlugin(StartupPermissionsPlugin.class);
        registerPlugin(NativeExportPlugin.class);
        super.onCreate(savedInstanceState);

        // 启用沉浸式（边缘到边缘）显示
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        }
    }
}
