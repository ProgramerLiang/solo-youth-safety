package com.solo.youth.safety;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MaterialThemeBridgePlugin.class);
        registerPlugin(EmergencyActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
