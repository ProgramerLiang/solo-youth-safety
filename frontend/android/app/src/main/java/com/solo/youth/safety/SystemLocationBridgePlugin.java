package com.solo.youth.safety;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import androidx.core.os.CancellationSignal;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "SystemLocationBridge",
    permissions = {
        @Permission(
            alias = SystemLocationBridgePlugin.ALIAS_LOCATION,
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }
        ),
        @Permission(
            alias = SystemLocationBridgePlugin.ALIAS_COARSE_LOCATION,
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION }
        )
    }
)
public class SystemLocationBridgePlugin extends Plugin {
    public static final String ALIAS_LOCATION = "location";
    public static final String ALIAS_COARSE_LOCATION = "coarseLocation";

    private static final int DEFAULT_TIMEOUT_MS = 10000;
    private static final int MIN_TIMEOUT_MS = 1500;
    private JSObject lastAttempt = null;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (!isLocationServicesEnabled()) {
            rememberAttempt("preflight", false, "Location services are not enabled");
            call.reject("Location services are not enabled");
            return;
        }
        if (!hasRequiredPermission(call)) {
            rememberAttempt("permission", false, "Location permission was denied");
            call.reject("Location permission was denied");
            return;
        }

        int maximumAge = Math.max(call.getInt("maximumAge", 0), 0);
        Location cachedLocation = getBestLastKnownLocation(maximumAge);
        if (cachedLocation != null) {
            rememberAttempt("system-cache", true, null);
            call.resolve(toLocationResult(cachedLocation, "system-cache"));
            return;
        }

        requestCurrentLocation(call);
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("bridge", "system-location-manager");

        JSObject permissions = new JSObject();
        permissions.put("fine", permissionLabel(Manifest.permission.ACCESS_FINE_LOCATION));
        permissions.put("coarse", permissionLabel(Manifest.permission.ACCESS_COARSE_LOCATION));
        result.put("permissions", permissions);

        JSObject providers = new JSObject();
        providers.put("gps", isProviderEnabled(LocationManager.GPS_PROVIDER));
        providers.put("network", isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        result.put("providers", providers);

        JSObject device = new JSObject();
        device.put("sdkInt", Build.VERSION.SDK_INT);
        device.put("brand", Build.BRAND);
        device.put("manufacturer", Build.MANUFACTURER);
        device.put("model", Build.MODEL);
        result.put("device", device);

        result.put("lastAttempt", lastAttempt == null ? toAttemptDiagnostics("unknown", false, null) : lastAttempt);
        call.resolve(result);
    }

    private void requestCurrentLocation(PluginCall call) {
        String primaryProvider = choosePrimaryProvider(isHighAccuracyRequested(call));
        if (primaryProvider == null) {
            rememberAttempt("provider-selection", false, "location disabled");
            call.reject("location disabled");
            return;
        }

        String secondaryProvider = chooseSecondaryProvider(primaryProvider);
        int timeoutMs = Math.max(call.getInt("timeout", DEFAULT_TIMEOUT_MS), MIN_TIMEOUT_MS);
        requestLocationFromProvider(call, primaryProvider, timeoutMs, secondaryProvider);
    }

    private void requestLocationFromProvider(PluginCall call, String provider, int timeoutMs, String fallbackProvider) {
        LocationManager locationManager = getLocationManager();
        if (locationManager == null) {
            call.reject("location unavailable");
            return;
        }

        CancellationSignal cancellationSignal = new CancellationSignal();
        Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean completed = new AtomicBoolean(false);
        Runnable timeoutAction = () -> {
            if (completed.compareAndSet(false, true)) {
                cancellationSignal.cancel();
                onProviderFailure(call, fallbackProvider, timeoutMs, provider, "timeout");
            }
        };

        try {
            handler.postDelayed(timeoutAction, timeoutMs);
            LocationManagerCompat.getCurrentLocation(
                locationManager,
                provider,
                cancellationSignal,
                ContextCompat.getMainExecutor(getContext()),
                (location) -> {
                    if (!completed.compareAndSet(false, true)) {
                        return;
                    }
                    handler.removeCallbacks(timeoutAction);
                    if (location == null) {
                        onProviderFailure(call, fallbackProvider, timeoutMs, provider, "location unavailable");
                        return;
                    }
                    rememberAttempt("system-" + provider, true, null);
                    call.resolve(toLocationResult(location, "system"));
                }
            );
        } catch (SecurityException error) {
            handler.removeCallbacks(timeoutAction);
            onProviderFailure(call, fallbackProvider, timeoutMs, provider, "Location permission was denied");
        } catch (Exception error) {
            handler.removeCallbacks(timeoutAction);
            onProviderFailure(call, fallbackProvider, timeoutMs, provider, safeMessage(error));
        }
    }

    private void onProviderFailure(
        PluginCall call,
        String fallbackProvider,
        int timeoutMs,
        String failedProvider,
        String message
    ) {
        if (fallbackProvider == null || fallbackProvider.equals(failedProvider)) {
            rememberAttempt("system-" + failedProvider, false, message);
            call.reject(message);
            return;
        }
        requestLocationFromProvider(call, fallbackProvider, timeoutMs, null);
    }

    private boolean hasRequiredPermission(PluginCall call) {
        String alias = resolvePermissionAlias(call);
        return getPermissionState(alias) == PermissionState.GRANTED ||
            getPermissionState(ALIAS_COARSE_LOCATION) == PermissionState.GRANTED;
    }

    private String resolvePermissionAlias(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !call.getBoolean("enableHighAccuracy", false)) {
            return ALIAS_COARSE_LOCATION;
        }
        return ALIAS_LOCATION;
    }

    private boolean isHighAccuracyRequested(PluginCall call) {
        return call.getBoolean("enableHighAccuracy", false) &&
            getPermissionState(ALIAS_LOCATION) == PermissionState.GRANTED;
    }

    private String permissionLabel(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED ? "granted" : "denied";
    }

    private JSObject toAttemptDiagnostics(String strategy, boolean success, String error) {
        JSObject attempt = new JSObject();
        attempt.put("strategy", strategy);
        attempt.put("success", success);
        attempt.put("error", error);
        return attempt;
    }

    private void rememberAttempt(String strategy, boolean success, String error) {
        lastAttempt = toAttemptDiagnostics(strategy, success, error);
    }

    private boolean isLocationServicesEnabled() {
        LocationManager locationManager = getLocationManager();
        return locationManager != null && LocationManagerCompat.isLocationEnabled(locationManager);
    }

    private LocationManager getLocationManager() {
        return (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
    }

    private Location getBestLastKnownLocation(int maximumAgeMs) {
        if (maximumAgeMs == 0) {
            return null;
        }

        LocationManager locationManager = getLocationManager();
        if (locationManager == null) {
            return null;
        }

        List<String> providers = locationManager.getProviders(true);
        Location bestLocation = null;
        long now = System.currentTimeMillis();
        for (String provider : providers) {
            try {
                Location location = locationManager.getLastKnownLocation(provider);
                if (location == null) {
                    continue;
                }
                if (Math.max(now - location.getTime(), 0) > maximumAgeMs) {
                    continue;
                }
                if (isBetterLocation(location, bestLocation)) {
                    bestLocation = location;
                }
            } catch (SecurityException ignored) {
                return null;
            } catch (Exception ignored) {
                // ignore invalid provider state
            }
        }
        return bestLocation;
    }

    private boolean isBetterLocation(Location candidate, Location currentBest) {
        if (candidate == null) {
            return false;
        }
        if (currentBest == null) {
            return true;
        }

        float candidateAccuracy = candidate.hasAccuracy() ? candidate.getAccuracy() : Float.MAX_VALUE;
        float currentAccuracy = currentBest.hasAccuracy() ? currentBest.getAccuracy() : Float.MAX_VALUE;
        if (candidateAccuracy < currentAccuracy) {
            return true;
        }
        return candidateAccuracy == currentAccuracy && candidate.getTime() > currentBest.getTime();
    }

    private String choosePrimaryProvider(boolean highAccuracy) {
        if (highAccuracy && isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            return LocationManager.NETWORK_PROVIDER;
        }
        if (isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
            return LocationManager.PASSIVE_PROVIDER;
        }
        return null;
    }

    private String chooseSecondaryProvider(String primaryProvider) {
        if (!LocationManager.NETWORK_PROVIDER.equals(primaryProvider) && isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            return LocationManager.NETWORK_PROVIDER;
        }
        if (!LocationManager.GPS_PROVIDER.equals(primaryProvider) && isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (!LocationManager.PASSIVE_PROVIDER.equals(primaryProvider) && isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
            return LocationManager.PASSIVE_PROVIDER;
        }
        return null;
    }

    private boolean isProviderEnabled(String provider) {
        LocationManager locationManager = getLocationManager();
        if (locationManager == null) {
            return false;
        }
        try {
            return locationManager.isProviderEnabled(provider);
        } catch (Exception error) {
            return false;
        }
    }

    private JSObject toLocationResult(Location location, String channel) {
        JSObject result = new JSObject();
        JSObject coords = new JSObject();
        result.put("coords", coords);
        result.put("timestamp", location.getTime());
        result.put("providerChannel", channel);
        result.put("providerName", location.getProvider() == null ? "system" : location.getProvider());
        coords.put("latitude", location.getLatitude());
        coords.put("longitude", location.getLongitude());
        coords.put("accuracy", location.getAccuracy());
        coords.put("altitude", location.getAltitude());
        coords.put("speed", location.getSpeed());
        coords.put("heading", location.getBearing());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            coords.put("altitudeAccuracy", location.getVerticalAccuracyMeters());
        }
        return result;
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? "location unavailable" : message;
    }
}
