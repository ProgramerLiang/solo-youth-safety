package com.solo.youth.safety;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.telephony.SmsManager;
import android.text.TextUtils;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(
    name = "EmergencyActions",
    permissions = {
        @Permission(alias = "call", strings = { Manifest.permission.CALL_PHONE }),
        @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS })
    }
)
public class EmergencyActionsPlugin extends Plugin {
    private static final String TAG = "EmergencyActionsPlugin";
    private static final String ALIAS_CALL = "call";
    private static final String ALIAS_SMS = "sms";

    @PluginMethod
    public void triggerEmergency(PluginCall call) {
        String[] missingAliases = getMissingAliases(call);
        if (missingAliases.length > 0) {
            requestPermissionForAliases(missingAliases, call, "completeTriggerEmergency");
            return;
        }
        performEmergency(call);
    }

    @PermissionCallback
    private void completeTriggerEmergency(PluginCall call) {
        performEmergency(call);
    }

    private void performEmergency(PluginCall call) {
        String callNumber = normalizeNumber(call.getString("callNumber", ""));
        String smsNumber = normalizeNumber(call.getString("smsNumber", ""));
        String smsBody = normalizeBody(call.getString("smsBody", ""));

        JSArray logs = new JSArray();
        logs.put(sendSms(smsNumber, smsBody));
        logs.put(startPhoneCall(callNumber));

        JSObject result = new JSObject();
        result.put("logs", logs);
        result.put("permissions", buildPermissionSummary());
        call.resolve(result);
    }

    private String[] getMissingAliases(PluginCall call) {
        List<String> aliases = new ArrayList<>();
        if (!normalizeNumber(call.getString("smsNumber", "")).isEmpty() && getPermissionState(ALIAS_SMS) != PermissionState.GRANTED) {
            aliases.add(ALIAS_SMS);
        }
        if (!normalizeNumber(call.getString("callNumber", "")).isEmpty() && getPermissionState(ALIAS_CALL) != PermissionState.GRANTED) {
            aliases.add(ALIAS_CALL);
        }
        return aliases.toArray(new String[0]);
    }

    @SuppressWarnings("deprecation")
    private JSObject sendSms(String number, String message) {
        if (number.isEmpty()) {
            return buildLog("sms", "skipped", "smsNumber is empty");
        }
        if (message.isEmpty()) {
            return buildLog("sms", "failed", "smsBody is empty");
        }
        if (getPermissionState(ALIAS_SMS) != PermissionState.GRANTED) {
            return buildLog("sms", "failed", "SEND_SMS permission denied");
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.isEmpty()) {
                parts.add(message);
            }
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(number, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(number, null, parts.get(0), null, null);
            }
            Log.i(TAG, "SMS dispatch invoked for " + number + ", parts=" + parts.size());
            return buildLog("sms", "dispatched", "SmsManager invoked: " + number + ", parts=" + parts.size());
        } catch (Exception error) {
            Log.e(TAG, "SMS dispatch failed for " + number, error);
            return buildLog("sms", "failed", "SmsManager failed: " + error.getMessage());
        }
    }

    private JSObject startPhoneCall(String number) {
        if (number.isEmpty()) {
            return buildLog("call", "skipped", "callNumber is empty");
        }
        if (getPermissionState(ALIAS_CALL) != PermissionState.GRANTED) {
            return buildLog("call", "failed", "CALL_PHONE permission denied");
        }

        Intent intent = new Intent(Intent.ACTION_CALL);
        intent.setData(Uri.fromParts("tel", number, null));
        return launchCallIntent(intent, number);
    }

    private JSObject launchCallIntent(Intent intent, String number) {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<JSObject> resultRef = new AtomicReference<>();

        bridge.executeOnMainThread(() -> {
            try {
                getActivity().startActivity(intent);
                Log.i(TAG, "ACTION_CALL launched for " + number);
                resultRef.set(buildLog("call", "triggered", "ACTION_CALL launched: " + number));
            } catch (ActivityNotFoundException error) {
                Log.e(TAG, "No call activity found for " + number, error);
                resultRef.set(buildLog("call", "failed", "No call activity found: " + error.getMessage()));
            } catch (SecurityException error) {
                Log.e(TAG, "CALL_PHONE denied for " + number, error);
                resultRef.set(buildLog("call", "failed", "CALL_PHONE denied: " + error.getMessage()));
            } catch (Exception error) {
                Log.e(TAG, "Unexpected call failure for " + number, error);
                resultRef.set(buildLog("call", "failed", "Call launch failed: " + error.getMessage()));
            } finally {
                latch.countDown();
            }
        });

        try {
            if (!latch.await(2, TimeUnit.SECONDS)) {
                Log.w(TAG, "Timed out waiting for ACTION_CALL launch result for " + number);
                return buildLog("call", "failed", "Timed out waiting for ACTION_CALL launch result");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            Log.e(TAG, "Interrupted while waiting for ACTION_CALL launch", error);
            return buildLog("call", "failed", "Interrupted while waiting for ACTION_CALL launch");
        }

        JSObject result = resultRef.get();
        return result != null ? result : buildLog("call", "failed", "Unknown ACTION_CALL launch result");
    }

    private JSObject buildPermissionSummary() {
        JSObject permissions = new JSObject();
        permissions.put(ALIAS_CALL, getPermissionState(ALIAS_CALL).toString());
        permissions.put(ALIAS_SMS, getPermissionState(ALIAS_SMS).toString());
        return permissions;
    }

    private JSObject buildLog(String channel, String status, String detail) {
        JSObject log = new JSObject();
        log.put("channel", channel);
        log.put("status", status);
        log.put("detail", detail);
        return log;
    }

    private String normalizeNumber(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeBody(String value) {
        return TextUtils.isEmpty(value) ? "" : value.trim();
    }
}
